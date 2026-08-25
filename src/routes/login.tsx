import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePharmacy, type User } from "@/lib/pharmacy-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, UserRound, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const DEMO_USERS: (User & { password: string })[] = [
  { username: "abinaya", name: "Abinaya", role: "admin", password: "admin123" },
  { username: "aswin", name: "Aswin", role: "pharmacist", password: "pharm123" },
];

function LoginPage() {
  const { user, login } = usePharmacy();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const u = DEMO_USERS.find((x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password);
    if (!u) { toast.error("Invalid credentials"); return; }
    login({ username: u.username, name: u.name, role: u.role });
    toast.success(`Welcome, ${u.name}`);
    navigate({ to: "/" });
  };

  const quickLogin = (u: (typeof DEMO_USERS)[number]) => {
    login({ username: u.username, name: u.name, role: u.role });
    toast.success(`Welcome, ${u.name}`);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-red/5 via-background to-brand-blue/5 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-2 items-center">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3">
            <div className="h-20 w-20 rounded-2xl bg-white border shadow-md flex items-center justify-center">
              <img src="/kumar-logo.png" alt="Kumar Hospital" className="h-16 w-16 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-brand-red">Kumar</span> <span className="text-brand-blue">Hospital</span>
              </h1>
              <p className="text-sm font-semibold tracking-wider text-muted-foreground">PHARMACY MODULE</p>
            </div>
          </div>
          <p className="mt-6 text-muted-foreground max-w-md mx-auto lg:mx-0">
            Fast, friendly pharmacy operations — dispensing, inventory, purchases, refunds and analytics in one place.
          </p>
        </div>

        <Card className="p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-5">Use a demo account or your credentials.</p>

          <form onSubmit={submit} className="space-y-3 mb-5">
            <div>
              <Label htmlFor="u">Username</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="abinaya / aswin" className="h-11" />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </div>
            <Button type="submit" className="w-full h-11"><LogIn className="h-4 w-4 mr-2" /> Sign in</Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Demo accounts</span></div>
          </div>

          <div className="grid gap-2 mt-3">
            <button onClick={() => quickLogin(DEMO_USERS[0])} className="flex items-center gap-3 p-3 rounded-xl border hover:border-brand-red hover:bg-brand-red/5 transition text-left">
              <div className="h-10 w-10 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center"><ShieldCheck className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">Abinaya — Admin</div>
                <div className="text-xs text-muted-foreground">abinaya / admin123</div>
              </div>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => quickLogin(DEMO_USERS[1])} className="flex items-center gap-3 p-3 rounded-xl border hover:border-brand-blue hover:bg-brand-blue/5 transition text-left">
              <div className="h-10 w-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center"><UserRound className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">Aswin — Pharmacist</div>
                <div className="text-xs text-muted-foreground">aswin / pharm123</div>
              </div>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
