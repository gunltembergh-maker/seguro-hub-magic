import { createFileRoute } from "@tanstack/react-router";
import CanalParceirosTela from "@/components/comercial/CanalParceirosTela";

export const Route = createFileRoute("/_authenticated/comercial_/canal-parceiros")({
  head: () => ({
    meta: [
      { title: "Canal Parceiros | Comercial | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Cadastro único de parceiro do grupo Lavoro: contratos, vigências e liberação de repasse.",
      },
      { property: "og:title", content: "Canal Parceiros | Comercial | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content:
          "Cadastro único de parceiro do grupo Lavoro: contratos, vigências e liberação de repasse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CanalParceirosPage,
});

function CanalParceirosPage() {
  return (
    <div className="min-h-screen bg-background px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">
        <CanalParceirosTela />
      </div>
    </div>
  );
}
