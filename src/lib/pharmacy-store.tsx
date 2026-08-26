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
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
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
  refundItems: (id: string, itemsToRefund: { medicineId: string; qty: number }[]) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  updatePurchaseStatus: (
    id: string,
    status: Purchase["status"]
  ) => Promise<void>;
  
  doctors: Doctor[];
  addDoctor: (d: Omit<Doctor, "id" | "active">) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  toggleDoctor: (id: string, active: boolean) => Promise<void>;

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

const fetchBills = async () => {
  const { data, error } = await supabase.from("bills").select("*, items:bill_items(*)").order("created_at", { ascending: false });
  if (error) return [];
  return data.map((b: any) => ({
    id: b.id, patientName: b.patient_name, patientId: b.patient_id, doctorId: b.doctor_id, doctorName: b.doctor_name,
    total: b.total, discountPct: b.discount_pct, status: b.status,
    paymentMethod: b.payment_method, createdAt: b.created_at, createdBy: b.created_by,
    items: b.items.map((i: any) => ({
      id: i.id, medicineId: i.medicine_id, name: i.name, quantity: i.quantity,
      refundedQuantity: i.refunded_quantity, price: i.price
    }))
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
  const [canTransfer, setCanTransfer] = useState(true);
  const [printFormat, setPrintFormat] = useState("A4");
  const [autoPrint, setAutoPrint] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [medRes, matRes, purRes, docRes, setRes] = await Promise.all([
        supabase.from("medicines").select("*").order("name"),
        supabase.from("materials").select("*").order("name"),
        supabase.from("purchases").select("*").order("created_at", { ascending: false }),
        supabase.from("doctors").select("*").order("name"),
        supabase.from("settings").select("*"),
      ]);
      setMedicines((medRes.data ?? []).map(rowToMedicine));
      setMaterials((matRes.data ?? []).map(rowToMaterial));
      setBills(await fetchBills());
      setPurchases((purRes.data ?? []).map(p => ({
        id: p.id, item: p.item, supplier: p.supplier, quantity: p.quantity,
        received: p.received, cost: p.cost, status: p.status, createdAt: p.created_at,
        invoice_no: p.invoice_no, free_quantity: p.free_quantity, discount_amount: p.discount_amount, mrp: p.mrp
      })));
      setDoctors(docRes.data ?? []);

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

    // Insert bill items
    if (b.items.length > 0) {
      const { error: itemsError } = await supabase.from("bill_items").insert(
        b.items.map((it) => ({
          bill_id: billId,
          medicine_id: it.medicineId || null,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
        }))
      );
      if (itemsError) throw itemsError;
    }

    // Deduct pharmacy stock
    for (const it of b.items) {
      if (!it.medicineId) continue;
      const med = medicines.find((x) => x.id === it.medicineId);
      if (!med) continue;
      await supabase
        .from("medicines")
        .update({ pharmacy_quantity: Math.max(0, med.pharmacyQuantity - it.quantity) })
        .eq("id", it.medicineId);
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
    // Also deduct material stock if any bill items are materials
    setMaterials((prev) =>
      prev.map((m) => {
        const it = b.items.find((i) => i.medicineId === m.id);
        return it
          ? { ...m, pharmacyQuantity: Math.max(0, m.pharmacyQuantity - it.quantity) }
          : m;
      })
    );
    for (const it of b.items) {
      if (!it.medicineId) continue;
      const mat = materials.find((x) => x.id === it.medicineId);
      if (!mat) continue;
      await supabase
        .from("materials")
        .update({ pharmacy_quantity: Math.max(0, mat.pharmacyQuantity - it.quantity) })
        .eq("id", it.medicineId);
    }

    return newBill;
  };

  const refundItems = async (id: string, itemsToRefund: { medicineId: string; qty: number }[]) => {
    const bill = bills.find((x) => x.id === id);
    if (!bill) return;

    let updatedItems = [...bill.items];
    let fullyRefunded = true;

    for (const refItem of itemsToRefund) {
      if (refItem.qty <= 0) continue;
      const bItem = updatedItems.find(i => i.medicineId === refItem.medicineId);
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
      const med = medicines.find(m => m.id === refItem.medicineId);
      if (med) {
        const nq = med.pharmacyQuantity + refItem.qty;
        await supabase.from("medicines").update({ pharmacy_quantity: nq }).eq("id", med.id);
        setMedicines(prev => prev.map(m => m.id === med.id ? { ...m, pharmacyQuantity: nq } : m));
      } else {
        const mat = materials.find(m => m.id === refItem.medicineId);
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

  /* --- Purchases --- */
  const addPurchase = async (p: Omit<Purchase, "id" | "createdAt">) => {
    const id = "PO" + Date.now();
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
      mrp: p.mrp
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

    // When marking as received, add quantity to main inventory
    if (status === "received" && purchase.status !== "received") {
      const qtyToAdd = receivedAmt;

      // Try medicines first (earliest expiry batch of matching name)
      const matchingMeds = medicines
        .filter((m) => m.name.toLowerCase() === purchase.item.toLowerCase())
        .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

      if (matchingMeds.length > 0) {
        const target = matchingMeds[0];
        const newQty = target.mainQuantity + qtyToAdd;
        await supabase
          .from("medicines")
          .update({ main_quantity: newQty })
          .eq("id", target.id);
        setMedicines((prev) =>
          prev.map((m) => m.id === target.id ? { ...m, mainQuantity: newQty } : m)
        );
      } else {
        // Try materials
        const matchingMats = materials
          .filter((m) => m.name.toLowerCase() === purchase.item.toLowerCase())
          .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

        if (matchingMats.length > 0) {
          const target = matchingMats[0];
          const newQty = target.mainQuantity + qtyToAdd;
          await supabase
            .from("materials")
            .update({ main_quantity: newQty })
            .eq("id", target.id);
          setMaterials((prev) =>
            prev.map((m) => m.id === target.id ? { ...m, mainQuantity: newQty } : m)
          );
        }
        // If no match found, the item hasn't been added to inventory yet
        // The admin should add it via Medicine/Material invoice first
      }
    }

    setPurchases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, received: status === "received" ? (p.quantity + (p.free_quantity || 0)) : p.received } : p))
    );
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
        refundBill,
        addPurchase,
        updatePurchaseStatus,
        addDoctor,
        deleteDoctor,
        toggleDoctor,
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
