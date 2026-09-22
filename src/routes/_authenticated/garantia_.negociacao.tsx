// Negociação do ramo Garantia.
//
// Sufixo "_" porque /garantia é uma página completa, não um layout: esta rota
// não deve herdar nada de garantia.tsx.
// Gate por permissão (nunca por role), no mesmo molde da Entrada de Demandas.

import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import Negociacao from "@/pages/garantia/Negociacao";

export const Route = createFileRoute("/_authenticated/garantia_/negociacao")({
  component: NegociacaoPage,
  head: () => ({
    meta: [
      { title: "Negociação · Garantia | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Quadro de negociação do ramo Garantia: triagem, análise técnica, consulta a mercado, " +
          "cadastro, cotação e proposta, com registro de negócios perdidos.",
      },
      { property: "og:title", content: "Negociação · Garantia | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Pipeline de negociação das demandas de Seguro Garantia e Fiança Locatícia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NegociacaoPage() {
  const perfil = useMeuPerfilEfetivo();

  if (!hasPermission(perfil, "menu_garantia_negociacao")) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para acessar a Negociação do ramo Garantia.
            Solicite a liberação a um administrador.
          </p>
        </div>
      </div>
    );
  }

  return <Negociacao />;
}
