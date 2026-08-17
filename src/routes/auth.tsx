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
            // Se este contexto é a janela auxiliar do SSO, devolvemos o
            // controle para a tela do Lovable e fechamos a janela.
            const handoffCode = searchParams.get("hs");
            const isPopup =
              !!handoffCode ||
              searchParams.get("sso") === "popup" ||
              (!!window.opener && window.opener !== window);
            if (isPopup) {
              // O preview do editor roda em iframe e o navegador particiona o
              // storage: a sessão obtida aqui não é visível lá. Entregamos os
              // tokens via servidor, com código de uso único.
              if (handoffCode) {
                try {
                  const { data: sess } = await supabase.auth.getSession();
                  if (sess.session) {
                    await ssoHandoffStore({
                      data: {
                        code: handoffCode,
                        payload: JSON.stringify({
                          access_token: sess.session.access_token,
                          refresh_token: sess.session.refresh_token,
                        }),
                      },
                    });
                  }
                } catch {
                  /* ignore */
                }
              }
              try {
                localStorage.setItem("lavoro-sso-complete", String(Date.now()));
              } catch {
                /* ignore */
              }
              try {
                window.opener?.postMessage(
                  { type: "lavoro-sso-complete" },
                  window.location.origin,
                );
              } catch {
                /* ignore */
              }
              cleanUrl();
              setAuthMessage("Login concluído. Voltando ao Hub...");
              window.close();
              window.setTimeout(() => {
                if (!window.closed) goToHub();
              }, 1200);
              return;
            }

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

    // Quando o login é concluído num popup auxiliar, ele avisa a tela principal,
    // que então carrega a sessão (compartilhada via localStorage mesma origem)
    // e segue para o Hub — sem deixar o usuário em uma aba nova.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "lavoro-sso-complete") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) goToHub();
        });
      }
    };
    window.addEventListener("message", onMessage);

    // Fallback: alguns navegadores bloqueiam window.opener no popup do SSO.
    // O popup grava um sinal no localStorage e a tela do Lovable reage.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lavoro-sso-complete") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) goToHub();
        });
      }
    };
    window.addEventListener("storage", onStorage);

    // Último fallback: sondagem da sessão enquanto a tela de login está aberta.
    const poll = window.setInterval(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) goToHub();
      });
    }, 1500);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        goToHub();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.clearInterval(poll);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
    };

  }, [navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setAuthMessage("Redirecionando para a Microsoft...");

    // A Microsoft recusa ser carregada em iframe (preview do editor).
    // Nesse caso abrimos o consentimento em uma aba de topo.
    const isEmbedded = typeof window !== "undefined" && window.self !== window.top;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth${isEmbedded ? "?sso=popup" : ""}`,
        scopes: "email openid profile",
        skipBrowserRedirect: isEmbedded,
        // Força a Microsoft a exibir o seletor de contas em vez de reaproveitar
        // a sessão já autenticada (ex.: conta Lavoro) ao entrar por outro domínio.
        queryParams: {
          prompt: "select_account",
        },
      },
    });


    if (error) {
      setLoading(false);
      setAuthMessage(null);
      toast.error("SSO indisponível", {
        description: error.message ?? "Não foi possível iniciar o login Microsoft.",
      });
      return;
    }

    if (isEmbedded && data?.url) {
      // Popup dimensionado: a Microsoft recusa iframes, mas permite janelas
      // de topo. O popup fecha sozinho ao concluir e devolve o controle
      // para a tela principal (preview ao lado do chat).
      const opened = window.open(
        data.url,
        "lavoro-sso",
        "width=560,height=720,menubar=no,toolbar=no,location=no,status=no",
      );
      if (!opened) {
        try {
          window.top!.location.href = data.url;
        } catch {
          toast.error("Pop-up bloqueado", {
            description:
              "Abra o Hub em uma aba separada para concluir o login Microsoft.",
          });
        }
      }
      setLoading(false);
      setAuthMessage("Conclua o login na janela da Microsoft e volte ao Hub.");
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
      {/* Vinheta suave central para dar contraste ao card */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(6,20,32,0.55) 0%, rgba(6,20,32,0.75) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Logo Lavoro canto superior esquerdo */}
      <div className="absolute left-8 top-8 z-10">
        <img
          src={logoBranca.url}
          alt="Lavoro Seguros"
          className="h-10 w-auto drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]"
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-24">
        {/* Card de login centralizado */}
        <div className="w-full max-w-[440px]">
            <div className="rounded-2xl border border-[#B8DCE9]/60 bg-[#DDECF3]/95 p-8 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <h2 className="text-center font-display text-xl font-semibold tracking-tight text-[#14405C]">
                Acessar o Hub
              </h2>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Acesso exclusivo para colaboradores autorizados via SSO Microsoft
                (@{ALLOWED_DOMAIN}, @zin.com.br, @taicons.com.br)
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
                  O login por e-mail e senha é restrito a pessoas autorizadas.
                  Informe seu e-mail para verificar se possui acesso liberado.
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
  );
}
