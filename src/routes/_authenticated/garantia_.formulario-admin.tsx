// Sub-item de Garantia: consulta das demandas recebidas pelo formulário
// público de Seguro Garantia Judicial.
//
// Gate por permissão (nunca por role): apenas `menu_garantia_formulario_admin`.
// A permissão pai `menu_ramo_garantia` NÃO dá acesso a esta tela.
// O `_` mantém a URL /garantia/formulario-admin sem herdar o layout de /garantia.

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import GarantiaFormularioAdmin from "@/pages/garantia/FormularioAdmin";

export const Route = createFileRoute("/_authenticated/garantia_/formulario-admin")({
  component: FormularioAdminPage,
  head: () => ({
    meta: [
      { title: "Formulário Admin | Garantia | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Consulta das demandas recebidas pelo formulário público de Seguro Garantia Judicial, " +
          "com status, prazos e anexos gerados.",
      },
      { property: "og:title", content: "Formulário Admin | Garantia | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Demandas recebidas pelo formulário público de Seguro Garantia Judicial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function FormularioAdminPage() {
  const perfil = useMeuPerfilEfetivo();
  const pode = hasPermission(perfil, "menu_garantia_formulario_admin");

  if (!pode) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para consultar as demandas do formulário de Garantia Judicial.
            Solicite a liberação a um administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
          <Link to="/garantia">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Garantia
          </Link>
        </Button>
      </div>
      <GarantiaFormularioAdmin />
    </div>
  );
}
