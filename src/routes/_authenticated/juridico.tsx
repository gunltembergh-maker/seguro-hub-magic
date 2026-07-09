import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/juridico")({
  component: () => (
    <AreaPage
      icon={Scale}
      title="Jurídico"
      subtitle="Contratos, compliance, LGPD e pareceres."
      description="Acompanhe modelos de contrato, políticas internas, atualizações regulatórias e o fluxo de pareceres jurídicos para as áreas de negócio."
      sections={[
        { title: "Contratos", description: "Modelos padrão e status das minutas em análise." },
        { title: "Compliance", description: "Políticas, código de ética e trilhas de treinamento." },
        { title: "LGPD", description: "Fluxos de tratamento de dados e canal do encarregado." },
      ]}
    />
  ),
});
