import { useMemo } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Package, Receipt } from "lucide-react";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export function AnalyticsTab() {
  const { bills, medicines } = usePharmacy();

  const active = bills.filter((b) => b.status !== "refunded");
  const totalRevenue = active.reduce((s, b) => s + b.total, 0);
  const totalQty = active.reduce((s, b) => s + b.items.reduce((x, i) => x + i.quantity, 0), 0);
  const totalTx = active.length;

  const topMeds = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const b of active) for (const it of b.items) {
      const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.quantity; cur.revenue += it.quantity * it.price;
      map.set(it.name, cur);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [active]);

  const revenueData = topMeds.slice(0, 8).map((m) => ({ name: m.name, value: Number(m.revenue.toFixed(2)) }));

  const stockValue = medicines.reduce((s, m) => s + m.quantity * m.price, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} sub="From medicine sales" Icon={TrendingUp} tone="primary" />
        <KPI label="Quantity Sold" value={totalQty.toString()} sub="Units dispensed" Icon={Package} tone="success" />
        <KPI label="Transactions" value={totalTx.toString()} sub="Billing entries" Icon={Receipt} tone="warning" />
        <KPI label="Stock Value" value={`₹${stockValue.toFixed(0)}`} sub="Current inventory" Icon={Package} tone="primary" />
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Top 10 Medicines by Quantity Sold</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topMeds}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="#2563eb" name="Quantity Sold" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Revenue Distribution (Top 8)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={revenueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => e.value}>
                {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function KPI({ label, value, sub, Icon, tone }: { label: string; value: string; sub: string; Icon: any; tone: "primary" | "success" | "warning" }) {
  const bg = tone === "primary" ? "bg-primary/10 text-primary" : tone === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning";
  return (
    <Card className="p-5">
      <div className="flex justify-between items-start">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${bg}`}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}
