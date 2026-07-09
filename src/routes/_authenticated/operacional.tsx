import { createFileRoute } from "@tanstack/react-router";
import { Cog } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/operacional")({
  component: () => (
    <AreaPage
      icon={Cog}
      title="Operacional"
      subtitle="Emissão, endossos, sinistros e pós-venda."
      description="Gestão dos processos operacionais de apólices — emissão, endossos, cancelamentos, renovações e acompanhamento de sinistros."
      sections={[
        { title: "Emissão & endossos", description: "Filas, SLAs e pendências por produto." },
        { title: "Sinistros", description: "Acompanhamento, indenizações e comunicação com segurados." },
        { title: "Renovações", description: "Carteira em vencimento e ações de retenção." },
      ]}
    />
  ),
});
