import { useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Undo2, RefreshCcw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function ReturnsTab() {
  const { bills, refundItems } = usePharmacy();
  const [q, setQ] = useState("");
  const [foundId, setFoundId] = useState<string | null>(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);
  const [refundQty, setRefundQty] = useState<number>(1);
  const [processing, setProcessing] = useState(false);

  const search = () => {
    const b = bills.find((x) => x.id.toLowerCase() === q.trim().toLowerCase());
    if (!b) { toast.error("Bill not found"); setFoundId(null); return; }
    setFoundId(b.id);
    setSelectedMedicineId(null);
    setRefundQty(1);
  };

  const goBack = () => {
    setFoundId(null);
    setSelectedMedicineId(null);
    setRefundQty(1);
  };

  const bill = foundId ? bills.find((b) => b.id === foundId) : null;

  const selectedItem = bill?.items.find(it => it.medicineId === selectedMedicineId);
  const maxRef = selectedItem
    ? selectedItem.quantity - (selectedItem.refundedQuantity || 0)
    : 0;
  const effectiveRate = selectedItem && bill
    ? selectedItem.price * (1 - (bill.discountPct || 0) / 100)
    : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center">
          <Undo2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Returns &amp; Refunds</h2>
          <p className="text-xs text-muted-foreground">Enter a bill ID to refund it and restock items</p>
        </div>
      </div>

      {/* Search bar — always visible */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Enter bill ID (e.g. B10001)"
            className="pl-9 h-11"
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button onClick={search} className="h-11 px-6"><Search className="h-4 w-4 mr-1.5" /> Search</Button>
      </div>

      {bill && (
        <div className="rounded-xl border p-4">
          {/* Red back button */}
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-destructive font-semibold mb-4 hover:underline transition-opacity hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" /> Back to bill list
          </button>

          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Bill</div>
              <div className="font-mono font-bold text-lg">{bill.id}</div>
              <div className="text-sm mt-1">{bill.patientName} <span className="text-muted-foreground">• {bill.patientId}</span></div>
            </div>
            <Badge variant={bill.status === "paid" ? "default" : bill.status === "refunded" ? "destructive" : "secondary"}>
              {bill.status}
            </Badge>
          </div>

          {/* Step 1: Select a single item to refund */}
          {!selectedMedicineId && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Select item to refund</p>
              {bill.items.map((it, i) => {
                const max = it.quantity - (it.refundedQuantity || 0);
                const isFullyRefunded = max === 0;
                return (
                  <button
                    key={i}
                    disabled={isFullyRefunded || bill.status === "refunded"}
                    onClick={() => { setSelectedMedicineId(it.medicineId); setRefundQty(Math.min(1, max)); }}
                    className={`w-full text-left rounded-lg border p-3 transition flex justify-between items-center text-sm ${
                      isFullyRefunded || bill.status === "refunded"
                        ? "opacity-50 cursor-not-allowed bg-muted/30"
                        : "hover:border-primary hover:bg-primary/5 cursor-pointer"
                    }`}
                  >
                    <div>
                      <span className={isFullyRefunded ? "line-through text-muted-foreground" : "font-semibold"}>
                        {it.name}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        (Total: {it.quantity} | Refunded: {it.refundedQuantity || 0} | Available: {max})
                      </span>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="font-semibold">₹{it.price.toFixed(2)}/unit</div>
                      {isFullyRefunded && <Badge variant="secondary" className="text-[10px]">Fully Refunded</Badge>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Confirm qty for the selected item */}
          {selectedMedicineId && selectedItem && (
            <div className="border-t pt-4 space-y-4">
              <button
                onClick={() => { setSelectedMedicineId(null); setRefundQty(1); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Choose a different item
              </button>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="font-semibold">{selectedItem.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Unit price: ₹{selectedItem.price.toFixed(2)}
                  {bill.discountPct > 0 && ` − ${bill.discountPct}% = ₹${effectiveRate.toFixed(2)} effective`}
                </div>
                <div className="text-xs text-muted-foreground">Max refundable: {maxRef} units</div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Refund Qty</label>
                <Input
                  type="number"
                  className="h-9 w-24 text-center"
                  min={1}
                  max={maxRef}
                  value={refundQty}
                  onChange={(e) => {
                    let val = parseInt(e.target.value) || 1;
                    if (val > maxRef) val = maxRef;
                    if (val < 1) val = 1;
                    setRefundQty(val);
                  }}
                />
                <span className="text-sm text-muted-foreground">of {maxRef}</span>
              </div>

              <div className="flex justify-between font-bold text-lg border-t pt-3">
                <span>Refund Amount</span>
                <span>₹{(effectiveRate * refundQty).toFixed(2)}</span>
              </div>

              <Button
                disabled={bill.status === "refunded" || processing || refundQty <= 0}
                variant="destructive"
                className="w-full h-11"
                onClick={async () => {
                  setProcessing(true);
                  try {
                    await refundItems(bill.id, [{ medicineId: selectedMedicineId, qty: refundQty }]);
                    toast.success("Refund processed & stock restored");
                    setSelectedMedicineId(null);
                    setRefundQty(1);
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setProcessing(false);
                  }
                }}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Process Refund — ₹{(effectiveRate * refundQty).toFixed(2)}
              </Button>
            </div>
          )}
        </div>
      )}

      {!bill && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">RECENT BILLS</div>
          <div className="space-y-1.5">
            {bills.slice(0, 6).map((b) => (
              <button
                key={b.id}
                onClick={() => { setQ(b.id); setFoundId(b.id); setSelectedMedicineId(null); setRefundQty(1); }}
                className="w-full text-left flex justify-between items-center rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition"
              >
                <div>
                  <div className="font-mono font-semibold">{b.id}</div>
                  <div className="text-xs text-muted-foreground">{b.patientName}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">₹{b.total.toFixed(2)}</div>
                  <Badge variant={b.status === "paid" ? "default" : b.status === "refunded" ? "destructive" : "secondary"} className="text-[10px]">{b.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
