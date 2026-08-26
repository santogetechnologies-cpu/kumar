import { useMemo, useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Download, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillPrintDialog } from "./BillPrintDialog";
import type { Bill } from "@/lib/pharmacy-store";

export function PaymentsTab() {
  const { bills, printFormat } = usePharmacy();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "refunded" | "partially_refunded">("all");
  const [printBill, setPrintBill] = useState<Bill | null>(null);

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (q && !(b.id.toLowerCase().includes(q.toLowerCase()) || b.patientName.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [bills, q, status]);

  const total = bills.reduce((s, b) => s + (b.status === "refunded" ? 0 : b.total), 0);
  const paid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.total, 0);
  const pending = bills.filter((b) => b.status === "pending").reduce((s, b) => s + b.total, 0);

  const exportCsv = () => {
    const rows = [["Date", "Bill ID", "Patient", "Amount", "Status", "Method"], ...filtered.map((b) => [b.createdAt, b.id, b.patientName, b.total.toString(), b.status, b.paymentMethod])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "payments.csv"; a.click();
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><FileText className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold">Bill & Payment History</h2>
            <p className="text-xs text-muted-foreground">Search, export, and reprint bills</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <StatBox label="Total Bills" value={bills.length.toString()} />
        <StatBox label="Total Amount" value={`₹${total.toFixed(2)}`} />
        <StatBox label="Paid" value={`₹${paid.toFixed(2)}`} color="text-success" />
        <StatBox label="Pending" value={`₹${pending.toFixed(2)}`} color="text-warning" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bill ID or patient..." className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg border p-1 overflow-x-auto">
          {(["all", "paid", "pending", "refunded", "partially_refunded"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-accent whitespace-nowrap"}`}>{s.replace("_", " ")}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>{["Date & Time", "Bill ID", "Patient", "Amount", "Status", "Method", ""].map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No bills</td></tr>}
            {filtered.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2.5">{new Date(b.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2.5 font-mono">{b.id}</td>
                <td className="px-3 py-2.5">{b.patientName} <span className="text-muted-foreground">• {b.patientId}</span></td>
                <td className="px-3 py-2.5 font-semibold">₹{b.total.toFixed(2)}</td>
                <td className="px-3 py-2.5 capitalize"><Badge variant={b.status === "paid" ? "default" : b.status === "refunded" ? "destructive" : "secondary"}>{b.status.replace("_", " ")}</Badge></td>
                <td className="px-3 py-2.5">{b.paymentMethod}</td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="outline" size="sm" onClick={() => setPrintBill(b)}>
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BillPrintDialog 
        open={!!printBill} 
        onOpenChange={(v) => !v && setPrintBill(null)} 
        bill={printBill} 
        format={printFormat}
      />
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
