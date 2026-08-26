import { useMemo, useState, useRef, useEffect } from "react";
import { usePharmacy, getBillNetTotal } from "@/lib/pharmacy-store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Package, Receipt, Sparkles, User, Send, Bot, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

/* ── Quick-reply chip suggestions ── */
const QUICK_REPLIES = [
  "What is the total revenue?",
  "Which medicine sells the most?",
  "Who is the top doctor?",
  "Show low stock items",
  "Which medicines are expiring?",
  "How many transactions today?",
  "What is my total stock value?",
  "Show top 5 medicines",
];

/* ── Token helpers ── */
function tokens(s: string) {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
}

function has(q: string, ...words: string[]) {
  return words.some((w) => q.includes(w));
}

/* ──────────────────────────────────────────
   SMART INTENT ENGINE
   ────────────────────────────────────────── */
function buildAnswer(
  q: string,
  {
    bills, medicines, materials, purchases,
    active, totalRevenue, totalTx, totalQty,
    topMeds, doctorStats, stockValue,
  }: any
): string {
  const t = tokens(q).join(" ");

  /* ─── Greetings / small talk ─── */
  if (has(t, "hi", "hello", "hey", "namaste", "good morning", "good evening", "good afternoon", "howdy", "hola")) {
    return `Hello! 👋 I'm your pharmacy data assistant.\n\nI can answer questions like:\n• "What is today's revenue?"\n• "Which medicine sells the most?"\n• "Who is the top prescribing doctor?"\n• "Show items expiring soon"\n• "How much is my stock worth?"\n\nWhat would you like to know?`;
  }

  if (has(t, "how are you", "you okay", "you good", "what are you", "who are you")) {
    return `I'm your pharmacy AI assistant — running perfectly! 🤖\n\nI analyze your live pharmacy data in real time. Ask me about revenue, medicines, doctors, stock, or expiry dates.`;
  }

  if (has(t, "thank", "thanks", "great", "nice", "awesome", "perfect", "good", "excellent", "helpful")) {
    return `You're welcome! 😊 Let me know if you have more questions about your pharmacy data.`;
  }

  if (has(t, "help", "what can you do", "what do you know", "capabilities", "features")) {
    return `Here's what I can help you with:\n\n📊 **Revenue & Sales**\n→ Total revenue, daily/monthly trends, transactions\n\n💊 **Medicines**\n→ Top sellers, specific medicine stats, search by name\n\n👨‍⚕️ **Doctors**\n→ Top prescribers, revenue per doctor\n\n📦 **Stock & Inventory**\n→ Low stock, out-of-stock, transfer needs, stock value\n\n📅 **Expiry**\n→ Expired, expiring soon, next month\n\n🛒 **Purchases**\n→ Recent orders, pending, received\n\nJust ask naturally — I'll figure it out!`;
  }

  /* ─── Revenue / Sales ─── */
  if (has(t, "revenue", "earning", "income", "sales", "money", "total", "collection", "made", "profit", "turnover", "how much")) {
    if (has(t, "today", "today's")) {
      const today = new Date().toDateString();
      const todayBills = active.filter((b: any) => new Date(b.createdAt).toDateString() === today);
      const todayRev = todayBills.reduce((s: number, b: any) => s + b.total, 0);
      return `📅 **Today's Revenue**\n\n₹${todayRev.toFixed(2)} from ${todayBills.length} transaction${todayBills.length !== 1 ? "s" : ""} today.\n\nAll-time total: ₹${totalRevenue.toFixed(2)} from ${totalTx} transactions.`;
    }
    if (has(t, "month", "this month", "monthly")) {
      const now = new Date();
      const thisMonth = active.filter((b: any) => {
        const d = new Date(b.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const monthRev = thisMonth.reduce((s: number, b: any) => s + b.total, 0);
      return `🗓️ **This Month's Revenue**\n\n₹${monthRev.toFixed(2)} from ${thisMonth.length} transactions in ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}.\n\nAll-time total: ₹${totalRevenue.toFixed(2)}`;
    }
    return `💰 **Total Revenue**\n\n₹${totalRevenue.toFixed(2)} earned from ${totalTx} transactions with ${totalQty} units dispensed.\n\nAverage bill value: ₹${totalTx > 0 ? (totalRevenue / totalTx).toFixed(2) : "0.00"}`;
  }

  /* ─── Transactions / bills count ─── */
  if (has(t, "transaction", "bill", "invoice", "prescription", "how many bill", "how many patient")) {
    if (has(t, "today")) {
      const today = new Date().toDateString();
      const count = active.filter((b: any) => new Date(b.createdAt).toDateString() === today).length;
      return `📋 **Today's Transactions**\n\n${count} bill${count !== 1 ? "s" : ""} processed today.\n\nTotal all-time: ${totalTx} transactions.`;
    }
    return `📋 **Transactions Overview**\n\n• Total transactions: ${totalTx}\n• Paid: ${active.filter((b: any) => b.status === "paid").length}\n• Partially refunded: ${active.filter((b: any) => b.status === "partially_refunded").length}\n• All units dispensed: ${totalQty}`;
  }

  /* ─── Stock value ─── */
  if (has(t, "stock value", "inventory value", "worth", "inventory worth", "value of stock", "assets")) {
    const medValue = medicines.reduce((s: number, m: any) => s + (m.mainQuantity + m.pharmacyQuantity) * m.price, 0);
    const matValue = materials.reduce((s: number, m: any) => s + (m.mainQuantity + m.pharmacyQuantity) * m.price, 0);
    return `💎 **Total Inventory Value**\n\n₹${stockValue.toFixed(2)} total\n\n• Medicine stock: ₹${medValue.toFixed(2)}\n• Material stock: ₹${matValue.toFixed(2)}\n• Total SKUs: ${medicines.length + materials.length} items`;
  }

  /* ─── Top medicines / best sellers ─── */
  if (
    has(t, "top", "best", "most sold", "highest", "popular", "selling", "frequent", "rank") &&
    has(t, "medicine", "drug", "item", "product", "tablet", "sell", "sold", "dispense")
  ) {
    if (topMeds.length === 0) return "No medicines have been dispensed yet. Start billing to see top sellers!";
    const num = t.match(/\d+/)?.[0] ? Math.min(parseInt(t.match(/\d+/)![0]), topMeds.length) : Math.min(5, topMeds.length);
    const list = topMeds.slice(0, num).map((m: any, i: number) =>
      `${i + 1}. ${m.name} — ${m.qty} units, ₹${m.revenue.toFixed(2)}`
    ).join("\n");
    return `💊 **Top ${num} Best-Selling Medicines**\n\n${list}`;
  }

  /* ─── Search for a specific medicine ─── */
  const allMedNames = medicines.map((m: any) => m.name.toLowerCase());
  const matchedMed = allMedNames.find((name: string) => t.includes(name) || name.split(" ").some((w: string) => w.length > 3 && t.includes(w)));
  if (matchedMed) {
    const medInfo = medicines.filter((m: any) => m.name.toLowerCase().includes(matchedMed));
    const soldData = topMeds.find((m: any) => m.name.toLowerCase().includes(matchedMed));
    const totalStock = medInfo.reduce((s: number, m: any) => s + m.mainQuantity + m.pharmacyQuantity, 0);
    const pharmacyStock = medInfo.reduce((s: number, m: any) => s + m.pharmacyQuantity, 0);
    const batches = medInfo.length;
    return `💊 **${medInfo[0].name}**\n\n📦 Stock: ${totalStock} units total (${pharmacyStock} in pharmacy, across ${batches} batch${batches !== 1 ? "es" : ""})\n💵 Price: ₹${medInfo[0].price.toFixed(2)}\n📅 Nearest expiry: ${new Date(medInfo.sort((a: any, b: any) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())[0].expiry).toLocaleDateString()}${soldData ? `\n📊 Units sold: ${soldData.qty} · Revenue: ₹${soldData.revenue.toFixed(2)}` : "\n📊 Not yet sold"}`;
  }

  /* ─── Low stock ─── */
  if (has(t, "low stock", "low", "running out", "short", "shortage", "minimum", "reorder", "need to order", "alert")) {
    const allItems = [
      ...medicines.map((m: any) => ({ ...m, _type: "medicine" })),
      ...materials.map((m: any) => ({ ...m, _type: "material" })),
    ];
    const low = allItems.filter((m: any) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel);
    if (low.length === 0) return "✅ All items are well stocked above minimum levels. No alerts!";
    const out = low.filter((m: any) => (m.mainQuantity + m.pharmacyQuantity) === 0);
    const list = low.slice(0, 6).map((m: any) => {
      const total = m.mainQuantity + m.pharmacyQuantity;
      return `• ${m.name} — ${total === 0 ? "❌ Out of stock" : `⚠️ ${total} left (min: ${m.minLevel})`}`;
    }).join("\n");
    return `⚠️ **Low Stock Alert — ${low.length} item${low.length !== 1 ? "s" : ""}**\n\n${list}${low.length > 6 ? `\n…and ${low.length - 6} more.` : ""}\n\n${out.length > 0 ? `❌ ${out.length} item${out.length !== 1 ? "s" : ""} completely out of stock.` : ""}`;
  }

  /* ─── Out of stock ─── */
  if (has(t, "out of stock", "empty", "zero stock", "no stock", "finished", "unavailable")) {
    const allItems = [
      ...medicines.map((m: any) => ({ ...m, _type: "medicine" })),
      ...materials.map((m: any) => ({ ...m, _type: "material" })),
    ];
    const out = allItems.filter((m: any) => (m.mainQuantity + m.pharmacyQuantity) === 0);
    if (out.length === 0) return "✅ No items are completely out of stock currently!";
    const list = out.slice(0, 8).map((m: any) => `• ${m.name} (${m._type})`).join("\n");
    return `❌ **Out of Stock — ${out.length} item${out.length !== 1 ? "s" : ""}**\n\n${list}${out.length > 8 ? `\n…and ${out.length - 8} more.` : ""}`;
  }

  /* ─── Expiry ─── */
  if (has(t, "expir", "expire", "expired", "expiry", "shelf life", "date", "validity")) {
    const now = Date.now();
    const expired = medicines.filter((m: any) => new Date(m.expiry).getTime() < now);
    const in7 = medicines.filter((m: any) => {
      const d = new Date(m.expiry).getTime() - now;
      return d >= 0 && d < 7 * 86400000;
    });
    const in30 = medicines.filter((m: any) => {
      const d = new Date(m.expiry).getTime() - now;
      return d >= 0 && d < 30 * 86400000;
    });
    const in60 = medicines.filter((m: any) => {
      const d = new Date(m.expiry).getTime() - now;
      return d >= 0 && d < 60 * 86400000;
    });
    let res = `📅 **Expiry Report**\n\n`;
    res += `• Expired: ${expired.length} item${expired.length !== 1 ? "s" : ""}\n`;
    res += `• Expiring in 7 days: ${in7.length}\n`;
    res += `• Expiring in 30 days: ${in30.length}\n`;
    res += `• Expiring in 60 days: ${in60.length}\n`;
    if (expired.length > 0) {
      res += `\n❌ **Expired items:**\n` + expired.slice(0, 4).map((m: any) => `• ${m.name} (${m.batch}) — expired ${new Date(m.expiry).toLocaleDateString()}`).join("\n");
    }
    if (in30.length > 0 && expired.length === 0) {
      res += `\n⚠️ **Expiring soon:**\n` + in30.slice(0, 4).map((m: any) => `• ${m.name} (${m.batch}) — ${new Date(m.expiry).toLocaleDateString()}`).join("\n");
    }
    return res;
  }

  /* ─── Doctors ─── */
  if (has(t, "doctor", "dr", "physician", "prescri", "specialist")) {
    if (doctorStats.length === 0) return "No doctor prescription data yet. Assign doctors when billing to track this.";
    if (has(t, "top", "best", "highest", "most", "leading", "number 1", "no 1", "#1")) {
      const topDoc = doctorStats.filter((d: any) => d.name !== "Walk-in / None")[0];
      if (!topDoc) return "No named doctor prescriptions recorded yet.";
      return `👨‍⚕️ **Top Prescribing Doctor**\n\n${topDoc.name}\n• ${topDoc.prescriptions} prescription${topDoc.prescriptions !== 1 ? "s" : ""}\n• ₹${topDoc.revenue.toFixed(2)} revenue generated\n• Avg bill: ₹${(topDoc.revenue / topDoc.prescriptions).toFixed(2)}`;
    }
    const named = doctorStats.filter((d: any) => d.name !== "Walk-in / None");
    const walkin = doctorStats.find((d: any) => d.name === "Walk-in / None");
    const list = named.slice(0, 5).map((d: any, i: number) =>
      `${i + 1}. ${d.name} — ${d.prescriptions} prescriptions · ₹${d.revenue.toFixed(2)}`
    ).join("\n");
    return `👨‍⚕️ **Doctor Performance**\n\n${list || "No named doctor data yet."}${walkin ? `\n\n🚶 Walk-ins: ${walkin.prescriptions} bills · ₹${walkin.revenue.toFixed(2)}` : ""}`;
  }

  /* ─── Purchases / orders ─── */
  if (has(t, "purchase", "order", "supplier", "buy", "bought", "received", "pending", "invoice", "po")) {
    const pending = purchases.filter((p: any) => p.status === "pending");
    const received = purchases.filter((p: any) => p.status === "received");
    const totalCost = received.reduce((s: number, p: any) => s + p.cost, 0);
    if (has(t, "pending")) {
      if (pending.length === 0) return "✅ No pending purchase orders right now.";
      const list = pending.slice(0, 5).map((p: any) => `• ${p.item} from ${p.supplier} — ${p.quantity} units`).join("\n");
      return `🛒 **Pending Purchase Orders — ${pending.length}**\n\n${list}`;
    }
    return `🛒 **Purchases Overview**\n\n• Total orders: ${purchases.length}\n• Pending: ${pending.length}\n• Received: ${received.length}\n• Total purchase cost: ₹${totalCost.toFixed(2)}`;
  }

  /* ─── Inventory / stock count ─── */
  if (has(t, "inventory", "stock", "how many medicine", "how many item", "how many product", "count")) {
    const mainTotal = medicines.reduce((s: number, m: any) => s + m.mainQuantity, 0) +
                      materials.reduce((s: number, m: any) => s + m.mainQuantity, 0);
    const pharmTotal = medicines.reduce((s: number, m: any) => s + m.pharmacyQuantity, 0) +
                       materials.reduce((s: number, m: any) => s + m.pharmacyQuantity, 0);
    return `📦 **Inventory Overview**\n\n• Medicines: ${medicines.length} SKUs\n• Materials: ${materials.length} SKUs\n• Main warehouse stock: ${mainTotal} units\n• Pharmacy dispensing stock: ${pharmTotal} units\n• Total inventory value: ₹${stockValue.toFixed(2)}`;
  }

  /* ─── Patient / customers ─── */
  if (has(t, "patient", "customer", "who visited", "visitor")) {
    const patients = new Set(active.map((b: any) => b.patientId));
    const today = new Date().toDateString();
    const todayPatients = new Set(active.filter((b: any) => new Date(b.createdAt).toDateString() === today).map((b: any) => b.patientId));
    return `🏥 **Patient Overview**\n\n• Unique patients (all time): ${patients.size}\n• Today's patients: ${todayPatients.size}\n• Total consultations billed: ${totalTx}`;
  }

  /* ─── Payment methods ─── */
  if (has(t, "payment", "upi", "cash", "card", "mode", "how paid")) {
    const methods: Record<string, number> = {};
    active.forEach((b: any) => {
      methods[b.paymentMethod] = (methods[b.paymentMethod] || 0) + b.total;
    });
    const list = Object.entries(methods).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k}: ₹${v.toFixed(2)}`).join("\n");
    return `💳 **Payment Method Breakdown**\n\n${list || "No payment data yet."}`;
  }

  /* ─── Summary / overview ─── */
  if (has(t, "summary", "overview", "dashboard", "report", "stats", "statistics", "overall", "snapshot")) {
    const today = new Date().toDateString();
    const todayBills = active.filter((b: any) => new Date(b.createdAt).toDateString() === today);
    const todayRev = todayBills.reduce((s: number, b: any) => s + b.total, 0);
    const allItems = [...medicines, ...materials];
    const lowCount = allItems.filter((m: any) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel).length;
    const now = Date.now();
    const expiringCount = medicines.filter((m: any) => {
      const d = new Date(m.expiry).getTime() - now;
      return d >= 0 && d < 30 * 86400000;
    }).length;
    return `📊 **Pharmacy Summary**\n\n💰 Total revenue: ₹${totalRevenue.toFixed(2)} (${totalTx} bills)\n📅 Today: ₹${todayRev.toFixed(2)} (${todayBills.length} bills)\n💊 Best seller: ${topMeds[0]?.name || "—"}\n⚠️ Low stock alerts: ${lowCount}\n📅 Expiring in 30 days: ${expiringCount}\n💎 Stock value: ₹${stockValue.toFixed(0)}`;
  }

  /* ─── Fallback with suggestions ─── */
  return `🤔 I didn't quite catch that. Here are things I can help with:\n\n• **Revenue** — "what is today's revenue?"\n• **Top sellers** — "which medicine sells the most?"\n• **Doctors** — "who is the top doctor?"\n• **Stock** — "show low stock items"\n• **Expiry** — "which medicines are expiring?"\n• **Inventory** — "how much is my stock worth?"\n• **Purchases** — "show pending orders"\n\nOr just say the name of a medicine to get its details!`;
}

/* ══════════════════════════════════════
   COMPONENT
══════════════════════════════════════ */
export function AnalyticsTab() {
  const { bills, medicines, materials, purchases } = usePharmacy();
  const active = bills.filter((b) => b.status !== "refunded");
  const totalRevenue = active.reduce((s, b) => s + getBillNetTotal(b), 0);
  const totalQty = active.reduce((s, b) => s + b.items.reduce((x, i) => x + (i.quantity - (i.refundedQuantity || 0)), 0), 0);
  const totalTx = active.length;

  const topMeds = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const b of active) {
      const disc = 1 - (b.discountPct || 0) / 100;
      for (const it of b.items) {
        const netQ = it.quantity - (it.refundedQuantity || 0);
        if (netQ <= 0) continue;
        const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += netQ;
        cur.revenue += netQ * it.price * disc;
        map.set(it.name, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [active]);

  const revenueData = topMeds.slice(0, 8).map((m) => ({ name: m.name, value: Number(m.revenue.toFixed(2)) }));

  const doctorStats = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; prescriptions: number }>();
    for (const b of active) {
      const doc = b.doctorName || "Walk-in / None";
      const cur = map.get(doc) ?? { name: doc, revenue: 0, prescriptions: 0 };
      cur.revenue += getBillNetTotal(b);
      cur.prescriptions += 1;
      map.set(doc, cur);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [active]);

  const stockValue =
    medicines.reduce((s, m) => s + (m.mainQuantity + m.pharmacyQuantity) * m.price, 0) +
    materials.reduce((s, m) => s + (m.mainQuantity + m.pharmacyQuantity) * m.price, 0);

  /* ── Revenue per unit (revenue/qty for each item) ── */
  const revenuePerUnit = useMemo(() => {
    return topMeds
      .filter(m => m.qty > 0)
      .map(m => ({
        name: m.name.length > 14 ? m.name.slice(0, 14) + "…" : m.name,
        revenuePerUnit: +(m.revenue / m.qty).toFixed(2),
        totalRevenue: +m.revenue.toFixed(2),
        qty: m.qty,
      }))
      .sort((a, b) => b.revenuePerUnit - a.revenuePerUnit)
      .slice(0, 10);
  }, [topMeds]);

  /* ── Doctor → Medicine matrix (which doctor prescribes which medicines) ── */
  const doctorMedMatrix = useMemo(() => {
    // Map: doctorName → { medicineName → qty }
    const matrix: Record<string, Record<string, number>> = {};
    for (const b of active) {
      const doc = b.doctorName || "Walk-in";
      if (!matrix[doc]) matrix[doc] = {};
      for (const it of b.items) {
        matrix[doc][it.name] = (matrix[doc][it.name] || 0) + it.quantity;
      }
    }
    // Build rows: top 5 doctors × top 6 medicines
    const topDocs = doctorStats.slice(0, 5).map(d => d.name);
    const allMedNames = new Set<string>();
    active.forEach(b => b.items.forEach(it => allMedNames.add(it.name)));
    // Top 6 medicines by qty
    const topMedNames = topMeds.slice(0, 6).map(m => m.name);
    return { topDocs, topMedNames, matrix };
  }, [active, doctorStats, topMeds]);

  /* ── Payment breakdown ── */
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    active.forEach(b => {
      const m = b.paymentMethod || "Unknown";
      if (!map[m]) map[m] = { count: 0, total: 0 };
      map[m].count++;
      map[m].total += b.total;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v, total: +v.total.toFixed(2) }));
  }, [active]);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    {
      role: "ai",
      text: "Hello! 👋 I'm your pharmacy data assistant.\n\nAsk me anything — revenue, top medicines, doctors, stock levels, expiry dates, or just say a medicine name to look it up!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new message
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleAsk = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setIsTyping(true);

    const ctx = { bills, medicines, materials, purchases, active, totalRevenue, totalTx, totalQty, topMeds, doctorStats, stockValue };
    const delay = 400 + Math.random() * 400; // Feels natural
    setTimeout(() => {
      const answer = buildAnswer(q, ctx);
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "ai", text: answer }]);
    }, delay);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAsk();
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} sub="From all sales" Icon={TrendingUp} tone="primary" />
        <KPI label="Quantity Sold" value={totalQty.toString()} sub="Units dispensed" Icon={Package} tone="success" />
        <KPI label="Transactions" value={totalTx.toString()} sub="Billing entries" Icon={Receipt} tone="warning" />
        <KPI label="Total Stock Value" value={`₹${stockValue.toFixed(0)}`} sub="All inventory" Icon={Package} tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Charts */}
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
                      <div className="text-xs text-muted-foreground ml-5">{d.prescriptions} Prescriptions</div>
                    </div>
                    <div className="font-semibold text-sm text-brand-blue">₹{d.revenue.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Revenue per Unit chart ── */}
        <div className="lg:col-span-3">
          <Card className="p-5">
            <h3 className="font-semibold mb-1">Revenue per Unit — Top 10 Items</h3>
            <p className="text-xs text-muted-foreground mb-3">Shows how much revenue each unit sold generates (price × sell-through efficiency)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenuePerUnit} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v: any, name: string) => [`₹${v}`, name === "revenuePerUnit" ? "Revenue/Unit" : "Total Revenue"]} />
                  <Legend />
                  <Bar dataKey="revenuePerUnit" fill="#7c3aed" name="Revenue/Unit" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalRevenue" fill="#2563eb" name="Total Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── Doctor → Medicine Prescribing Matrix ── */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Doctor → Medicine Prescribing Matrix
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Units prescribed per doctor for top medicines</p>
            {doctorMedMatrix.topDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No doctor prescription data yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Doctor</th>
                      {doctorMedMatrix.topMedNames.map(m => (
                        <th key={m} className="text-right px-2 py-2 font-semibold text-muted-foreground max-w-[80px]">
                          <div className="truncate" title={m}>{m.length > 10 ? m.slice(0, 10) + "…" : m}</div>
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorMedMatrix.topDocs.map(doc => {
                      const row = doctorMedMatrix.matrix[doc] ?? {};
                      const rowTotal = Object.values(row).reduce((s, v) => s + v, 0);
                      return (
                        <tr key={doc} className="border-t">
                          <td className="px-3 py-2 font-semibold truncate max-w-[120px]" title={doc}>{doc}</td>
                          {doctorMedMatrix.topMedNames.map(med => {
                            const qty = row[med] || 0;
                            const intensity = rowTotal > 0 ? qty / rowTotal : 0;
                            return (
                              <td key={med} className="text-right px-2 py-2">
                                <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[11px] ${
                                  qty === 0 ? "text-muted-foreground" :
                                  intensity > 0.4 ? "bg-primary text-primary-foreground" :
                                  intensity > 0.15 ? "bg-primary/20 text-primary" :
                                  "bg-muted text-muted-foreground"
                                }`}>{qty || "—"}</span>
                              </td>
                            );
                          })}
                          <td className="text-right px-3 py-2 font-bold text-primary">{rowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ── Payment Method Breakdown ── */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Payment Methods</h3>
          <div className="space-y-3">
            {paymentBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment data.</p>
            ) : paymentBreakdown.map(p => (
              <div key={p.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.count} bills · ₹{p.total.toFixed(0)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${active.length > 0 ? (p.count / active.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col overflow-hidden border-brand-blue/20" style={{ minHeight: 520 }}>
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-r from-brand-blue/10 to-primary/5 flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-brand-blue text-white flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-brand-blue">AI Data Insights</h3>
              <p className="text-xs text-muted-foreground">Ask anything about your pharmacy</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">Live</span>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 p-4 bg-muted/10 overflow-y-auto space-y-3"
            style={{ maxHeight: 360 }}
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="h-6 w-6 rounded-full bg-brand-blue text-white flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-background border shadow-sm rounded-bl-none text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2 items-center">
                <div className="h-6 w-6 rounded-full bg-brand-blue text-white flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-background border shadow-sm rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Analyzing data…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 border-t bg-muted/5 shrink-0 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {QUICK_REPLIES.slice(0, 4).map((qr) => (
                <button
                  key={qr}
                  onClick={() => handleAsk(qr)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition whitespace-nowrap"
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-3 bg-background border-t shrink-0">
            <form onSubmit={onSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try "hi", "show revenue", "low stock"…'
                className="flex-1 rounded-full bg-muted/50 focus-visible:bg-background text-sm"
                disabled={isTyping}
              />
              <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!input.trim() || isTyping}>
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
