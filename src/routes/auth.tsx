import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import fundo1 from "@/assets/fundo-1.png.asset.json";

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

async function ensureOAuthSessionFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = searchParams.get("code");
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
    if (error) throw error;
    return data.session;
  }

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function waitForSession(maxWaitMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return null;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const clearAuthPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    let done = false;
    let mounted = true;
    const goToHub = () => {
      if (done) return;
      done = true;
      navigate({ to: "/hub", replace: true });
    };

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    // Se esta página abriu como popup do SSO, repassa o resultado para a
    // janela principal e fecha — evita o loop de reabrir /auth dentro do popup.
    const isPopup = !!window.opener && window.opener !== window;
    const hasOAuthCallback =
      searchParams.has("code") ||
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("refresh_token");

    if (isPopup && (oauthError || hasOAuthCallback)) {
      void (async () => {
        try {
          if (oauthError) {
            window.opener.postMessage(
              { type: "lavoro-sso", ok: false, error: oauthError },
              window.location.origin,
            );
          } else {
            const session = await ensureOAuthSessionFromUrl();
            window.opener.postMessage(
              {
                type: "lavoro-sso",
                ok: !!session,
                error: session ? undefined : "Não foi possível salvar a sessão do SSO.",
              },
              window.location.origin,
            );
          }
        } catch (err) {
          window.opener.postMessage(
            {
              type: "lavoro-sso",
              ok: false,
              error: err instanceof Error ? err.message : "Falha ao concluir o SSO.",
            },
            window.location.origin,
          );
        } finally {
          window.setTimeout(() => window.close(), 150);
        }
      })();
      return;
    }

    if (oauthError) {
      toast.error("SSO não concluído", { description: oauthError });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Checagem inicial (pode incluir hash do OAuth callback)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goToHub();
      else if (mounted) setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        goToHub();
      }
    });

    // Mensagens do popup do SSO
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; ok?: boolean; error?: string } | null;
      if (!data || data.type !== "lavoro-sso") return;
      clearAuthPoll();
      if (data.ok) {
        setAuthMessage("Login concluído. Entrando no Hub...");
        waitForSession().then((session) => {
          if (session) {
            goToHub();
            return;
          }
          setLoading(false);
          setAuthMessage("SSO concluído, mas a sessão não foi encontrada. Tente novamente.");
          toast.error("Sessão não encontrada", {
            description: "O login foi aprovado, mas a sessão não chegou ao navegador principal.",
          });
        });
      } else {
        setLoading(false);
        setAuthMessage(null);
        toast.error("SSO não concluído", {
          description: data.error ?? "Falha no login com Microsoft.",
        });
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      mounted = false;
      clearAuthPoll();
      sub.subscription.unsubscribe();
      window.removeEventListener("message", onMessage);
    };
  }, [navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setAuthMessage(null);
    clearAuthPoll();

    const popup = window.open(
      "about:blank",
      "lavoro-microsoft-sso",
      "width=520,height=720,left=120,top=80",
    );

    if (!popup) {
      setLoading(false);
      setAuthMessage("O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.");
      toast.error("Popup bloqueado", {
        description: "Permita pop-ups para esta página e clique em Entrar com Microsoft novamente.",
      });
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        scopes: "email openid profile",
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      popup.close();
      setLoading(false);
      toast.error("SSO indisponível", {
        description: error?.message ?? "Não foi possível iniciar o login Microsoft.",
      });
      return;
    }

    popup.location.href = data.url;

    setAuthMessage("Conclua o login na janela da Microsoft que foi aberta.");
    const startedAt = Date.now();
    pollRef.current = window.setInterval(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        clearAuthPoll();
        popup.close();
        navigate({ to: "/hub", replace: true });
        return;
      }

      if (popup.closed) {
        clearAuthPoll();
        setLoading(false);
        setAuthMessage("A janela de login foi fechada antes da conclusão.");
        return;
      }

      if (Date.now() - startedAt > 180_000) {
        clearAuthPoll();
        setLoading(false);
        setAuthMessage("Tempo esgotado. Clique novamente para tentar entrar.");
      }
    }, 1000);
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
            {authMessage ?? "Para colaboradores da Lavoro Seguros"}
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
