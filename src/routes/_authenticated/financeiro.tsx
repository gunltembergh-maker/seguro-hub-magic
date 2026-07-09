import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: () => (
    <AreaPage
      icon={Landmark}
      title="Financeiro"
      subtitle="Contas, faturamento, comissionamento e fechamento contábil."
      description="Centralize aqui indicadores financeiros, fluxos de aprovação, relatórios de comissionamento e prazos do fechamento contábil da Lavoro Seguros."
      sections={[
        { title: "Fechamento mensal", description: "Prazos, checklist e responsáveis pelo ciclo contábil." },
        { title: "Comissionamento", description: "Regras, cálculos e histórico por corretor e produto." },
        { title: "Contas a pagar/receber", description: "Fluxos, aprovações e conciliação bancária." },
      ]}
    />
  ),
});
