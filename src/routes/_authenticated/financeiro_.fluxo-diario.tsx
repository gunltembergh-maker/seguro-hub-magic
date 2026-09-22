import { createFileRoute } from "@tanstack/react-router";
import { RecebimentoDezenas } from "@/components/financeiro/RecebimentoDezenas";
import { RepasseParceiro } from "@/components/financeiro/RepasseParceiro";
import { DemandasRepasseNF } from "@/components/financeiro/DemandasRepasseNF";

export const Route = createFileRoute("/_authenticated/financeiro_/fluxo-diario")({
  validateSearch: (search: Record<string, unknown>) => ({
    demanda: typeof search.demanda === "string" ? search.demanda : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fluxo Diário | Financeiro | Hub Lavoro Seguros" },
      {
        name: "description",
        content: "Previsão de recebimento e repasse de parceiro por dezenas do Financeiro Lavoro.",
      },
      { property: "og:title", content: "Fluxo Diário | Financeiro | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Previsão de recebimento e repasse de parceiro por dezenas do Financeiro Lavoro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FluxoDiarioPage,
});

function FluxoDiarioPage() {
  return (
    <div className="min-h-screen bg-background px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Fluxo Diário
          </h1>
          <p className="mt-1 text-muted-foreground">Previsão de recebimento e repasse de parceiro</p>
        </div>

        <RecebimentoDezenas />

        <DemandasRepasseNF />

        <RepasseParceiro />
      </div>
    </div>
  );
}
