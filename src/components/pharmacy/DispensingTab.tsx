import { useMemo, useState, useEffect } from "react";
import { usePharmacy, type Medicine } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, Trash2, ShoppingCart, Search, User, Receipt, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CartItem {
  medicineId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  details?: string;
}

export function DispensingTab() {
  const { medicines, addBill } = usePharmacy();
  const [q, setQ] = useState("");
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  
  // Prescription Form State
  const [isDetailed, setIsDetailed] = useState(false);
  const [qty, setQty] = useState<number>(1);
  const [frequency, setFrequency] = useState("Twice Daily (2x/day)");
  const [foodTiming, setFoodTiming] = useState("After Food");
  const [duration, setDuration] = useState<number>(5);
  const [dosagePattern, setDosagePattern] = useState("1-0-1");
  const [timing, setTiming] = useState("8:00 AM, 8:00 PM");
  const [autoCalc, setAutoCalc] = useState(true);

  // Cart & Bill State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [lastBillId, setLastBillId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return medicines.slice(0, 5);
    return medicines.filter((m) => m.name.toLowerCase().includes(t) || m.batch.toLowerCase().includes(t)).slice(0, 15);
  }, [q, medicines]);

  // Auto-calculate quantity in detailed mode
  useEffect(() => {
    if (isDetailed && autoCalc) {
      const parts = dosagePattern.split("-");
      const daily = parts.reduce((acc, part) => acc + (parseFloat(part) || 0), 0);
      setQty(Math.ceil(daily * duration));
    }
  }, [isDetailed, autoCalc, dosagePattern, duration]);

  const handleAdd = () => {
    if (!selectedMed) return;
    if (qty <= 0) { toast.error("Invalid quantity"); return; }
    if (qty > selectedMed.pharmacyQuantity) { toast.error("Not enough pharmacy stock"); return; }
    
    let details = undefined;
    if (isDetailed) {
      details = `${frequency}, ${foodTiming} for ${duration} days (${dosagePattern})`;
    }

    setCart((c) => {
      const ex = c.find((x) => x.medicineId === selectedMed.id);
      if (ex) {
        if (ex.quantity + qty > selectedMed.pharmacyQuantity) { toast.error("Not enough pharmacy stock"); return c; }
        return c.map((x) => x.medicineId === selectedMed.id ? { ...x, quantity: x.quantity + qty, details } : x);
      }
      return [...c, { medicineId: selectedMed.id, name: selectedMed.name, price: selectedMed.price, quantity: qty, stock: selectedMed.pharmacyQuantity, details }];
    });
    
    // Reset form
    setSelectedMed(null);
    setQ("");
    setQty(1);
    toast.success("Added to prescription");
  };

  const changeQty = (id: string, delta: number) => {
    setCart((c) => c.flatMap((x) => {
      if (x.medicineId !== id) return [x];
      const nq = x.quantity + delta;
      if (nq <= 0) return [];
      if (nq > x.stock) { toast.error("Not enough pharmacy stock"); return [x]; }
      return [{ ...x, quantity: nq }];
    }));
  };

  const removeItem = (id: string) => setCart((c) => c.filter((x) => x.medicineId !== id));

  const grossTotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const total = grossTotal - (grossTotal * discountPct) / 100;

  const dispense = () => {
    if (!patientName.trim()) { toast.error("Enter patient name"); return; }
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    const bill = addBill({
      patientName: patientName.trim(),
      patientId: patientId.trim() || "P" + Math.floor(1000 + Math.random() * 9000),
      items: cart.map((c) => ({ medicineId: c.medicineId, name: c.name, quantity: c.quantity, price: c.price })),
      total,
      discountPct,
      status: "paid",
      paymentMethod: payment,
    });
    setLastBillId(bill.id);
    toast.success(`Dispensed! Bill ${bill.id}`);
    setCart([]);
    setPatientName("");
    setPatientId("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Left: search & prescription form */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Prescription</h2>
                <p className="text-xs text-muted-foreground">Search & add medicines</p>
              </div>
            </div>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSelectedMed(null); }}
              placeholder="Type medicine name or batch..."
              className="pl-9 h-11 text-base"
            />
          </div>
          
          {!selectedMed && (
            <div className="grid gap-2 max-h-[300px] overflow-auto pr-1">
              {filtered.map((m) => {
                const low = m.pharmacyQuantity <= m.minLevel;
                const out = m.pharmacyQuantity <= 0;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMed(m)}
                    disabled={out}
                    className="w-full text-left rounded-xl border p-3 hover:border-primary hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.category} • Batch {m.batch}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-primary">₹{m.price.toFixed(2)}</div>
                      <div className="text-[11px]">
                        {out ? <Badge variant="destructive">Out</Badge>
                          : low ? <Badge className="bg-warning text-white hover:bg-warning">Low: {m.pharmacyQuantity}</Badge>
                          : <span className="text-muted-foreground">Pharma Stock: {m.pharmacyQuantity}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedMed && (
            <div className="mt-4 border rounded-xl p-4 bg-muted/20">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-primary">{selectedMed.name}</h3>
                  <p className="text-xs text-muted-foreground">Available: {selectedMed.pharmacyQuantity} | ₹{selectedMed.price}/item</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMed(null)}>Change</Button>
              </div>

              <div className="flex items-center gap-2 mb-4 bg-background border rounded-lg p-1 w-max">
                <button
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${!isDetailed ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-muted text-muted-foreground'}`}
                  onClick={() => setIsDetailed(false)}
                >
                  Simple Entry
                </button>
                <button
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${isDetailed ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-muted text-muted-foreground'}`}
                  onClick={() => setIsDetailed(true)}
                >
                  Detailed Prescription
                </button>
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
                        <Checkbox id="autocalc" checked={autoCalc} onCheckedChange={(c) => setAutoCalc(!!c)} />
                        <label htmlFor="autocalc" className="text-sm font-medium leading-none">Auto-calculate</label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Total Quantity to Dispense</Label>
                  <div className="flex items-center gap-4">
                    <Input type="number" className="h-11 w-32 text-lg font-bold" value={qty} onChange={e => setQty(+e.target.value)} />
                  </div>
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
              <Input id="pname" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. Mr. Ramesh" className="h-11" />
            </div>
            <div>
              <Label htmlFor="pid">Patient ID (optional)</Label>
              <Input id="pid" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="P1234" className="h-11" />
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
              {cart.map((c) => (
                <div key={c.medicineId} className="flex flex-col gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">₹{c.price.toFixed(2)} × {c.quantity}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">₹{(c.price * c.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                  {c.details && <div className="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded">{c.details}</div>}
                  <div className="flex items-center justify-between border-t pt-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(c.medicineId, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center text-sm font-semibold">{c.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(c.medicineId, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeItem(c.medicineId)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
              {["Cash", "UPI", "Card"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`h-9 rounded-lg border font-medium text-xs transition ${
                    payment === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >{p}</button>
              ))}
            </div>
            
            <Button onClick={dispense} disabled={cart.length === 0} className="w-full h-12 text-base font-semibold">
              <Receipt className="h-5 w-5 mr-2" /> Dispense & Bill
            </Button>
            {lastBillId && (
              <div className="text-xs text-success flex items-center gap-1.5 justify-center">
                <CheckCircle2 className="h-4 w-4" /> Last bill: <span className="font-mono font-semibold">{lastBillId}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
