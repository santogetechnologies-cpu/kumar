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

export function getBillNetTotal(bill: Bill): number {
  const gross = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return gross - (gross * (bill.discountPct ?? 0)) / 100;
}

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
    createdAt: row.created_at,
  };
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
  refundItems: (billId: string, refunds: Array<{ medicineId: string | null; quantity: number; name: string }>) => Promise<void>;
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
    const { data: billRows, error: billErr } = await supabase
      .from("bills")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (billErr || !billRows) return;

    const billIds = billRows.map((b: any) => b.id);
    if (billIds.length === 0) { setBills([]); return; }

    const { data: itemRows, error: itemErr } = await supabase
      .from("bill_items")
      .select("*")
      .in("bill_id", billIds);
    if (itemErr) return;

    const itemsByBill = new Map<string, BillItem[]>();
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

    setBills(billRows.map((row: any) => mapBill(row, itemsByBill.get(row.id) ?? [])));
  };

  const addBill = useCallback(async (data: {
    patientName: string; patientId: string; doctorId?: string; doctorName: string;
    items: Array<{ medicineId: string; name: string; quantity: number; price: number; batchId?: string }>;
    total: number; discountPct: number; status: string; paymentMethod: string;
  }): Promise<Bill> => {
    const billId = "BILL-" + Date.now();
    const { error: billErr } = await supabase.from("bills").insert({
      id: billId,
      patient_name: data.patientName,
      patient_id: data.patientId,
      doctor_id: data.doctorId ?? null,
      doctor_name: data.doctorName,
      total: data.total,
      discount_pct: data.discountPct,
      status: data.status,
      payment_method: data.paymentMethod,
    });
    if (billErr) throw billErr;

    // Insert bill items
    const itemInserts = data.items.map((it) => ({
      bill_id: billId,
      medicine_id: it.medicineId,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      batch_id: it.batchId ?? null,
    }));
    const { error: itemErr } = await supabase.from("bill_items").insert(itemInserts);
    if (itemErr) throw itemErr;

    // Deduct stock from medicine rows (FIFO — handled by caller's breakdown)
    for (const it of data.items) {
      if (it.medicineId) {
        const { data: med } = await supabase
          .from("medicines")
          .select("pharmacy_quantity")
          .eq("id", it.medicineId)
          .single();
        if (med) {
          await supabase
            .from("medicines")
            .update({ pharmacy_quantity: Math.max(0, med.pharmacy_quantity - it.quantity) })
            .eq("id", it.medicineId);
        }
      }
    }

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
        batchId: it.batchId,
      })),
      total: data.total,
      discountPct: data.discountPct,
      status: data.status as Bill["status"],
      paymentMethod: data.paymentMethod,
      createdBy: "",
      createdAt: new Date().toISOString(),
    };

    setBills((prev) => [newBill, ...prev]);
    await loadMedicines(); // refresh stock
    return newBill;
  }, []);

  const refundItems = useCallback(async (
    billId: string,
    refunds: Array<{ medicineId: string | null; quantity: number; name: string }>
  ) => {
    // Update each bill_item refunded_quantity
    for (const ref of refunds) {
      if (!ref.medicineId) continue;
      const { data: items } = await supabase
        .from("bill_items")
        .select("id, refunded_quantity, quantity")
        .eq("bill_id", billId)
        .eq("medicine_id", ref.medicineId);
      const item = items?.[0];
      if (!item) continue;
      const newRefunded = Math.min(item.quantity, (item.refunded_quantity ?? 0) + ref.quantity);
      await supabase
        .from("bill_items")
        .update({ refunded_quantity: newRefunded })
        .eq("id", item.id);
      // Return to pharmacy stock
      const { data: med } = await supabase
        .from("medicines")
        .select("pharmacy_quantity")
        .eq("id", ref.medicineId)
        .single();
      if (med) {
        await supabase
          .from("medicines")
          .update({ pharmacy_quantity: med.pharmacy_quantity + ref.quantity })
          .eq("id", ref.medicineId);
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

    await loadBills();
    await loadMedicines();
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
      .order("created_at", { ascending: false })
      .limit(300);
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
    const { error } = await supabase.from("purchases").update({ status }).eq("id", id);
    if (error) throw error;

    // If marking as received, add stock to matching medicine/material
    if (status === "received") {
      const purchase = purchases.find((p) => p.id === id);
      if (purchase) {
        const totalQty = purchase.quantity + (purchase.free_quantity ?? 0);
        // Try medicines first, then materials
        const { data: meds } = await supabase
          .from("medicines")
          .select("id, main_quantity")
          .eq("name", purchase.item)
          .eq("archived", false);
        if (meds && meds.length > 0) {
          // Find matching batch if possible, else update first
          const matchBatch = meds.find(() => true); // simplified — add to first match
          if (matchBatch) {
            await supabase
              .from("medicines")
              .update({ main_quantity: matchBatch.main_quantity + totalQty })
              .eq("id", matchBatch.id);
          }
        } else {
          const { data: mats } = await supabase
            .from("materials")
            .select("id, main_quantity")
            .eq("name", purchase.item)
            .eq("archived", false);
          if (mats && mats.length > 0) {
            await supabase
              .from("materials")
              .update({ main_quantity: mats[0].main_quantity + totalQty })
              .eq("id", mats[0].id);
          }
        }
        await loadMedicines();
        await loadMaterials();
      }
    }

    await loadPurchases();
  }, [purchases]);

  const deletePurchase = useCallback(async (id: string, revertStock: boolean) => {
    if (revertStock) {
      const purchase = purchases.find((p) => p.id === id);
      if (purchase && purchase.status === "received") {
        const totalQty = purchase.quantity + (purchase.free_quantity ?? 0);
        const { data: meds } = await supabase
          .from("medicines")
          .select("id, main_quantity")
          .eq("name", purchase.item)
          .eq("archived", false);
        if (meds && meds.length > 0) {
          await supabase
            .from("medicines")
            .update({ main_quantity: Math.max(0, meds[0].main_quantity - totalQty) })
            .eq("id", meds[0].id);
          await loadMedicines();
        } else {
          const { data: mats } = await supabase
            .from("materials")
            .select("id, main_quantity")
            .eq("name", purchase.item)
            .eq("archived", false);
          if (mats && mats.length > 0) {
            await supabase
              .from("materials")
              .update({ main_quantity: Math.max(0, mats[0].main_quantity - totalQty) })
              .eq("id", mats[0].id);
            await loadMaterials();
          }
        }
      }
    }
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) throw error;
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  }, [purchases]);

  // ── STOCK TRANSFER ───────────────────────────
  const transferStock = useCallback(async (type: "medicine" | "material", id: string, qty: number) => {
    const table = type === "medicine" ? "medicines" : "materials";
    const { data: row } = await supabase
      .from(table)
      .select("main_quantity, pharmacy_quantity")
      .eq("id", id)
      .single();
    if (!row) throw new Error("Item not found");
    if (row.main_quantity < qty) throw new Error("Not enough main stock");
    const { error } = await supabase.from(table).update({
      main_quantity: row.main_quantity - qty,
      pharmacy_quantity: row.pharmacy_quantity + qty,
    }).eq("id", id);
    if (error) throw error;
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
      .order("created_at", { ascending: false })
      .limit(200);
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
