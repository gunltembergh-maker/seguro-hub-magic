// Painel da Gerência do ramo Garantia.
//
// Gargalos e tempo até finalizar a demanda são informação de gestão: a tela
// inteira é `menu_garantia_painel`. O corte de verdade está nas RPCs, que
// devolvem vazio sem a permissão.

import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import Painel from "@/pages/garantia/Painel";

export const Route = createFileRoute("/_authenticated/garantia_/painel")({
  component: PainelPage,
  head: () => ({
    meta: [
      { title: "Painel da Gerência · Garantia | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Painel da gerência do ramo Garantia: gargalos, tempo por etapa, conversão, " +
          "valor em jogo, perdas e comportamento das seguradoras.",
      },
      { property: "og:title", content: "Painel da Gerência · Garantia | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Gargalos, tempos, conversão e carteira do pipeline de Garantia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PainelPage() {
  const perfil = useMeuPerfilEfetivo();

  if (!hasPermission(perfil, "menu_garantia_painel")) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O Painel da Gerência do ramo Garantia é restrito. Solicite a liberação a um
            administrador.
          </p>
        </div>
      </div>
    );
  }

  return <Painel />;
}
