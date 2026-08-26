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
import { PillBottle, Undo2, Boxes, Receipt, BarChart3, Users, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Tab = "dispensing" | "returns" | "inventory" | "payments" | "analytics" | "users";

function HomePage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dispensing");

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

  const TABS: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "dispensing", label: "Dispensing", icon: PillBottle },
    { id: "returns", label: "Returns & Refunds", icon: Undo2 },
    { id: "inventory", label: "Full Inventory", icon: Boxes },
    { id: "payments", label: "Payment History", icon: Receipt },
    { id: "analytics", label: "Analytics & Reports", icon: BarChart3 },
    { id: "users", label: "User Management", icon: Users, adminOnly: true },
  ];

  const visibleTabs = TABS.filter((t) => !t.adminOnly || role === "admin");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <StatCards />

        <div className="rounded-2xl border bg-card p-1.5 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                  {t.adminOnly && (
                    <span className="ml-1 text-[10px] bg-brand-red/15 text-brand-red px-1.5 py-0.5 rounded-full font-semibold">
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
        {tab === "users" && role === "admin" && <UserManagementTab />}
      </main>
    </div>
  );
}
