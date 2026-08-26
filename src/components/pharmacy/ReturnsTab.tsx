import { useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Undo2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export function ReturnsTab() {
  const { bills, refundItems } = usePharmacy();
  const [q, setQ] = useState("");
  const [foundId, setFoundId] = useState<string | null>(null);
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);

  const search = () => {
    const b = bills.find((x) => x.id.toLowerCase() === q.trim().toLowerCase());
    if (!b) { toast.error("Bill not found"); setFoundId(null); return; }
    setFoundId(b.id);
    
    // Initialize refund quantities to remaining possible amounts
    const qtys: Record<string, number> = {};
    for (const it of b.items) {
      qtys[it.medicineId] = it.quantity - (it.refundedQuantity || 0);
    }
    setRefundQtys(qtys);
  };
  const bill = foundId ? bills.find((b) => b.id === foundId) : null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center">
          <Undo2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Returns & Refunds</h2>
          <p className="text-xs text-muted-foreground">Enter a bill ID to refund it and restock items</p>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Enter bill ID (e.g. B10001)" className="pl-9 h-11" onKeyDown={(e) => e.key === "Enter" && search()} />
        </div>
        <Button onClick={search} className="h-11 px-6"><Search className="h-4 w-4 mr-1.5" /> Search</Button>
      </div>

      {bill && (
        <div className="rounded-xl border p-4">
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
          <div className="space-y-3 border-t pt-3">
            {bill.items.map((it, i) => {
              const maxRef = it.quantity - (it.refundedQuantity || 0);
              const isFullyRefunded = maxRef === 0;
              const currentRefundQty = refundQtys[it.medicineId] ?? maxRef;

              return (
                <div key={i} className="flex justify-between items-center text-sm gap-2">
                  <div className="flex-1">
                    <span className={isFullyRefunded ? "line-through text-muted-foreground" : ""}>{it.name}</span> 
                    <span className="text-muted-foreground ml-1">
                      (Total: {it.quantity} | Refunded: {it.refundedQuantity || 0})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-semibold w-20 text-right">₹{(it.price * currentRefundQty).toFixed(2)}</span>
                    {!isFullyRefunded && bill.status !== "refunded" && (
                      <div className="flex items-center gap-1 w-24">
                        <Input 
                          type="number" 
                          className="h-8 text-center" 
                          min={0} 
                          max={maxRef}
                          value={currentRefundQty}
                          onChange={(e) => {
                            let val = parseInt(e.target.value) || 0;
                            if (val > maxRef) val = maxRef;
                            if (val < 0) val = 0;
                            setRefundQtys(prev => ({ ...prev, [it.medicineId]: val }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="space-y-1 pt-2 border-t mt-4">
              <div className="flex justify-between font-bold text-muted-foreground">
                <span>Original Bill Amount</span>
                <span>₹{bill.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-primary pt-1">
                <span>Total Refund Amount</span>
                <span>₹{bill.items.reduce((sum, it) => sum + ((refundQtys[it.medicineId] ?? (it.quantity - (it.refundedQuantity || 0))) * it.price), 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <Button
            disabled={bill.status === "refunded" || processing || Object.values(refundQtys).every(v => v === 0)}
            variant="destructive"
            className="w-full mt-4 h-11"
            onClick={async () => { 
              setProcessing(true);
              try {
                const itemsToRefund = Object.entries(refundQtys).map(([medicineId, qty]) => ({ medicineId, qty }));
                await refundItems(bill.id, itemsToRefund);
                toast.success("Refund processed & stock restored");
                search(); // re-fetch state
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setProcessing(false);
              }
            }}
          >
            <RefreshCcw className="h-4 w-4 mr-2" /> 
            {bill.status === "refunded" ? "Fully Refunded" : "Process Selected Refunds"}
          </Button>
        </div>
      )}

      {!bill && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">RECENT BILLS</div>
          <div className="space-y-1.5">
            {bills.slice(0, 6).map((b) => (
              <button key={b.id} onClick={() => { setQ(b.id); setFoundId(b.id); }} className="w-full text-left flex justify-between items-center rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition">
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
