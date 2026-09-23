import { createFileRoute } from "@tanstack/react-router";
import ContratoParceriaTela from "@/components/juridico/ContratoParceriaTela";

export const Route = createFileRoute("/_authenticated/juridico_/contrato-parceria")({
  head: () => ({
    meta: [
      { title: "Contrato de Parceria | Jurídico | Hub Lavoro Seguros" },
      { name: "description", content: "Vigência, renovação, suspensão e bloqueio de repasse dos contratos de parceria." },
      { property: "og:title", content: "Contrato de Parceria | Jurídico | Hub Lavoro Seguros" },
      { property: "og:description", content: "Vigência, renovação, suspensão e bloqueio de repasse dos contratos de parceria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContratoParceriaPage,
});

function ContratoParceriaPage() {
  return (
    <div className="min-h-screen bg-background px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">
        <ContratoParceriaTela />
      </div>
    </div>
  );
}
