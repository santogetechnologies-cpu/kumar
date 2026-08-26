import { Button } from "@/components/ui/button";
import { Activity, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

export function Header() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "";

  return (
    <header className="border-b bg-card sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-white border shadow-sm flex items-center justify-center overflow-hidden">
            <img src="/kumar-logo.png" alt="Kumar Hospital" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold leading-tight">
              <span className="text-brand-red">Kumar</span>{" "}
              <span className="text-brand-blue">Hospital</span>
            </h1>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> PHARMACY MODULE
            </p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background">
              <Activity className="h-4 w-4 text-success" />
              <div className="text-xs">
                <div className="font-semibold leading-tight">{displayName}</div>
                <div className="text-muted-foreground capitalize leading-tight">{role}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
