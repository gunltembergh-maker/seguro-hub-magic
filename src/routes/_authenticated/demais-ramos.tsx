import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/demais-ramos")({
  component: () => (
    <AreaPage
      icon={Boxes}
      title="Demais Ramos"
      subtitle="Patrimonial, RC, transportes, riscos de engenharia e mais."
      description="Consulte condições, seguradoras parceiras e materiais dos demais ramos operados pela Lavoro Seguros."
      sections={[
        { title: "Patrimonial", description: "Empresarial, condomínio e residencial." },
        { title: "Responsabilidade Civil", description: "RC geral, profissional e D&O." },
        { title: "Transportes & Engenharia", description: "Cargas, RCTR-C e riscos de obra." },
      ]}
    />
  ),
});
