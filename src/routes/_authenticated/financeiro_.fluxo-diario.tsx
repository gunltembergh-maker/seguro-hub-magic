import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { RecebimentoDezenas } from "@/components/financeiro/RecebimentoDezenas";

export const Route = createFileRoute("/_authenticated/financeiro_/fluxo-diario")({
  head: () => ({
    meta: [
      { title: "Fluxo Diário | Financeiro | Hub Lavoro Seguros" },
      {
        name: "description",
        content: "Previsão de recebimento e repasse de parceiro por dezenas do Financeiro Lavoro.",
      },
    ],
  }),
  component: FluxoDiarioPage,
});

function FluxoDiarioPage() {
  return (
    <div className="px-6 pb-10 md:px-8 lg:px-10 min-h-screen pt-6 md:pt-8 lg:pt-10" style={{ background: "#14405C" }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Fluxo Diário
          </h1>
          <p className="mt-1 text-white/70">Previsão de recebimento e repasse de parceiro</p>
        </div>

        <RecebimentoDezenas />

        {/* Parte 3: quadro de repasse de parceiro entra aqui */}
      </div>
    </div>
  );
}
