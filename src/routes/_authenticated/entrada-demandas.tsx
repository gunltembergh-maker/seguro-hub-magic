// Entrada de Demandas: porta única de registro do Hub, de todos os ramos.
//
// Gate por permissão (nunca por role), no mesmo molde do Formulário Admin:
// sem `menu_entrada_demandas`, a tela nem renderiza — quem souber a URL não entra.

import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import EntradaDemandas from "@/pages/entrada/EntradaDemandas";

export const Route = createFileRoute("/_authenticated/entrada-demandas")({
  component: EntradaDemandasPage,
  head: () => ({
    meta: [
      { title: "Entrada de Demandas | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Porta única de registro de demandas do Hub Lavoro Seguros: qualquer ramo entra por aqui, " +
          "com cliente, canal, origem e horário de chegada.",
      },
      { property: "og:title", content: "Entrada de Demandas | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Registro único de demandas de todos os ramos, com roteamento automático para Garantia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EntradaDemandasPage() {
  const perfil = useMeuPerfilEfetivo();
  const pode = hasPermission(perfil, "menu_entrada_demandas");

  if (!pode) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para registrar ou consultar a Entrada de Demandas.
            Solicite a liberação a um administrador.
          </p>
        </div>
      </div>
    );
  }

  return <EntradaDemandas />;
}
