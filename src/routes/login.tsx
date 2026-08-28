import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
        <Loader2 className="h-10 w-10 animate-spin text-[#4F75FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-white font-sans selection:bg-blue-100">
      
      {/* Left side: The Medical Cross Visual (Hidden on mobile) */}
      <div className="hidden lg:block lg:w-[45%] xl:w-[50%] relative bg-[#4F75FF]">
        {/* 
          To create the negative-space cross from the image:
          We place white rectangles over the blue background. 
          The horizontal rectangle extends fully to the right edge so it merges with the white right-panel.
        */}
        
        {/* Vertical Bar of the Cross */}
        <div className="absolute top-[15%] bottom-[20%] left-[35%] w-[140px] bg-white rounded-t-2xl rounded-b-2xl shadow-sm"></div>
        
        {/* Horizontal Bar of the Cross */}
        <div className="absolute top-1/2 -translate-y-1/2 left-[15%] right-0 h-[140px] bg-white rounded-l-2xl shadow-sm z-10"></div>
        
        {/* Decorative Dashboard Lines (Top Left) */}
        <div className="absolute top-[15%] left-[10%] flex flex-col gap-3">
          <div className="h-1.5 w-12 bg-white/40 rounded-full"></div>
          <div className="h-1.5 w-20 bg-white/40 rounded-full"></div>
          <div className="h-1.5 w-8 bg-white/40 rounded-full"></div>
        </div>

        {/* Decorative Profile Node (Top Center-Right) */}
        <div className="absolute top-[20%] left-[60%] flex flex-col items-center">
          <div className="h-20 w-20 rounded-full border-2 border-white/50 flex items-center justify-center relative">
             <div className="w-8 h-8 bg-white/40 rounded-full absolute top-3"></div>
             <div className="w-12 h-6 bg-white/40 rounded-t-full absolute bottom-3"></div>
          </div>
          <div className="h-1 w-12 bg-white/40 rounded-full mt-3"></div>
        </div>

        {/* Decorative Charts (Bottom Right in the blue) */}
        <div className="absolute bottom-[25%] left-[65%] flex items-center gap-4">
           <div className="w-16 h-16 rounded-full border-[6px] border-white/40 border-r-transparent rotate-45"></div>
           <div className="w-10 h-10 rounded-full border-[4px] border-white/40"></div>
        </div>
        
        {/* Brand/Logo overlay in the center of the cross */}
        <div className="absolute top-1/2 left-[35%] -translate-y-1/2 ml-[70px] -translate-x-1/2 z-20">
          <img src="/kumar-logo.png" alt="Logo" className="w-20 h-20 object-contain drop-shadow-xl" />
        </div>
      </div>

      {/* Right side: The Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-16 relative bg-white z-10">
        
        {/* Leaf graphics at bottom right (using simple clean SVGs) */}
        <div className="absolute bottom-0 right-0 pointer-events-none opacity-90 overflow-hidden w-64 h-64 lg:w-96 lg:h-96">
          <svg viewBox="0 0 200 200" className="absolute bottom-[-10%] right-[-10%] w-[120%] h-[120%] text-cyan-400">
             <path fill="currentColor" d="M 100,200 C 100,100 200,100 200,0 C 200,100 100,100 100,200 Z" />
          </svg>
          <svg viewBox="0 0 200 200" className="absolute bottom-[-20%] right-[-5%] w-[100%] h-[100%] text-[#4F75FF]">
             <path fill="currentColor" d="M 50,200 C 50,120 150,120 150,20 C 150,120 50,120 50,200 Z" />
          </svg>
        </div>

        <div className="w-full max-w-sm relative z-10">
          
          {/* Mobile Branding (Hidden on large screens) */}
          <div className="flex lg:hidden flex-col mb-10">
            <img src="/kumar-logo.png" alt="Logo" className="h-14 w-14 object-contain mb-4" />
            <h1 className="text-4xl font-extrabold text-[#4F75FF] tracking-tight leading-tight">
              Family<br/>health<br/>protection
            </h1>
          </div>

          {/* Desktop Heading exactly mimicking the image */}
          <div className="hidden lg:block mb-16 text-left">
            <h1 className="text-5xl xl:text-[72px] font-extrabold text-[#4F75FF] leading-[1.02] tracking-[-0.02em]">
              Family<br/>
              health<br/>
              protection
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-600">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@kumarhospital.com"
                className="h-14 bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:ring-[#4F75FF]/20 focus-visible:border-[#4F75FF] rounded-xl text-base px-4 shadow-sm transition-all"
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-600">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:ring-[#4F75FF]/20 focus-visible:border-[#4F75FF] rounded-xl text-base px-4 shadow-sm transition-all"
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold rounded-xl bg-[#4F75FF] hover:bg-[#3d5ed1] text-white shadow-[0_8px_20px_-8px_rgba(79,117,255,0.5)] transition-all active:scale-[0.98] mt-6" 
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Signing in…</>
              ) : (
                "Log in"
              )}
            </Button>
          </form>

        </div>
      </div>
      
    </div>
  );
}
