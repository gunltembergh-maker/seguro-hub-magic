// Porta de entrada do time de Garantia para o módulo Análise Background.
//
// É a MESMA página de /juridico/analise-background, com outro ponto de
// partida: aqui ela abre na fila de oportunidades; lá, na consulta
// processual.
//
// O sufixo `_` mantém a URL /garantia/analise-background sem herdar o
// layout de /garantia — mesmo padrão do garantia_.analise-limite.tsx.

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnaliseBackground from "@/pages/juridico/AnaliseBackground";

export const Route = createFileRoute("/_authenticated/garantia_/analise-background")({
  component: AnaliseProcessosPage,
  head: () => ({
    meta: [
      { title: "Análise de Processos | Garantia | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Fila de oportunidades de seguro garantia por ramo, com valor, prazo e " +
          "argumento, a partir de fontes públicas oficiais.",
      },
      { property: "og:title", content: "Análise de Processos | Garantia | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content:
          "Fila de oportunidades de seguro garantia por ramo, com valor, prazo e argumento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AnaliseProcessosPage() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
          <Link to="/garantia">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Garantia
          </Link>
        </Button>
      </div>
      <AnaliseBackground foco="originacao" />
    </div>
  );
}
