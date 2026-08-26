import { useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, FileText } from "lucide-react";
import { BillPrintDialog } from "./BillPrintDialog";
import type { Bill } from "@/lib/pharmacy-store";

export function BillHistoryTab() {
  const { bills, printFormat } = usePharmacy();
  const [q, setQ] = useState("");
  const [printBill, setPrintBill] = useState<Bill | null>(null);

  const filtered = bills.filter(b => 
    b.id.toLowerCase().includes(q.toLowerCase()) || 
    b.patientName.toLowerCase().includes(q.toLowerCase()) ||
    b.patientId.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Bill & Transaction History</h2>
            <p className="text-xs text-muted-foreground">Search and reprint old bills for insurance claims or records</p>
          </div>
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Search by Bill No, Patient Name or ID..." 
            className="pl-9" 
          />
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Date", "Bill No", "Patient", "Total", "Discount", "Mode", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No bills found matching your search.</td></tr>}
              {filtered.map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{b.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{b.patientName}</div>
                    <div className="text-xs text-muted-foreground">{b.patientId}</div>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">₹{b.total.toFixed(2)}</td>
                  <td className="px-3 py-2.5">{b.discountPct}%</td>
                  <td className="px-3 py-2.5">{b.paymentMethod}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={b.status === "paid" ? "default" : b.status === "refunded" ? "destructive" : "secondary"} className="capitalize">
                      {b.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Button variant="outline" size="sm" onClick={() => setPrintBill(b)}>
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <BillPrintDialog 
        open={!!printBill} 
        onOpenChange={(v) => !v && setPrintBill(null)} 
        bill={printBill} 
        format={printFormat}
      />
    </div>
  );
}
