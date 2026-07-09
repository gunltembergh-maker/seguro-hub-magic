import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/middle")({
  component: () => (
    <AreaPage
      icon={Layers}
      title="Middle"
      subtitle="Ponte entre áreas comerciais e operacionais."
      description="O Middle coordena informações entre comercial, operacional e seguradoras, garantindo fluidez nas cotações, emissões e atendimento a clientes estratégicos."
      sections={[
        { title: "Cotações estratégicas", description: "Acompanhamento de contas prioritárias." },
        { title: "Relacionamento com seguradoras", description: "Contatos, condições e SLAs." },
        { title: "Análise técnica", description: "Pareceres e recomendações por conta." },
      ]}
    />
  ),
});
