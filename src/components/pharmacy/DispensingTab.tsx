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
interface CartState {
  name: string;
  requestedQty: number;
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
  const [cartState, setCartState] = useState<CartState[]>([]);
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
      const sorted = [...batches].sort((a, b) => {
        if (a.pharmacyQuantity > 0 && b.pharmacyQuantity <= 0) return -1;
        if (a.pharmacyQuantity <= 0 && b.pharmacyQuantity > 0) return 1;
        return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
      });
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

  /* Click item → add 1 unit instantly */
  const handleAddItem = (g: ItemGroup) => {
    if (g.totalPharmacyStock <= 0) {
      toast.error("No pharmacy stock available");
      return;
    }

    setCartState(c => {
      const ex = c.find(x => x.name === g.name);
      if (ex) {
        if (ex.requestedQty + 1 > g.totalPharmacyStock) {
          toast.error(`Max stock: ${g.totalPharmacyStock}`);
          return c;
        }
        return c.map(x => x.name === g.name ? { ...x, requestedQty: x.requestedQty + 1 } : x);
      } else {
        return [...c, { name: g.name, requestedQty: 1 }];
      }
    });

    toast.success(`Added ${g.name}`);
    setQ("");
    searchRef.current?.focus();
  };

  /* Cart qty controls */
  const changeQty = (name: string, delta: number) => {
    setCartState(c => c.flatMap(x => {
      if (x.name !== name) return [x];
      const g = groups.find(g => g.name === name);
      if (!g) return [];
      const nq = x.requestedQty + delta;
      if (nq <= 0) return [];
      if (nq > g.totalPharmacyStock) { toast.error(`Max stock: ${g.totalPharmacyStock}`); return [x]; }
      return [{ ...x, requestedQty: nq }];
    }));
  };

  const setQtyDirect = (name: string, val: string) => {
    const n = parseInt(val) || 0;
    setCartState(c => c.flatMap(x => {
      if (x.name !== name) return [x];
      const g = groups.find(g => g.name === name);
      if (!g) return [];
      if (n <= 0) return [];
      if (n > g.totalPharmacyStock) { toast.error(`Max stock: ${g.totalPharmacyStock}`); return [x]; }
      return [{ ...x, requestedQty: n }];
    }));
  };

  const removeItem = (name: string) => setCartState(c => c.filter(x => x.name !== name));

  const cart = useMemo(() => {
    return cartState.map(c => {
      const g = groups.find(g => g.name === c.name);
      if (!g) return null;
      const breakdown = resolveFifo(g, c.requestedQty);
      const itemTotal = breakdown.reduce((s, b) => s + b.qty * b.med.price, 0);
      return { ...c, group: g, breakdown, itemTotal };
    }).filter(Boolean) as (CartState & { group: ItemGroup, breakdown: ReturnType<typeof resolveFifo>, itemTotal: number })[];
  }, [cartState, groups]);

  const grossTotal = cart.reduce((s, x) => s + x.itemTotal, 0);
  const total = grossTotal - (grossTotal * discountPct) / 100;

  /* Dispense */
  const dispense = async () => {
    if (!patientName.trim()) { toast.error("Enter patient name"); return; }
    if (!doctorName.trim()) { toast.error("Please select a prescribing doctor"); return; }
    if (!cart.length) { toast.error("Cart is empty"); return; }
    try {
      const selectedDoc = doctors.find(d => d.name === doctorName);

      const billItems = cart.flatMap(c => 
        c.breakdown.map(b => ({
          medicineId: b.med.id, 
          name: b.med.name, 
          quantity: b.qty, 
          price: b.med.price
        }))
      );

      const bill = await addBill({
        patientName: patientName.trim(),
        patientId: patientId.trim() || "P" + Math.floor(1000 + Math.random() * 9000),
        doctorId: selectedDoc?.id,
        doctorName,
        items: billItems,
        total,
        discountPct,
        status: "paid",
        paymentMethod: payment,
      });
      setLastBillId(bill.id);
      setLastBill(bill);
      toast.success(`Dispensed! Bill ${bill.id}`);
      setCartState([]);
      setPatientName("");
      setPatientId("");
      setDoctorName("");
      if (autoPrint) setShowPrintDialog(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const daysUntilExpiry = (exp: string) =>
    Math.floor((new Date(exp).getTime() - Date.now()) / 86400000);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">

      {/* ── LEFT: Cart & Checkout (Moved from Right) ── */}
      <div className="space-y-4">

        {/* Patient */}
        <Card className="p-6 border-brand-red/10 shadow-sm bg-gradient-to-br from-card to-brand-red/[0.02]">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center shadow-sm">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg tracking-tight">Patient Details</h2>
              <p className="text-xs text-muted-foreground">Required for billing</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="pname" className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Patient Name *</Label>
              <Input id="pname" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Mr. Ramesh Kumar" className="h-11 mt-1.5 bg-background/50 focus-visible:ring-brand-red/30 transition-all shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pid" className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Patient ID (optional)</Label>
                <Input id="pid" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="P1234" className="h-11 mt-1.5 bg-background/50 shadow-sm" />
              </div>
              <div>
                <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Doctor *</Label>
                <select
                  className="flex h-11 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm mt-1.5 shadow-sm focus-visible:ring-brand-red/30 transition-all outline-none focus:border-brand-red/50"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  required
                >
                  <option value="">— Select Doctor * —</option>
                  {doctors.filter(d => d.active).map(d => (
                    <option key={d.id} value={d.name}>{d.name}{d.specialty ? ` (${d.specialty})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Cart */}
        <Card className="p-6 flex flex-col border-brand-blue/10 shadow-sm bg-gradient-to-br from-card to-brand-blue/[0.02]" style={{ minHeight: 460 }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shadow-sm">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-lg tracking-tight">Prescription Cart</h2>
                <p className="text-xs text-muted-foreground">
                  {cart.length === 0 ? "No items yet" : `${cart.length} item${cart.length > 1 ? "s" : ""} · ${cart.reduce((s, x) => s + x.requestedQty, 0)} units`}
                </p>
              </div>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs transition-colors rounded-lg" onClick={() => setCartState([])}>
                Clear all
              </Button>
            )}
          </div>

          {/* Cart items */}
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-10 bg-background/30 rounded-xl border border-dashed border-border/60">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs opacity-70 mt-1">Search and click medicines on the right</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-auto max-h-80 pr-1">
              {cart.map(item => (
                <div key={item.name} className="rounded-xl border border-border/50 p-3.5 bg-background/50 hover:bg-accent/30 transition-colors shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate text-foreground/90">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex flex-col gap-0.5">
                        {item.breakdown.map((b, i) => (
                          <span key={i}>Batch {b.med.batch} <span className="opacity-50">|</span> {b.qty} × ₹{b.med.price.toFixed(2)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="font-bold text-sm shrink-0 text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-md">
                      ₹{item.itemTotal.toFixed(2)}
                    </div>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
                    <div className="flex items-center gap-1 bg-background rounded-lg border shadow-sm p-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground"
                        onClick={() => changeQty(item.name, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input
                        type="number"
                        className="h-7 w-12 text-center px-1 text-sm font-bold border-0 bg-transparent focus-visible:ring-0 shadow-none"
                        value={item.requestedQty}
                        onChange={e => setQtyDirect(item.name, e.target.value)}
                        min={0}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground"
                        onClick={() => changeQty(item.name, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Max {item.group.totalPharmacyStock}</span>
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        onClick={() => removeItem(item.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals + Payment */}
          <div className="border-t border-border/60 mt-auto pt-5 space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Gross Total</span>
                <span className="font-semibold text-foreground/80">₹{grossTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Discount</span>
                <select
                    className="h-8 rounded-md border border-border/60 bg-background/50 px-2 text-sm font-semibold w-24 text-right shadow-sm focus-visible:ring-brand-blue/30 outline-none"
                    value={discountPct}
                    onChange={e => setDiscountPct(+e.target.value)}
                >
                    {[0, 5, 10, 15, 20, 25, 50].map(p => (
                    <option key={p} value={p}>{p}%</option>
                    ))}
                </select>
                </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
              <span className="font-bold text-primary text-sm uppercase tracking-wider">Net Payable</span>
              <span className="text-3xl font-extrabold text-primary tracking-tight">₹{total.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["Cash", "UPI", "Card"].map(p => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`h-10 rounded-xl border font-semibold text-sm transition-all shadow-sm ${payment === p ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-1 ring-offset-background" : "bg-background/50 hover:bg-accent hover:border-accent-foreground/20 text-muted-foreground hover:text-foreground"}`}
                >{p}</button>
              ))}
            </div>
            <Button onClick={dispense} disabled={!cart.length} className="w-full h-12 text-base font-bold shadow-md hover:shadow-lg transition-all rounded-xl relative overflow-hidden group">
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <Receipt className="h-5 w-5 mr-2" /> Dispense & Generate Bill
            </Button>
            {lastBillId && (
              <div className="flex items-center justify-between text-sm pt-2">
                <div className="text-success flex items-center gap-1.5 bg-success/10 px-2.5 py-1 rounded-md border border-success/20">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Bill: <span className="font-mono font-bold">{lastBillId}</span></span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)} className="rounded-lg shadow-sm border-border/60 hover:bg-accent">
                  <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── RIGHT: Search (Moved from Left) ── */}
      <div className="space-y-4">
        <Card className="p-6 border-primary/10 shadow-sm bg-gradient-to-br from-card to-primary/[0.02]">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg tracking-tight">Item Search</h2>
              <p className="text-xs text-muted-foreground">Click an item to add it to the prescription</p>
            </div>
          </div>

          <div className="relative mb-5 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              ref={searchRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type medicine or material name / batch…"
              className="pl-10 h-12 text-base bg-background/50 shadow-sm rounded-xl border-border/60 focus-visible:ring-primary/30 transition-all"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="grid gap-2.5 max-h-[580px] overflow-auto pr-1">
            {filtered.length === 0 && q && (
              <div className="text-center py-12 text-muted-foreground text-sm bg-background/30 rounded-xl border border-dashed border-border/60">No items found for <span className="font-semibold text-foreground">"{q}"</span></div>
            )}
            {filtered.length === 0 && !q && (
              <div className="text-center py-12 text-muted-foreground text-sm bg-background/30 rounded-xl border border-dashed border-border/60">
                <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <span className="font-medium">Start typing to search medicines & materials</span>
              </div>
            )}
            {filtered.map(g => {
              const out = g.totalPharmacyStock <= 0;
              const low = !out && g.batches.some(b => b.pharmacyQuantity <= b.minLevel);
              const firstBatch = g.batches[0];
              const isMat = (firstBatch as any)._isMaterial;
              const inCart = cart.find(x => x.name === g.name);
              const cartQty = inCart ? inCart.requestedQty : 0;

              return (
                <button
                  key={g.name}
                  onClick={() => handleAddItem(g)}
                  disabled={out}
                  className="w-full text-left rounded-xl border border-border/60 bg-card p-4 hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:border-border/60 disabled:hover:bg-card group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-[15px] truncate text-foreground/90 group-hover:text-primary transition-colors">{g.name}</span>
                        {isMat && <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0 bg-secondary/50">Material</Badge>}
                        {cartQty > 0 && (
                          <Badge className="text-[10px] py-0 px-2 bg-primary text-primary-foreground shrink-0 shadow-sm">
                            ×{cartQty} in cart
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2.5 font-medium">{g.category}</div>
                      {/* Batch rows */}
                      <div className="space-y-1">
                        {g.batches.slice(0, 3).map((b, bi) => {
                          const days = daysUntilExpiry(b.expiry);
                          return (
                            <div key={b.id} className="flex items-center gap-2 text-[11px] bg-background/50 rounded-md px-1.5 py-1 border border-border/30">
                              <span className={`font-mono px-1.5 py-0.5 rounded-sm font-semibold ${bi === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {bi === 0 ? "▶ " : "  "}{b.batch}
                              </span>
                              <span className="text-muted-foreground">Exp: {new Date(b.expiry).toLocaleDateString()}</span>
                              {days < 0 && <Badge variant="destructive" className="text-[9px] py-0 px-1 border-0">Expired</Badge>}
                              {days >= 0 && days <= 30 && <Badge className="text-[9px] py-0 px-1 bg-warning text-white border-0"><AlertTriangle className="h-2 w-2 mr-0.5" />{days}d</Badge>}
                              <span className="ml-auto text-muted-foreground font-medium">Stk: <span className="text-foreground/80">{b.pharmacyQuantity}</span></span>
                            </div>
                          );
                        })}
                        {g.batches.length > 3 && (
                          <div className="text-[10px] text-muted-foreground pl-1.5 pt-1 font-medium italic">+{g.batches.length - 3} more batches available</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2 flex flex-col items-end">
                      <div className="font-extrabold text-primary text-lg tracking-tight">₹{firstBatch.price.toFixed(2)}</div>
                      <div className="mt-1">
                          {out
                            ? <Badge variant="destructive" className="text-[10px] border-0">Out of Stock</Badge>
                            : low
                            ? <Badge className="text-[10px] bg-warning text-white hover:bg-warning border-0 shadow-sm">Low Stock</Badge>
                            : <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground font-medium">{g.totalPharmacyStock} units</Badge>
                          }
                      </div>
                      <div className="mt-auto pt-3 text-[11px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Add <Plus className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
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
