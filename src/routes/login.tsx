import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Syringe, Stethoscope } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-slate-50 font-sans selection:bg-blue-200">
      
      {/* Left side: The Medical Cross Visual (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 overflow-hidden items-center justify-center">
        
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-40 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-10 -right-20 w-80 h-80 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl opacity-30"></div>
        </div>

        {/* 
          The negative-space cross from the image:
          Using glassmorphism and subtle shadows for a premium feel
        */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          {/* Vertical Bar of the Cross */}
          <div className="absolute top-[10%] bottom-[10%] left-[35%] w-[160px] bg-white/95 backdrop-blur-xl rounded-full shadow-[0_0_40px_rgba(0,0,0,0.1)] border border-white/20"></div>
          
          {/* Horizontal Bar of the Cross */}
          <div className="absolute top-1/2 -translate-y-1/2 left-[10%] right-0 h-[160px] bg-white/95 backdrop-blur-xl rounded-l-full shadow-[0_0_40px_rgba(0,0,0,0.1)] border-y border-l border-white/20 z-10"></div>
        </div>

        {/* Decorative Elements */}
        {/* Medical Icon (Top Left) */}
        <div className="absolute top-[15%] left-[15%] z-20 bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg">
          <Stethoscope className="w-10 h-10 text-white/90 drop-shadow-md" />
        </div>

        {/* Decorative Profile Node (Top Center-Right) */}
        <div className="absolute top-[20%] left-[65%] flex flex-col items-center z-20">
          <div className="h-20 w-20 rounded-full border-[3px] border-white/60 flex items-center justify-center relative shadow-lg bg-white/10 backdrop-blur-sm">
             <div className="w-8 h-8 bg-white/80 rounded-full absolute top-3 shadow-sm"></div>
             <div className="w-12 h-6 bg-white/80 rounded-t-full absolute bottom-3 shadow-sm"></div>
          </div>
          <div className="h-1.5 w-12 bg-white/60 rounded-full mt-4 shadow-sm"></div>
        </div>

        {/* Medical Icon (Bottom Right) */}
        <div className="absolute bottom-[20%] left-[65%] z-20">
           <div className="bg-white/20 p-3.5 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg transition-transform hover:-translate-y-1 duration-300">
             <Syringe className="w-7 h-7 text-white/90 drop-shadow-md" />
           </div>
        </div>

        {/* Medical Tablet (Bottom Left) */}
        <div className="absolute bottom-[20%] left-[15%] z-20">
           <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg transition-transform hover:-translate-y-1 duration-300 flex items-center justify-center">
             <div className="relative w-8 h-8 rounded-full border-[3px] border-white/90 shadow-sm flex items-center justify-center bg-white/10">
                <div className="absolute w-full h-[2.5px] bg-white/90 -rotate-45"></div>
             </div>
           </div>
        </div>
        
        {/* Brand/Logo overlay in the center of the cross */}
        <div className="absolute top-1/2 left-[35%] -translate-y-1/2 ml-[80px] -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="bg-white p-4 rounded-3xl shadow-2xl mb-4 border border-slate-100 transition-transform hover:scale-105 duration-300">
            <img src="/kumar-logo.png" alt="Logo" className="w-20 h-20 object-contain drop-shadow-sm" />
          </div>
        </div>
      </div>

      {/* Right side: The Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-16 relative bg-[#FAFAFA] z-10 overflow-hidden">
        
        {/* Abstract Background Grid/Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        {/* Leaf graphics at bottom right */}
        <div className="absolute bottom-0 right-0 pointer-events-none opacity-80 overflow-hidden w-64 h-64 lg:w-96 lg:h-96">
          <div className="absolute bottom-[-10%] right-[-10%] w-[120%] h-[120%] bg-gradient-to-tl from-blue-100 to-transparent rounded-tl-full blur-2xl"></div>
          <svg viewBox="0 0 200 200" className="absolute bottom-[-20%] right-[-5%] w-[100%] h-[100%] text-blue-500 opacity-20">
             <path fill="currentColor" d="M 50,200 C 50,120 150,120 150,20 C 150,120 50,120 50,200 Z" />
          </svg>
        </div>

        <div className="w-full max-w-[420px] relative z-10 bg-white p-8 sm:p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.03)] border border-slate-100">
          
          {/* Mobile Branding (Hidden on large screens) */}
          <div className="flex lg:hidden flex-col mb-10 items-center text-center">
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 mb-5 inline-block">
              <img src="/kumar-logo.png" alt="Logo" className="h-16 w-16 object-contain" />
            </div>
            <h2 className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-2">Kumar Hospital</h2>
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight leading-tight">
              Smart Pharmacy
            </h1>
            <p className="text-slate-500 mt-3 text-sm">Welcome back, please enter your details.</p>
          </div>

          {/* Desktop Heading */}
          <div className="hidden lg:block mb-10 text-left">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
              <h2 className="text-blue-700 font-bold tracking-widest uppercase text-[11px]">Kumar Hospital</h2>
            </div>
            <h1 className="text-5xl font-extrabold text-slate-800 leading-[1.1] tracking-tight">
              Smart<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Pharmacy</span>
            </h1>
            <p className="text-slate-500 mt-4 text-[15px] font-medium leading-relaxed">Welcome back, please enter your details to access the dashboard.</p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-bold text-slate-700 ml-0.5">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@kumarhospital.com"
                className="h-14 bg-slate-50 hover:bg-slate-100/80 border-slate-200 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 rounded-xl text-base px-5 shadow-sm transition-all duration-200 placeholder:text-slate-400"
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between ml-0.5">
                <Label htmlFor="password" className="text-sm font-bold text-slate-700">Password</Label>
                <a href="#" className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">Forgot password?</a>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 bg-slate-50 hover:bg-slate-100/80 border-slate-200 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 rounded-xl text-base px-5 shadow-sm transition-all duration-200 placeholder:text-slate-400"
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-[15px] font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-[0_8px_20px_-8px_rgba(79,117,255,0.5)] hover:shadow-[0_12px_25px_-8px_rgba(79,117,255,0.6)] transition-all duration-300 hover:-translate-y-[2px] active:translate-y-0 mt-8 border border-transparent hover:border-white/20" 
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Signing in…</>
              ) : (
                "Log In to Dashboard"
              )}
            </Button>
          </form>

        </div>
      </div>
      
    </div>
  );
}
