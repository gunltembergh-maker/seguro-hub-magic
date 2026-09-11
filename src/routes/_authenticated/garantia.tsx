import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, FileSearch, ArrowRight } from "lucide-react";
import { AreaPage } from "@/components/area-page";

export const Route = createFileRoute("/_authenticated/garantia")({
  component: GarantiaPage,
});

function GarantiaPage() {
  return (
    <div>
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

      <div className="bg-background px-6 pb-10 md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/garantia/analise-limite"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/50"
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: "#338B85" }}
            >
              <FileSearch className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-display text-base font-semibold text-card-foreground">Análise de Limite</p>
              <p className="text-sm text-muted-foreground">
                Auditoria da minuta/apólice contra os modelos padrão ANP, com aderência por cláusula e
                classificação de risco.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
