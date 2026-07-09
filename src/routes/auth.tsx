import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const ALLOWED_DOMAIN = "lavoroseguros.com.br";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });
  }, [navigate]);

  const handleSsoLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithSSO({
      domain: ALLOWED_DOMAIN,
      options: {
        redirectTo: `${window.location.origin}/hub`,
      },
    });
    if (error) {
      toast.error("Não foi possível iniciar o SSO", {
        description:
          error.message ||
          "Confirme com o TI se o SSO SAML está configurado no Supabase.",
      });
      setLoading(false);
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
            Acesso corporativo via SSO. Apenas contas @{ALLOWED_DOMAIN}.
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

          <h1 className="font-display text-3xl font-bold tracking-tight">Entrar no Hub</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesso exclusivo para colaboradores Lavoro Seguros.
          </p>

          <Button
            onClick={handleSsoLogin}
            disabled={loading}
            size="lg"
            className="mt-8 w-full justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Entrar com SSO Lavoro
          </Button>

          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            Você será redirecionado ao provedor de identidade corporativo (SAML).
            Somente e-mails <span className="font-medium">@{ALLOWED_DOMAIN}</span> são autorizados.
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
