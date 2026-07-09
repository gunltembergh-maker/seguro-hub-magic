import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/facilities")({
  component: () => (
    <AreaPage
      icon={Wrench}
      title="Facilities"
      subtitle="Infraestrutura, manutenção e serviços do escritório."
      description="Abertura de chamados, agenda de manutenção, reservas de salas e comunicações de infraestrutura predial."
      sections={[
        { title: "Chamados", description: "Abertura e acompanhamento de solicitações." },
        { title: "Reservas", description: "Salas de reunião e espaços colaborativos." },
        { title: "Manutenção", description: "Calendário e comunicados de serviços programados." },
      ]}
    />
  ),
});
