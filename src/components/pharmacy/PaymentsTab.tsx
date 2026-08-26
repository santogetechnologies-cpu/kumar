import { useMemo, useState } from "react";
import { usePharmacy, getBillNetTotal } from "@/lib/pharmacy-store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Printer, FileText, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { BillPrintDialog } from "./BillPrintDialog";
import { toast } from "sonner";
import type { Bill } from "@/lib/pharmacy-store";

export function PaymentsTab() {
  const { bills, deleteBill, printFormat } = usePharmacy();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "refunded" | "partially_refunded">("all");
  const [printBill, setPrintBill] = useState<Bill | null>(null);

  // Admin delete state
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [restoreStock, setRestoreStock] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (q && !(b.id.toLowerCase().includes(q.toLowerCase()) || b.patientName.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [bills, q, status]);

  // Net total accounting for refunds
  const total = bills.reduce((s, b) => s + getBillNetTotal(b), 0);
  const paid = bills.filter((b) => b.status === "paid" || b.status === "partially_refunded").reduce((s, b) => s + getBillNetTotal(b), 0);
  const pending = bills.filter((b) => b.status === "pending").reduce((s, b) => s + b.total, 0);

  const exportCsv = () => {
    const rows = [
      ["Date", "Bill ID", "Patient", "Patient ID", "Doctor", "Amount", "Net Total", "Discount %", "Status", "Payment Method", "Billed By"],
      ...filtered.map((b) => [
        b.createdAt,
        b.id,
        b.patientName,
        b.patientId || "",
        b.doctorName || "",
        b.total.toString(),
        getBillNetTotal(b).toString(),
        (b.discountPct || 0).toString(),
        b.status,
        b.paymentMethod,
        b.createdBy || ""
      ])
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bills_and_payments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    setDeleting(true);
    try {
      await deleteBill(billToDelete.id, restoreStock);
      toast.success(`Bill ${billToDelete.id} deleted successfully${restoreStock ? " and stock restored" : ""}`);
      setBillToDelete(null);
    } catch (e: any) {
      toast.error("Failed to delete bill: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Bill & Payment History</h2>
            <p className="text-xs text-muted-foreground">Search, reprint, export, and manage bills</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <StatBox label="Total Bills" value={bills.length.toString()} />
        <StatBox label="Net Total Amount" value={`₹${total.toFixed(2)}`} />
        <StatBox label="Collected / Paid" value={`₹${paid.toFixed(2)}`} color="text-success" />
        <StatBox label="Pending" value={`₹${pending.toFixed(2)}`} color="text-warning" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bill ID or patient name..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border p-1 overflow-x-auto">
          {(["all", "paid", "pending", "refunded", "partially_refunded"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${
                status === s ? "bg-primary text-primary-foreground" : "hover:bg-accent whitespace-nowrap"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Date & Time", "Bill ID", "Patient", "Items", "Amount", "Status", "Method", "Actions"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No bills found matching your criteria.
                </td>
              </tr>
            )}
            {filtered.map((b) => {
              const net = getBillNetTotal(b);
              const isPartiallyRefunded = b.status === "partially_refunded";
              const isFullyRefunded = b.status === "refunded";

              return (
                <tr key={b.id} className="border-t hover:bg-muted/20 transition">
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold">{b.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{b.patientName}</div>
                    {b.patientId && <div className="text-xs text-muted-foreground">{b.patientId}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={b.items.map(i => `${i.name} (x${i.quantity})`).join(", ")}>
                    {b.items.map(i => i.name).join(", ")}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-semibold ${isFullyRefunded ? "line-through text-muted-foreground" : ""}`}>
                      ₹{b.total.toFixed(2)}
                    </div>
                    {isPartiallyRefunded && (
                      <div className="text-[11px] text-success font-medium">
                        Net: ₹{net.toFixed(2)}
                      </div>
                    )}
                    {b.discountPct > 0 && (
                      <span className="text-[10px] text-muted-foreground">({b.discountPct}% off)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 capitalize">
                    <Badge
                      variant={
                        b.status === "paid"
                          ? "default"
                          : b.status === "refunded"
                          ? "destructive"
                          : b.status === "partially_refunded"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {b.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 uppercase text-xs">{b.paymentMethod}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setPrintBill(b)} title="Print / Reprint Bill">
                        <Printer className="h-3.5 w-3.5 mr-1" /> Print
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setBillToDelete(b)}
                          title="Delete Bill (Admin only)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bill Print Dialog */}
      <BillPrintDialog
        open={!!printBill}
        onOpenChange={(v) => !v && setPrintBill(null)}
        bill={printBill}
        format={printFormat}
      />

      {/* Admin Delete Bill Confirmation Dialog */}
      <Dialog open={!!billToDelete} onOpenChange={(o) => { if (!o && !deleting) setBillToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Bill {billToDelete?.id}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bill record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div><strong>Patient:</strong> {billToDelete?.patientName}</div>
              <div><strong>Amount:</strong> ₹{billToDelete?.total.toFixed(2)}</div>
              <div><strong>Items:</strong> {billToDelete?.items.length} item(s)</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={restoreStock}
                onChange={(e) => setRestoreStock(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-xs font-medium">Restore dispensed items back to Pharmacy stock</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" /> Confirm Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${color ?? ""}`}>{value}</div>
    </div>
  );
}
