import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/date-utils";
import { useHeldBills, removeHeldBill, setPendingResume, type HeldBill } from "@/lib/held-bills";

export function HeldBillsTab({ onResume }: { onResume: () => void }) {
  const held = useHeldBills();

  const resume = (h: HeldBill) => {
    setPendingResume(h);
    onResume();
  };

  const discard = (h: HeldBill) => {
    if (!confirm(`Discard held bill for ${h.patientName}? This cannot be undone.`)) return;
    removeHeldBill(h.id);
    toast.success("Held bill discarded");
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <PauseCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Held Bills</h2>
          <p className="text-xs text-muted-foreground">
            Retrieve a bill to dispense it. The bill date will be the dispensed date, not the hold date.
          </p>
        </div>
      </div>

      {held.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
          No held bills
        </div>
      ) : (
        <div className="space-y-3">
          {held.map(h => (
            <div key={h.id} className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{h.patientName}</span>
                  {h.patientId && <span className="text-xs text-muted-foreground font-mono">{h.patientId}</span>}
                  <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{h.id}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {h.doctorName || "No doctor"} · Held {formatDateTime(h.heldAt)}
                </div>
                <div className="text-xs mt-1.5 text-foreground/80">
                  {h.items.map(i => `${i.name} ×${i.qty}`).join(", ")}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-primary">≈ ₹{h.estTotal.toFixed(2)}</span>
                <Button size="sm" onClick={() => resume(h)}>
                  <PlayCircle className="h-4 w-4 mr-1.5" /> Retrieve
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => discard(h)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
