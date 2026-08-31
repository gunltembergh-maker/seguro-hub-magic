import { createFileRoute } from "@tanstack/react-router";
import { BeneficiosShell } from "@/components/beneficios/beneficios-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContrato } from "@/hooks/use-beneficios";

export const Route = createFileRoute("/_authenticated/beneficios/contratos/$id")({
  head: () => ({
    meta: [
      { title: "Contrato de Benefícios — Hub Lavoro" },
      { name: "description", content: "Detalhe do contrato de Benefícios: vigência, prêmio, comissão e coberturas ativas." },
      { property: "og:title", content: "Contrato de Benefícios — Hub Lavoro" },
      { property: "og:description", content: "Detalhe do contrato de Benefícios: vigência, prêmio, comissão e coberturas ativas." },
    ],
  }),
  component: ContratoPage,
});

const NAVY = "#14405C";
const BRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

function ContratoPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useContrato(id);

  if (isLoading) {
    return <BeneficiosShell titulo="Contrato" mostrarAbas={false}><p className="text-gray-500">Carregando…</p></BeneficiosShell>;
  }
  if (!data) {
    return <BeneficiosShell titulo="Contrato" mostrarAbas={false}><p className="text-gray-500">Contrato não encontrado.</p></BeneficiosShell>;
  }

  const c = data as unknown as {
    numero_apolice: string | null;
    quantidade_vidas: number | null;
    premio_atual: number | null;
    percentual_agenciamento: number | null;
    percentual_vitalicio: number | null;
    data_inicio_vigencia: string;
    data_fim_vigencia: string;
    status: string;
    migrou_outra_corretora: boolean;
    clientes: { nome_razao_social: string; numero_cliente: string } | null;
    seguradoras: { nome: string } | null;
    canais: { nome: string } | null;
    contrato_coberturas: { id: string; ativa_desde: string; ativa_ate: string | null; coberturas: { nome: string } | null }[];
  };

  const dias = Math.ceil((new Date(c.data_fim_vigencia).getTime() - Date.now()) / 864e5);

  return (
    <BeneficiosShell
      titulo={`Contrato — ${c.clientes?.nome_razao_social ?? ""}`}
      trilha={["Clientes", c.clientes?.nome_razao_social ?? ""]}
      mostrarAbas={false}
      acoes={
        <Button disabled title="Em breve — o Ciclo de renovação ainda será liberado" style={{ background: "#00BAF2" }} className="text-white">
          Iniciar renovação (em breve)
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Badge variant={c.status === "vigente" ? "secondary" : "outline"}>
          {c.status === "vigente" ? "Vigente" : "Cancelado"}
        </Badge>
        {c.migrou_outra_corretora && <Badge variant="outline">Migrou de outra corretora</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Campo label="Seguradora atual" valor={c.seguradoras?.nome ?? "—"} />
        <Campo label="Nº da apólice" valor={c.numero_apolice ?? "—"} />
        <Campo label="Quantidade de vidas" valor={String(c.quantidade_vidas ?? "—")} />
        <Campo label="Canal" valor={c.canais?.nome ?? "—"} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-5" style={{ borderColor: "#F0DCC0", background: "#FDF7EE" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#D98418" }}>Vigência</p>
          <p className="mt-1 font-display text-xl font-bold" style={{ color: NAVY }}>
            {dataBR(c.data_inicio_vigencia)} — {dataBR(c.data_fim_vigencia)}
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "#D98418" }}>
            {dias >= 0 ? `Renova em ${dias} dias` : `Vencido há ${Math.abs(dias)} dias`}
          </p>
        </div>
        <Campo label="Prêmio atual" valor={`${BRL(c.premio_atual)} /mês`} />
        <Campo
          label="Comissão"
          valor={`${c.percentual_agenciamento ?? 0}% agenc. · ${c.percentual_vitalicio ?? 0}% vitalício`}
        />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Coberturas ativas neste contrato
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {c.contrato_coberturas
            .filter((cc) => !cc.ativa_ate)
            .map((cc) => (
              <span key={cc.id} className="rounded-lg bg-[#E8F7FD] px-4 py-2 text-sm font-semibold" style={{ color: NAVY }}>
                {cc.coberturas?.nome} <span className="font-normal text-gray-500">desde {dataBR(cc.ativa_desde)}</span>
              </span>
            ))}
          {!c.contrato_coberturas.filter((cc) => !cc.ativa_ate).length && (
            <span className="text-sm text-gray-500">Nenhuma cobertura ativa registrada.</span>
          )}
        </div>
      </div>
    </BeneficiosShell>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 font-display text-lg font-bold" style={{ color: NAVY }}>{valor}</p>
    </div>
  );
}
