import { usePharmacy } from "@/lib/pharmacy-store";
import { AlertTriangle, CheckCircle2, Package } from "lucide-react";

export function StatCards() {
  const { medicines, materials, bills } = usePharmacy();
  const today = new Date().toDateString();
  const dispensedToday = bills.filter(
    (b) => new Date(b.createdAt).toDateString() === today && (b.status === "paid" || b.status === "partially_refunded")
  ).length;

  const allItems = [...medicines, ...materials];
  const lowStock = allItems.filter((m) => (m.mainQuantity + m.pharmacyQuantity) <= m.minLevel).length;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Dispensed Today"
        value={dispensedToday}
        sub="Completed today"
        color="success"
        Icon={CheckCircle2}
      />
      <StatCard
        label="Low Stock Alerts"
        value={lowStock}
        sub="Items need reorder"
        color={lowStock > 0 ? "destructive" : "success"}
        Icon={AlertTriangle}
      />
      <StatCard
        label="Total Active Inventory"
        value={`${medicines.length + materials.length}`}
        sub={`${medicines.length} Meds · ${materials.length} Materials`}
        color="primary"
        Icon={Package}
      />
    </div>
  );
}

function StatCard({
  label, value, sub, color, Icon,
}: {
  label: string; value: number | string; sub: string; color: "success" | "destructive" | "primary"; Icon: any;
}) {
  const border = color === "success" ? "border-success/30 bg-success/5"
    : color === "destructive" ? "border-destructive/30 bg-destructive/5"
    : "border-primary/30 bg-primary/5";
  const iconBg = color === "success" ? "bg-success/15 text-success"
    : color === "destructive" ? "bg-destructive/15 text-destructive"
    : "bg-primary/15 text-primary";
  const valColor = color === "success" ? "text-success"
    : color === "destructive" ? "text-destructive"
    : "text-primary";

  return (
    <div className={`rounded-2xl border p-5 ${border}`}>
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-foreground/80">{label}</div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className={`text-4xl font-bold mt-3 ${valColor}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
