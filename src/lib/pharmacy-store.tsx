import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

/* ---------- Types ---------- */
export interface Medicine {
  id: string;
  name: string;
  category: string;
  batch: string;
  expiry: string;
  mainQuantity: number;
  pharmacyQuantity: number;
  minLevel: number;
  price: number;
  supplier?: string;
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
  price: number;
  supplier?: string;
}

export interface BillItem {
  id?: string;
  medicineId: string;
  name: string;
  quantity: number;
  refundedQuantity?: number;
  price: number;
}

export interface Bill {
  id: string;
  patientName: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  items: BillItem[];
  total: number;
  discountPct: number;
  status: "paid" | "pending" | "refunded" | "partially_refunded";
  paymentMethod: string;
  createdAt: string;
  createdBy: string;
}

/** Calculates net revenue for a bill accounting for refunds and discounts */
export function getBillNetTotal(b: Bill): number {
  if (b.status === "refunded") return 0;
  if (b.status === "partially_refunded") {
    const remainingGross = b.items.reduce((s, it) => s + (it.quantity - (it.refundedQuantity || 0)) * it.price, 0);
    return +(remainingGross * (1 - (b.discountPct || 0) / 100)).toFixed(2);
  }
  return b.total;
}

export interface Purchase {
  id: string;
  item: string;
  supplier: string;
  quantity: number;
  received: number;
  cost: number;
  status: "pending" | "received" | "cancelled";
  createdAt: string;
  invoice_no?: string;
  free_quantity?: number;
  discount_amount?: number;
  mrp?: number;
  batch?: string;
  expiry?: string;
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
  createdBy: string;
  createdAt: string;
}


/* ---------- Context ---------- */
interface PharmacyState {
  medicines: Medicine[];
  materials: Material[];
  bills: Bill[];
  purchases: Purchase[];
  loading: boolean;
  addMedicine: (m: Omit<Medicine, "id">) => Promise<void>;
  updateMedicine: (id: string, m: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  addMaterial: (m: Omit<Material, "id">) => Promise<void>;
  updateMaterial: (id: string, m: Partial<Material>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  transferStock: (
    type: "medicine" | "material",
    id: string,
    amount: number
  ) => Promise<void>;
  addBill: (b: Omit<Bill, "id" | "createdAt" | "createdBy">) => Promise<Bill>;
  deleteBill: (id: string, restoreStock?: boolean) => Promise<void>;
  refundItems: (id: string, itemsToRefund: { medicineId: string; qty: number }[]) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  deletePurchase: (id: string, revertStock?: boolean) => Promise<void>;
  updatePurchaseStatus: (
    id: string,
    status: Purchase["status"]
  ) => Promise<void>;
  
  doctors: Doctor[];
  addDoctor: (d: Omit<Doctor, "id" | "active">) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  toggleDoctor: (id: string, active: boolean) => Promise<void>;

  expenses: Expense[];
  addExpense: (e: Omit<Expense, "id" | "createdAt" | "createdBy">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  canTransfer: boolean;
  printFormat: string;
  autoPrint: boolean;
  updateSetting: (key: string, value: string) => Promise<void>;

  refresh: () => Promise<void>;
}

const Ctx = createContext<PharmacyState | null>(null);

/* ---------- Helpers: DB row → app model ---------- */
function rowToMedicine(r: any): Medicine {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    batch: r.batch,
    expiry: r.expiry,
    mainQuantity: r.main_quantity,
    pharmacyQuantity: r.pharmacy_quantity,
    minLevel: r.min_level,
    price: r.price,
    supplier: r.supplier ?? undefined,
  };
}

function rowToMaterial(r: any): Material {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    batch: r.batch,
    expiry: r.expiry,
    mainQuantity: r.main_quantity,
    pharmacyQuantity: r.pharmacy_quantity,
    minLevel: r.min_level,
    price: r.price,
    supplier: r.supplier ?? undefined,
  };
}

const fetchBills = async (allMedicines?: Medicine[], allMaterials?: Material[]) => {
  const { data, error } = await supabase.from("bills").select("*, items:bill_items(*)").order("created_at", { ascending: false });
  if (error) return [];
  return data.map((b: any) => ({
    id: b.id, patientName: b.patient_name, patientId: b.patient_id, doctorId: b.doctor_id, doctorName: b.doctor_name,
    total: b.total, discountPct: b.discount_pct, status: b.status,
    paymentMethod: b.payment_method, createdAt: b.created_at, createdBy: b.created_by,
    items: (b.items || []).map((i: any) => {
      let resolvedId = i.medicine_id;
      if (!resolvedId && allMaterials) {
        const mat = allMaterials.find(m => m.name.toLowerCase() === i.name?.toLowerCase());
        if (mat) resolvedId = mat.id;
      }
      return {
        id: i.id,
        medicineId: resolvedId || i.id,
        name: i.name,
        quantity: i.quantity,
        refundedQuantity: i.refunded_quantity,
        price: i.price
      };
    })
  }));
};

/* ---------- Provider ---------- */
export function PharmacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [canTransfer, setCanTransfer] = useState(true);
  const [printFormat, setPrintFormat] = useState("A4");
  const [autoPrint, setAutoPrint] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [medRes, matRes, purRes, docRes, setRes, expRes] = await Promise.all([
        supabase.from("medicines").select("*").order("name"),
        supabase.from("materials").select("*").order("name"),
        supabase.from("purchases").select("*").order("created_at", { ascending: false }),
        supabase.from("doctors").select("*").order("name"),
        supabase.from("settings").select("*"),
        supabase.from("expenses").select("*").order("date", { ascending: false }),
      ]);
      const meds = (medRes.data ?? []).map(rowToMedicine);
      const mats = (matRes.data ?? []).map(rowToMaterial);
      setMedicines(meds);
      setMaterials(mats);
      setBills(await fetchBills(meds, mats));
      setPurchases((purRes.data ?? []).map(p => ({
        id: p.id, item: p.item, supplier: p.supplier, quantity: p.quantity,
        received: p.received, cost: p.cost, status: p.status, createdAt: p.created_at,
        invoice_no: p.invoice_no, free_quantity: p.free_quantity, discount_amount: p.discount_amount, mrp: p.mrp,
        batch: p.batch, expiry: p.expiry
      })));
      setDoctors(docRes.data ?? []);
      setExpenses((expRes.data ?? []).map((e: any) => ({
        id: e.id, amount: e.amount, description: e.description,
        category: e.category, date: e.date, createdBy: e.created_by, createdAt: e.created_at,
      })));

      const settings = setRes.data ?? [];
      const tSet = settings.find((s: any) => s.key === "allow_pharmacist_transfer");
      if (tSet) setCanTransfer(tSet.value === "true");
        
      const pfSet = settings.find((s: any) => s.key === "print_format");
      if (pfSet) setPrintFormat(pfSet.value);

      const apSet = settings.find((s: any) => s.key === "auto_print");
      if (apSet) setAutoPrint(apSet.value === "true");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user]);

  /* --- Medicines --- */
  const addMedicine = async (m: Omit<Medicine, "id">) => {
    const { data, error } = await supabase
      .from("medicines")
      .insert({
        name: m.name,
        category: m.category,
        batch: m.batch,
        expiry: m.expiry,
        main_quantity: m.mainQuantity,
        pharmacy_quantity: m.pharmacyQuantity,
        min_level: m.minLevel,
        price: m.price,
        supplier: m.supplier,
      })
      .select()
      .single();
    if (error) throw error;
    setMedicines((prev) => [rowToMedicine(data), ...prev]);
  };

  const updateMedicine = async (id: string, m: Partial<Medicine>) => {
    const update: any = {};
    if (m.name !== undefined) update.name = m.name;
    if (m.category !== undefined) update.category = m.category;
    if (m.batch !== undefined) update.batch = m.batch;
    if (m.expiry !== undefined) update.expiry = m.expiry;
    if (m.mainQuantity !== undefined) update.main_quantity = m.mainQuantity;
    if (m.pharmacyQuantity !== undefined) update.pharmacy_quantity = m.pharmacyQuantity;
    if (m.minLevel !== undefined) update.min_level = m.minLevel;
    if (m.price !== undefined) update.price = m.price;
    if (m.supplier !== undefined) update.supplier = m.supplier;
    const { data, error } = await supabase
      .from("medicines")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setMedicines((prev) => prev.map((x) => (x.id === id ? rowToMedicine(data) : x)));
  };

  const deleteMedicine = async (id: string) => {
    const { error } = await supabase.from("medicines").delete().eq("id", id);
    if (error) throw error;
    setMedicines((prev) => prev.filter((x) => x.id !== id));
  };

  /* --- Materials --- */
  const addMaterial = async (m: Omit<Material, "id">) => {
    const { data, error } = await supabase
      .from("materials")
      .insert({
        name: m.name,
        category: m.category,
        batch: m.batch,
        expiry: m.expiry,
        main_quantity: m.mainQuantity,
        pharmacy_quantity: m.pharmacyQuantity,
        min_level: m.minLevel,
        price: m.price,
        supplier: m.supplier,
      })
      .select()
      .single();
    if (error) throw error;
    setMaterials((prev) => [rowToMaterial(data), ...prev]);
  };

  const updateMaterial = async (id: string, m: Partial<Material>) => {
    const update: any = {};
    if (m.name !== undefined) update.name = m.name;
    if (m.category !== undefined) update.category = m.category;
    if (m.batch !== undefined) update.batch = m.batch;
    if (m.expiry !== undefined) update.expiry = m.expiry;
    if (m.mainQuantity !== undefined) update.main_quantity = m.mainQuantity;
    if (m.pharmacyQuantity !== undefined) update.pharmacy_quantity = m.pharmacyQuantity;
    if (m.minLevel !== undefined) update.min_level = m.minLevel;
    if (m.price !== undefined) update.price = m.price;
    if (m.supplier !== undefined) update.supplier = m.supplier;
    const { data, error } = await supabase
      .from("materials")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setMaterials((prev) => prev.map((x) => (x.id === id ? rowToMaterial(data) : x)));
  };

  const deleteMaterial = async (id: string) => {
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) throw error;
    setMaterials((prev) => prev.filter((x) => x.id !== id));
  };

  /* --- Stock Transfer --- */
  const transferStock = async (
    type: "medicine" | "material",
    id: string,
    amount: number
  ) => {
    const table = type === "medicine" ? "medicines" : "materials";
    const items = type === "medicine" ? medicines : materials;
    const item = items.find((x) => x.id === id);
    if (!item) return;
    const { error } = await supabase
      .from(table)
      .update({
        main_quantity: item.mainQuantity - amount,
        pharmacy_quantity: item.pharmacyQuantity + amount,
      })
      .eq("id", id);
    if (error) throw error;
    if (type === "medicine") {
      setMedicines((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, mainQuantity: x.mainQuantity - amount, pharmacyQuantity: x.pharmacyQuantity + amount }
            : x
        )
      );
    } else {
      setMaterials((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, mainQuantity: x.mainQuantity - amount, pharmacyQuantity: x.pharmacyQuantity + amount }
            : x
        )
      );
    }
  };

  /* --- Bills --- */
  const addBill = async (
    b: Omit<Bill, "id" | "createdAt" | "createdBy">
  ): Promise<Bill> => {
    const billId = "B" + (10000 + Math.floor(Math.random() * 90000));
    const createdBy = user?.email ?? "unknown";

    const { error: billError } = await supabase.from("bills").insert({
      id: billId,
      patient_name: b.patientName,
      patient_id: b.patientId,
      doctor_id: b.doctorId,
      doctor_name: b.doctorName,
      total: b.total,
      discount_pct: b.discountPct,
      status: b.status,
      payment_method: b.paymentMethod,
      created_by: createdBy,
    });
    if (billError) throw billError;

    // Insert bill items — medicine_id is null for materials (FK only references medicines table)
    if (b.items.length > 0) {
      const { error: itemsError } = await supabase.from("bill_items").insert(
        b.items.map((it) => {
          const isMedicine = medicines.some((x) => x.id === it.medicineId);
          return {
            bill_id: billId,
            medicine_id: isMedicine ? it.medicineId : null,
            name: it.name,
            quantity: it.quantity,
            price: it.price,
          };
        })
      );
      if (itemsError) throw itemsError;
    }

    // Deduct pharmacy stock — medicines first, then materials
    for (const it of b.items) {
      if (!it.medicineId) continue;
      const med = medicines.find((x) => x.id === it.medicineId);
      if (med) {
        await supabase
          .from("medicines")
          .update({ pharmacy_quantity: Math.max(0, med.pharmacyQuantity - it.quantity) })
          .eq("id", it.medicineId);
        continue;
      }
      const mat = materials.find((x) => x.id === it.medicineId);
      if (mat) {
        await supabase
          .from("materials")
          .update({ pharmacy_quantity: Math.max(0, mat.pharmacyQuantity - it.quantity) })
          .eq("id", it.medicineId);
      }
    }

    const newBill: Bill = {
      ...b,
      id: billId,
      createdAt: new Date().toISOString(),
      createdBy,
    };
    setBills((prev) => [newBill, ...prev]);
    setMedicines((prev) =>
      prev.map((m) => {
        const it = b.items.find((i) => i.medicineId === m.id);
        return it
          ? { ...m, pharmacyQuantity: Math.max(0, m.pharmacyQuantity - it.quantity) }
          : m;
      })
    );
    setMaterials((prev) =>
      prev.map((m) => {
        const it = b.items.find((i) => i.medicineId === m.id);
        return it
          ? { ...m, pharmacyQuantity: Math.max(0, m.pharmacyQuantity - it.quantity) }
          : m;
      })
    );

    return newBill;
  };

  const refundItems = async (id: string, itemsToRefund: { medicineId: string; qty: number }[]) => {
    const bill = bills.find((x) => x.id === id);
    if (!bill) return;

    let updatedItems = [...bill.items];
    let fullyRefunded = true;

    for (const refItem of itemsToRefund) {
      if (refItem.qty <= 0) continue;
      const bItem = updatedItems.find(i => i.medicineId === refItem.medicineId || (i.id && i.id === refItem.medicineId));
      if (!bItem) continue;

      const newRefQty = (bItem.refundedQuantity || 0) + refItem.qty;
      
      // Update DB for this bill item
      if (bItem.id) {
        await supabase
          .from("bill_items")
          .update({ refunded_quantity: newRefQty })
          .eq("id", bItem.id);
      }

      bItem.refundedQuantity = newRefQty;

      // Update Stock (check medicines then materials)
      const med = medicines.find(m => m.id === refItem.medicineId || m.name.toLowerCase() === bItem.name.toLowerCase());
      if (med) {
        const nq = med.pharmacyQuantity + refItem.qty;
        await supabase.from("medicines").update({ pharmacy_quantity: nq }).eq("id", med.id);
        setMedicines(prev => prev.map(m => m.id === med.id ? { ...m, pharmacyQuantity: nq } : m));
      } else {
        const mat = materials.find(m => m.id === refItem.medicineId || m.name.toLowerCase() === bItem.name.toLowerCase());
        if (mat) {
          const nq = mat.pharmacyQuantity + refItem.qty;
          await supabase.from("materials").update({ pharmacy_quantity: nq }).eq("id", mat.id);
          setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, pharmacyQuantity: nq } : m));
        }
      }
    }

    // Check if entire bill is refunded
    for (const it of updatedItems) {
      if ((it.refundedQuantity || 0) < it.quantity) fullyRefunded = false;
    }

    const newStatus = fullyRefunded ? "refunded" : "partially_refunded";

    await supabase.from("bills").update({ status: newStatus }).eq("id", id);
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: newStatus, items: updatedItems } : b));
  };

  const deleteBill = async (id: string, restoreStock: boolean = true) => {
    const bill = bills.find((b) => b.id === id);
    if (!bill) return;

    // If restoreStock is requested, restore unrefunded stock back to pharmacy
    if (restoreStock) {
      for (const it of bill.items) {
        const remainingQty = it.quantity - (it.refundedQuantity || 0);
        if (remainingQty <= 0) continue;

        const med = medicines.find((m) => m.id === it.medicineId || m.name.toLowerCase() === it.name.toLowerCase());
        if (med) {
          const nq = med.pharmacyQuantity + remainingQty;
          await supabase.from("medicines").update({ pharmacy_quantity: nq }).eq("id", med.id);
          setMedicines((prev) => prev.map((m) => m.id === med.id ? { ...m, pharmacyQuantity: nq } : m));
          continue;
        }

        const mat = materials.find((m) => m.id === it.medicineId || m.name.toLowerCase() === it.name.toLowerCase());
        if (mat) {
          const nq = mat.pharmacyQuantity + remainingQty;
          await supabase.from("materials").update({ pharmacy_quantity: nq }).eq("id", mat.id);
          setMaterials((prev) => prev.map((m) => m.id === mat.id ? { ...m, pharmacyQuantity: nq } : m));
        }
      }
    }

    // Delete bill items and bill record from Supabase
    await supabase.from("bill_items").delete().eq("bill_id", id);
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) throw error;

    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  /* --- Purchases --- */
  const addPurchase = async (p: Omit<Purchase, "id" | "createdAt">) => {
    const id = "PO-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const { error } = await supabase.from("purchases").insert({
      id,
      item: p.item,
      supplier: p.supplier,
      quantity: p.quantity,
      received: p.received,
      cost: p.cost,
      status: p.status,
      invoice_no: p.invoice_no,
      free_quantity: p.free_quantity,
      discount_amount: p.discount_amount,
      mrp: p.mrp,
      batch: p.batch,
      expiry: p.expiry
    });
    if (error) throw error;
    const newP: Purchase = { ...p, id, createdAt: new Date().toISOString() };
    setPurchases((prev) => [newP, ...prev]);
  };

  const updatePurchaseStatus = async (
    id: string,
    status: Purchase["status"]
  ) => {
    const purchase = purchases.find((p) => p.id === id);
    if (!purchase) return;

    let receivedAmt = purchase.received;
    if (status === "received") {
      receivedAmt = purchase.quantity + (purchase.free_quantity || 0);
    }

    const { error } = await supabase
      .from("purchases")
      .update({ status, received: receivedAmt })
      .eq("id", id);
    if (error) throw error;

    if (status === "received" && purchase.status !== "received") {
      const qtyToAdd = receivedAmt;
      const b = purchase.batch?.trim();
      const e = purchase.expiry?.trim();

      // Check Medicines
      let templateMed = medicines.find(m => m.name.toLowerCase() === purchase.item.toLowerCase());
      
      if (templateMed) {
        // We found a medicine with the same name. Let's see if the exact batch exists.
        const exactBatch = b && e 
          ? medicines.find(m => m.name.toLowerCase() === purchase.item.toLowerCase() && m.batch === b && m.expiry === e)
          : undefined;

        if (exactBatch) {
          // Add to existing batch
          const newQty = exactBatch.mainQuantity + qtyToAdd;
          await supabase.from("medicines").update({ main_quantity: newQty }).eq("id", exactBatch.id);
          setMedicines(prev => prev.map(m => m.id === exactBatch.id ? { ...m, mainQuantity: newQty } : m));
        } else {
          // Create a new batch using the template
          const { data, error: insErr } = await supabase
            .from("medicines")
            .insert({
              name: templateMed.name,
              category: templateMed.category,
              batch: b || `PO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
              expiry: e || new Date(Date.now() + 31536000000).toISOString(),
              main_quantity: qtyToAdd,
              pharmacy_quantity: 0,
              min_level: templateMed.minLevel,
              price: purchase.mrp || templateMed.price,
              supplier: purchase.supplier
            })
            .select()
            .single();
          if (insErr) throw insErr;
          if (data) {
            setMedicines(prev => [rowToMedicine(data), ...prev]);
          }
        }
      } else {
        // Try Materials
        let templateMat = materials.find(m => m.name.toLowerCase() === purchase.item.toLowerCase());
        if (templateMat) {
          const exactBatchMat = b && e 
            ? materials.find(m => m.name.toLowerCase() === purchase.item.toLowerCase() && m.batch === b && m.expiry === e)
            : undefined;

          if (exactBatchMat) {
            const newQty = exactBatchMat.mainQuantity + qtyToAdd;
            await supabase.from("materials").update({ main_quantity: newQty }).eq("id", exactBatchMat.id);
            setMaterials(prev => prev.map(m => m.id === exactBatchMat.id ? { ...m, mainQuantity: newQty } : m));
          } else {
            const { data, error: insErr } = await supabase
              .from("materials")
              .insert({
                name: templateMat.name,
                category: templateMat.category,
                batch: b || `PO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
                expiry: e || new Date(Date.now() + 31536000000).toISOString(),
                main_quantity: qtyToAdd,
                pharmacy_quantity: 0,
                min_level: templateMat.minLevel,
                price: purchase.mrp || templateMat.price,
                supplier: purchase.supplier
              })
              .select()
              .single();
            if (insErr) throw insErr;
            if (data) {
              setMaterials(prev => [rowToMaterial(data), ...prev]);
            }
          } else {
            // Create a completely new medicine if it doesn't match ANY existing medicine or material
            const { data, error: insErr } = await supabase
              .from("medicines")
              .insert({
                name: purchase.item,
                category: "General",
                batch: b || `PO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
                expiry: e || new Date(Date.now() + 31536000000).toISOString(),
                main_quantity: qtyToAdd,
                pharmacy_quantity: 0,
                min_level: 10,
                price: purchase.mrp || purchase.cost || 0,
                supplier: purchase.supplier
              })
              .select()
              .single();
            if (insErr) throw insErr;
            if (data) {
              setMedicines(prev => [rowToMedicine(data), ...prev]);
            }
          }
        }
      }
    }

    setPurchases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, received: status === "received" ? (p.quantity + (p.free_quantity || 0)) : p.received } : p))
    );
  };

  const deletePurchase = async (id: string, revertStock: boolean = true) => {
    const purchase = purchases.find((p) => p.id === id);
    if (!purchase) return;

    // If purchase was received and revertStock is true, remove the added items from main stock
    if (revertStock && purchase.status === "received" && purchase.received > 0) {
      const qtyToDeduct = purchase.received;

      const matchingMeds = medicines.filter(
        (m) => m.name.toLowerCase() === purchase.item.toLowerCase()
      );
      if (matchingMeds.length > 0) {
        const target = matchingMeds[0];
        const newQty = Math.max(0, target.mainQuantity - qtyToDeduct);
        await supabase.from("medicines").update({ main_quantity: newQty }).eq("id", target.id);
        setMedicines((prev) => prev.map((m) => m.id === target.id ? { ...m, mainQuantity: newQty } : m));
      } else {
        const matchingMats = materials.filter(
          (m) => m.name.toLowerCase() === purchase.item.toLowerCase()
        );
        if (matchingMats.length > 0) {
          const target = matchingMats[0];
          const newQty = Math.max(0, target.mainQuantity - qtyToDeduct);
          await supabase.from("materials").update({ main_quantity: newQty }).eq("id", target.id);
          setMaterials((prev) => prev.map((m) => m.id === target.id ? { ...m, mainQuantity: newQty } : m));
        }
      }
    }

    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) throw error;

    setPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  /* --- Doctors --- */
  const addDoctor = async (d: Omit<Doctor, "id" | "active">) => {
    const { data, error } = await supabase
      .from("doctors")
      .insert({ name: d.name, specialty: d.specialty })
      .select()
      .single();
    if (error) throw error;
    setDoctors((prev) => [...prev, { id: data.id, name: data.name, specialty: data.specialty, active: data.active }]);
  };

  const deleteDoctor = async (id: string) => {
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) throw error;
    setDoctors((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleDoctor = async (id: string, active: boolean) => {
    const { error } = await supabase.from("doctors").update({ active }).eq("id", id);
    if (error) throw error;
    setDoctors((prev) => prev.map((d) => d.id === id ? { ...d, active } : d));
  };

  /* --- Expenses --- */
  const addExpense = async (e: Omit<Expense, "id" | "createdAt" | "createdBy">) => {
    const createdBy = user?.email ?? "unknown";
    const { data, error } = await supabase
      .from("expenses")
      .insert({ amount: e.amount, description: e.description, category: e.category, date: e.date, created_by: createdBy })
      .select()
      .single();
    if (error) throw error;
    setExpenses(prev => [{ id: data.id, amount: data.amount, description: data.description, category: data.category, date: data.date, createdBy: data.created_by, createdAt: data.created_at }, ...prev]);
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  /* --- Settings --- */
  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase.from("settings").upsert({ key, value });
    if (error) throw error;
    if (key === "allow_pharmacist_transfer") setCanTransfer(value === "true");
    if (key === "print_format") setPrintFormat(value);
    if (key === "auto_print") setAutoPrint(value === "true");
  };

  return (
    <Ctx.Provider
      value={{
        medicines,
        materials,
        bills,
        purchases,
        doctors,
        expenses,
        canTransfer,
        printFormat,
        autoPrint,
        loading,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        transferStock,
        addBill,
        deleteBill,
        refundItems,
        addPurchase,
        deletePurchase,
        updatePurchaseStatus,
        addDoctor,
        deleteDoctor,
        toggleDoctor,
        addExpense,
        deleteExpense,
        updateSetting,
        refresh: loadAll,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePharmacy() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePharmacy must be used inside PharmacyProvider");
  return v;
}
