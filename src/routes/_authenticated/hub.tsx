import { createFileRoute } from "@tanstack/react-router";

import { useMeuPerfilEfetivo, useViewAs } from "@/contexts/view-as-context";
import { useInicioData } from "@/hooks/use-inicio-data";
import { HeaderSaudacao } from "@/components/hub/header-saudacao";
import { BlocoLavoroInicio } from "@/components/hub/bloco-lavoro-inicio";
import { AcessoRapidoCard } from "@/components/hub/acesso-rapido-card";
import { UltimasAtualizacoesCard } from "@/components/hub/ultimas-atualizacoes-card";

export const Route = createFileRoute("/_authenticated/hub")({
  component: HubHome,
});

function HubHome() {
  const perfil = useMeuPerfilEfetivo();
  const { effectiveRole, effectivePermissoes } = useViewAs();
  const { resumo, timestamps, isLoading, isFetching, lastUpdated, refetch } = useInicioData();

  const isAdmin = effectiveRole === "ADMIN";
  const canSeeLavoro =
    isAdmin ||
    effectivePermissoes.menu_dashboard_receita === true ||
    effectivePermissoes.menu_dashboards === true;

  return (
    <div className="relative min-h-full">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #0E2E43 0%, #14405C 55%, #1B5680 100%)",
        }}
      />
      <div className="relative z-0 p-6 md:p-8 lg:p-10">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <HeaderSaudacao
            fullName={perfil?.full_name || perfil?.email || "Usuário"}
            lastUpdated={lastUpdated}
            isFetching={isFetching}
            onRefresh={refetch}
          />

          <BlocoLavoroInicio resumo={resumo} isLoading={isLoading} canSee={canSeeLavoro} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3">
              <UltimasAtualizacoesCard timestamps={timestamps} isLoading={isLoading} />
            </div>
            <div className="lg:col-span-2">
              <AcessoRapidoCard role={effectiveRole} permissoes={effectivePermissoes} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
