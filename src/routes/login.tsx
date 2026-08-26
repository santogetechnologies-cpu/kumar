import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
      navigate({ to: "/" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-red/5 via-background to-brand-blue/5 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-2 items-center">
        {/* Branding */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3">
            <div className="h-20 w-20 rounded-2xl bg-white border shadow-md flex items-center justify-center">
              <img src="/kumar-logo.png" alt="Kumar Hospital" className="h-16 w-16 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-brand-red">Kumar</span>{" "}
                <span className="text-brand-blue">Hospital</span>
              </h1>
              <p className="text-sm font-semibold tracking-wider text-muted-foreground">PHARMACY MODULE</p>
            </div>
          </div>
          <p className="mt-6 text-muted-foreground max-w-md mx-auto lg:mx-0">
            Fast, friendly pharmacy operations — dispensing, inventory, purchases, refunds and analytics in one place.
          </p>
          <div className="mt-8 p-4 rounded-xl bg-brand-blue/5 border border-brand-blue/20 max-w-md mx-auto lg:mx-0">
            <p className="text-sm font-semibold text-brand-blue mb-1">🔐 Secure Login</p>
            <p className="text-xs text-muted-foreground">
              All accounts are managed by your system administrator. Contact admin to create or reset your account.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-5">Enter your credentials to access the pharmacy.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
              ) : (
                <><LogIn className="h-4 w-4 mr-2" /> Sign in</>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
