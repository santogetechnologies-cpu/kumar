import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calculator, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  /** If true, product must be selected from existingProducts only */
  restrictToExisting?: boolean;
}

function ProductCell({
  value,
  onChange,
  existingProducts,
  restrictToExisting,
}: {
  value: string;
  onChange: (v: string) => void;
  existingProducts?: string[];
  restrictToExisting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (restrictToExisting && existingProducts && existingProducts.length > 0) {
    const filtered = existingProducts.filter((p) =>
      p.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex h-8 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm hover:bg-accent"
          >
            <span className="truncate">{value || "Select product…"}</span>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-1" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup className="max-h-48 overflow-auto">
              {filtered.map((p) => (
                <CommandItem
                  key={p}
                  value={p}
                  onSelect={() => {
                    onChange(p);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // Free-text with autocomplete for medicine invoices (new items)
  return (
    <Input
      list="existing-products-list"
      className="h-8 min-w-[160px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Product name"
    />
  );
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
    if (valid.length === 0) { toast.error("Add at least one valid row (Product, Batch, Expiry, Qty)"); return; }
    if (restrictToExisting) {
      const invalid = valid.find((r) => existingProducts && !existingProducts.includes(r.product));
      if (invalid) { toast.error(`"${invalid.product}" is not in the existing product list. Please select from the dropdown.`); return; }
    }
    onSave(valid, meta);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] w-[1300px] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
        </DialogHeader>

        {/* Header Meta */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Supplier <span className="text-destructive">*</span></Label>
            <Input value={meta.supplier} onChange={(e) => setMeta({ ...meta, supplier: e.target.value })} />
          </div>
          <div>
            <Label>Invoice No.</Label>
            <Input value={meta.invoiceNo} onChange={(e) => setMeta({ ...meta, invoiceNo: e.target.value })} />
          </div>
          <div>
            <Label>Invoice Date</Label>
            <Input type="date" value={meta.invoiceDate} onChange={(e) => setMeta({ ...meta, invoiceDate: e.target.value })} />
          </div>
          <div>
            <Label>Payment Mode</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={meta.paymentMode}
              onChange={(e) => setMeta({ ...meta, paymentMode: e.target.value })}
            >
              <option>Cash</option><option>UPI</option><option>Card</option><option>Credit</option><option>Cheque</option>
            </select>
          </div>
        </div>

        {/* Free-text autocomplete datalist (used when not restrictToExisting) */}
        {existingProducts && existingProducts.length > 0 && !restrictToExisting && (
          <datalist id="existing-products-list">
            {existingProducts.map((p) => <option key={p} value={p} />)}
          </datalist>
        )}

        {/* Rows Table */}
        <div className="mt-4 border rounded-lg overflow-auto flex-1">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-xs text-left uppercase text-muted-foreground">
                {["S.No", "Product *", "HSN", "Batch *", "Expiry *", "MRP (per item)", "PTR (per item)", "Qty *", "Free", "Total Qty", "Taxable", "Disc %", "GST %", "Net Amount", ""].map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-1 py-1">
                    <ProductCell
                      value={r.product}
                      onChange={(v) => update(i, { product: v })}
                      existingProducts={existingProducts}
                      restrictToExisting={restrictToExisting}
                    />
                  </td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" value={r.hsn} onChange={(e) => update(i, { hsn: e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-24" value={r.batch} onChange={(e) => update(i, { batch: e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-36" type="date" value={r.exp} onChange={(e) => update(i, { exp: e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-24" type="number" value={r.mrp === 0 ? "" : r.mrp} onChange={(e) => update(i, { mrp: +e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-24" type="number" value={r.ptr === 0 ? "" : r.ptr} onChange={(e) => update(i, { ptr: +e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" value={r.qty === 0 ? "" : r.qty} onChange={(e) => update(i, { qty: +e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" value={r.free === 0 ? "" : r.free} onChange={(e) => update(i, { free: +e.target.value })} /></td>
                  <td className="px-2 py-1.5 font-mono text-center w-20">{(r.qty || 0) + (r.free || 0)}</td>
                  <td className="px-2 py-1.5 font-mono text-right w-24">{rowTaxable(r).toFixed(2)}</td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" value={r.disPct === 0 ? "" : r.disPct} onChange={(e) => update(i, { disPct: +e.target.value })} /></td>
                  <td className="px-1 py-1"><Input className="h-8 w-20" type="number" value={r.gstPct === 0 ? "" : r.gstPct} onChange={(e) => update(i, { gstPct: +e.target.value })} /></td>
                  <td className="px-2 py-1.5 font-mono text-right w-28">₹{rowNet(r).toFixed(2)}</td>
                  <td className="px-1 py-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Row */}
        <div className="flex items-start justify-between gap-4 pt-3">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Row
          </Button>
          <div className="text-sm space-y-0.5 text-right min-w-[300px]">
            <div>Subtotal: <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span></div>
            <div className="text-success">Discount: -₹{totals.discount.toFixed(2)}</div>
            <div>Taxable: ₹{totals.taxable.toFixed(2)}</div>
            <div>GST: +₹{totals.gst.toFixed(2)}</div>
            <div>Net (with GST): ₹{totals.net.toFixed(2)}</div>
            <div>Round off: {totals.roundOff >= 0 ? "+" : ""}₹{totals.roundOff.toFixed(2)}</div>
            <div className="text-lg font-bold pt-1">Bill Amount: ₹{totals.billAmount.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground pt-1">
              Total stock: {totals.paidItems + totals.freeItems} items ({totals.paidItems} paid + {totals.freeItems} free)
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}><Calculator className="h-4 w-4 mr-1.5" /> Save Invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
