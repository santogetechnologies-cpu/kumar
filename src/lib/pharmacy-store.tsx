import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "pharmacist";
export interface User {
  username: string;
  name: string;
  role: Role;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  batch: string;
  expiry: string; // YYYY-MM-DD
  mainQuantity: number;
  pharmacyQuantity: number;
  minLevel: number;
  price: number;
  supplier?: string;
  quantity?: number; // for backward compatibility during load
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
  quantity?: number; // for backward compatibility during load
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

interface PharmacyState {
  user: User | null;
  medicines: Medicine[];
  materials: Material[];
  bills: Bill[];
  purchases: Purchase[];
  login: (u: User) => void;
  logout: () => void;
  addMedicine: (m: Omit<Medicine, "id">) => void;
  deleteMedicine: (id: string) => void;
  addMaterial: (m: Omit<Material, "id">) => void;
  deleteMaterial: (id: string) => void;
  transferStock: (type: "medicine" | "material", id: string, amount: number) => void;
  addBill: (b: Omit<Bill, "id" | "createdAt" | "createdBy">) => Bill;
  refundBill: (id: string) => void;
  addPurchase: (p: Omit<Purchase, "id" | "createdAt">) => void;
  updatePurchaseStatus: (id: string, status: Purchase["status"]) => void;
}

const Ctx = createContext<PharmacyState | null>(null);
const KEY = "kumar-pharmacy-v2";

const seedMedicines: Medicine[] = [
  { id: "m1", name: "PARACETAMOL 500", category: "Tablet", batch: "PC2401", expiry: "2027-06-01", mainQuantity: 200, pharmacyQuantity: 40, minLevel: 50, price: 2.5, supplier: "MediSup" },
  { id: "m2", name: "AMOXICILLIN 250", category: "Capsule", batch: "AM2312", expiry: "2026-11-15", mainQuantity: 10, pharmacyQuantity: 8, minLevel: 30, price: 8, supplier: "PharmaCo" },
  { id: "m3", name: "AZITHROMYCIN 500", category: "Tablet", batch: "AZ2405", expiry: "2027-01-20", mainQuantity: 50, pharmacyQuantity: 12, minLevel: 40, price: 22, supplier: "PharmaCo" },
  { id: "m4", name: "CETIRIZINE 10", category: "Tablet", batch: "CT2402", expiry: "2027-03-10", mainQuantity: 0, pharmacyQuantity: 5, minLevel: 25, price: 1.8, supplier: "MediSup" },
  { id: "m5", name: "IBUPROFEN 400", category: "Tablet", batch: "IB2311", expiry: "2026-08-30", mainQuantity: 100, pharmacyQuantity: 30, minLevel: 40, price: 3.2 },
  { id: "m6", name: "OMEPRAZOLE 20", category: "Capsule", batch: "OM2403", expiry: "2027-05-12", mainQuantity: 68, pharmacyQuantity: 20, minLevel: 30, price: 4.5 },
  { id: "m7", name: "COUGH SYRUP 100ML", category: "Syrup", batch: "CS2401", expiry: "2026-09-05", mainQuantity: 12, pharmacyQuantity: 10, minLevel: 15, price: 65 },
  { id: "m8", name: "INSULIN 10ML", category: "Injection", batch: "IN2404", expiry: "2026-12-01", mainQuantity: 10, pharmacyQuantity: 2, minLevel: 10, price: 320 },
];

const seedMaterials: Material[] = [
  { id: "mt1", name: "10 ML SYRINGE", category: "Hypodermic", batch: "SY2401", expiry: "2028-01-01", mainQuantity: 54, pharmacyQuantity: 40, minLevel: 20, price: 14.3 },
  { id: "mt2", name: "COTTON ROLL", category: "Dressing", batch: "CR2311", expiry: "2029-04-10", mainQuantity: 30, pharmacyQuantity: 10, minLevel: 15, price: 45 },
  { id: "mt3", name: "SURGICAL GLOVES M", category: "Surgical", batch: "GL2405", expiry: "2027-08-01", mainQuantity: 0, pharmacyQuantity: 8, minLevel: 20, price: 12 },
  { id: "mt4", name: "3M MICROPORE TAPE", category: "Dressing", batch: "MP2402", expiry: "2028-06-15", mainQuantity: 40, pharmacyQuantity: 15, minLevel: 15, price: 38 },
  { id: "mt5", name: "IV CANNULA 20G", category: "Surgical", batch: "IV2312", expiry: "2027-11-30", mainQuantity: 20, pharmacyQuantity: 10, minLevel: 12, price: 28 },
];

const seedBills: Bill[] = [
  {
    id: "B10001", patientName: "MR. RAJESH", patientId: "P1001",
    items: [{ medicineId: "m1", name: "PARACETAMOL 500", quantity: 10, price: 2.5 }],
    total: 25, discountPct: 0, status: "paid", paymentMethod: "Cash",
    createdAt: new Date(Date.now() - 86400000).toISOString(), createdBy: "aswin",
  },
  {
    id: "B10002", patientName: "MRS. LATHA", patientId: "P1002",
    items: [{ medicineId: "m3", name: "AZITHROMYCIN 500", quantity: 6, price: 22 }],
    total: 132, discountPct: 0, status: "paid", paymentMethod: "UPI",
    createdAt: new Date(Date.now() - 43200000).toISOString(), createdBy: "aswin",
  },
];

const seedPurchases: Purchase[] = [
  { id: "PO2001", item: "PARACETAMOL 500", supplier: "MediSup", quantity: 500, received: 500, cost: 1200, status: "received", createdAt: new Date().toISOString() },
  { id: "PO2002", item: "AMOXICILLIN 250", supplier: "PharmaCo", quantity: 200, received: 0, cost: 1600, status: "pending", createdAt: new Date().toISOString() },
];

interface Persisted {
  user: User | null;
  medicines: Medicine[];
  materials: Material[];
  bills: Bill[];
  purchases: Purchase[];
}

function load(): Persisted {
  if (typeof window === "undefined") {
    return { user: null, medicines: seedMedicines, materials: seedMaterials, bills: seedBills, purchases: seedPurchases };
  }
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem("kumar-pharmacy-v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration logic
      parsed.medicines = (parsed.medicines || []).map((m: any) => {
        if (m.quantity !== undefined && m.mainQuantity === undefined) {
          m.mainQuantity = m.quantity;
          m.pharmacyQuantity = 0;
          delete m.quantity;
        }
        return m;
      });
      parsed.materials = (parsed.materials || []).map((m: any) => {
        if (m.quantity !== undefined && m.mainQuantity === undefined) {
          m.mainQuantity = m.quantity;
          m.pharmacyQuantity = 0;
          delete m.quantity;
        }
        return m;
      });
      return parsed;
    }
  } catch {}
  return { user: null, medicines: seedMedicines, materials: seedMaterials, bills: seedBills, purchases: seedPurchases };
}

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => ({
    user: null, medicines: seedMedicines, materials: seedMaterials, bills: seedBills, purchases: seedPurchases,
  }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const update = (patch: Partial<Persisted>) => setState((s) => ({ ...s, ...patch }));

  const value: PharmacyState = {
    ...state,
    login: (u) => update({ user: u }),
    logout: () => update({ user: null }),
    addMedicine: (m) => setState((s) => ({ ...s, medicines: [{ ...m, id: "m" + Date.now() }, ...s.medicines] })),
    deleteMedicine: (id) => setState((s) => ({ ...s, medicines: s.medicines.filter((x) => x.id !== id) })),
    addMaterial: (m) => setState((s) => ({ ...s, materials: [{ ...m, id: "mt" + Date.now() }, ...s.materials] })),
    deleteMaterial: (id) => setState((s) => ({ ...s, materials: s.materials.filter((x) => x.id !== id) })),
    transferStock: (type, id, amount) => setState((s) => {
      if (type === "medicine") {
        return {
          ...s,
          medicines: s.medicines.map((m) => m.id === id ? { ...m, mainQuantity: m.mainQuantity - amount, pharmacyQuantity: m.pharmacyQuantity + amount } : m),
        };
      } else {
        return {
          ...s,
          materials: s.materials.map((m) => m.id === id ? { ...m, mainQuantity: m.mainQuantity - amount, pharmacyQuantity: m.pharmacyQuantity + amount } : m),
        };
      }
    }),
    addBill: (b) => {
      const bill: Bill = {
        ...b,
        id: "B" + (10000 + Math.floor(Math.random() * 90000)),
        createdAt: new Date().toISOString(),
        createdBy: state.user?.username ?? "unknown",
      };
      setState((s) => ({
        ...s,
        bills: [bill, ...s.bills],
        medicines: s.medicines.map((m) => {
          const it = b.items.find((i) => i.medicineId === m.id);
          return it ? { ...m, pharmacyQuantity: Math.max(0, m.pharmacyQuantity - it.quantity) } : m;
        }),
      }));
      return bill;
    },
    refundBill: (id) => setState((s) => {
      const bill = s.bills.find((x) => x.id === id);
      if (!bill || bill.status === "refunded") return s;
      return {
        ...s,
        bills: s.bills.map((x) => x.id === id ? { ...x, status: "refunded" } : x),
        medicines: s.medicines.map((m) => {
          const it = bill.items.find((i) => i.medicineId === m.id);
          return it ? { ...m, pharmacyQuantity: m.pharmacyQuantity + it.quantity } : m;
        }),
      };
    }),
    addPurchase: (p) => setState((s) => ({ ...s, purchases: [{ ...p, id: "PO" + Date.now(), createdAt: new Date().toISOString() }, ...s.purchases] })),
    updatePurchaseStatus: (id, status) => setState((s) => ({ ...s, purchases: s.purchases.map((p) => p.id === id ? { ...p, status } : p) })),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePharmacy() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePharmacy must be used inside PharmacyProvider");
  return v;
}
