import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/pharmacy/Header";
import { StatCards } from "@/components/pharmacy/StatCards";
import { DispensingTab } from "@/components/pharmacy/DispensingTab";
import { ReturnsTab } from "@/components/pharmacy/ReturnsTab";
import { InventoryTab } from "@/components/pharmacy/InventoryTab";
import { PaymentsTab } from "@/components/pharmacy/PaymentsTab";
import { AnalyticsTab } from "@/components/pharmacy/AnalyticsTab";
import { UserManagementTab } from "@/components/pharmacy/UserManagementTab";
import { FinanceTab } from "@/components/pharmacy/FinanceTab";
import { PillBottle, Undo2, Boxes, Receipt, BarChart3, Users, Loader2, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Tab = "dispensing" | "returns" | "inventory" | "payments" | "analytics" | "users" | "finance";

function HomePage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  // Default tab based on role
  const [tab, setTab] = useState<Tab>(role === "admin" ? "analytics" : "dispensing");

  useEffect(() => {
    // Sync tab when role loads
    if (!loading && user) {
      if (role === "admin" && (tab === "dispensing" || tab === "returns")) setTab("analytics");
      if (role !== "admin" && (tab === "analytics" || tab === "users")) setTab("dispensing");
    }
  }, [role, loading, user]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const TABS_ADMIN: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "analytics", label: "Dashboard & Analytics", icon: BarChart3, adminOnly: true },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "finance", label: "Finance & Expenses", icon: Wallet },
    { id: "users", label: "User Management", icon: Users, adminOnly: true },
    { id: "payments", label: "Payment History", icon: Receipt },
  ];

  const TABS_PHARMACIST: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "dispensing", label: "Dispensing", icon: PillBottle },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "returns", label: "Returns & Refunds", icon: Undo2 },
    { id: "finance", label: "Finance & Expenses", icon: Wallet },
    { id: "payments", label: "Payment History", icon: Receipt },
  ];

  const visibleTabs = role === "admin" ? TABS_ADMIN : TABS_PHARMACIST;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <StatCards />

        <div className="rounded-2xl border bg-card/60 backdrop-blur-sm p-2 shadow-sm overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 min-w-max">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap relative overflow-hidden group ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20 scale-[1.02]"
                      : "text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:scale-[1.01]"
                  }`}
                >
                  {active && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  <Icon className={`h-4 w-4 ${active ? "animate-in zoom-in duration-300" : ""}`} /> 
                  <span>{t.label}</span>
                  {t.adminOnly && (
                    <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-brand-red/10 text-brand-red"
                    }`}>
                      Admin
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "dispensing" && <DispensingTab />}
        {tab === "returns" && <ReturnsTab />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "finance" && <FinanceTab />}
        {tab === "users" && role === "admin" && <UserManagementTab />}
      </main>
    </div>
  );
}
