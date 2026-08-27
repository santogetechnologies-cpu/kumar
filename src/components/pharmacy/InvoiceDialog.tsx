import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  restrictToExisting?: boolean;
  initialRows?: InvoiceRow[];
  initialMeta?: Partial<InvoiceMeta>;
}

export function InvoiceDialog({ open, onOpenChange, title, onSave, existingProducts, restrictToExisting, initialRows, initialMeta }: Props) {
  const [meta, setMeta] = useState<InvoiceMeta>({
    supplier: "", invoiceNo: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    paymentMode: "Cash",
  });
  const [rows, setRows] = useState<InvoiceRow[]>([emptyRow()]);

  // Sync state when dialog opens with initial data
  useEffect(() => {
    if (open) {
      setMeta({
        supplier: initialMeta?.supplier || "", 
        invoiceNo: initialMeta?.invoiceNo || "",
        invoiceDate: initialMeta?.invoiceDate || new Date().toISOString().slice(0, 10),
        paymentMode: initialMeta?.paymentMode || "Cash",
      });
      setRows(initialRows || [emptyRow()]);
    }
  }, [open]);

  const updateMeta = (patch: Partial<InvoiceMeta>) => setMeta(m => ({ ...m, ...patch }));
  const updateRow = (i: number, patch: Partial<InvoiceRow>) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i: number) => { if (rows.length > 1) setRows(rs => rs.filter((_, idx) => idx !== i)); };

  const totals = useMemo(() => {
    const taxable = rows.reduce((s, r) => s + rowTaxable(r), 0);
    const gst = rows.reduce((s, r) => s + rowGst(r), 0);
    const net = taxable + gst;
    return {
      subtotal: rows.reduce((s, r) => s + r.ptr * r.qty, 0),
      discount: rows.reduce((s, r) => s + (r.ptr * r.qty * r.disPct) / 100, 0),
      taxable, gst, net,
      roundOff: Math.round(net) - net,
      billAmount: Math.round(net),
      totalQty: rows.reduce((s, r) => s + r.qty + r.free, 0),
    };
  }, [rows]);

  const reset = () => {
    setMeta({ supplier: "", invoiceNo: "", invoiceDate: new Date().toISOString().slice(0, 10), paymentMode: "Cash" });
    setRows([emptyRow()]);
  };

  const submit = () => {
    if (!meta.supplier.trim()) { toast.error("Supplier is required"); return; }
    const valid = rows.filter(r => r.product.trim() && r.batch.trim() && r.exp && (r.qty > 0 || r.free > 0));
    if (!valid.length) { toast.error("At least one row needs: Product, Batch, Expiry, Qty"); return; }
    onSave(valid, meta);
    reset();
    onOpenChange(false);
  };

  const dlId = "dl-" + title.replace(/\s+/g, "");

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent
        style={{ maxWidth: "min(95vw, 1350px)", maxHeight: "90vh", overflowY: "auto", width: "100%" }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
        </DialogHeader>

        {/* ---- Meta header ---- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "8px" }}>
          <div>
            <Label style={{ fontSize: "12px" }}>Supplier *</Label>
            <Input style={{ marginTop: 4 }} value={meta.supplier} onChange={e => updateMeta({ supplier: e.target.value })} placeholder="Supplier name" />
          </div>
          <div>
            <Label style={{ fontSize: "12px" }}>Invoice No.</Label>
            <Input style={{ marginTop: 4 }} value={meta.invoiceNo} onChange={e => updateMeta({ invoiceNo: e.target.value })} placeholder="INV-001" />
          </div>
          <div>
            <Label style={{ fontSize: "12px" }}>Invoice Date</Label>
            <Input style={{ marginTop: 4 }} type="date" value={meta.invoiceDate} onChange={e => updateMeta({ invoiceDate: e.target.value })} />
          </div>
          <div>
            <Label style={{ fontSize: "12px" }}>Payment Mode</Label>
            <select
              style={{ marginTop: 4, display: "flex", height: "40px", width: "100%", borderRadius: "6px", border: "1px solid hsl(var(--input))", background: "hsl(var(--background))", padding: "0 12px", fontSize: "14px" }}
              value={meta.paymentMode}
              onChange={e => updateMeta({ paymentMode: e.target.value })}
            >
              <option>Cash</option><option>UPI</option><option>Card</option><option>Credit</option><option>Cheque</option>
            </select>
          </div>
        </div>

        {/* autocomplete datalist */}
        {existingProducts?.length ? (
          <datalist id={dlId}>
            {existingProducts.map(p => <option key={p} value={p} />)}
          </datalist>
        ) : null}

        {/* ---- Rows ---- */}
        <div style={{ overflowX: "auto", border: "1px solid hsl(var(--border))", borderRadius: "8px", marginTop: "12px" }}>
          <table style={{ width: "100%", minWidth: "1150px", fontSize: "13px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "hsl(var(--muted))", textAlign: "left" }}>
                {["#","Product *","HSN","Batch *","Expiry *","MRP","PTR","Qty *","Free","Total","Taxable","Disc %","GST %","Net Amt",""].map(h => (
                  <th key={h} style={{ padding: "8px 6px", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                  <td style={{ padding: "4px 6px", color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>{i + 1}</td>
                  <td style={{ padding: "2px 4px" }}>
                    {restrictToExisting && existingProducts?.length ? (
                      <select
                        value={r.product}
                        onChange={e => updateRow(i, { product: e.target.value })}
                        style={{ height: "32px", minWidth: "160px", borderRadius: "6px", border: "1px solid hsl(var(--input))", padding: "0 8px", fontSize: "13px", background: "hsl(var(--background))", width: "100%" }}
                      >
                        <option value="">— Select —</option>
                        {existingProducts.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <input
                        list={dlId}
                        value={r.product}
                        onChange={e => updateRow(i, { product: e.target.value })}
                        placeholder="Product name"
                        style={{ height: "32px", minWidth: "160px", borderRadius: "6px", border: "1px solid hsl(var(--input))", padding: "0 8px", fontSize: "13px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", outline: "none", width: "100%" }}
                      />
                    )}
                  </td>
                  <td style={{ padding: "2px 4px" }}><input style={cellStyle} value={r.hsn} onChange={e => updateRow(i, { hsn: e.target.value })} /></td>
                  <td style={{ padding: "2px 4px" }}><input style={cellStyle} value={r.batch} onChange={e => updateRow(i, { batch: e.target.value })} /></td>
                  <td style={{ padding: "2px 4px" }}><input type="date" style={{ ...cellStyle, width: "130px" }} value={r.exp} onChange={e => updateRow(i, { exp: e.target.value })} /></td>
                  <td style={{ padding: "2px 4px" }}><input type="number" min="0" step="0.01" style={cellStyle} value={r.mrp || ""} onChange={e => updateRow(i, { mrp: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "2px 4px" }}><input type="number" min="0" step="0.01" style={cellStyle} value={r.ptr || ""} onChange={e => updateRow(i, { ptr: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "2px 4px" }}><input type="number" min="0" style={{ ...cellStyle, width: "70px" }} value={r.qty || ""} onChange={e => updateRow(i, { qty: parseInt(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "2px 4px" }}><input type="number" min="0" style={{ ...cellStyle, width: "70px" }} value={r.free || ""} onChange={e => updateRow(i, { free: parseInt(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "4px 6px", fontFamily: "monospace", textAlign: "center" }}>{r.qty + r.free}</td>
                  <td style={{ padding: "4px 6px", fontFamily: "monospace", textAlign: "right" }}>{rowTaxable(r).toFixed(2)}</td>
                  <td style={{ padding: "2px 4px" }}><input type="number" min="0" max="100" style={{ ...cellStyle, width: "65px" }} value={r.disPct || ""} onChange={e => updateRow(i, { disPct: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "2px 4px" }}><input type="number" min="0" max="100" style={{ ...cellStyle, width: "65px" }} value={r.gstPct || ""} onChange={e => updateRow(i, { gstPct: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "4px 6px", fontFamily: "monospace", textAlign: "right", fontWeight: 600 }}>₹{rowNet(r).toFixed(2)}</td>
                  <td style={{ padding: "2px 4px" }}>
                    <button
                      onClick={() => removeRow(i)}
                      disabled={rows.length === 1}
                      style={{ width: "30px", height: "30px", borderRadius: "6px", border: "none", cursor: rows.length === 1 ? "not-allowed" : "pointer", background: "transparent", color: "hsl(var(--destructive))", opacity: rows.length === 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Footer row ---- */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginTop: "12px" }}>
          <Button variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Row
          </Button>
          <div style={{ minWidth: "280px", border: "1px solid hsl(var(--border))", borderRadius: "10px", padding: "12px 16px", background: "hsl(var(--muted)/0.3)", fontSize: "13px" }}>
            {[
              ["Subtotal", `₹${totals.subtotal.toFixed(2)}`],
              ["Discount", `-₹${totals.discount.toFixed(2)}`],
              ["Taxable", `₹${totals.taxable.toFixed(2)}`],
              ["GST", `+₹${totals.gst.toFixed(2)}`],
              ["Round off", `${totals.roundOff >= 0 ? "+" : ""}₹${totals.roundOff.toFixed(2)}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
                <span>{val}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 2px", borderTop: "1px solid hsl(var(--border))", marginTop: "4px", fontWeight: 700, fontSize: "15px" }}>
              <span>Bill Amount</span><span>₹{totals.billAmount.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "4px" }}>
              Total: {totals.totalQty} items
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid hsl(var(--border))" }}>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}><Calculator className="h-4 w-4 mr-1.5" /> Save Invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const cellStyle: React.CSSProperties = {
  height: "32px",
  width: "90px",
  borderRadius: "6px",
  border: "1px solid hsl(var(--input))",
  padding: "0 8px",
  fontSize: "13px",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  outline: "none",
};
