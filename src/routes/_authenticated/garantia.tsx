import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/garantia")({
  component: () => (
    <AreaPage
      icon={ShieldCheck}
      title="Garantia"
      subtitle="Seguro garantia — judicial, contratual e aduaneiro."
      description="Centralize condições de aceitação, seguradoras parceiras, modelos de apólice e fluxos operacionais do ramo Garantia."
      sections={[
        { title: "Garantia judicial", description: "Modelos, prazos e condições aceitas." },
        { title: "Garantia contratual", description: "Riscos, análises e coberturas." },
        { title: "Garantia aduaneira", description: "Fluxo alfandegário e documentos." },
      ]}
    />
  ),
});
