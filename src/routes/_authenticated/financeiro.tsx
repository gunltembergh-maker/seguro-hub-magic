import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark, CalendarClock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NAVY = "#14405C";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Área financeira da Lavoro Seguros: comissionamento, contas e fechamento contábil.",
      },
    ],
  }),
  component: FinanceiroPage,
});

const outrasSecoes = [
  { title: "Fechamento mensal", description: "Prazos, checklist e responsáveis pelo ciclo contábil." },
  { title: "Contas a pagar/receber", description: "Fluxos, aprovações e conciliação bancária." },
];

function FinanceiroPage() {
  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-10" style={{ background: NAVY }}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-xl text-white shadow-lg"
            style={{ background: "#00BAF2" }}
          >
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/15">
              Área
            </Badge>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Financeiro
            </h1>
            <p className="mt-1 max-w-2xl text-white/70">
              Contas, faturamento, comissionamento e fechamento contábil.
            </p>
          </div>
        </div>

        {/* Sobre */}
        <Card className="mt-8 border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-lg" style={{ color: NAVY }}>
              Sobre esta área
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-gray-600">
              Centralize aqui indicadores financeiros, fluxos de aprovação, relatórios de comissionamento
              e prazos do fechamento contábil da Lavoro Seguros.
            </p>
          </CardContent>
        </Card>

        {/* Link para o Fluxo Diário */}
        <div className="mt-8">
          <Link
            to="/financeiro/fluxo-diario"
            className="group flex items-center gap-4 rounded-xl border border-white/15 bg-white/5 p-5 transition-colors hover:bg-white/10"
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: "#00BAF2" }}
            >
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-display text-base font-semibold text-white">Fluxo Diário</p>
              <p className="text-sm text-white/70">
                Previsão de recebimento por dezenas e repasse de parceiro.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/60 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Outras seções */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {outrasSecoes.map((s) => (
            <Card key={s.title} className="border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="font-display text-base" style={{ color: NAVY }}>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{s.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
