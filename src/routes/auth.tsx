import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowLeft, Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALLOWED_DOMAIN = "lavoroseguros.com.br";

export const Route = createFileRoute("/auth")({
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
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });
  }, [navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email",
        redirectTo: window.location.origin,
      },
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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden gradient-hero p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">Lavoro Seguros</span>
          </div>
          <h2 className="mt-10 font-display text-4xl font-bold leading-tight tracking-tight">
            Bem-vindo ao Hub.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Acesso corporativo. Apenas contas @{ALLOWED_DOMAIN}.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Lavoro Seguros. Uso interno restrito.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">Lavoro Seguros</span>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight">
            {mode === "signin" ? "Entrar no Hub" : "Criar conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesso exclusivo para colaboradores Lavoro Seguros.
          </p>

          <Button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            size="lg"
            className="mt-8 w-full justify-center gap-3 bg-foreground text-background hover:bg-foreground/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MicrosoftLogo className="h-4 w-4" />
            )}
            Entrar com Microsoft
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">ou</span>
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
            <Button type="submit" disabled={pwLoading} size="lg" className="w-full justify-center gap-2">
              {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "Ainda não tem conta?" : "Já possui conta?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signin" ? "Criar conta" : "Entrar"}
            </button>
          </p>

          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            Acesso restrito a e-mails <span className="font-medium">@{ALLOWED_DOMAIN}</span>.
            Login por senha é temporário até o SSO Microsoft estar configurado.
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Problemas para acessar?{" "}
            <a href="mailto:ti@lavoroseguros.com.br" className="font-medium text-primary hover:underline">
              Fale com o TI
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
