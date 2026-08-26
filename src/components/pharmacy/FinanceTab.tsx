import { useMemo, useState } from "react";
import { usePharmacy, type Expense } from "@/lib/pharmacy-store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Plus, Trash2,
  CalendarDays, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";

/* ── Date range helpers ── */
type RangeKey = "today" | "week" | "month" | "quarter" | "year" | "custom";

function startOf(key: RangeKey, customStart?: string, customEnd?: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (key) {
    case "today": return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to };
    case "week": {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { from: new Date(d.getFullYear(), d.getMonth(), d.getDate()), to };
    }
    case "month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "quarter": return { from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), to };
    case "year": return { from: new Date(now.getFullYear(), 0, 1), to };
    case "custom":
      return {
        from: customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1),
        to: customEnd ? new Date(new Date(customEnd).setHours(23, 59, 59, 999)) : to,
      };
  }
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

/* Pharmacy-only internal use expense categories */
const EXPENSE_CATS = [
  "Dressing Materials",
  "Sanitization Supplies",
  "Internal Medicine Use",
  "Medical Waste Disposal",
  "PPE & Safety",
  "Pharmacy Consumables",
  "Sterile Supplies",
  "Miscellaneous Pharmacy",
];

/* ── Main Component ── */
export function FinanceTab() {
  const { bills, purchases, expenses, addExpense, deleteExpense } = usePharmacy();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [range, setRange] = useState<RangeKey>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expCat, setExpCat] = useState(EXPENSE_CATS[0]);
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { from, to } = startOf(range, customStart, customEnd);

  /* ── Filter data by date range ── */
  const filteredBills = useMemo(() =>
    bills.filter(b => {
      const d = new Date(b.createdAt);
      return d >= from && d <= to && b.status !== "refunded";
    }), [bills, from, to]);

  /* All purchases (both received and pending/initial) in the period */
  const filteredPurchases = useMemo(() =>
    purchases.filter(p => {
      const d = new Date(p.createdAt);
      return d >= from && d <= to;
    }), [purchases, from, to]);

  /* Only received purchases count as a real expense in P&L */
  const filteredReceivedPurchases = useMemo(() =>
    filteredPurchases.filter(p => p.status === "received"),
  [filteredPurchases]);

  const filteredExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    }), [expenses, from, to]);

  /* ── P&L Calculations ── */
  const revenue = filteredBills.reduce((s, b) => s + b.total, 0);
  const purchaseCost = filteredReceivedPurchases.reduce((s, p) => s + p.cost, 0);
  const otherExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = purchaseCost + otherExpenses;
  const grossProfit = revenue - purchaseCost;
  const netProfit = revenue - totalExpenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const totalTx = filteredBills.length;
  const avgBill = totalTx > 0 ? revenue / totalTx : 0;

  /* ── Daily chart data ── */
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; revenue: number; expenses: number; profit: number }> = {};
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: 0, expenses: 0, profit: 0 };
    }
    filteredBills.forEach(b => {
      const k = new Date(b.createdAt).toISOString().slice(0, 10);
      if (days[k]) days[k].revenue += b.total;
    });
    filteredReceivedPurchases.forEach(p => {
      const k = new Date(p.createdAt).toISOString().slice(0, 10);
      if (days[k]) days[k].expenses += p.cost;
    });
    filteredExpenses.forEach(e => {
      const k = e.date;
      if (days[k]) days[k].expenses += e.amount;
    });
    return Object.values(days).map(d => ({
      ...d,
      profit: +(d.revenue - d.expenses).toFixed(2),
      revenue: +d.revenue.toFixed(2),
      expenses: +d.expenses.toFixed(2),
    }));
  }, [filteredBills, filteredReceivedPurchases, filteredExpenses, from, to]);

  /* ── Expense by category ── */
  const expByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    filteredReceivedPurchases.forEach(p => { map["Purchases (Received)"] = (map["Purchases (Received)"] || 0) + p.cost; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [filteredExpenses, filteredReceivedPurchases]);

  /* ── Add Expense ── */
  const handleAddExpense = async () => {
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!expDesc.trim()) { toast.error("Enter a description"); return; }
    setSaving(true);
    try {
      await addExpense({ amount: amt, description: expDesc.trim(), category: expCat, date: expDate });
      toast.success("Expense recorded!");
      setShowExpenseDialog(false);
      setExpAmount(""); setExpDesc("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteExpense(id);
      toast.success("Expense deleted");
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleting(null); }
  };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "Last 7 Days" },
    { key: "month", label: "This Month" },
    { key: "quarter", label: "This Quarter" },
    { key: "year", label: "This Year" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> {isAdmin ? "Finance & P&L Report" : "Pharmacy Expense Entry"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? `${fmt(from)} — ${fmt(to)}` : "Record pharmacy internal use expenses"}
          </p>
        </div>
        <Button onClick={() => setShowExpenseDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Record Expense
        </Button>
      </div>

      {/* Date range pills — admin only */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${range === r.key ? "bg-primary text-primary-foreground border-primary shadow-sm" : "hover:bg-accent border-transparent"}`}
            >
              {r.label}
            </button>
          ))}
          {range === "custom" && (
            <div className="flex items-center gap-2 ml-1 flex-wrap">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-sm" />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-sm" />
            </div>
          )}
        </div>
      )}

      {/* ── KPI Cards — admin only ── */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PLCard label="Total Revenue" value={`₹${revenue.toFixed(2)}`} sub={`${totalTx} transactions · Avg ₹${avgBill.toFixed(0)}`} icon={TrendingUp} color="blue" positive />
          <PLCard label="Total Expenses" value={`₹${totalExpenses.toFixed(2)}`} sub={`Purchases ₹${purchaseCost.toFixed(0)} + Other ₹${otherExpenses.toFixed(0)}`} icon={ShoppingCart} color="red" positive={false} />
          <PLCard label="Gross Profit" value={`₹${grossProfit.toFixed(2)}`} sub={`Margin: ${grossMargin.toFixed(1)}%`} icon={grossProfit >= 0 ? ArrowUpRight : ArrowDownRight} color={grossProfit >= 0 ? "green" : "red"} positive={grossProfit >= 0} />
          <PLCard label="Net Profit" value={`₹${netProfit.toFixed(2)}`} sub={`Net margin: ${netMargin.toFixed(1)}%`} icon={netProfit >= 0 ? DollarSign : TrendingDown} color={netProfit >= 0 ? "green" : "red"} positive={netProfit >= 0} />
        </div>
      )}

      {/* ── P&L + Charts — admin only ── */}
      {isAdmin && (
        <>
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Profit & Loss Summary</h3>
            <div className="space-y-2">
              {[
                { label: "Revenue from Bills", val: revenue, indent: 0, bold: false, color: "text-green-600" },
                { label: "Less: Cost of Purchases (Received)", val: -purchaseCost, indent: 1, bold: false, color: "text-red-500" },
                { label: "= Gross Profit", val: grossProfit, indent: 0, bold: true, color: grossProfit >= 0 ? "text-green-600" : "text-red-500" },
                { label: "Less: Pharmacy Internal Expenses", val: -otherExpenses, indent: 1, bold: false, color: "text-red-500" },
                { label: "= Net Profit / (Loss)", val: netProfit, indent: 0, bold: true, color: netProfit >= 0 ? "text-green-700" : "text-red-600" },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between py-2 border-b last:border-0 last:pt-3 ${row.bold ? "border-t-2 font-bold text-base" : "text-sm"} ${row.indent ? "pl-6" : ""}`}>
                  <span className={row.bold ? "" : "text-muted-foreground"}>{row.label}</span>
                  <span className={row.color + (row.bold ? " text-lg" : "")}>
                    {row.val < 0 ? "-" : ""}₹{Math.abs(row.val).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Daily Revenue vs Expenses</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ left: -10 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `₹${v}`} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#rev)" strokeWidth={2} name="Revenue" dot={false} />
                    <Area type="monotone" dataKey="expenses" stroke="#dc2626" fill="url(#exp)" strokeWidth={2} name="Expenses" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3">Daily Net Profit / Loss</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `₹${v}`} />
                    <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]} fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3">Expenses by Category</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expByCategory} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip formatter={(v: any) => `₹${v}`} />
                    <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3">Key Metrics</h3>
              <div className="space-y-3">
                {[
                  { label: "Gross Margin", value: `${grossMargin.toFixed(1)}%`, bar: Math.min(100, grossMargin), color: "bg-blue-500" },
                  { label: "Net Margin", value: `${netMargin.toFixed(1)}%`, bar: Math.min(100, Math.max(0, netMargin)), color: "bg-green-500" },
                  { label: "Expense Ratio", value: `${revenue > 0 ? ((totalExpenses / revenue) * 100).toFixed(1) : 0}%`, bar: Math.min(100, revenue > 0 ? (totalExpenses / revenue) * 100 : 0), color: "bg-red-500" },
                  { label: "Purchase/Revenue", value: `${revenue > 0 ? ((purchaseCost / revenue) * 100).toFixed(1) : 0}%`, bar: Math.min(100, revenue > 0 ? (purchaseCost / revenue) * 100 : 0), color: "bg-orange-500" },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-semibold">{m.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.color} transition-all`} style={{ width: `${m.bar}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ── Expense Ledger ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" /> Other Expenses Ledger
            <Badge variant="secondary">{filteredExpenses.length} entries</Badge>
          </h3>
          <Button variant="outline" size="sm" onClick={() => setShowExpenseDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Expense
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Date", "Category", "Description", "Added By", "Amount", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No expenses recorded in this period.<br /><span className="text-xs">Click "Add Expense" to record one.</span></td></tr>
              )}
              {filteredExpenses.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2.5">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5"><Badge variant="outline">{e.category}</Badge></td>
                  <td className="px-3 py-2.5">{e.description}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{e.createdBy}</td>
                  <td className="px-3 py-2.5 font-semibold text-red-500">₹{e.amount.toFixed(2)}</td>
                  <td className="px-3 py-2.5">
                    {isAdmin && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
                      >
                        {deleting === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-muted/30">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-right">Total Other Expenses:</td>
                  <td className="px-3 py-2 font-bold text-red-500">₹{otherExpenses.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ── All Purchases Ledger (both pending + received) ── */}
      {isAdmin && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Purchase Orders in Period
            <Badge variant="secondary">{filteredPurchases.length} orders</Badge>
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Date", "Item", "Supplier", "Qty", "Status", "Cost", "Invoice No"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No purchases in this period</td></tr>
                )}
                {filteredPurchases.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2.5">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 font-semibold">{p.item}</td>
                    <td className="px-3 py-2.5">{p.supplier}</td>
                    <td className="px-3 py-2.5">{p.quantity}{p.free_quantity ? <span className="text-xs text-success ml-1">(+{p.free_quantity} free)</span> : ""}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={p.status === "received" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}>{p.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-red-500">₹{p.cost.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{p.invoice_no || "—"}</td>
                  </tr>
                ))}
              </tbody>
              {filteredReceivedPurchases.length > 0 && (
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-sm font-semibold text-right">Total Received (Expense):</td>
                    <td className="px-3 py-2 font-bold text-red-500">₹{purchaseCost.toFixed(2)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* ── Add Expense Dialog ── */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Record Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-10 mt-1"
                  placeholder="0.00"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  className="h-10 mt-1"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                value={expCat}
                onChange={e => setExpCat(e.target.value)}
              >
                {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Description *</Label>
              <Input
                className="h-10 mt-1"
                placeholder="e.g. Monthly electricity bill"
                value={expDesc}
                onChange={e => setExpDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <><Plus className="h-4 w-4 mr-2" /> Save Expense</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── KPI Card ── */
function PLCard({
  label, value, sub, icon: Icon, color, positive,
}: {
  label: string; value: string; sub: string;
  icon: any; color: "blue" | "green" | "red"; positive: boolean;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
    green: "bg-green-50 text-green-600 dark:bg-green-950/30",
    red: "bg-red-50 text-red-500 dark:bg-red-950/30",
  };
  return (
    <Card className="p-5">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${color === "red" || !positive ? "text-red-500" : color === "green" ? "text-green-600" : "text-blue-600"}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </Card>
  );
}
