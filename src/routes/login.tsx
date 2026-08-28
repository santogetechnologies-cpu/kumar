import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, User, Activity, Circle, ShieldPlus } from "lucide-react";
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
        <Loader2 className="h-10 w-10 animate-spin text-[#5271FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-white font-sans selection:bg-blue-100 overflow-hidden">
      
      {/* Left side: Blue Graphic Section with White Cross & Dashboards */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-[#5271FF] items-center justify-center rounded-br-[150px] shadow-2xl z-10">
        
        {/* The Huge White Cross */}
        <div className="absolute w-[180%] h-[320px] bg-white rotate-0 shadow-sm"></div>
        <div className="absolute h-[180%] w-[320px] bg-white rotate-0 shadow-sm"></div>
        
        {/* Abstract Dashboard Elements */}
        
        {/* Top left (Blue area) - Data bars */}
        <div className="absolute top-[12%] left-[12%] flex flex-col gap-4">
           <div className="h-2 w-16 bg-white/40 rounded-full"></div>
           <div className="h-2 w-28 bg-white/40 rounded-full"></div>
           <div className="h-2 w-12 bg-white/40 rounded-full"></div>
        </div>

        {/* Top left (Pills/Dots) */}
        <div className="absolute top-[15%] left-[25%] grid grid-cols-2 gap-2">
           <div className="h-3 w-3 rounded-full border-2 border-white/50"></div>
           <div className="h-3 w-3 rounded-full border-2 border-white/50"></div>
           <div className="h-3 w-3 rounded-full border-2 border-white/50"></div>
           <div className="h-3 w-3 rounded-full border-2 border-white/50"></div>
        </div>
        
        {/* Top Center (Profile icon in circle) in Blue area */}
        <div className="absolute top-[8%] left-[45%]">
           <div className="w-28 h-28 rounded-full border-[3px] border-white/40 flex items-center justify-center">
              <User className="w-14 h-14 text-white/70" />
           </div>
           <div className="w-16 h-1 bg-white/40 mx-auto mt-4 rounded-full"></div>
           <div className="w-24 h-1 bg-white/40 mx-auto mt-2 rounded-full"></div>
        </div>
        
        {/* Center left (on the white cross) - Blue Plus */}
        <div className="absolute top-[42%] left-[10%] text-[#5271FF]">
           <Plus className="w-28 h-28" strokeWidth={2.5} />
        </div>
        
        {/* Center Right (on the white cross) - Donut charts */}
        <div className="absolute top-[40%] right-[10%] flex items-center gap-6 text-[#5271FF]">
           <div className="w-24 h-24 rounded-full border-[8px] border-[#5271FF] border-r-[#5271FF]/20 rotate-45 relative">
              <div className="absolute inset-2 border-[4px] border-[#5271FF]/30 border-t-[#5271FF] rounded-full rotate-[120deg]"></div>
           </div>
           <div className="flex flex-col gap-3">
             <div className="w-10 h-10 rounded-full border-[5px] border-[#5271FF]"></div>
             <div className="w-10 h-10 rounded-full border-[5px] border-[#5271FF]"></div>
           </div>
        </div>
        
        {/* Bottom Left (Blue area) - Bar chart */}
        <div className="absolute bottom-[20%] left-[20%] flex items-end gap-3 h-24">
           <div className="w-3 h-10 bg-white/40 rounded-t-sm"></div>
           <div className="w-3 h-16 bg-white/40 rounded-t-sm"></div>
           <div className="w-3 h-24 bg-white/80 rounded-t-sm"></div>
           <div className="w-3 h-14 bg-white/40 rounded-t-sm"></div>
           <div className="w-3 h-12 bg-white/40 rounded-t-sm"></div>
           <div className="w-3 h-20 bg-white/60 rounded-t-sm"></div>
           <div className="w-3 h-16 bg-white/40 rounded-t-sm"></div>
        </div>

        {/* Bottom Right (Blue area) - Shield Icon */}
        <div className="absolute bottom-[15%] right-[25%] opacity-80">
           <ShieldPlus className="w-24 h-24 text-white" strokeWidth={1.5} />
        </div>
        
        {/* Center (Intersection of cross) - Logo or central graphic */}
        <div className="absolute z-20 flex items-center justify-center p-6 bg-white rounded-full shadow-[0_0_50px_rgba(82,113,255,0.15)]">
           <img src="/kumar-logo.png" alt="Kumar Logo" className="w-24 h-24 object-contain" />
        </div>
      </div>

      {/* Right side: Login Form & Text */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-16 relative bg-white">
        
        {/* Bottom right leaf shapes (Cyan/Blue) */}
        <div className="absolute -bottom-24 -right-10 w-[450px] h-[450px] bg-gradient-to-tr from-cyan-400 to-[#3b82f6] rounded-tl-[250px] rounded-bl-[50px] rounded-tr-[50px] opacity-90 rotate-[-15deg] pointer-events-none"></div>
        <div className="absolute -bottom-40 right-20 w-[350px] h-[350px] bg-gradient-to-tr from-[#5271FF] to-[#2563eb] rounded-tl-[200px] rounded-bl-[30px] rounded-tr-[30px] opacity-90 rotate-[-45deg] pointer-events-none"></div>

        {/* Mobile Logo Header (Hidden on Desktop) */}
        <div className="flex lg:hidden flex-col items-center mb-10 text-center z-10">
          <img src="/kumar-logo.png" alt="Logo" className="h-16 w-16 object-contain mb-4" />
        </div>

        <div className="w-full max-w-[420px] z-10">
          {/* Main Heading mimicking the reference image */}
          <div className="mb-12 text-left">
            <h1 className="text-6xl lg:text-[75px] font-black text-[#5271FF] leading-[1.05] tracking-tight">
              Family<br/>
              health<br/>
              protection
            </h1>
          </div>

          <form onSubmit={submit} className="space-y-5 bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 relative">
            <div className="mb-2">
               <h2 className="text-xl font-bold text-slate-800">Pharmacy Login</h2>
               <p className="text-sm text-slate-500 font-medium">Kumar Hospital Management</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-slate-700">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.com"
                className="h-14 text-base px-4 bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:ring-[#5271FF]/30 focus-visible:border-[#5271FF] rounded-xl transition-all"
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 text-base px-4 bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:ring-[#5271FF]/30 focus-visible:border-[#5271FF] rounded-xl transition-all"
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold rounded-xl bg-[#5271FF] hover:bg-[#405CDB] text-white shadow-lg shadow-[#5271FF]/30 transition-all active:scale-[0.98] mt-4" 
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Authenticating…</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>
      
    </div>
  );
}
