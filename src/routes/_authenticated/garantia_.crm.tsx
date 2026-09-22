// CRM do ramo Garantia.
//
// Sufixo "_" porque /garantia é uma página completa, não um layout.
// Gate por permissão (nunca por role), no mesmo molde da Negociação.

import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import Crm from "@/pages/garantia/Crm";

export const Route = createFileRoute("/_authenticated/garantia_/crm")({
  component: CrmPage,
  head: () => ({
    meta: [
      { title: "CRM · Garantia | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "CRM do ramo Garantia: curadoria, minuta e aprovações dos casos aceitos pelo cliente, " +
          "com código GAR e todos os dados herdados da negociação.",
      },
      { property: "og:title", content: "CRM · Garantia | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Curadoria, minuta e aprovações das demandas aceitas de Garantia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CrmPage() {
  const perfil = useMeuPerfilEfetivo();

  if (!hasPermission(perfil, "menu_garantia_crm")) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para acessar o CRM do ramo Garantia.
            Solicite a liberação a um administrador.
          </p>
        </div>
      </div>
    );
  }

  return <Crm />;
}
