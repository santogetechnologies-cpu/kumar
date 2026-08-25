import { useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Undo2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export function ReturnsTab() {
  const { bills, refundBill } = usePharmacy();
  const [q, setQ] = useState("");
  const [foundId, setFoundId] = useState<string | null>(null);

  const search = () => {
    const b = bills.find((x) => x.id.toLowerCase() === q.trim().toLowerCase());
    if (!b) { toast.error("Bill not found"); setFoundId(null); return; }
    setFoundId(b.id);
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
          <div className="space-y-1.5 border-t pt-3">
            {bill.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{it.name} × {it.quantity}</span>
                <span>₹{(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total</span>
              <span>₹{bill.total.toFixed(2)}</span>
            </div>
          </div>
          <Button
            disabled={bill.status !== "paid"}
            variant="destructive"
            className="w-full mt-4 h-11"
            onClick={() => { refundBill(bill.id); toast.success("Refund processed & stock restored"); }}
          >
            <RefreshCcw className="h-4 w-4 mr-2" /> {bill.status === "refunded" ? "Already Refunded" : "Process Full Refund"}
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
