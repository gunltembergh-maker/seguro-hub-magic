import { createFileRoute } from "@tanstack/react-router";
import AnaliseBackground from "@/pages/juridico/AnaliseBackground";

export const Route = createFileRoute("/_authenticated/juridico_/analise-background")({
  head: () => ({
    meta: [
      { title: "Análise Background | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Originação de seguro garantia e due diligence de CNPJ e CPF a partir de fontes públicas oficiais.",
      },
      { property: "og:title", content: "Análise Background | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content:
          "Fila de oportunidades por ramo, carteira 360 e background check com base legal registrada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnaliseBackground,
});
