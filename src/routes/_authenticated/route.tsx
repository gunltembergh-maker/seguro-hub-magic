import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { HubHeader } from "@/components/hub-header";
import { useMeuPerfil } from "@/hooks/use-meu-perfil";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSplash } from "@/components/loading-splash";
import { ViewAsProvider, useViewAs } from "@/contexts/view-as-context";
import { MinhaVisaoIndicator } from "@/components/minha-visao-indicator";
import { ViewAsSelector } from "@/components/view-as-selector";
import { PopupComunicado } from "@/components/popup-comunicado";
import fundoHub from "@/assets/fundo-hub.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession lê do localStorage (síncrono/local) → evita HTTP round-trip
    // em cada navegação. A validação real do token acontece nas RPCs via RLS.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
  pendingComponent: LoadingSplash,
});


function AuthenticatedLayout() {
  const { data: perfil, isLoading } = useMeuPerfil();
  const navigate = useNavigate();

  // registrar acesso uma vez, quando temos perfil válido
  useEffect(() => {
    if (perfil && !perfil.blocked && perfil.active) {
      void supabase.rpc("rpc_registrar_acesso").then(() => {});
    }
  }, [perfil?.user_id, perfil?.blocked, perfil?.active]);

  if (isLoading) {
    return <LoadingSplash />;
  }

  if (!perfil || perfil.blocked || !perfil.active) {
    // perfil == null → domínio não autorizado / não pré-cadastrado (trigger bloqueou no Auth)
    // perfil.blocked/!active → aguardando liberação do admin
    const negado = !perfil;
    const titulo = negado
      ? "Acesso não autorizado"
      : "Solicitação de acesso em análise";
    const mensagem = negado
      ? "Seu e-mail não está cadastrado no Hub Lavoro Seguros. O acesso é restrito a colaboradores previamente autorizados. Solicite ao administrador o pré-cadastro do seu e-mail."
      : "Seu acesso ao Hub Lavoro foi registrado e aguarda aprovação de um administrador. Você receberá acesso assim que for liberado.";

    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div
            className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${
              negado
                ? "bg-red-500/10 text-red-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">{titulo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{mensagem}</p>
          <Button
            variant="outline"
            className="mt-6 gap-2"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ViewAsProvider>
      <AuthenticatedShell />
    </ViewAsProvider>
  );
}

function AuthenticatedShell() {
  const { isImpersonating, viewAsProfile } = useViewAs();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-sidebar">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          {isImpersonating && viewAsProfile && (
            <div className="flex items-center justify-center gap-2 border-b border-amber-500/50 bg-amber-400/95 px-4 py-1.5 text-xs font-medium text-amber-950">
              👁 Você está visualizando como{" "}
              <strong>{viewAsProfile.full_name || viewAsProfile.email}</strong>. Ações executadas
              usam suas credenciais reais — apenas a UI é filtrada.
            </div>
          )}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger className="text-muted-foreground" />
            <HubHeader />
            <div className="ml-auto">
              <ViewAsSelector />
            </div>
          </header>
          <main className="relative flex-1 bg-background">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[65%] bg-cover bg-right bg-no-repeat opacity-70 [mask-image:linear-gradient(to_left,black_0%,black_55%,transparent_100%)]"
              style={{ backgroundImage: `url(${fundoHub.url})` }}
              aria-hidden="true"
            />
            <div className="relative">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
      <MinhaVisaoIndicator />
      <PopupComunicado />
    </SidebarProvider>
  );
}
