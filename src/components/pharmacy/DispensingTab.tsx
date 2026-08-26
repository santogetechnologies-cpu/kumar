import { useMemo, useState, useEffect } from "react";
import { usePharmacy, type Medicine } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, Trash2, ShoppingCart, Search, User, Receipt, CheckCircle2, AlertTriangle, CalendarClock, Printer } from "lucide-react";
import { toast } from "sonner";
import { BillPrintDialog } from "./BillPrintDialog";
import type { Bill } from "@/lib/pharmacy-store";

/* ---- Types ---- */
interface CartItem {
  medicineId: string;
  name: string;
  batch: string;
  expiry: string;
  price: number;
  quantity: number;
  stock: number;
  details?: string;
}

/** Group items by name, sorted by expiry (FIFO) */
interface ItemGroup {
  name: string;
  category: string;
  batches: Medicine[]; // or Material[]
  totalPharmacyStock: number;
}

export function DispensingTab() {
  const { medicines, materials, doctors, addBill, autoPrint, printFormat } = usePharmacy();
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"medicines" | "materials">("medicines");
  const [selectedGroup, setSelectedGroup] = useState<ItemGroup | null>(null);
  
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // Prescription Form
  const [isDetailed, setIsDetailed] = useState(false);
  const [qty, setQty] = useState<number>(1);
  const [frequency, setFrequency] = useState("Twice Daily (2x/day)");
  const [foodTiming, setFoodTiming] = useState("After Food");
  const [duration, setDuration] = useState<number>(5);
  const [dosagePattern, setDosagePattern] = useState("1-0-1");
  const [timing, setTiming] = useState("8:00 AM, 8:00 PM");
  const [autoCalc, setAutoCalc] = useState(true);

  // Cart & Bill
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [lastBillId, setLastBillId] = useState<string | null>(null);

  // Build FIFO groups: group by name, sort batches by expiry date ascending
  const groups = useMemo<ItemGroup[]>(() => {
    const source = activeTab === "medicines" ? medicines : materials;
    const map = new Map<string, Medicine[]>();
    for (const m of source) {
      const key = m.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m as Medicine); // cast for simplicity, material has same shape
    }
    const result: ItemGroup[] = [];
    map.forEach((batches, _key) => {
      const sorted = [...batches].sort(
        (a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()
      );
      const totalPharmacyStock = sorted.reduce((s, m) => s + m.pharmacyQuantity, 0);
      result.push({ name: sorted[0].name, category: sorted[0].category, batches: sorted, totalPharmacyStock });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [medicines, materials, activeTab]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups.slice(0, 8);
    return groups
      .filter(g =>
        g.name.toLowerCase().includes(t) ||
        g.batches.some(b => b.batch.toLowerCase().includes(t))
      )
      .slice(0, 15);
  }, [q, groups]);

  // Auto-calculate quantity
  useEffect(() => {
    if (isDetailed && autoCalc) {
      const parts = dosagePattern.split("-");
      const daily = parts.reduce((acc, part) => acc + (parseFloat(part) || 0), 0);
      setQty(Math.ceil(daily * duration));
    }
  }, [isDetailed, autoCalc, dosagePattern, duration]);

  /** FIFO: deduct qty from earliest expiry batches first */
  const resolveFifoBatches = (group: ItemGroup, totalQty: number): { med: Medicine; qty: number }[] => {
    const allocations: { med: Medicine; qty: number }[] = [];
    let remaining = totalQty;
    for (const med of group.batches) {
      if (remaining <= 0) break;
      if (med.pharmacyQuantity <= 0) continue;
      const take = Math.min(remaining, med.pharmacyQuantity);
      allocations.push({ med, qty: take });
      remaining -= take;
    }
    return allocations;
  };

  const handleAdd = () => {
    if (!selectedGroup) return;
    if (qty <= 0) { toast.error("Invalid quantity"); return; }
    if (qty > selectedGroup.totalPharmacyStock) {
      toast.error(`Only ${selectedGroup.totalPharmacyStock} units available in pharmacy`);
      return;
    }

    const fifo = resolveFifoBatches(selectedGroup, qty);
    if (fifo.length === 0) { toast.error("No pharmacy stock available"); return; }

    let details: string | undefined;
    if (isDetailed) {
      details = `${frequency}, ${foodTiming} for ${duration} days (${dosagePattern})`;
    }

    setCart(c => {
      let updated = [...c];
      for (const { med, qty: bqty } of fifo) {
        const ex = updated.find(x => x.medicineId === med.id);
        if (ex) {
          if (ex.quantity + bqty > med.pharmacyQuantity) {
            toast.error(`Not enough stock for batch ${med.batch}`);
            return c;
          }
          updated = updated.map(x => x.medicineId === med.id ? { ...x, quantity: x.quantity + bqty, details } : x);
        } else {
          updated.push({
            medicineId: med.id,
            name: med.name + (fifo.length > 1 ? ` [Batch: ${med.batch}]` : ""),
            batch: med.batch,
            expiry: med.expiry,
            price: med.price,
            quantity: bqty,
            stock: med.pharmacyQuantity,
            details,
          });
        }
      }
      return updated;
    });

    setSelectedGroup(null);
    setQ("");
    setQty(1);
    toast.success(`Added ${qty} × ${selectedGroup.name} to prescription`);
  };

  const changeQty = (id: string, delta: number) => {
    setCart(c => c.flatMap(x => {
      if (x.medicineId !== id) return [x];
      const nq = x.quantity + delta;
      if (nq <= 0) return [];
      if (nq > x.stock) { toast.error("Not enough pharmacy stock"); return [x]; }
      return [{ ...x, quantity: nq }];
    }));
  };

  const setQtyDirectly = (id: string, qtyStr: string) => {
    const val = parseInt(qtyStr) || 0;
    setCart(c => c.flatMap(x => {
      if (x.medicineId !== id) return [x];
      if (val <= 0) return []; // removes item if 0
      if (val > x.stock) { toast.error("Not enough pharmacy stock"); return [x]; }
      return [{ ...x, quantity: val }];
    }));
  };

  const removeItem = (id: string) => setCart(c => c.filter(x => x.medicineId !== id));

  const grossTotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const total = grossTotal - (grossTotal * discountPct) / 100;

  const [doctorName, setDoctorName] = useState("");

  const dispense = async () => {
    if (!patientName.trim()) { toast.error("Enter patient name"); return; }
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    try {
      const bill = await addBill({
        patientName: patientName.trim(),
        patientId: patientId.trim() || "P" + Math.floor(1000 + Math.random() * 9000),
        doctorName: doctorName,
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
      
      if (autoPrint) {
        setShowPrintDialog(true);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const daysUntilExpiry = (expiry: string) =>
    Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Left: search & prescription form */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Prescription</h2>
              <p className="text-xs text-muted-foreground">Search & add items (FIFO batch auto-selected)</p>
            </div>
          </div>

          <div className="flex border rounded-lg overflow-hidden mb-4 p-1 bg-muted/20">
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${activeTab === "medicines" ? "bg-primary text-primary-foreground shadow" : "hover:bg-muted"}`}
              onClick={() => { setActiveTab("medicines"); setSelectedGroup(null); setQ(""); }}
            >Medicines</button>
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${activeTab === "materials" ? "bg-primary text-primary-foreground shadow" : "hover:bg-muted"}`}
              onClick={() => { setActiveTab("materials"); setSelectedGroup(null); setQ(""); }}
            >Materials</button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => { setQ(e.target.value); setSelectedGroup(null); }}
              placeholder={`Type ${activeTab.slice(0,-1)} name or batch number...`}
              className="pl-9 h-11 text-base"
            />
          </div>

          {/* Search results — grouped by item name */}
          {!selectedGroup && (
            <div className="grid gap-2 max-h-[300px] overflow-auto pr-1">
              {filtered.length === 0 && q && (
                <div className="text-center py-6 text-muted-foreground text-sm">No items found</div>
              )}
              {filtered.map((g) => {
                const out = g.totalPharmacyStock <= 0;
                const low = g.totalPharmacyStock > 0 && g.batches.some(b => b.pharmacyQuantity <= b.minLevel);
                const firstBatch = g.batches[0];
                const days = daysUntilExpiry(firstBatch.expiry);
                return (
                  <button
                    key={g.name}
                    onClick={() => setSelectedGroup(g)}
                    disabled={out}
                    className="w-full text-left rounded-xl border p-3 hover:border-primary hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.category}</div>
                        {/* Show all batches */}
                        <div className="mt-1.5 space-y-0.5">
                          {g.batches.map((b, bi) => (
                            <div key={b.id} className="flex items-center gap-1.5 text-[11px]">
                              <span className={`font-mono px-1 rounded ${bi === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {bi === 0 ? "▶ " : "  "}Batch {b.batch}
                              </span>
                              <span className="text-muted-foreground">Exp: {new Date(b.expiry).toLocaleDateString()}</span>
                              {daysUntilExpiry(b.expiry) < 0 && <Badge variant="destructive" className="text-[10px] py-0">Expired</Badge>}
                              {daysUntilExpiry(b.expiry) >= 0 && daysUntilExpiry(b.expiry) <= 30 && <Badge className="text-[10px] py-0 bg-warning text-white">Exp soon</Badge>}
                              <span className="ml-auto">Stock: {b.pharmacyQuantity}</span>
                              <span className="text-muted-foreground">₹{b.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-primary">₹{firstBatch.price.toFixed(2)}</div>
                        {out
                          ? <Badge variant="destructive">Out of Stock</Badge>
                          : low
                          ? <Badge className="bg-warning text-white hover:bg-warning">Low: {g.totalPharmacyStock}</Badge>
                          : <span className="text-[11px] text-muted-foreground">Stock: {g.totalPharmacyStock}</span>
                        }
                        {g.batches.length > 1 && (
                          <div className="text-[10px] text-muted-foreground mt-1">{g.batches.length} batches</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected medicine form */}
          {selectedGroup && (
            <div className="mt-4 border rounded-xl p-4 bg-muted/20">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-primary">{selectedGroup.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Total available: <strong>{selectedGroup.totalPharmacyStock}</strong> units across {selectedGroup.batches.length} batch{selectedGroup.batches.length > 1 ? "es" : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)}>Change</Button>
              </div>

              {/* Batch breakdown */}
              <div className="mb-4 rounded-lg border bg-background p-2 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" /> FIFO Batch Order (earliest expiry first)
                </div>
                {selectedGroup.batches.map((b, bi) => {
                  const days = daysUntilExpiry(b.expiry);
                  return (
                    <div key={b.id} className={`flex items-center gap-2 text-xs rounded-md p-1.5 ${bi === 0 ? "bg-primary/5 border border-primary/20" : ""}`}>
                      <span className={`font-semibold ${bi === 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {bi === 0 ? "① First" : `② Batch ${bi + 1}`}
                      </span>
                      <span className="font-mono bg-muted px-1 rounded">{b.batch}</span>
                      <span>Exp: {new Date(b.expiry).toLocaleDateString()}</span>
                      {days < 0 && <Badge variant="destructive" className="text-[10px] py-0">Expired</Badge>}
                      {days >= 0 && days <= 30 && <Badge className="text-[10px] py-0 bg-warning text-white"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{days}d</Badge>}
                      <span className="ml-auto text-muted-foreground">Stock: {b.pharmacyQuantity} | ₹{b.price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Simple / Detailed toggle */}
              <div className="flex items-center gap-2 mb-4 bg-background border rounded-lg p-1 w-max">
                <button
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${!isDetailed ? "bg-primary text-primary-foreground shadow" : "hover:bg-muted text-muted-foreground"}`}
                  onClick={() => setIsDetailed(false)}
                >Simple Entry</button>
                <button
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${isDetailed ? "bg-primary text-primary-foreground shadow" : "hover:bg-muted text-muted-foreground"}`}
                  onClick={() => setIsDetailed(true)}
                >Detailed Prescription</button>
              </div>

              {isDetailed ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <select className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm" value={frequency} onChange={e => setFrequency(e.target.value)}>
                      <option>Once Daily (1x/day)</option>
                      <option>Twice Daily (2x/day)</option>
                      <option>Thrice Daily (3x/day)</option>
                      <option>SOS</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Food Timing</Label>
                    <select className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm" value={foodTiming} onChange={e => setFoodTiming(e.target.value)}>
                      <option>After Food</option>
                      <option>Before Food</option>
                      <option>Empty Stomach</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Duration (days)</Label>
                    <Input type="number" className="h-9" value={duration} onChange={e => setDuration(+e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dosage Pattern (M-A-N)</Label>
                    <Input className="h-9" value={dosagePattern} onChange={e => setDosagePattern(e.target.value)} placeholder="e.g. 1-0-1" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Timing</Label>
                    <Input className="h-9" value={timing} onChange={e => setTiming(e.target.value)} placeholder="8:00 AM, 8:00 PM" />
                  </div>
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5 w-1/3">
                        <Label className="text-xs font-semibold">Total Quantity</Label>
                        <Input type="number" className="h-10 text-lg font-bold" value={qty} onChange={e => setQty(+e.target.value)} disabled={autoCalc} />
                      </div>
                      <div className="flex items-center space-x-2 pt-5">
                        <Checkbox id="autocalc" checked={autoCalc} onCheckedChange={c => setAutoCalc(!!c)} />
                        <label htmlFor="autocalc" className="text-sm font-medium leading-none">Auto-calculate</label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Total Quantity to Dispense</Label>
                  <Input type="number" className="h-11 w-32 text-lg font-bold" value={qty} onChange={e => setQty(+e.target.value)} />
                </div>
              )}

              <Button onClick={handleAdd} className="w-full mt-6 h-11 text-base">
                + Add to Prescription
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Right: cart & checkout */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Patient Details</h2>
              <p className="text-xs text-muted-foreground">Who is this for?</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="pname">Patient Name *</Label>
              <Input id="pname" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Mr. Ramesh" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pid">Patient ID (optional)</Label>
                <Input id="pid" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="P1234" className="h-11" />
              </div>
              <div>
                <Label>Doctor</Label>
                <select
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                >
                  <option value="">— Select Doctor —</option>
                  {doctors.filter(d => d.active).map(d => (
                    <option key={d.id} value={d.name}>{d.name} {d.specialty ? `(${d.specialty})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Bill Summary</h2>
                <p className="text-xs text-muted-foreground">{cart.length} item{cart.length === 1 ? "" : "s"}</p>
              </div>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm py-10">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Prescription is empty.
            </div>
          ) : (
            <div className="space-y-2 mb-4 flex-1 overflow-auto max-h-64 pr-1">
              {cart.map(c => (
                <div key={c.medicineId} className="flex flex-col gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Batch: {c.batch} | Exp: {new Date(c.expiry).toLocaleDateString()} | ₹{c.price.toFixed(2)} × {c.quantity}
                      </div>
                    </div>
                    <div className="font-bold text-sm shrink-0">₹{(c.price * c.quantity).toFixed(2)}</div>
                  </div>
                  {c.details && <div className="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded">{c.details}</div>}
                  <div className="flex items-center justify-between border-t pt-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(c.medicineId, -1)}><Minus className="h-3 w-3" /></Button>
                      <Input
                        type="number"
                        className="h-7 w-14 text-center px-1 py-0 text-sm font-semibold"
                        value={c.quantity || ""}
                        onChange={(e) => setQtyDirectly(c.medicineId, e.target.value)}
                        min={0}
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(c.medicineId, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeItem(c.medicineId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gross Total</span>
              <span className="font-semibold">₹{grossTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Discount</span>
              <select
                className="h-8 rounded-md border bg-background px-2 py-1 text-sm font-medium w-24 text-right"
                value={discountPct}
                onChange={e => setDiscountPct(+e.target.value)}
              >
                {[0, 5, 10, 15, 20, 25, 50, 75, 100].map(pct => (
                  <option key={pct} value={pct}>{pct}%</option>
                ))}
              </select>
            </div>
            <div className="flex items-baseline justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Net Payable</span>
              <span className="text-3xl font-bold text-primary">₹{total.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1">
              {["Cash", "UPI", "Card"].map(p => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`h-9 rounded-lg border font-medium text-xs transition ${payment === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >{p}</button>
              ))}
            </div>
            <Button onClick={dispense} disabled={cart.length === 0} className="w-full h-12 text-base font-semibold">
              <Receipt className="h-5 w-5 mr-2" /> Dispense & Bill
            </Button>
            {lastBillId && (
              <div className="flex items-center justify-between text-sm mt-2">
                <div className="text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Last bill: <span className="font-mono font-semibold">{lastBillId}</span>
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
