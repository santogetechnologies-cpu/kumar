import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pill, Activity, HeartPulse } from "lucide-react";
import { toast } from "sonner";

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-white font-sans selection:bg-blue-100">
      
      {/* Left side: Premium Bright Graphic Section */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-slate-50 flex-col justify-between p-12 xl:p-16 border-r border-slate-100">
        
        {/* Abstract bright background elements (Mesh Gradient Effect) */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-300/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>
        <div className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-rose-300/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] bg-indigo-300/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] bg-amber-200/40 rounded-full mix-blend-multiply filter blur-[80px] opacity-70"></div>

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-4 bg-white/70 backdrop-blur-xl p-4 pr-6 rounded-2xl shadow-sm border border-white/80">
            <div className="h-14 w-14 rounded-xl bg-white shadow-sm flex items-center justify-center">
              <img src="/kumar-logo.png" alt="Logo" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                <span className="text-rose-600">Kumar</span> <span className="text-blue-600">Hospital</span>
              </h1>
              <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mt-0.5">Pharmacy Module</p>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="relative z-10 max-w-lg mt-auto pb-8">
          <h2 className="text-6xl font-black text-slate-900 leading-[1.1] tracking-tighter mb-6">
            Smart inventory. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Seamless care.</span>
          </h2>
          <p className="text-xl text-slate-600 font-medium leading-relaxed">
            Experience the next generation of hospital pharmacy management. Fast dispensing, intelligent alerts, and complete control.
          </p>
          
          {/* Minimal Feature Pills */}
          <div className="flex flex-wrap items-center gap-4 mt-10">
             <div className="flex items-center gap-2 font-semibold text-slate-700 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm border border-white">
               <Pill className="w-5 h-5 text-blue-500"/> Inventory
             </div>
             <div className="flex items-center gap-2 font-semibold text-slate-700 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm border border-white">
               <Activity className="w-5 h-5 text-rose-500"/> Analytics
             </div>
             <div className="flex items-center gap-2 font-semibold text-slate-700 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm border border-white">
               <HeartPulse className="w-5 h-5 text-indigo-500"/> Patient Care
             </div>
          </div>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 z-10 bg-white shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.02)]">
        
        {/* Mobile Header */}
        <div className="flex lg:hidden flex-col items-center mb-10 text-center">
          <div className="h-20 w-20 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-4">
            <img src="/kumar-logo.png" alt="Logo" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            <span className="text-rose-600">Kumar</span> <span className="text-blue-600">Hospital</span>
          </h1>
          <p className="text-sm font-bold tracking-widest text-slate-500 uppercase mt-1">Pharmacy Module</p>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 mt-3 text-lg font-medium">Enter your credentials to access the pharmacy.</p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-bold text-slate-700">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.com"
                className="h-14 text-base px-4 bg-slate-50/50 border-slate-200 focus-visible:bg-white focus-visible:ring-blue-500/30 focus-visible:border-blue-500 rounded-xl transition-all"
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm font-bold text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 text-base px-4 bg-slate-50/50 border-slate-200 focus-visible:bg-white focus-visible:ring-blue-500/30 focus-visible:border-blue-500 rounded-xl transition-all"
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] mt-4" 
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Authenticating…</>
              ) : (
                "Sign In to Dashboard"
              )}
            </Button>
          </form>
        </div>
      </div>
      
    </div>
  );
}
