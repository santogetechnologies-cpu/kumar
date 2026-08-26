import { useMemo, useState, useRef, useEffect } from "react";
import { usePharmacy, type Medicine } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Minus, Trash2, ShoppingCart, Search, User,
  Receipt, CheckCircle2, AlertTriangle, CalendarClock, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { BillPrintDialog } from "./BillPrintDialog";
import type { Bill } from "@/lib/pharmacy-store";

/* ── Types ── */
interface CartItem {
  medicineId: string;
  name: string;
  batch: string;
  expiry: string;
  price: number;
  quantity: number;
  stock: number;
}

interface ItemGroup {
  name: string;
  category: string;
  batches: Medicine[];
  totalPharmacyStock: number;
}

export function DispensingTab() {
  const { medicines, materials, doctors, addBill, autoPrint, printFormat } = usePharmacy();

  const [q, setQ] = useState("");
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  /* Cart & Bill */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [lastBillId, setLastBillId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  /* Merged medicines + materials */
  const allItems = useMemo(() => [
    ...medicines.map(m => ({ ...m, _isMaterial: false })),
    ...materials.map(m => ({ ...m, _isMaterial: true })),
  ], [medicines, materials]);

  /* FIFO groups: group by name, sort batches by expiry */
  const groups = useMemo<ItemGroup[]>(() => {
    const map = new Map<string, Medicine[]>();
    for (const m of allItems) {
      const key = m.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m as Medicine);
    }
    const result: ItemGroup[] = [];
    map.forEach(batches => {
      const sorted = [...batches].sort(
        (a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()
      );
      const totalPharmacyStock = sorted.reduce((s, m) => s + m.pharmacyQuantity, 0);
      result.push({ name: sorted[0].name, category: sorted[0].category, batches: sorted, totalPharmacyStock });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups.slice(0, 8);
    return groups.filter(g =>
      g.name.toLowerCase().includes(t) ||
      g.batches.some(b => b.batch.toLowerCase().includes(t))
    ).slice(0, 15);
  }, [q, groups]);

  /* FIFO allocation */
  const resolveFifo = (group: ItemGroup, totalQty: number) => {
    const out: { med: Medicine; qty: number }[] = [];
    let rem = totalQty;
    for (const med of group.batches) {
      if (rem <= 0) break;
      if (med.pharmacyQuantity <= 0) continue;
      const take = Math.min(rem, med.pharmacyQuantity);
      out.push({ med, qty: take });
      rem -= take;
    }
    return out;
  };

  /* Click item → add 1 unit via FIFO instantly */
  const handleAddItem = (g: ItemGroup) => {
    if (g.totalPharmacyStock <= 0) {
      toast.error("No pharmacy stock available");
      return;
    }
    const fifo = resolveFifo(g, 1);
    if (!fifo.length) return;

    setCart(c => {
      let updated = [...c];
      for (const { med, qty: bqty } of fifo) {
        const ex = updated.find(x => x.medicineId === med.id);
        if (ex) {
          if (ex.quantity + bqty > med.pharmacyQuantity) {
            toast.error(`Max stock: ${med.pharmacyQuantity}`);
            return c;
          }
          updated = updated.map(x =>
            x.medicineId === med.id ? { ...x, quantity: x.quantity + bqty } : x
          );
        } else {
          updated.push({
            medicineId: med.id,
            name: g.batches.length > 1 ? `${med.name} [${med.batch}]` : med.name,
            batch: med.batch,
            expiry: med.expiry,
            price: med.price,
            quantity: bqty,
            stock: med.pharmacyQuantity,
          });
        }
      }
      return updated;
    });

    toast.success(`Added ${g.name}`);
    setQ("");
    searchRef.current?.focus();
  };

  /* Cart qty controls */
  const changeQty = (id: string, delta: number) => {
    setCart(c => c.flatMap(x => {
      if (x.medicineId !== id) return [x];
      const nq = x.quantity + delta;
      if (nq <= 0) return [];
      if (nq > x.stock) { toast.error("Not enough pharmacy stock"); return [x]; }
      return [{ ...x, quantity: nq }];
    }));
  };

  const setQtyDirect = (id: string, val: string) => {
    const n = parseInt(val) || 0;
    setCart(c => c.flatMap(x => {
      if (x.medicineId !== id) return [x];
      if (n <= 0) return [];
      if (n > x.stock) { toast.error("Not enough pharmacy stock"); return [x]; }
      return [{ ...x, quantity: n }];
    }));
  };

  const removeItem = (id: string) => setCart(c => c.filter(x => x.medicineId !== id));

  const grossTotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const total = grossTotal - (grossTotal * discountPct) / 100;

  /* Dispense */
  const dispense = async () => {
    if (!patientName.trim()) { toast.error("Enter patient name"); return; }
    if (!cart.length) { toast.error("Cart is empty"); return; }
    try {
      const selectedDoc = doctors.find(d => d.name === doctorName);
      const bill = await addBill({
        patientName: patientName.trim(),
        patientId: patientId.trim() || "P" + Math.floor(1000 + Math.random() * 9000),
        doctorId: selectedDoc?.id,
        doctorName,
        items: cart.map(c => ({ medicineId: c.medicineId, name: c.name, quantity: c.quantity, price: c.price })),
        total,
        discountPct,
        status: "paid",
        paymentMethod: payment,
      });
      setLastBillId(bill.id);
      setLastBill(bill);
      toast.success(`Dispensed! Bill ${bill.id}`);
      setCart([]);
      setPatientName("");
      setPatientId("");
      if (autoPrint) setShowPrintDialog(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const daysUntilExpiry = (exp: string) =>
    Math.floor((new Date(exp).getTime() - Date.now()) / 86400000);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">

      {/* ── LEFT: Search ── */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Item Search</h2>
              <p className="text-xs text-muted-foreground">Click an item to add it to the prescription</p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type medicine or material name / batch…"
              className="pl-9 h-11 text-base"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="grid gap-2 max-h-[520px] overflow-auto pr-1">
            {filtered.length === 0 && q && (
              <div className="text-center py-8 text-muted-foreground text-sm">No items found for "{q}"</div>
            )}
            {filtered.length === 0 && !q && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Start typing to search medicines & materials
              </div>
            )}
            {filtered.map(g => {
              const out = g.totalPharmacyStock <= 0;
              const low = !out && g.batches.some(b => b.pharmacyQuantity <= b.minLevel);
              const firstBatch = g.batches[0];
              const isMat = (firstBatch as any)._isMaterial;
              const inCart = cart.filter(x => g.batches.some(b => b.id === x.medicineId));
              const cartQty = inCart.reduce((s, x) => s + x.quantity, 0);

              return (
                <button
                  key={g.name}
                  onClick={() => handleAddItem(g)}
                  disabled={out}
                  className="w-full text-left rounded-xl border p-3.5 hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{g.name}</span>
                        {isMat && <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">Material</Badge>}
                        {cartQty > 0 && (
                          <Badge className="text-[10px] py-0 px-1.5 bg-primary shrink-0">
                            ×{cartQty} in cart
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1.5">{g.category}</div>
                      {/* Batch rows */}
                      <div className="space-y-0.5">
                        {g.batches.slice(0, 3).map((b, bi) => {
                          const days = daysUntilExpiry(b.expiry);
                          return (
                            <div key={b.id} className="flex items-center gap-1.5 text-[11px]">
                              <span className={`font-mono px-1 rounded ${bi === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {bi === 0 ? "▶ " : "  "}{b.batch}
                              </span>
                              <span className="text-muted-foreground">Exp: {new Date(b.expiry).toLocaleDateString()}</span>
                              {days < 0 && <Badge variant="destructive" className="text-[10px] py-0">Expired</Badge>}
                              {days >= 0 && days <= 30 && <Badge className="text-[10px] py-0 bg-warning text-white"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{days}d</Badge>}
                              <span className="ml-auto text-muted-foreground">Stk: {b.pharmacyQuantity}</span>
                            </div>
                          );
                        })}
                        {g.batches.length > 3 && (
                          <div className="text-[10px] text-muted-foreground pl-1">+{g.batches.length - 3} more batches</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-bold text-primary text-base">₹{firstBatch.price.toFixed(2)}</div>
                      {out
                        ? <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                        : low
                        ? <Badge className="text-[10px] bg-warning text-white hover:bg-warning">Low Stock</Badge>
                        : <span className="text-xs text-muted-foreground">{g.totalPharmacyStock} units</span>
                      }
                      <div className="mt-2 text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition">
                        Click to add →
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── RIGHT: Cart & Checkout ── */}
      <div className="space-y-4">

        {/* Patient */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Patient Details</h2>
              <p className="text-xs text-muted-foreground">Required for billing</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="pname">Patient Name *</Label>
              <Input id="pname" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Mr. Ramesh Kumar" className="h-11 mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pid">Patient ID (optional)</Label>
                <Input id="pid" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="P1234" className="h-10 mt-1" />
              </div>
              <div>
                <Label>Doctor (optional)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                >
                  <option value="">— Select Doctor —</option>
                  {doctors.filter(d => d.active).map(d => (
                    <option key={d.id} value={d.name}>{d.name}{d.specialty ? ` (${d.specialty})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Cart */}
        <Card className="p-5 flex flex-col" style={{ minHeight: 420 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Prescription Cart</h2>
                <p className="text-xs text-muted-foreground">
                  {cart.length === 0 ? "No items yet" : `${cart.length} item${cart.length > 1 ? "s" : ""} · ${cart.reduce((s, x) => s + x.quantity, 0)} units`}
                </p>
              </div>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={() => setCart([])}>
                Clear all
              </Button>
            )}
          </div>

          {/* Cart items */}
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-10">
              <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Search and click medicines to add them here</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-auto max-h-72 pr-0.5">
              {cart.map(item => (
                <div key={item.medicineId} className="rounded-xl border p-3 bg-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Batch: {item.batch} · Exp: {new Date(item.expiry).toLocaleDateString()} · ₹{item.price.toFixed(2)} ea
                      </div>
                    </div>
                    <div className="font-bold text-sm shrink-0 text-primary">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg"
                        onClick={() => changeQty(item.medicineId, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input
                        type="number"
                        className="h-8 w-16 text-center px-1 text-sm font-bold"
                        value={item.quantity}
                        onChange={e => setQtyDirect(item.medicineId, e.target.value)}
                        min={0}
                      />
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg"
                        onClick={() => changeQty(item.medicineId, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground ml-1">/{item.stock}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => removeItem(item.medicineId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals + Payment */}
          <div className="border-t mt-auto pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gross Total</span>
              <span className="font-semibold">₹{grossTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Discount</span>
              <select
                className="h-8 rounded-lg border bg-background px-2 text-sm font-medium w-24 text-right"
                value={discountPct}
                onChange={e => setDiscountPct(+e.target.value)}
              >
                {[0, 5, 10, 15, 20, 25, 50].map(p => (
                  <option key={p} value={p}>{p}%</option>
                ))}
              </select>
            </div>
            <div className="flex items-baseline justify-between pt-2 border-t">
              <span className="font-semibold">Net Payable</span>
              <span className="text-3xl font-bold text-primary">₹{total.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {["Cash", "UPI", "Card"].map(p => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`h-9 rounded-lg border font-medium text-sm transition ${payment === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >{p}</button>
              ))}
            </div>
            <Button onClick={dispense} disabled={!cart.length} className="w-full h-12 text-base font-semibold">
              <Receipt className="h-5 w-5 mr-2" /> Dispense & Generate Bill
            </Button>
            {lastBillId && (
              <div className="flex items-center justify-between text-sm">
                <div className="text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Bill: <span className="font-mono font-bold">{lastBillId}</span></span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <BillPrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        bill={lastBill}
        format={printFormat}
      />
    </div>
  );
}
