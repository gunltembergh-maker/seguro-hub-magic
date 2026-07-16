import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
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
      options: { scopes: "email openid profile", redirectTo: window.location.origin },
    });
    if (error) {
      toast.error("Não foi possível iniciar o login", { description: error.message });
      setLoading(false);
    }
  };

  if (checking) return <LoadingSplash />;

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo1.url})` }}
    >
      <div className="absolute inset-0 bg-black/15" />

      <div className="absolute left-6 top-6 z-10 flex items-center gap-2">
        <img src={logoBranca.url} alt="Lavoro Seguros" className="h-7 w-auto" />
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="text-center font-display text-xl font-semibold tracking-tight text-[#14405C]">
            Acessar o Hub Lavoro Seguros
          </h1>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            Entre com sua conta corporativa Microsoft
          </p>

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

          <p className="mt-6 text-center text-xs text-muted-foreground">
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
