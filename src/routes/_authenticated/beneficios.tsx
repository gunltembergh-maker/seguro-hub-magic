import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/beneficios")({
  component: () => (
    <AreaPage
      icon={HeartPulse}
      title="Benefícios"
      subtitle="Saúde, odontológico, vida e previdência corporativa."
      description="Gestão de carteiras de benefícios, movimentação de vidas, sinistralidade e material comercial para clientes empresariais."
      sections={[
        { title: "Movimentação", description: "Inclusões, exclusões e alterações cadastrais." },
        { title: "Sinistralidade", description: "Indicadores por operadora e cliente." },
        { title: "Renovações", description: "Carteira em vencimento e propostas de reajuste." },
      ]}
    />
  ),
});
