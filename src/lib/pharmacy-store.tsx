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
  medicineId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Bill {
  id: string;
  patientName: string;
  patientId: string;
  items: BillItem[];
  total: number;
  discountPct: number;
  status: "paid" | "pending" | "refunded";
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
  refundBill: (id: string) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  updatePurchaseStatus: (
    id: string,
    status: Purchase["status"]
  ) => Promise<void>;
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

async function fetchBills(): Promise<Bill[]> {
  const { data: billRows, error } = await supabase
    .from("bills")
    .select("*, bill_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (billRows ?? []).map((b: any) => ({
    id: b.id,
    patientName: b.patient_name,
    patientId: b.patient_id ?? "",
    total: b.total,
    discountPct: b.discount_pct ?? 0,
    status: b.status,
    paymentMethod: b.payment_method ?? "",
    createdAt: b.created_at,
    createdBy: b.created_by ?? "",
    items: (b.bill_items ?? []).map((it: any) => ({
      medicineId: it.medicine_id ?? "",
      name: it.name,
      quantity: it.quantity,
      price: it.price,
    })),
  }));
}

/* ---------- Provider ---------- */
export function PharmacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [medRes, matRes, purRes] = await Promise.all([
        supabase.from("medicines").select("*").order("name"),
        supabase.from("materials").select("*").order("name"),
        supabase.from("purchases").select("*").order("created_at", { ascending: false }),
      ]);
      setMedicines((medRes.data ?? []).map(rowToMedicine));
      setMaterials((matRes.data ?? []).map(rowToMaterial));
      setBills(await fetchBills());
      setPurchases(
        (purRes.data ?? []).map((p: any) => ({
          id: p.id,
          item: p.item,
          supplier: p.supplier,
          quantity: p.quantity,
          received: p.received,
          cost: p.cost,
          status: p.status,
          createdAt: p.created_at,
        }))
      );
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
    return newBill;
  };

  const refundBill = async (id: string) => {
    const bill = bills.find((x) => x.id === id);
    if (!bill || bill.status === "refunded") return;
    const { error } = await supabase
      .from("bills")
      .update({ status: "refunded" })
      .eq("id", id);
    if (error) throw error;
    setBills((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "refunded" } : x))
    );
    // Restore stock
    setMedicines((prev) =>
      prev.map((m) => {
        const it = bill.items.find((i) => i.medicineId === m.id);
        return it ? { ...m, pharmacyQuantity: m.pharmacyQuantity + it.quantity } : m;
      })
    );
    for (const it of bill.items) {
      if (!it.medicineId) continue;
      const med = medicines.find((x) => x.id === it.medicineId);
      if (!med) continue;
      await supabase
        .from("medicines")
        .update({ pharmacy_quantity: med.pharmacyQuantity + it.quantity })
        .eq("id", it.medicineId);
    }
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
    });
    if (error) throw error;
    const newP: Purchase = { ...p, id, createdAt: new Date().toISOString() };
    setPurchases((prev) => [newP, ...prev]);
  };

  const updatePurchaseStatus = async (
    id: string,
    status: Purchase["status"]
  ) => {
    const { error } = await supabase
      .from("purchases")
      .update({ status })
      .eq("id", id);
    if (error) throw error;

    const purchase = purchases.find((p) => p.id === id);

    // When marking as received, add quantity to main inventory
    if (status === "received" && purchase) {
      const qtyToAdd = purchase.quantity;

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
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  };

  return (
    <Ctx.Provider
      value={{
        medicines,
        materials,
        bills,
        purchases,
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
