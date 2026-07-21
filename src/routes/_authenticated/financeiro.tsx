import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecebimentoDezenas } from "@/components/financeiro/RecebimentoDezenas";

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

        {/* Comissionamento */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: "#00BAF2" }} />
            <h2 className="font-display text-lg font-semibold text-white">Comissionamento</h2>
          </div>
          <RecebimentoDezenas />
        </section>

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
