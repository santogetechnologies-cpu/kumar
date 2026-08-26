import { useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Package, FlaskConical, ShoppingCart, GitBranch, Calendar, AlertTriangle, LayoutDashboard, ArrowLeftRight, Plus, Trash2, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { InvoiceDialog, type InvoiceRow, type InvoiceMeta, rowTaxable, rowGst } from "./InvoiceDialog";
import { BulkUploadDialog } from "./BulkUploadDialog";

type SubTab = "dashboard" | "medicines" | "materials" | "purchases" | "branches" | "movements" | "expiry" | "lowstock";

const subTabs: { id: SubTab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "medicines", label: "Medicines", icon: Package },
  { id: "materials", label: "Materials", icon: FlaskConical },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "branches", label: "Branches", icon: GitBranch },
  { id: "movements", label: "Movements", icon: ArrowLeftRight },
  { id: "expiry", label: "Expiry", icon: Calendar },
  { id: "lowstock", label: "Low Stock", icon: AlertTriangle },
];

export function InventoryTab() {
  const [sub, setSub] = useState<SubTab>("dashboard");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-1.5 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = sub === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSub(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {sub === "dashboard" && <InvDashboard />}
      {sub === "medicines" && <MedicinesMgmt />}
      {sub === "materials" && <MaterialsMgmt />}
      {sub === "purchases" && <PurchasesMgmt />}
      {sub === "branches" && <BranchesView />}
      {sub === "movements" && <MovementsView />}
      {sub === "expiry" && <ExpiryView />}
      {sub === "lowstock" && <LowStockView />}
    </div>
  );
}

function InvDashboard() {
  const { medicines, materials, purchases } = usePharmacy();
  const lowStock = medicines.filter((m) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel).length;
  const now = Date.now();
  const expiry = medicines.filter((m) => new Date(m.expiry).getTime() - now < 60 * 86400000).length;
  const outOfStock = medicines.filter((m) => (m.mainQuantity + m.pharmacyQuantity) === 0).length;
  const thisMonth = purchases.filter((p) => new Date(p.createdAt).getMonth() === new Date().getMonth()).length;

  const cards = [
    { label: "Total Medicines", value: medicines.length, icon: Package, tone: "primary" },
    { label: "Service Materials", value: materials.length, icon: FlaskConical, tone: "success" },
    { label: "Purchases This Month", value: thisMonth, icon: ShoppingCart, tone: "success" },
    { label: "Low Stock Alerts", value: lowStock, icon: AlertTriangle, tone: "warning" },
    { label: "Expiry Alerts (60d)", value: expiry, icon: Calendar, tone: "warning" },
    { label: "Out of Stock", value: outOfStock, icon: Package, tone: "destructive" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const bg = c.tone === "primary" ? "bg-primary/10 text-primary"
          : c.tone === "success" ? "bg-success/10 text-success"
          : c.tone === "warning" ? "bg-warning/10 text-warning"
          : "bg-destructive/10 text-destructive";
        return (
          <Card key={c.label} className="p-5">
            <div className="flex justify-between items-start">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${bg}`}><Icon className="h-5 w-5" /></div>
            </div>
            <div className="text-4xl font-bold mt-3">{c.value}</div>
          </Card>
        );
      })}
    </div>
  );
}

function MedicinesMgmt() {
  const { medicines, addMedicine, deleteMedicine } = usePharmacy();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const filtered = medicines.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  const handleSave = async (rows: InvoiceRow[], meta: InvoiceMeta) => {
    setSaving(true);
    try {
      for (const r of rows) {
        await addMedicine({
          name: r.product, category: "Tablet", batch: r.batch, expiry: r.exp,
          mainQuantity: r.qty + r.free, pharmacyQuantity: 0, minLevel: 10, price: r.mrp || r.ptr, supplier: meta.supplier,
        });
      }
      toast.success(`Invoice saved · ${rows.length} medicine${rows.length > 1 ? "s" : ""} added`);
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Medicine Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={saving}>Bulk Upload CSV</Button>
          <Button onClick={() => setOpen(true)} disabled={saving}><FileText className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Add via Invoice"}</Button>
        </div>
        <InvoiceDialog open={open} onOpenChange={setOpen} title="Medicine Purchase Invoice" onSave={handleSave} existingProducts={medicines.map(m => m.name)} />
        <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} type="medicine" />
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medicines..." className="pl-9" />
      </div>
      <ItemTable rows={filtered} onDelete={deleteMedicine} type="medicine" />
    </Card>
  );
}

function MaterialsMgmt() {
  const { materials, addMaterial, deleteMaterial } = usePharmacy();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const filtered = materials.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  const handleSave = async (rows: InvoiceRow[], meta: InvoiceMeta) => {
    setSaving(true);
    try {
      for (const r of rows) {
        await addMaterial({
          name: r.product, category: "Surgical", batch: r.batch, expiry: r.exp,
          mainQuantity: r.qty + r.free, pharmacyQuantity: 0, minLevel: 10, price: r.mrp || r.ptr, supplier: meta.supplier,
        });
      }
      toast.success(`Invoice saved · ${rows.length} material${rows.length > 1 ? "s" : ""} added`);
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Service Materials Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={saving}>Bulk Upload CSV</Button>
          <Button onClick={() => setOpen(true)} disabled={saving}><FileText className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Add via Invoice"}</Button>
        </div>
        <InvoiceDialog open={open} onOpenChange={setOpen} title="Material Purchase Invoice" onSave={handleSave} existingProducts={materials.map(m => m.name)} />
        <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} type="material" />
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials..." className="pl-9" />
      </div>
      <ItemTable rows={filtered} onDelete={deleteMaterial} type="material" />
    </Card>
  );
}


function ItemTable({ rows, onDelete, type }: { rows: any[]; onDelete: (id: string) => void, type: "medicine" | "material" }) {
  const { transferStock, canTransfer } = usePharmacy();
  const { user } = useAuth();
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState<number>(0);

  const isPharmacist = user?.user_metadata?.role === "pharmacist" || user?.role === "pharmacist";
  const showTransfer = !isPharmacist || canTransfer;

  const handleTransfer = () => {
    if (!transferId || transferAmount <= 0) return;
    const item = rows.find(r => r.id === transferId);
    if (!item) return;
    if (transferAmount > item.mainQuantity) {
      toast.error("Not enough main stock to transfer");
      return;
    }
    transferStock(type, transferId, transferAmount);
    toast.success(`Transferred ${transferAmount} to Pharmacy`);
    setTransferId(null);
    setTransferAmount(0);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Name", "Category", "Batch", "Expiry", "Main Stock", "Pharmacy Stock", "Min", "Price", "Supplier", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">No items</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                <td className="px-3 py-2.5">{r.category}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{r.batch}</td>
                <td className="px-3 py-2.5">{new Date(r.expiry).toLocaleDateString()}</td>
                <td className="px-3 py-2.5 font-semibold">{r.mainQuantity}</td>
                <td className="px-3 py-2.5 font-semibold text-primary">{r.pharmacyQuantity}</td>
                <td className="px-3 py-2.5">{r.minLevel}</td>
                <td className="px-3 py-2.5">₹{r.price}</td>
                <td className="px-3 py-2.5">{r.supplier || "-"}</td>
                <td className="px-3 py-2.5 flex items-center gap-1">
                  {showTransfer ? (
                    <Button variant="outline" size="sm" onClick={() => setTransferId(r.id)}>
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Transfer
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled title="Transfer disabled by Admin">
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Locked
                    </Button>
                  )}
                  {!isPharmacist && (
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <Dialog open={!!transferId} onOpenChange={(o) => { if (!o) setTransferId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to Pharmacy Stock</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Quantity to Transfer</Label>
            <Input type="number" value={transferAmount || ""} onChange={e => setTransferAmount(parseInt(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground mt-2">This moves stock from the main inventory to the active pharmacy dispensing inventory.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferId(null)}>Cancel</Button>
            <Button onClick={handleTransfer}>Transfer Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PurchasesMgmt() {
  const { medicines, materials, purchases, addPurchase, updatePurchaseStatus } = usePharmacy();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const allProducts = [...medicines.map(m => m.name), ...materials.map(m => m.name)];

  const handleSave = async (rows: InvoiceRow[], meta: InvoiceMeta) => {
    setSaving(true);
    try {
      for (const r of rows) {
        const cost = rowTaxable(r) + rowGst(r);
        const discountAmt = (r.ptr * r.qty * r.disPct) / 100;
        await addPurchase({ 
          item: r.product, 
          supplier: meta.supplier, 
          quantity: r.qty, 
          received: 0, 
          cost: +cost.toFixed(2), 
          status: "pending",
          invoice_no: meta.invoiceNo,
          free_quantity: r.free,
          discount_amount: +discountAmt.toFixed(2),
          mrp: r.mrp
        });
      }
      toast.success(`Purchase order created · ${rows.length} line${rows.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = purchases.filter(p => 
    p.item.toLowerCase().includes(q.toLowerCase()) || 
    p.supplier.toLowerCase().includes(q.toLowerCase()) ||
    (p.invoice_no && p.invoice_no.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Purchase Orders & Invoices</h2>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)} disabled={saving}><Plus className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "New Purchase Invoice"}</Button>
        </div>
        <InvoiceDialog open={open} onOpenChange={setOpen} title="New Purchase Invoice" onSave={handleSave} existingProducts={allProducts} />
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by item, supplier, or invoice no..." className="pl-9 max-w-md" />
      </div>
      
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Date", "Invoice No", "Item", "Supplier", "Qty + Free", "Received", "Cost", "MRP", "Margin/Tab", "Status", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={11} className="text-center py-6 text-muted-foreground">No purchases found</td></tr>}
            {filtered.map((p) => {
              const totalQty = p.quantity + (p.free_quantity || 0);
              const costPerTab = totalQty > 0 ? (p.cost / totalQty) : 0;
              const margin = p.mrp ? (p.mrp - costPerTab) : 0;
              const marginClass = margin > 0 ? "text-success" : margin < 0 ? "text-destructive" : "";

              return (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2.5">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{p.invoice_no || "-"}</td>
                  <td className="px-3 py-2.5 font-semibold">{p.item}</td>
                  <td className="px-3 py-2.5">{p.supplier}</td>
                  <td className="px-3 py-2.5">{p.quantity} {p.free_quantity ? <span className="text-success text-xs font-semibold">(+{p.free_quantity} Free)</span> : ""}</td>
                  <td className="px-3 py-2.5">{p.received}</td>
                  <td className="px-3 py-2.5">₹{p.cost}</td>
                  <td className="px-3 py-2.5">{p.mrp ? `₹${p.mrp}` : "-"}</td>
                  <td className={`px-3 py-2.5 font-medium ${marginClass}`}>{p.mrp ? `₹${margin.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2.5"><Badge variant={p.status === "received" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}>{p.status}</Badge></td>
                  <td className="px-3 py-2.5 text-right">
                    {p.status === "pending" && (
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => updatePurchaseStatus(p.id, "cancelled")}>Cancel</Button>
                        <Button size="sm" onClick={() => updatePurchaseStatus(p.id, "received")}>Mark Received</Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BranchesView() {
  const branches = [
    { name: "Kumar Hospital — Main", location: "Chennai", medicines: 447, active: true },
    { name: "Kumar Hospital — East Wing", location: "Chennai", medicines: 128, active: true },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {branches.map((b) => (
        <Card key={b.name} className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><GitBranch className="h-6 w-6" /></div>
            <div>
              <div className="font-semibold">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.location}</div>
            </div>
          </div>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted-foreground">Medicines</span><span className="font-semibold">{b.medicines}</span>
          </div>
          <Badge className="mt-3 bg-success text-white hover:bg-success">Active</Badge>
        </Card>
      ))}
    </div>
  );
}

function MovementsView() {
  const { bills } = usePharmacy();
  const movements = bills.slice(0, 20).flatMap((b) => b.items.map((it) => ({
    id: b.id + "-" + it.medicineId, date: b.createdAt, type: b.status === "refunded" ? "IN" : "OUT",
    item: it.name, qty: it.quantity, ref: b.id,
  })));
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold mb-3">Stock Movements</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>{["Date", "Type", "Item", "Qty", "Reference"].map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {movements.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No movements yet</td></tr>}
            {movements.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2.5">{new Date(m.date).toLocaleString()}</td>
                <td className="px-3 py-2.5"><Badge variant={m.type === "IN" ? "default" : "secondary"}>{m.type}</Badge></td>
                <td className="px-3 py-2.5 font-semibold">{m.item}</td>
                <td className="px-3 py-2.5">{m.qty}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{m.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ExpiryView() {
  const { medicines } = usePharmacy();
  const now = Date.now();
  const withDays = medicines.map((m) => ({ ...m, days: Math.floor((new Date(m.expiry).getTime() - now) / 86400000) })).sort((a, b) => a.days - b.days);
  const bucket = (d: number) => d < 0 ? "Expired" : d <= 7 ? "Within 7 Days" : d <= 30 ? "This Month" : d <= 60 ? "Next Month" : "Later";
  const groups = withDays.reduce<Record<string, typeof withDays>>((acc, m) => { const k = bucket(m.days); (acc[k] ||= []).push(m); return acc; }, {});
  const colors: Record<string, string> = { "Expired": "border-destructive/40 bg-destructive/5", "Within 7 Days": "border-warning/40 bg-warning/5", "This Month": "border-warning/40 bg-warning/5", "Next Month": "border-primary/40 bg-primary/5", "Later": "border-border" };
  return (
    <div className="space-y-3">
      {["Expired", "Within 7 Days", "This Month", "Next Month", "Later"].map((k) => groups[k] && (
        <Card key={k} className={`p-4 ${colors[k]}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{k}</div>
            <Badge variant="outline">{groups[k].length} batches</Badge>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {groups[k].map((m) => (
              <div key={m.id} className="text-sm flex justify-between">
                <span className="font-medium">{m.name} <span className="text-muted-foreground font-mono">({m.batch})</span></span>
                <span className="text-muted-foreground">{new Date(m.expiry).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function LowStockView() {
  const { medicines } = usePharmacy();
  const rows = medicines.filter((m) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel).sort((a, b) => (a.mainQuantity + a.pharmacyQuantity) - (b.mainQuantity + b.pharmacyQuantity));
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Stock Level Monitoring</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>{["Medicine", "Category", "Total Stock", "Min", "Status", "Price"].map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">All stock levels adequate</td></tr>}
            {rows.map((m) => {
              const total = m.mainQuantity + m.pharmacyQuantity;
              const status = total === 0 ? "Out" : total <= m.minLevel * 0.25 ? "Critical" : "Low";
              const badge = status === "Out" ? "destructive" : status === "Critical" ? "destructive" : "secondary";
              return (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2.5 font-semibold">{m.name}</td>
                  <td className="px-3 py-2.5">{m.category}</td>
                  <td className="px-3 py-2.5 font-bold text-destructive">{total}</td>
                  <td className="px-3 py-2.5">{m.minLevel}</td>
                  <td className="px-3 py-2.5"><Badge variant={badge as any}>{status}</Badge></td>
                  <td className="px-3 py-2.5">₹{m.price}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
