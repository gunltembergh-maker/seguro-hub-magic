import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/garantia_/analise-limite")({
  component: AnaliseLimitePage,
  head: () => ({
    meta: [
      { title: "Análise de Limite | Garantia | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Ferramenta de análise de limites, análise financeira IA e relatórios T&C para Seguro Garantia da Lavoro Seguros.",
      },
      { property: "og:title", content: "Análise de Limite | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content:
          "Análise de limites por seguradora, leitura documental com IA e relatórios T&C dentro do Hub Lavoro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AnaliseLimitePage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
          <Link to="/garantia">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Garantia
          </Link>
        </Button>
        <h1 className="text-lg font-semibold text-white">Análise de Limite</h1>
      </div>
      <iframe
        src="/analise-limite/index.html"
        title="Análise de Limite"
        className="h-full w-full flex-1 rounded-xl border border-white/10 bg-white"
        allow="clipboard-write; downloads"
      />
    </div>
  );
}
