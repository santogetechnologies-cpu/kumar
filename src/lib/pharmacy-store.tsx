import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface Medicine {
  id: string;
  name: string;
  category: string;
  batch: string;
  expiry: string;
  mainQuantity: number;
  pharmacyQuantity: number;
  /** Hardcoded min level stored on the row (legacy / from purchase). */
  minLevel: number;
  /** Per-medicine override. If set, takes priority over generalMinStock. */
  customMinLevel: number | null;
  price: number;
  supplier: string;
  archived: boolean;
  createdAt: string;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  batch: string;
  expiry: string;
  mainQuantity: number;
  pharmacyQuantity: number;
  minLevel: number;
  customMinLevel: number | null;
  price: number;
  supplier: string;
  archived: boolean;
  createdAt: string;
}

export interface BillItem {
  medicineId: string | null;
  name: string;
  quantity: number;
  price: number;
  refundedQuantity: number;
  batchId?: string | null;
}

export interface Bill {
  id: string;
  patientName: string;
  patientId: string;
  doctorId?: string;
  doctorName: string;
  items: BillItem[];
  total: number;
  discountPct: number;
  status: "paid" | "pending" | "refunded" | "partially_refunded";
  paymentMethod: string;
  createdBy: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  item: string;
  supplier: string;
  quantity: number;
  received: number;
  cost: number;
  status: "pending" | "received" | "cancelled";
  invoice_no: string;
  free_quantity: number;
  discount_amount: number;
  mrp: number;
  batch?: string;
  expiry?: string;
  /** Inventory row this purchase was received into (set on receive). */
  targetId?: string;
  targetTable?: "medicines" | "materials";
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// UTILITY: Effective minimum stock for an item
// ─────────────────────────────────────────────

export function getEffectiveMinLevel(
  item: Pick<Medicine | Material, "customMinLevel" | "minLevel">,
  generalMinStock: number
): number {
  if (item.customMinLevel !== null && item.customMinLevel !== undefined) {
    return item.customMinLevel;
  }
  return generalMinStock;
}

// ─────────────────────────────────────────────
// UTILITY: Net total of a bill
// ─────────────────────────────────────────────

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Amount actually kept after discount AND refunds. Use this for all money totals. */
export function getBillNetTotal(bill: Bill): number {
  const gross = bill.items.reduce(
    (s, i) => s + i.price * Math.max(0, i.quantity - (i.refundedQuantity || 0)),
    0
  );
  return round2(gross * (1 - (bill.discountPct ?? 0) / 100));
}

/** Original amount charged at billing time (after discount, before refunds). */
export function getBillOriginalTotal(bill: Bill): number {
  const gross = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return round2(gross * (1 - (bill.discountPct ?? 0) / 100));
}

/** Normalise batch / name strings for matching ("  b12 " === "B12"). */
export const normKey = (s?: string | null) => (s ?? "").trim().toUpperCase();

// ─────────────────────────────────────────────
// DB ROW MAPPERS
// ─────────────────────────────────────────────

function mapMedicine(row: any): Medicine {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    batch: row.batch,
    expiry: row.expiry,
    mainQuantity: row.main_quantity,
    pharmacyQuantity: row.pharmacy_quantity,
    minLevel: row.min_level,
    customMinLevel: row.custom_min_level ?? null,
    price: parseFloat(row.price),
    supplier: row.supplier ?? "",
    archived: row.archived ?? false,
    createdAt: row.created_at,
  };
}

function mapMaterial(row: any): Material {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    batch: row.batch,
    expiry: row.expiry,
    mainQuantity: row.main_quantity,
    pharmacyQuantity: row.pharmacy_quantity,
    minLevel: row.min_level,
    customMinLevel: row.custom_min_level ?? null,
    price: parseFloat(row.price),
    supplier: row.supplier ?? "",
    archived: row.archived ?? false,
    createdAt: row.created_at,
  };
}

function mapBill(row: any, items: BillItem[]): Bill {
  return {
    id: row.id,
    patientName: row.patient_name,
    patientId: row.patient_id ?? "",
    doctorId: row.doctor_id ?? undefined,
    doctorName: row.doctor_name ?? "",
    items,
    total: parseFloat(row.total),
    discountPct: parseFloat(row.discount_pct ?? 0),
    status: row.status,
    paymentMethod: row.payment_method ?? "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
  };
}

function mapPurchase(row: any): Purchase {
  return {
    id: row.id,
    item: row.item,
    supplier: row.supplier,
    quantity: row.quantity,
    received: row.received,
    cost: parseFloat(row.cost),
    status: row.status,
    invoice_no: row.invoice_no ?? "",
    free_quantity: row.free_quantity ?? 0,
    discount_amount: parseFloat(row.discount_amount ?? 0),
    mrp: parseFloat(row.mrp ?? 0),
    batch: row.batch ?? undefined,
    expiry: row.expiry ?? undefined,
    targetId: row.target_id ?? undefined,
    targetTable: row.target_table ?? undefined,
    createdAt: row.created_at,
  };
}

/** Which inventory table an item id belongs to (looked up fresh from the DB). */
async function tableForItem(id: string): Promise<"medicines" | "materials" | null> {
  const { data: med } = await supabase.from("medicines").select("id").eq("id", id).maybeSingle();
  if (med) return "medicines";
  const { data: mat } = await supabase.from("materials").select("id").eq("id", id).maybeSingle();
  if (mat) return "materials";
  return null;
}

/** Atomic +/- stock change (main and/or pharmacy). Throws if stock would go negative. */
export async function adjustStock(
  table: "medicines" | "materials",
  id: string,
  mainDelta: number,
  pharmacyDelta: number
): Promise<void> {
  if (!mainDelta && !pharmacyDelta) return;
  const { error } = await supabase.rpc("adjust_stock", {
    p_table: table, p_id: id, p_main: mainDelta, p_pharmacy: pharmacyDelta,
  });
  if (error) throw error;
}

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────

interface PharmacyContextType {
  medicines: Medicine[];
  materials: Material[];
  bills: Bill[];
  purchases: Purchase[];
  doctors: Doctor[];
  expenses: Expense[];

  /** General (admin-level) minimum stock default */
  generalMinStock: number;

  // Settings
  canTransfer: boolean;
  autoPrint: boolean;
  printFormat: string;

  // Medicines
  addMedicine: (data: Omit<Medicine, "id" | "archived" | "createdAt" | "customMinLevel">) => Promise<void>;
  updateMedicine: (id: string, patch: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;

  // Materials
  addMaterial: (data: Omit<Material, "id" | "archived" | "createdAt" | "customMinLevel">) => Promise<void>;
  updateMaterial: (id: string, patch: Partial<Material>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;

  // Bills
  addBill: (data: {
    patientName: string; patientId: string; doctorId?: string; doctorName: string;
    items: Array<{ medicineId: string; name: string; quantity: number; price: number; batchId?: string }>;
    total: number; discountPct: number; status: string; paymentMethod: string;
  }) => Promise<Bill>;
  refundItems: (billId: string, refunds: Array<{ medicineId: string | null; quantity?: number; qty?: number; name?: string }>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;

  // Purchases
  addPurchase: (data: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  updatePurchaseStatus: (id: string, status: "pending" | "received" | "cancelled") => Promise<void>;
  deletePurchase: (id: string, revertStock: boolean) => Promise<void>;

  // Stock transfer
  transferStock: (type: "medicine" | "material", id: string, qty: number) => Promise<void>;

  // Doctors
  addDoctor: (data: { name: string; specialty: string }) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  toggleDoctor: (id: string) => Promise<void>;

  // Expenses
  addExpense: (data: { amount: number; description: string; category: string; date: string }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Settings
  updateSetting: (key: string, value: string) => Promise<void>;
  updateGeneralMinStock: (value: number) => Promise<void>;
  updateMedicineMinStock: (id: string, value: number | null, type?: "medicine" | "material") => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | null>(null);

export function usePharmacy() {
  const ctx = useContext(PharmacyContext);
  if (!ctx) throw new Error("usePharmacy must be used within PharmacyProvider");
  return ctx;
}

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Settings state
  const [canTransfer, setCanTransfer] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [printFormat, setPrintFormat] = useState("thermal");
  const [generalMinStock, setGeneralMinStock] = useState(10);

  // ── Load all data on mount ──────────────────
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadMedicines(),
      loadMaterials(),
      loadBills(),
      loadPurchases(),
      loadDoctors(),
      loadExpenses(),
      loadSettings(),
    ]);
  };

  // ── MEDICINES ───────────────────────────────
  const loadMedicines = async () => {
    const { data, error } = await supabase
      .from("medicines")
      .select("*")
      .eq("archived", false)
      .order("name");
    if (!error && data) setMedicines(data.map(mapMedicine));
  };

  const addMedicine = useCallback(async (data: Omit<Medicine, "id" | "archived" | "createdAt" | "customMinLevel">) => {
    const { error } = await supabase.from("medicines").insert({
      name: data.name,
      category: data.category,
      batch: data.batch,
      expiry: data.expiry,
      main_quantity: data.mainQuantity,
      pharmacy_quantity: data.pharmacyQuantity,
      min_level: data.minLevel,
      price: data.price,
      supplier: data.supplier,
    });
    if (error) throw error;
    await loadMedicines();
  }, []);

  const updateMedicine = useCallback(async (id: string, patch: Partial<Medicine>) => {
    const dbPatch: Record<string, any> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.batch !== undefined) dbPatch.batch = patch.batch;
    if (patch.expiry !== undefined) dbPatch.expiry = patch.expiry;
    if (patch.mainQuantity !== undefined) dbPatch.main_quantity = patch.mainQuantity;
    if (patch.pharmacyQuantity !== undefined) dbPatch.pharmacy_quantity = patch.pharmacyQuantity;
    if (patch.minLevel !== undefined) dbPatch.min_level = patch.minLevel;
    if (patch.customMinLevel !== undefined) dbPatch.custom_min_level = patch.customMinLevel;
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.supplier !== undefined) dbPatch.supplier = patch.supplier;
    if (patch.archived !== undefined) dbPatch.archived = patch.archived;
    const { error } = await supabase.from("medicines").update(dbPatch).eq("id", id);
    if (error) throw error;
    await loadMedicines();
  }, []);

  const deleteMedicine = useCallback(async (id: string) => {
    // Soft delete — archive so historical bill_items remain valid
    const { error } = await supabase.from("medicines").update({ archived: true }).eq("id", id);
    if (error) throw error;
    await loadMedicines();
  }, []);

  // ── MATERIALS ───────────────────────────────
  const loadMaterials = async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("archived", false)
      .order("name");
    if (!error && data) setMaterials(data.map(mapMaterial));
  };

  const addMaterial = useCallback(async (data: Omit<Material, "id" | "archived" | "createdAt" | "customMinLevel">) => {
    const { error } = await supabase.from("materials").insert({
      name: data.name,
      category: data.category,
      batch: data.batch,
      expiry: data.expiry,
      main_quantity: data.mainQuantity,
      pharmacy_quantity: data.pharmacyQuantity,
      min_level: data.minLevel,
      price: data.price,
      supplier: data.supplier,
    });
    if (error) throw error;
    await loadMaterials();
  }, []);

  const updateMaterial = useCallback(async (id: string, patch: Partial<Material>) => {
    const dbPatch: Record<string, any> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.batch !== undefined) dbPatch.batch = patch.batch;
    if (patch.expiry !== undefined) dbPatch.expiry = patch.expiry;
    if (patch.mainQuantity !== undefined) dbPatch.main_quantity = patch.mainQuantity;
    if (patch.pharmacyQuantity !== undefined) dbPatch.pharmacy_quantity = patch.pharmacyQuantity;
    if (patch.minLevel !== undefined) dbPatch.min_level = patch.minLevel;
    if (patch.customMinLevel !== undefined) dbPatch.custom_min_level = patch.customMinLevel;
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.supplier !== undefined) dbPatch.supplier = patch.supplier;
    if (patch.archived !== undefined) dbPatch.archived = patch.archived;
    const { error } = await supabase.from("materials").update(dbPatch).eq("id", id);
    if (error) throw error;
    await loadMaterials();
  }, []);

  const deleteMaterial = useCallback(async (id: string) => {
    // Soft delete for materials too (consistent, and safer if materials appear in bills)
    const { error } = await supabase.from("materials").update({ archived: true }).eq("id", id);
    if (error) throw error;
    await loadMaterials();
  }, []);

  // ── BILLS ────────────────────────────────────
  const loadBills = async () => {
    try {
      const { data: billRows, error: billErr } = await supabase
        .from("bills")
        .select("*")
        .order("created_at", { ascending: false });

      if (billErr || !billRows) {
        console.error("Error loading bills:", billErr);
        return;
      }

      if (billRows.length === 0) {
        setBills([]);
        return;
      }

      const billIds = billRows.map((b: any) => b.id);
      const itemsByBill = new Map<string, BillItem[]>();

      // Fetch items in batches of 50 to avoid URI length overflow and stay within PostgREST max_rows limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < billIds.length; i += BATCH_SIZE) {
        const batch = billIds.slice(i, i + BATCH_SIZE);
        const { data: itemRows, error: itemErr } = await supabase
          .from("bill_items")
          .select("*")
          .in("bill_id", batch);

        if (itemErr) {
          console.error("Error loading bill items batch:", itemErr);
          continue;
        }

        for (const item of itemRows ?? []) {
          if (!itemsByBill.has(item.bill_id)) itemsByBill.set(item.bill_id, []);
          itemsByBill.get(item.bill_id)!.push({
            medicineId: item.medicine_id,
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price),
            refundedQuantity: item.refunded_quantity ?? 0,
            batchId: item.batch_id ?? null,
          });
        }
      }

      setBills(billRows.map((row: any) => mapBill(row, itemsByBill.get(row.id) ?? [])));
    } catch (err) {
      console.error("Error loading bills:", err);
    }
  };

  const addBill = useCallback(async (data: {
    patientName: string; patientId: string; doctorId?: string; doctorName: string;
    items: Array<{ medicineId: string; name: string; quantity: number; price: number; batchId?: string }>;
    total: number; discountPct: number; status: string; paymentMethod: string;
  }): Promise<Bill> => {
    // Bill + items + stock deduction happen in ONE database transaction (create_bill RPC).
    // If any batch no longer has enough pharmacy stock, nothing is saved.
    const { data: billId, error: billErr } = await supabase.rpc("create_bill", {
      p_bill: {
        patient_name: data.patientName,
        patient_id: data.patientId,
        doctor_id: data.doctorId ?? "",
        doctor_name: data.doctorName,
        total: round2(data.total),
        discount_pct: data.discountPct,
        status: data.status,
        payment_method: data.paymentMethod,
      },
      p_items: data.items.map((it) => ({
        medicine_id: it.medicineId,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
      })),
    });
    if (billErr) throw billErr;
    if (!billId) throw new Error("Bill could not be created");

    const newBill: Bill = {
      id: billId,
      patientName: data.patientName,
      patientId: data.patientId,
      doctorId: data.doctorId,
      doctorName: data.doctorName,
      items: data.items.map((it) => ({
        medicineId: it.medicineId,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        refundedQuantity: 0,
        batchId: it.medicineId,
      })),
      total: round2(data.total),
      discountPct: data.discountPct,
      status: data.status as Bill["status"],
      paymentMethod: data.paymentMethod,
      createdBy: "",
      createdAt: new Date().toISOString(),
    };

    setBills((prev) => [newBill, ...prev]);
    await Promise.all([loadBills(), loadMedicines(), loadMaterials()]); // refresh stock
    return newBill;
  }, []);

  const refundItems = useCallback(async (
    billId: string,
    refunds: Array<{ medicineId: string | null; quantity?: number; qty?: number; name?: string }>
  ) => {
    // Update each bill_item refunded_quantity
    for (const ref of refunds) {
      if (!ref.medicineId) continue;
      const refQty = Number(ref.quantity ?? (ref as any).qty ?? 1);
      if (isNaN(refQty) || refQty <= 0) continue;

      const { data: items } = await supabase
        .from("bill_items")
        .select("id, refunded_quantity, quantity")
        .eq("bill_id", billId)
        .eq("medicine_id", ref.medicineId);
      const item = items?.[0];
      if (!item) continue;
      const currentRefunded = Number(item.refunded_quantity) || 0;
      // Never refund (or return to stock) more than was actually sold
      const actualQty = Math.min(refQty, item.quantity - currentRefunded);
      if (actualQty <= 0) continue;
      // Guard against a double refund: only update if nobody changed it since we read it
      let q = supabase
        .from("bill_items")
        .update({ refunded_quantity: currentRefunded + actualQty })
        .eq("id", item.id);
      q = item.refunded_quantity == null ? q.is("refunded_quantity", null) : q.eq("refunded_quantity", item.refunded_quantity);
      const { data: updated, error: upErr } = await q.select("id");
      if (upErr) throw upErr;
      if (!updated || updated.length === 0) {
        throw new Error("This item was just refunded from another screen. Please reload and try again.");
      }
      // Return to pharmacy stock atomically
      const table = await tableForItem(ref.medicineId);
      if (table) {
        const { error: stErr } = await supabase.rpc("adjust_stock", {
          p_table: table, p_id: ref.medicineId, p_main: 0, p_pharmacy: actualQty,
        });
        if (stErr) throw stErr;
      }
    }

    // Determine new bill status
    const { data: allItems } = await supabase
      .from("bill_items")
      .select("quantity, refunded_quantity")
      .eq("bill_id", billId);
    if (allItems) {
      const allRefunded = allItems.every((it: any) => it.refunded_quantity >= it.quantity);
      const newStatus = allRefunded ? "refunded" : "partially_refunded";
      await supabase.from("bills").update({ status: newStatus }).eq("id", billId);
    }

    await Promise.all([loadBills(), loadMedicines(), loadMaterials()]);
  }, []);

  const deleteBill = useCallback(async (id: string) => {
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) throw error;
    setBills((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── PURCHASES ────────────────────────────────
  const loadPurchases = async () => {
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setPurchases(data.map(mapPurchase));
  };

  const addPurchase = useCallback(async (data: Omit<Purchase, "id" | "createdAt">) => {
    const poId = "PO-" + Date.now();
    const { error } = await supabase.from("purchases").insert({
      id: poId,
      item: data.item,
      supplier: data.supplier,
      quantity: data.quantity,
      received: data.received,
      cost: data.cost,
      status: data.status,
      invoice_no: data.invoice_no,
      free_quantity: data.free_quantity,
      discount_amount: data.discount_amount,
      mrp: data.mrp,
      batch: data.batch ?? null,
      expiry: data.expiry ?? null,
    });
    if (error) throw error;
    await loadPurchases();
  }, []);

  const updatePurchaseStatus = useCallback(async (id: string, status: "pending" | "received" | "cancelled") => {
    if (status !== "received") {
      // Only pending orders can be cancelled / reset; never touches stock
      const { error } = await supabase.from("purchases").update({ status }).eq("id", id).eq("status", "pending");
      if (error) throw error;
      await loadPurchases();
      return;
    }

    // 1. Always read the purchase fresh from the DB (React state can be stale)
    const { data: row, error: pErr } = await supabase.from("purchases").select("*").eq("id", id).maybeSingle();
    if (pErr) throw pErr;
    if (!row) throw new Error("Purchase not found");
    const purchase = mapPurchase(row);
    if (purchase.status !== "pending") throw new Error("This purchase is already " + purchase.status);

    // 2. Validate — never invent a batch, expiry or price
    const batch = (purchase.batch ?? "").trim();
    const expiry = (purchase.expiry ?? "").trim();
    if (!(purchase.mrp > 0) || !batch || !expiry) {
      throw new Error("Purchase is missing MRP / Batch / Expiry — delete it and re-enter with all details before receiving");
    }

    // 3. Find the inventory row (same name, same batch ignoring case/spaces)
    const itemName = purchase.item.trim();
    let table: "medicines" | "materials" = "medicines";
    let { data: rows } = await supabase.from("medicines").select("*").ilike("name", itemName).eq("archived", false);
    if (!rows || rows.length === 0) {
      const { data: mats } = await supabase.from("materials").select("*").ilike("name", itemName).eq("archived", false);
      if (mats && mats.length > 0) { rows = mats; table = "materials"; }
    }

    let targetId: string;
    const match = (rows ?? []).find((r: any) => normKey(r.batch) === normKey(batch));
    if (match) {
      // Same batch → same MRP; refresh price & expiry from the invoice
      const { error } = await supabase.from(table).update({ price: purchase.mrp, expiry }).eq("id", match.id);
      if (error) throw error;
      targetId = match.id;
    } else {
      // New batch row (stock is added below by receive_purchase)
      const template: any = rows && rows.length > 0 ? rows[0] : null;
      const { data: inserted, error } = await supabase.from(table).insert({
        name: template ? template.name : itemName,
        category: template ? template.category : "Tablet",
        batch,
        expiry,
        main_quantity: 0,
        pharmacy_quantity: 0,
        min_level: template ? template.min_level : 10,
        custom_min_level: template ? template.custom_min_level : null,
        price: purchase.mrp,
        supplier: purchase.supplier || template?.supplier || "",
      }).select("id").single();
      if (error) throw error;
      targetId = inserted.id;
    }

    // 4. Flip status + add stock atomically, exactly once
    const { error: rErr } = await supabase.rpc("receive_purchase", {
      p_purchase_id: id, p_target_table: table, p_target_id: targetId,
    });
    if (rErr) throw rErr;

    await Promise.all([loadPurchases(), loadMedicines(), loadMaterials()]);
  }, []);

  const deletePurchase = useCallback(async (id: string, revertStock: boolean) => {
    if (revertStock) {
      const { data: row } = await supabase.from("purchases").select("*").eq("id", id).maybeSingle();
      const purchase = row ? mapPurchase(row) : null;
      if (purchase && purchase.status === "received") {
        if (!purchase.targetId || !purchase.targetTable) {
          throw new Error("This older purchase has no linked batch, so stock can't be reverted automatically. Untick 'revert stock' and adjust the batch stock manually.");
        }
        const totalQty = purchase.quantity + (purchase.free_quantity ?? 0);
        await adjustStock(purchase.targetTable, purchase.targetId, -totalQty, 0);
        await Promise.all([loadMedicines(), loadMaterials()]);
      }
    }
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) throw error;
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── STOCK TRANSFER ───────────────────────────
  const transferStock = useCallback(async (type: "medicine" | "material", id: string, qty: number) => {
    const table = type === "medicine" ? "medicines" : "materials";
    try {
      await adjustStock(table, id, -qty, qty);
    } catch (e: any) {
      throw new Error(e?.message?.includes("Insufficient") ? "Not enough main stock" : e?.message ?? "Transfer failed");
    }
    if (type === "medicine") await loadMedicines();
    else await loadMaterials();
  }, []);

  // ── DOCTORS ──────────────────────────────────
  const loadDoctors = async () => {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .order("name");
    if (!error && data) {
      setDoctors(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty ?? "",
        active: d.active,
      })));
    }
  };

  const addDoctor = useCallback(async (data: { name: string; specialty: string }) => {
    const { error } = await supabase.from("doctors").insert({
      name: data.name,
      specialty: data.specialty,
      active: true,
    });
    if (error) throw error;
    await loadDoctors();
  }, []);

  const deleteDoctor = useCallback(async (id: string) => {
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) throw error;
    setDoctors((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const toggleDoctor = useCallback(async (id: string) => {
    const doc = doctors.find((d) => d.id === id);
    if (!doc) return;
    const { error } = await supabase.from("doctors").update({ active: !doc.active }).eq("id", id);
    if (error) throw error;
    setDoctors((prev) => prev.map((d) => d.id === id ? { ...d, active: !d.active } : d));
  }, [doctors]);

  // ── EXPENSES ─────────────────────────────────
  const loadExpenses = async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setExpenses(data.map((e: any) => ({
        id: e.id,
        amount: parseFloat(e.amount),
        description: e.description,
        category: e.category,
        date: e.date,
        createdAt: e.created_at,
      })));
    }
  };

  const addExpense = useCallback(async (data: { amount: number; description: string; category: string; date: string }) => {
    const { error } = await supabase.from("expenses").insert({
      amount: data.amount,
      description: data.description,
      category: data.category,
      date: data.date,
    });
    if (error) throw error;
    await loadExpenses();
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── SETTINGS ─────────────────────────────────
  const loadSettings = async () => {
    const { data, error } = await supabase.from("settings").select("key, value");
    if (error || !data) return;
    const settingsMap = Object.fromEntries(data.map((s: any) => [s.key, s.value]));
    setCanTransfer(settingsMap["allow_pharmacist_transfer"] !== "false");
    setAutoPrint(settingsMap["auto_print"] === "true");
    setPrintFormat(settingsMap["print_format"] ?? "thermal");
    const gms = parseInt(settingsMap["general_min_stock"] ?? "10", 10);
    setGeneralMinStock(isNaN(gms) ? 10 : gms);
  };

  const updateSetting = useCallback(async (key: string, value: string) => {
    const { error } = await supabase
      .from("settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
    await loadSettings();
  }, []);

  const updateGeneralMinStock = useCallback(async (value: number) => {
    await updateSetting("general_min_stock", String(value));
  }, [updateSetting]);

  const updateMedicineMinStock = useCallback(async (
    id: string,
    value: number | null,
    type: "medicine" | "material" = "medicine"
  ) => {
    const table = type === "medicine" ? "medicines" : "materials";
    const { error } = await supabase
      .from(table)
      .update({ custom_min_level: value })
      .eq("id", id);
    if (error) throw error;
    if (type === "medicine") await loadMedicines();
    else await loadMaterials();
  }, []);

  // ─────────────────────────────────────────────
  const value: PharmacyContextType = {
    medicines,
    materials,
    bills,
    purchases,
    doctors,
    expenses,
    generalMinStock,
    canTransfer,
    autoPrint,
    printFormat,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addBill,
    refundItems,
    deleteBill,
    addPurchase,
    updatePurchaseStatus,
    deletePurchase,
    transferStock,
    addDoctor,
    deleteDoctor,
    toggleDoctor,
    addExpense,
    deleteExpense,
    updateSetting,
    updateGeneralMinStock,
    updateMedicineMinStock,
  };

  return (
    <PharmacyContext.Provider value={value}>
      {children}
    </PharmacyContext.Provider>
  );
}
