import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import fundo1 from "@/assets/fundo-1.png.asset.json";
import { LoadingSplash } from "@/components/loading-splash";

const ALLOWED_DOMAIN = "lavoroseguros.com.br";
// Usuários com login por senha liberado (backdoor)
const ALLOWED_PASSWORD_EMAILS = new Set([
  "alessandro.oliveira@lavoroseguros.com.br",
]);

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
  const [email, setEmail] = useState("");

  useEffect(() => {
    let done = false;
    const goToHub = () => {
      if (done) return;
      done = true;
      navigate({ to: "/hub", replace: true });
    };

    // Checagem inicial (pode incluir hash do OAuth callback)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goToHub();
      else setChecking(false);
    });

    // Callback OAuth: sessão chega de forma assíncrona após a Supabase
    // processar o hash da URL — só então navegamos.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        goToHub();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email openid profile",
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) {
      toast.error("Não foi possível iniciar o login", { description: error.message });
      setLoading(false);
    }
  };

  const handleEmailCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    if (ALLOWED_PASSWORD_EMAILS.has(clean)) {
      navigate({ to: "/auth/senha" });
      return;
    }
    toast.info("Login por senha desativado", {
      description: `Este e-mail deve acessar via Microsoft SSO. O login por senha está restrito.`,
    });
  };

  if (checking) return <LoadingSplash />;

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo1.url})` }}
    >
      <div className="absolute inset-0 bg-[#0b2536]/70" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Logo centralizada acima do card */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src={logoBranca.url}
            alt="Lavoro Seguros"
            className="h-14 w-auto drop-shadow-lg"
          />
        </div>

        <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="text-center font-display text-xl font-semibold tracking-tight text-[#14405C]">
            Acessar o Hub Lavoro Seguros
          </h1>

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-[#0e2a3d] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#14405C] disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MicrosoftLogo className="h-4 w-4" />
            )}
            Entrar com Microsoft
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Para colaboradores da Lavoro Seguros
          </p>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              ou informe seu e-mail
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailCheck} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">E-mail Corporativo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`nome@${ALLOWED_DOMAIN}`}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              O login por senha está desativado para domínios corporativos. Informe seu
              e-mail para verificar se é possível acessar por senha.
            </p>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full text-[#14405C]"
            >
              Verificar acesso por senha
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Acesso somente por convite
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/70">
          Acesso restrito a colaboradores Lavoro Seguros © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
