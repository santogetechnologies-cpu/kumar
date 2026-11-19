import { useSyncExternalStore } from "react";

/** A bill put on hold from Dispensing. No stock is deducted and no bill is created until it is dispensed. */
export interface HeldBill {
  id: string;
  heldAt: string; // ISO — when it was put on hold (NOT the bill date)
  patientName: string;
  patientId: string;
  doctorName: string;
  payment: string;
  discountPct: number;
  /** Cart items: item group key + quantity. Batches/prices are re-allocated when retrieved. */
  items: { key: string; name: string; qty: number }[];
  /** Estimated total at the time of hold (for display only). */
  estTotal: number;
}

const STORAGE_KEY = "pharmacy-held-bills-v1";
const listeners = new Set<() => void>();
let cache: HeldBill[] | null = null;
let pendingResume: HeldBill | null = null;

function load(): HeldBill[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as HeldBill[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(list: HeldBill[]) {
  cache = list;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function holdBill(b: Omit<HeldBill, "id" | "heldAt">): HeldBill {
  const held: HeldBill = {
    ...b,
    id: "H" + Date.now().toString(36).toUpperCase(),
    heldAt: new Date().toISOString(),
  };
  save([held, ...load()]);
  return held;
}

export function removeHeldBill(id: string) {
  save(load().filter(h => h.id !== id));
}

/** Mark a held bill to be loaded into the Dispensing cart (consumed by DispensingTab). */
export function setPendingResume(b: HeldBill | null) { pendingResume = b; }
export function takePendingResume(): HeldBill | null {
  const b = pendingResume;
  pendingResume = null;
  return b;
}
export function peekPendingResume() { return pendingResume; }

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const empty: HeldBill[] = [];

export function useHeldBills(): HeldBill[] {
  return useSyncExternalStore(subscribe, load, () => empty);
}
