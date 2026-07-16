import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import fundoPredio from "@/assets/fundo-login-predio.png.asset.json";

const ALLOWED_DOMAIN = "lavoroseguros.com.br";
// Usuários com login por senha liberado (backdoor)
const ALLOWED_PASSWORD_EMAILS = new Set([
  "alessandro.oliveira@lavoroseguros.com.br",
]);

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
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    let mounted = true;
    const goToHub = () => {
      if (done) return;
      done = true;
      navigate({ to: "/inicio", replace: true });
    };

    const cleanUrl = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    };

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");
    const code = searchParams.get("code");
    const hasImplicit = hashParams.has("access_token");

    (async () => {
      try {
        if (oauthError) {
          toast.error("SSO não concluído", { description: oauthError });
          cleanUrl();
        } else if (code) {
          setAuthMessage("Concluindo login...");
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href,
          );
          cleanUrl();
          if (error) {
            toast.error("Falha ao concluir SSO", { description: error.message });
          } else {
            goToHub();
            return;
          }
        } else if (hasImplicit) {
          cleanUrl();
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          goToHub();
          return;
        }
      } catch (err) {
        toast.error("Erro no SSO", {
          description: err instanceof Error ? err.message : "Tente novamente.",
        });
      } finally {
        if (mounted && !done) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        goToHub();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setAuthMessage("Redirecionando para a Microsoft...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        scopes: "email openid profile",
      },
    });

    if (error) {
      setLoading(false);
      setAuthMessage(null);
      toast.error("SSO indisponível", {
        description: error.message ?? "Não foi possível iniciar o login Microsoft.",
      });
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a1e2c]">
      {/* Imagem 3D do prédio com o logo Lavoro Seguros integrado ao fundo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${fundoPredio.url})` }}
        aria-hidden="true"
      />
      {/* Vinheta lateral suave — escurece só o lado direito para o card, preserva o logo no fundo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(6,20,32,0.05) 0%, rgba(6,20,32,0.15) 40%, rgba(6,20,32,0.75) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Marca sutil no canto superior esquerdo (o hero logo já vive no fundo) */}
      <div className="absolute left-6 top-6 z-10 hidden items-center gap-3 md:flex">
        <img
          src={logoBranca.url}
          alt="Lavoro Seguros"
          className="h-8 w-auto opacity-90 drop-shadow-[0_4px_16px_rgba(0,0,0,0.55)]"
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center px-6 py-16 md:px-16 lg:px-24">
        <div className="grid w-full items-center gap-12 md:grid-cols-2">
          {/* Coluna esquerda: título institucional */}
          <div className="hidden text-white md:block">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/60">
              Hub Corporativo
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-white lg:text-5xl">
              Lavoro Seguros
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              Acesso centralizado para colaboradores. Áreas, ramos, indicadores e
              operações em um único ambiente seguro.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-white/60">
              <Lock className="h-3.5 w-3.5" />
              Ambiente restrito · Autenticação Microsoft 365
            </div>
          </div>

          {/* Coluna direita: card de login */}
          <div className="mx-auto w-full max-w-[440px] md:ml-auto">
            <div className="rounded-2xl border border-white/10 bg-white/95 p-8 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <h2 className="text-center font-display text-xl font-semibold tracking-tight text-[#14405C]">
                Acessar o Hub
              </h2>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Use sua conta corporativa @{ALLOWED_DOMAIN}
              </p>

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
                {authMessage ?? "Somente colaboradores previamente cadastrados"}
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
                  <Label htmlFor="email" className="text-xs">
                    E-mail Corporativo
                  </Label>
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
                  O login por senha está desativado para domínios corporativos.
                  Informe seu e-mail para verificar se é possível acessar por senha.
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

            <p className="mt-6 text-center text-[11px] text-white/60">
              © {new Date().getFullYear()} Lavoro Seguros · Acesso restrito
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
