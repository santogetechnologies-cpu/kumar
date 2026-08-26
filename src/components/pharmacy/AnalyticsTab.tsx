import { useMemo, useState } from "react";
import { usePharmacy } from "@/lib/pharmacy-store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Package, Receipt, Sparkles, User, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export function AnalyticsTab() {
  const { bills, medicines, materials, purchases } = usePharmacy();
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

  const doctorStats = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; prescriptions: number }>();
    for (const b of active) {
      const doc = b.doctorName || "Walk-in / None";
      const cur = map.get(doc) ?? { name: doc, revenue: 0, prescriptions: 0 };
      cur.revenue += b.total;
      cur.prescriptions += 1;
      map.set(doc, cur);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [active]);

  const stockValue = medicines.reduce((s, m) => s + m.mainQuantity * m.price + m.pharmacyQuantity * m.price, 0) +
                     materials.reduce((s, m) => s + m.mainQuantity * m.price + m.pharmacyQuantity * m.price, 0);

  // Pseudo-AI Chat state
  const [messages, setMessages] = useState<{ role: "user" | "ai", text: string }[]>([
    { role: "ai", text: "Hello! I am your pharmacy data assistant. Ask me questions like:\n- Which medicine sells the most?\n- Who is the top prescribing doctor?\n- What is the total revenue?\n- Which medicines are low on stock?" }
  ]);
  const [input, setInput] = useState("");

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const q = input.trim().toLowerCase();
    setMessages(prev => [...prev, { role: "user", text: input }]);
    setInput("");

    // Simulate AI thinking and analyzing data
    setTimeout(() => {
      let answer = "I'm not sure how to answer that yet based on the current data patterns. Try asking about revenue, top medicines, doctors, or stock.";
      
      if (q.includes("revenue") || q.includes("total money") || q.includes("sales")) {
        answer = `Your total revenue from ${totalTx} transactions is ₹${totalRevenue.toFixed(2)}.`;
      } else if (q.includes("medicine") && (q.includes("top") || q.includes("best") || q.includes("most"))) {
        if (topMeds.length > 0) {
          answer = `The top selling medicine is ${topMeds[0].name} with ${topMeds[0].qty} units sold, generating ₹${topMeds[0].revenue.toFixed(2)}.`;
        } else {
          answer = "No medicines have been sold yet.";
        }
      } else if (q.includes("doctor") || q.includes("prescribe")) {
        const topDoc = doctorStats.filter(d => d.name !== "Walk-in / None")[0];
        if (topDoc) {
          answer = `The top prescribing doctor is ${topDoc.name} with ${topDoc.prescriptions} prescriptions, driving ₹${topDoc.revenue.toFixed(2)} in revenue.`;
        } else {
          answer = "No doctors have prescribed medicines yet, or all sales are walk-ins.";
        }
      } else if (q.includes("stock") && (q.includes("low") || q.includes("out"))) {
        const lowMeds = medicines.filter(m => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel);
        if (lowMeds.length > 0) {
          answer = `You have ${lowMeds.length} medicines low on stock. Some of them are: ${lowMeds.slice(0,3).map(m => m.name).join(", ")}.`;
        } else {
          answer = "All your medicines are currently well stocked above minimum levels!";
        }
      } else if (q.includes("expire") || q.includes("expiry")) {
        const now = Date.now();
        const expiring = medicines.filter(m => new Date(m.expiry).getTime() - now < 30 * 86400000);
        if (expiring.length > 0) {
          answer = `You have ${expiring.length} medicines expiring in the next 30 days. Action recommended.`;
        } else {
          answer = "You have no medicines expiring in the next 30 days.";
        }
      }

      setMessages(prev => [...prev, { role: "ai", text: answer }]);
    }, 600);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} sub="From all sales" Icon={TrendingUp} tone="primary" />
        <KPI label="Quantity Sold" value={totalQty.toString()} sub="Units dispensed" Icon={Package} tone="success" />
        <KPI label="Transactions" value={totalTx.toString()} sub="Billing entries" Icon={Receipt} tone="warning" />
        <KPI label="Total Stock Value" value={`₹${stockValue.toFixed(0)}`} sub="All inventory" Icon={Package} tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Top 10 Items by Quantity Sold</h3>
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
          
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Revenue Distribution (Top 8)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `₹${e.value}`}>
                      {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            
            <Card className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><User className="h-4 w-4 text-muted-foreground" /> Doctor Revenue Contribution</h3>
              <div className="space-y-4 mt-2">
                {doctorStats.length === 0 ? (
                   <p className="text-sm text-muted-foreground">No doctor data available.</p>
                ) : doctorStats.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        <span className="w-4 text-xs text-muted-foreground">{i + 1}.</span> {d.name}
                      </div>
                      <div className="text-xs text-muted-foreground ml-5.5">{d.prescriptions} Prescriptions</div>
                    </div>
                    <div className="font-semibold text-sm text-brand-blue">₹{d.revenue.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* AI Chat Section */}
        <Card className="flex flex-col h-full overflow-hidden border-brand-blue/20">
          <div className="p-4 border-b bg-brand-blue/5 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-blue text-white flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-brand-blue">AI Data Insights</h3>
              <p className="text-xs text-muted-foreground">Ask questions about your data</p>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4 bg-muted/10 h-[400px] lg:h-auto">
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-br-none" 
                      : "bg-background border shadow-sm rounded-bl-none text-foreground"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="p-3 bg-background border-t">
            <form onSubmit={handleAsk} className="flex gap-2">
              <Input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about revenue, stock, doctors..."
                className="flex-1 rounded-full bg-muted/50 focus-visible:bg-background"
              />
              <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
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
