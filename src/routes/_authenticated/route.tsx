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

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
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
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/10 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">
            Solicitação de acesso em análise
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu acesso ao Hub Lavoro foi registrado e aguarda aprovação de um
            administrador. Você receberá acesso assim que for liberado.
          </p>
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger className="text-muted-foreground" />
            <HubHeader />
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
