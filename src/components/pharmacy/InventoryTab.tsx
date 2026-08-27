import { useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Package, FlaskConical, ShoppingCart, Calendar, AlertTriangle,
  LayoutDashboard, ArrowLeftRight, Plus, Trash2, Search, FileText, GitCompare, Loader2, ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { InvoiceDialog, type InvoiceRow, type InvoiceMeta, rowTaxable, rowGst } from "./InvoiceDialog";
import { BulkUploadDialog } from "./BulkUploadDialog";

type SubTab = "dashboard" | "medicines" | "materials" | "purchases" | "movements" | "stock" | "expiry" | "lowstock";

const subTabs: { id: SubTab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "medicines", label: "Medicines", icon: Package },
  { id: "materials", label: "Materials", icon: FlaskConical },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "movements", label: "Movements", icon: ArrowLeftRight },
  { id: "stock", label: "Stock Comparison", icon: GitCompare },
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
      {sub === "movements" && <MovementsView />}
      {sub === "stock" && <StockComparisonView />}
      {sub === "expiry" && <ExpiryView />}
      {sub === "lowstock" && <LowStockView />}
    </div>
  );
}

function InvDashboard() {
  const { medicines, materials, purchases } = usePharmacy();
  const allItems = [...medicines, ...materials];
  const lowStock = allItems.filter((m) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel).length;
  const now = Date.now();
  const expiry = medicines.filter((m) => new Date(m.expiry).getTime() - now < 60 * 86400000).length;
  const outOfStock = allItems.filter((m) => (m.mainQuantity + m.pharmacyQuantity) === 0).length;
  const thisMonth = purchases.filter((p) => new Date(p.createdAt).getMonth() === new Date().getMonth()).length;
  const totalMainStock = allItems.reduce((s, m) => s + m.mainQuantity, 0);
  const totalPharmacyStock = allItems.reduce((s, m) => s + m.pharmacyQuantity, 0);
  const stockValue = allItems.reduce((s, m) => s + (m.mainQuantity + m.pharmacyQuantity) * m.price, 0);

  const cards = [
    { label: "Total Medicines", value: medicines.length, icon: Package, tone: "primary" },
    { label: "Service Materials", value: materials.length, icon: FlaskConical, tone: "primary" },
    { label: "Total Stock Value", value: `₹${stockValue.toFixed(0)}`, icon: ShoppingCart, tone: "success" },
    { label: "Purchases This Month", value: thisMonth, icon: ShoppingCart, tone: "success" },
    { label: "Low Stock Alerts", value: lowStock, icon: AlertTriangle, tone: "warning" },
    { label: "Expiry Alerts (60d)", value: expiry, icon: Calendar, tone: "warning" },
    { label: "Out of Stock", value: outOfStock, icon: Package, tone: "destructive" },
    { label: "Main Inventory", value: totalMainStock, icon: Package, tone: "primary" },
    { label: "Pharmacy Stock", value: totalPharmacyStock, icon: FlaskConical, tone: "success" },
  ];

  return (
    <div className="space-y-4">
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

      {/* Mini stock overview bar chart */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-muted-foreground" /> Main vs Pharmacy Stock — Top 10 Medicines
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={medicines.slice(0, 10).map(m => ({ name: m.name.length > 14 ? m.name.slice(0, 14) + "…" : m.name, Main: m.mainQuantity, Pharmacy: m.pharmacyQuantity }))}
              margin={{ left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Main" fill="#2563eb" radius={[4, 4, 0, 0]} name="Main Stock" />
              <Bar dataKey="Pharmacy" fill="#16a34a" radius={[4, 4, 0, 0]} name="Pharmacy Stock" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ---- Stock Comparison Sub-Tab ---- */
function StockComparisonView() {
  const { medicines, materials } = usePharmacy();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "medicine" | "material">("all");

  const allItems = [
    ...medicines.map(m => ({ ...m, _type: "medicine" as const })),
    ...materials.map(m => ({ ...m, _type: "material" as const })),
  ];

  const filtered = allItems.filter(m => {
    const matchQ = m.name.toLowerCase().includes(q.toLowerCase());
    const matchF = filter === "all" || m._type === filter;
    return matchQ && matchF;
  });

  // Sort by total stock descending for chart
  const chartData = filtered
    .sort((a, b) => (b.mainQuantity + b.pharmacyQuantity) - (a.mainQuantity + a.pharmacyQuantity))
    .slice(0, 20)
    .map(m => ({
      name: m.name.length > 14 ? m.name.slice(0, 14) + "…" : m.name,
      Main: m.mainQuantity,
      Pharmacy: m.pharmacyQuantity,
      type: m._type,
    }));

  const totalMain = filtered.reduce((s, m) => s + m.mainQuantity, 0);
  const totalPharmacy = filtered.reduce((s, m) => s + m.pharmacyQuantity, 0);
  const lowTransfer = filtered.filter(m => m.pharmacyQuantity <= m.minLevel && m.mainQuantity > 0).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total SKUs</div>
          <div className="text-4xl font-bold mt-2">{filtered.length}</div>
        </Card>
        <Card className="p-5 border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
          <div className="text-sm text-muted-foreground">Main Inventory Stock</div>
          <div className="text-4xl font-bold mt-2 text-blue-600">{totalMain.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">units in warehouse</div>
        </Card>
        <Card className="p-5 border-green-200 bg-green-50/30 dark:bg-green-950/20">
          <div className="text-sm text-muted-foreground">Pharmacy Dispensing Stock</div>
          <div className="text-4xl font-bold mt-2 text-green-600">{totalPharmacy.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">units ready to dispense</div>
        </Card>
      </div>

      {lowTransfer > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <div className="font-semibold text-warning">{lowTransfer} item{lowTransfer > 1 ? "s" : ""} need transfer</div>
            <div className="text-sm text-muted-foreground">Pharmacy stock is below minimum level but main stock is available. Consider transferring.</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-muted-foreground" /> Main vs Pharmacy Stock Comparison (Top 20)
          </h3>
          <div className="flex gap-2">
            {(["all", "medicine", "material"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${filter === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-transparent"}`}
              >
                {f === "all" ? "All Items" : f === "medicine" ? "Medicines" : "Materials"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={65} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Main" fill="#2563eb" radius={[4, 4, 0, 0]} name="Main Stock" />
              <Bar dataKey="Pharmacy" fill="#16a34a" radius={[4, 4, 0, 0]} name="Pharmacy Stock" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detail table */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h3 className="font-semibold">Stock Detail Table</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items..." className="pl-9 h-9" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Name", "Type", "Category", "Main Stock", "Pharmacy Stock", "Total", "Min Level", "Status"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No items found</td></tr>
              )}
              {filtered.map(m => {
                const total = m.mainQuantity + m.pharmacyQuantity;
                const status = total === 0 ? "Out" : m.pharmacyQuantity <= m.minLevel ? (m.mainQuantity > 0 ? "Needs Transfer" : "Critical") : "OK";
                const statusColor = status === "Out" ? "destructive" : status === "Critical" ? "destructive" : status === "Needs Transfer" ? "secondary" : "default";
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2.5 font-semibold">{m.name}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">{m._type}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.category}</td>
                    <td className="px-3 py-2.5 font-semibold text-blue-600">{m.mainQuantity}</td>
                    <td className="px-3 py-2.5 font-semibold text-green-600">{m.pharmacyQuantity}</td>
                    <td className="px-3 py-2.5 font-bold">{total}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.minLevel}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={statusColor as any}>{status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
  const { medicines, materials, transferStock, canTransfer } = usePharmacy();
  const { user } = useAuth();
  // transferId holds the NAME of the item (for FIFO across batches)
  const [transferName, setTransferName] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferring, setTransferring] = useState(false);

  const isPharmacist = user?.user_metadata?.role === "pharmacist" || user?.role === "pharmacist";
  const showTransfer = !isPharmacist || canTransfer;

  // Get FIFO batches (same name, sorted by earliest expiry, with mainQuantity > 0)
  const fifoBatches = transferName
    ? rows
        .filter(r => r.name.toLowerCase() === transferName.toLowerCase() && r.mainQuantity > 0)
        .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())
    : [];

  const totalMainStock = fifoBatches.reduce((s, r) => s + r.mainQuantity, 0);

  const handleTransfer = async () => {
    if (!transferName || transferAmount <= 0) return;
    if (transferAmount > totalMainStock) {
      toast.error(`Not enough main stock. Only ${totalMainStock} units available.`);
      return;
    }
    setTransferring(true);
    try {
      // FIFO: deduct from earliest-expiry batches first
      let remaining = transferAmount;
      for (const batch of fifoBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.mainQuantity);
        await transferStock(type, batch.id, take);
        remaining -= take;
      }
      toast.success(`Transferred ${transferAmount} units to Pharmacy (FIFO — earliest batch first)`);
      setTransferName(null);
      setTransferAmount(0);
    } catch (e: any) {
      toast.error("Transfer failed: " + e.message);
    } finally {
      setTransferring(false);
    }
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
                    <Button variant="outline" size="sm" onClick={() => setTransferName(r.name)}>
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

      <Dialog open={!!transferName} onOpenChange={(o) => { if (!o && !transferring) setTransferName(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to Pharmacy Stock</DialogTitle>
            <DialogDescription>
              Transferring <strong>{transferName}</strong> — FIFO order (earliest expiry batch first).
              Total available in main stock: <strong>{totalMainStock}</strong> units.
            </DialogDescription>
          </DialogHeader>
          {fifoBatches.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
              <div className="font-semibold text-muted-foreground mb-1">Batches (will be consumed in this order):</div>
              {fifoBatches.map((b, i) => (
                <div key={b.id} className="flex justify-between">
                  <span className="font-mono">{b.batch}</span>
                  <span className="text-muted-foreground">Exp: {new Date(b.expiry).toLocaleDateString()}</span>
                  <span className="font-semibold">{b.mainQuantity} units</span>
                  {i === 0 && <span className="text-xs bg-primary/10 text-primary px-1.5 rounded">First</span>}
                </div>
              ))}
            </div>
          )}
          <div className="py-2">
            <Label>Quantity to Transfer</Label>
            <Input
              type="number"
              min={1}
              max={totalMainStock}
              value={transferAmount || ""}
              onChange={e => setTransferAmount(parseInt(e.target.value) || 0)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-2">Stock will be moved from main inventory to pharmacy dispensing stock, starting with the earliest-expiry batch.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferName(null)} disabled={transferring}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={transferring || transferAmount <= 0}>
              {transferring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transferring…</> : <><ArrowLeftRight className="h-4 w-4 mr-2" /> Transfer Stock</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PurchasesMgmt() {
  const { medicines, materials, purchases, addPurchase, updatePurchaseStatus, deletePurchase } = usePharmacy();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [purchaseToDelete, setPurchaseToDelete] = useState<any | null>(null);
  const [revertStock, setRevertStock] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      {p.status === "pending" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => updatePurchaseStatus(p.id, "cancelled")}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => updatePurchaseStatus(p.id, "received")}>
                            Mark Received
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setPurchaseToDelete(p)}
                          title="Delete Purchase Order (Admin only)"
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

      {/* Delete Purchase Confirmation Dialog */}
      <Dialog open={!!purchaseToDelete} onOpenChange={(o) => { if (!o && !deleting) setPurchaseToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Purchase {purchaseToDelete?.id}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this purchase order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div><strong>Item:</strong> {purchaseToDelete?.item}</div>
              <div><strong>Supplier:</strong> {purchaseToDelete?.supplier}</div>
              <div><strong>Cost:</strong> ₹{purchaseToDelete?.cost}</div>
              <div><strong>Status:</strong> {purchaseToDelete?.status}</div>
            </div>
            {purchaseToDelete?.status === "received" && (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={revertStock}
                  onChange={(e) => setRevertStock(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium">Revert / Deduct received quantity from Main stock</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!purchaseToDelete) return;
                setDeleting(true);
                try {
                  await deletePurchase(purchaseToDelete.id, revertStock);
                  toast.success("Purchase order deleted successfully");
                  setPurchaseToDelete(null);
                } catch (e: any) {
                  toast.error("Failed to delete purchase: " + e.message);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" /> Confirm Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
  const { medicines, materials, addPurchase } = usePharmacy();
  const allItems = [
    ...medicines.map(m => ({ ...m, _type: "medicine" as const })),
    ...materials.map(m => ({ ...m, _type: "material" as const })),
  ];
  const rows = allItems
    .filter((m) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel)
    .sort((a, b) => (a.mainQuantity + a.pharmacyQuantity) - (b.mainQuantity + b.pharmacyQuantity));

  // Purchase order dialog state
  const [poItem, setPoItem] = useState<any | null>(null);
  const [poSupplier, setPoSupplier] = useState("");
  const [poQty, setPoQty] = useState<number>(0);
  const [poCost, setPoCost] = useState<number>(0);
  const [poSaving, setPoSaving] = useState(false);

  const openPO = (item: any) => {
    setPoItem(item);
    setPoSupplier(item.supplier || "");
    setPoQty(item.minLevel * 2 || 10);
    setPoCost(0);
  };

  const submitPO = async () => {
    if (!poItem) return;
    if (!poSupplier.trim()) { toast.error("Enter supplier name"); return; }
    if (poQty <= 0) { toast.error("Enter quantity"); return; }
    setPoSaving(true);
    try {
      await addPurchase({
        item: poItem.name,
        supplier: poSupplier.trim(),
        quantity: poQty,
        received: 0,
        cost: poCost,
        status: "pending",
        invoice_no: "",
        free_quantity: 0,
        discount_amount: 0,
        mrp: poItem.price,
      });
      toast.success(`Purchase order created for ${poItem.name}`);
      setPoItem(null);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setPoSaving(false);
    }
  };

  return (
    <>
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Stock Level Monitoring</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>{["Item", "Type", "Category", "Total Stock", "Min", "Status", "Price", ""].map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">All stock levels adequate</td></tr>}
              {rows.map((m) => {
                const total = m.mainQuantity + m.pharmacyQuantity;
                const status = total === 0 ? "Out" : total <= m.minLevel * 0.25 ? "Critical" : "Low";
                const badge = status === "Out" ? "destructive" : status === "Critical" ? "destructive" : "secondary";
                const showPO = status === "Low" || status === "Critical" || status === "Out";
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2.5 font-semibold">{m.name}</td>
                    <td className="px-3 py-2.5"><Badge variant="outline" className="text-[10px]">{m._type}</Badge></td>
                    <td className="px-3 py-2.5">{m.category}</td>
                    <td className="px-3 py-2.5 font-bold text-destructive">{total}</td>
                    <td className="px-3 py-2.5">{m.minLevel}</td>
                    <td className="px-3 py-2.5"><Badge variant={badge as any}>{status}</Badge></td>
                    <td className="px-3 py-2.5">₹{m.price}</td>
                    <td className="px-3 py-2.5">
                      {showPO && (
                        <Button size="sm" variant="outline" className="text-xs whitespace-nowrap" onClick={() => openPO(m)}>
                          <ClipboardList className="h-3.5 w-3.5 mr-1" /> Create PO
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Purchase Order via InvoiceDialog */}
      <InvoiceDialog 
        open={!!poItem} 
        onOpenChange={(o) => { if (!o && !poSaving) setPoItem(null); }} 
        title="New Purchase Invoice (from Low Stock)"
        onSave={async (rows, meta) => {
          setPoSaving(true);
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
            setPoItem(null);
          } catch (e: any) {
            toast.error("Failed to create PO: " + e.message);
          } finally {
            setPoSaving(false);
          }
        }}
        existingProducts={allItems.map(m => m.name)}
        initialMeta={{ supplier: poItem?.supplier || "" }}
        initialRows={poItem ? [{
          product: poItem.name,
          hsn: "", batch: "", exp: "",
          mrp: poItem.price, ptr: poItem.price,
          qty: poItem.minLevel * 2 || 10,
          free: 0, disPct: 0, gstPct: 0
        }] : undefined}
      />
    </>
  );
}
