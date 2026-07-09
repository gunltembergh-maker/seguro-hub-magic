import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import fundo1 from "@/assets/fundo-1.png.asset.json";
import { LoadingSplash } from "@/components/loading-splash";

const ALLOWED_DOMAIN = "lavoroseguros.com.br";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden="true">
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/hub", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email", redirectTo: window.location.origin },
    });
    if (error) {
      toast.error("Não foi possível iniciar o login", { description: error.message });
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setPwLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/hub", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada", {
          description:
            "Se seu e-mail exigir confirmação, verifique sua caixa. Após o primeiro login, aguarde aprovação do admin.",
        });
        setMode("signin");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(mode === "signin" ? "Falha no login" : "Falha no cadastro", { description: message });
    } finally {
      setPwLoading(false);
    }
  };

  if (checking) return <LoadingSplash />;

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo1.url})` }}
    >
      <div className="absolute inset-0 bg-black/15" />

      {/* Marca d'água canto superior esquerdo */}
      <div className="absolute left-6 top-6 z-10 flex items-center gap-2">
        <img src={logoBranca.url} alt="Lavoro Seguros" className="h-7 w-auto" />
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="text-center font-display text-xl font-semibold tracking-tight text-[#14405C]">
            Acessar o Hub Lavoro Seguros
          </h1>

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-[#14405C]/15 bg-white px-4 py-3 text-sm font-medium text-[#14405C] transition-colors hover:bg-[#14405C]/5 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MicrosoftLogo className="h-4 w-4" />
            )}
            Entrar com Microsoft
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">E-mail corporativo</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`voce@${ALLOWED_DOMAIN}`}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={pwLoading}
              size="lg"
              className="w-full justify-center gap-2 bg-[#14405C] text-white hover:bg-[#0f3149]"
            >
              {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "Ainda não tem conta?" : "Já possui conta?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-[#14405C] hover:underline"
            >
              {mode === "signin" ? "Criar conta" : "Entrar"}
            </button>
          </p>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Acesso restrito — apenas @{ALLOWED_DOMAIN}
          </p>
        </div>

        <p className="mt-10 text-center text-xs text-white/70">
          Acesso restrito a colaboradores Lavoro Seguros © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
