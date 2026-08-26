import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";

export interface InvoiceRow {
  product: string;
  hsn: string;
  batch: string;
  exp: string;
  mrp: number;
  ptr: number;
  qty: number;
  free: number;
  disPct: number;
  gstPct: number;
}

export interface InvoiceMeta {
  supplier: string;
  invoiceNo: string;
  invoiceDate: string;
  paymentMode: string;
}

const emptyRow = (): InvoiceRow => ({
  product: "", hsn: "", batch: "", exp: "",
  mrp: 0, ptr: 0, qty: 0, free: 0, disPct: 0, gstPct: 0,
});

export function rowTaxable(r: InvoiceRow) {
  const gross = r.ptr * r.qty;
  return gross - (gross * r.disPct) / 100;
}
export function rowGst(r: InvoiceRow) {
  return (rowTaxable(r) * r.gstPct) / 100;
}
export function rowNet(r: InvoiceRow) {
  return rowTaxable(r) + rowGst(r);
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onSave: (rows: InvoiceRow[], meta: InvoiceMeta) => void;
  existingProducts?: string[];
  /** If true, product must be chosen from dropdown of existingProducts */
  restrictToExisting?: boolean;
}

export function InvoiceDialog({ open, onOpenChange, title, onSave, existingProducts, restrictToExisting }: Props) {
  const [meta, setMeta] = useState<InvoiceMeta>({
    supplier: "", invoiceNo: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    paymentMode: "Cash",
  });
  const [rows, setRows] = useState<InvoiceRow[]>([emptyRow()]);

  const update = (i: number, patch: Partial<InvoiceRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) => {
    if (rows.length === 1) return;
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  };

  const totals = useMemo(() => {
    const subtotal = rows.reduce((s, r) => s + r.ptr * r.qty, 0);
    const discount = rows.reduce((s, r) => s + (r.ptr * r.qty * r.disPct) / 100, 0);
    const taxable = rows.reduce((s, r) => s + rowTaxable(r), 0);
    const gst = rows.reduce((s, r) => s + rowGst(r), 0);
    const net = taxable + gst;
    const roundOff = Math.round(net) - net;
    const billAmount = Math.round(net);
    const paidItems = rows.reduce((s, r) => s + (r.qty || 0), 0);
    const freeItems = rows.reduce((s, r) => s + (r.free || 0), 0);
    return { subtotal, discount, taxable, gst, net, roundOff, billAmount, paidItems, freeItems };
  }, [rows]);

  const reset = () => {
    setMeta({ supplier: "", invoiceNo: "", invoiceDate: new Date().toISOString().slice(0, 10), paymentMode: "Cash" });
    setRows([emptyRow()]);
  };

  const submit = () => {
    if (!meta.supplier.trim()) { toast.error("Supplier is required"); return; }
    const valid = rows.filter((r) => r.product.trim() && r.batch.trim() && r.exp && (r.qty > 0 || r.free > 0));
    if (valid.length === 0) { toast.error("Add at least one valid row — Product, Batch, Expiry and Qty are required"); return; }
    onSave(valid, meta);
    reset();
    onOpenChange(false);
  };

  const datalistId = "inv-products-" + title.replace(/\s+/g, "");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] w-[1300px] max-h-[92vh] overflow-y-auto flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
        </DialogHeader>

        {/* Header Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Supplier <span className="text-destructive">*</span></Label>
            <Input className="mt-1" value={meta.supplier} onChange={(e) => setMeta({ ...meta, supplier: e.target.value })} placeholder="Supplier name" />
          </div>
          <div>
            <Label className="text-xs">Invoice No.</Label>
            <Input className="mt-1" value={meta.invoiceNo} onChange={(e) => setMeta({ ...meta, invoiceNo: e.target.value })} placeholder="INV-001" />
          </div>
          <div>
            <Label className="text-xs">Invoice Date</Label>
            <Input className="mt-1" type="date" value={meta.invoiceDate} onChange={(e) => setMeta({ ...meta, invoiceDate: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Payment Mode</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={meta.paymentMode}
              onChange={(e) => setMeta({ ...meta, paymentMode: e.target.value })}
            >
              <option>Cash</option><option>UPI</option><option>Card</option><option>Credit</option><option>Cheque</option>
            </select>
          </div>
        </div>

        {/* Datalist for autocomplete */}
        {existingProducts && existingProducts.length > 0 && (
          <datalist id={datalistId}>
            {existingProducts.map((p) => <option key={p} value={p} />)}
          </datalist>
        )}

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "1200px" }}>
            <thead className="bg-muted/60">
              <tr className="text-xs text-left uppercase text-muted-foreground">
                <th className="px-2 py-2 w-10">#</th>
                <th className="px-2 py-2 min-w-[180px]">Product *</th>
                <th className="px-2 py-2 w-20">HSN</th>
                <th className="px-2 py-2 w-24">Batch *</th>
                <th className="px-2 py-2 w-36">Expiry *</th>
                <th className="px-2 py-2 w-24">MRP</th>
                <th className="px-2 py-2 w-24">PTR</th>
                <th className="px-2 py-2 w-20">Qty *</th>
                <th className="px-2 py-2 w-20">Free</th>
                <th className="px-2 py-2 w-20">Total</th>
                <th className="px-2 py-2 w-24">Taxable</th>
                <th className="px-2 py-2 w-20">Disc %</th>
                <th className="px-2 py-2 w-20">GST %</th>
                <th className="px-2 py-2 w-28">Net Amt</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t hover:bg-muted/20">
                  <td className="px-2 py-1.5 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-1 py-1">
                    {restrictToExisting && existingProducts && existingProducts.length > 0 ? (
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={r.product}
                        onChange={(e) => update(i, { product: e.target.value })}
                      >
                        <option value="">— Select —</option>
                        {existingProducts.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        list={datalistId}
                        className="h-8"
                        style={{ minWidth: "160px" }}
                        value={r.product}
                        onChange={(e) => update(i, { product: e.target.value })}
                        placeholder="Product name"
                      />
                    )}
                  </td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" value={r.hsn} onChange={(e) => update(i, { hsn: e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-24" value={r.batch} onChange={(e) => update(i, { batch: e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-36" type="date" value={r.exp} onChange={(e) => update(i, { exp: e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-24" type="number" min="0" step="0.01" value={r.mrp || ""} onChange={(e) => update(i, { mrp: parseFloat(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-24" type="number" min="0" step="0.01" value={r.ptr || ""} onChange={(e) => update(i, { ptr: parseFloat(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" min="0" value={r.qty || ""} onChange={(e) => update(i, { qty: parseInt(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" min="0" value={r.free || ""} onChange={(e) => update(i, { free: parseInt(e.target.value) || 0 })} /></td>
                  <td className="px-2 py-1.5 font-mono text-center">{(r.qty || 0) + (r.free || 0)}</td>
                  <td className="px-2 py-1.5 font-mono text-right">{rowTaxable(r).toFixed(2)}</td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" min="0" max="100" value={r.disPct || ""} onChange={(e) => update(i, { disPct: parseFloat(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" min="0" max="100" value={r.gstPct || ""} onChange={(e) => update(i, { gstPct: parseFloat(e.target.value) || 0 })} /></td>
                  <td className="px-2 py-1.5 font-mono text-right font-semibold">₹{rowNet(r).toFixed(2)}</td>
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      disabled={rows.length === 1}
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom: Add Row + Totals */}
        <div className="flex items-start justify-between gap-4">
          <Button variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Row
          </Button>
          <div className="text-sm space-y-0.5 text-right min-w-[280px] border rounded-xl p-3 bg-muted/30">
            <div className="flex justify-between gap-8"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">₹{totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between gap-8 text-success"><span>Discount</span><span>-₹{totals.discount.toFixed(2)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-muted-foreground">Taxable</span><span>₹{totals.taxable.toFixed(2)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-muted-foreground">GST</span><span>+₹{totals.gst.toFixed(2)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-muted-foreground">Round off</span><span>{totals.roundOff >= 0 ? "+" : ""}₹{totals.roundOff.toFixed(2)}</span></div>
            <div className="flex justify-between gap-8 pt-1 border-t text-base font-bold"><span>Bill Amount</span><span>₹{totals.billAmount.toFixed(2)}</span></div>
            <div className="text-xs text-muted-foreground pt-1">{totals.paidItems + totals.freeItems} items ({totals.paidItems} paid + {totals.freeItems} free)</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}><Calculator className="h-4 w-4 mr-1.5" /> Save Invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
