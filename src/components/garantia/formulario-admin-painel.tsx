// Painel de indicadores do Formulário Admin.
//
// Respeita o mesmo período filtrado na lista. A consulta é separada da lista
// porque precisa de `resultado_mercado` (pesado) para o gráfico das
// seguradoras — que usa o MESMO normalizador da planilha, do e-mail e do
// detalhe.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { resumirResultadoMercado } from "@/lib/garantia/garantia-judicial-normalizar";

const EM_ANDAMENTO = ["recebida", "consultando_mercado", "mercado_consultado"];

const CORES_NATUREZA = ["#14405C", "#338B85", "#8AAFC9", "#00BAF2", "#B08968", "#7C3AED"];

type LinhaPainel = {
  id: string;
  criado_em: string;
  status: string;
  email_enviado_em: string | null;
  alerta_enviado_em: string | null;
  natureza: string | null;
  resultado_mercado: unknown;
};

function minutos(inicio: string, fim: string) {
  return (new Date(fim).getTime() - new Date(inicio).getTime()) / 60000;
}

function duracao(min: number | null) {
  if (min === null || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function diaBR(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

function Cartao({
  rotulo,
  valor,
  destaque,
  onClick,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  onClick?: (() => void) | undefined;
}) {
  const clicavel = !!onClick;
  return (
    <button
      type="button"
      disabled={!clicavel}
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 text-left shadow-sm transition ${
        destaque ? "border-red-200" : "border-border"
      } ${clicavel ? "cursor-pointer hover:shadow-md" : "cursor-default"}`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          destaque ? "text-red-600" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      {clicavel && <p className="mt-1 text-xs text-muted-foreground">Ver na lista</p>}
    </button>
  );
}

function Grafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-display text-sm font-semibold text-foreground">{titulo}</h3>
      <div className="h-[260px]">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function FormularioAdminPainel({
  dataInicial,
  dataFinal,
  onFiltrarProblemas,
}: {
  dataInicial: string;
  dataFinal: string;
  onFiltrarProblemas: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["garantia-formulario-admin-painel", dataInicial, dataFinal],
    queryFn: async () => {
      let q = supabase
        .from("garantia_judicial_solicitacoes")
        .select(
          "id,criado_em,status,email_enviado_em,alerta_enviado_em,resultado_mercado," +
            "natureza:dados_formulario->>naturezaRotulo",
        )
        .order("criado_em", { ascending: true })
        .limit(2000);
      if (dataInicial) q = q.gte("criado_em", `${dataInicial}T00:00:00-03:00`);
      if (dataFinal) q = q.lte("criado_em", `${dataFinal}T23:59:59-03:00`);
      const { data: linhas, error } = await q;
      if (error) throw error;
      return (linhas ?? []) as unknown as LinhaPainel[];
    },
  });

  const painel = useMemo(() => {
    const linhas = data ?? [];
    const concluidas = linhas.filter((l) => l.status === "email_enviado" && l.email_enviado_em);
    const tempos = concluidas.map((l) => minutos(l.criado_em, l.email_enviado_em as string));
    const problemas = linhas.filter((l) => l.status === "erro" || !!l.alerta_enviado_em).length;

    const porDiaMapa = new Map<string, number>();
    const porNaturezaMapa = new Map<string, number>();
    const porSeguradora = new Map<
      string,
      { seguradora: string; com_limite: number; sem_limite: number; nao_consultado: number }
    >();

    for (const l of linhas) {
      const dia = diaBR(l.criado_em);
      porDiaMapa.set(dia, (porDiaMapa.get(dia) ?? 0) + 1);

      const nat = l.natureza?.trim() || "Não informada";
      porNaturezaMapa.set(nat, (porNaturezaMapa.get(nat) ?? 0) + 1);

      if (!l.resultado_mercado) continue;
      const resumo = resumirResultadoMercado(l.resultado_mercado);
      for (const seg of resumo.seguradoras) {
        const atual =
          porSeguradora.get(seg.label) ??
          { seguradora: seg.label, com_limite: 0, sem_limite: 0, nao_consultado: 0 };
        atual[seg.grupo] += 1;
        porSeguradora.set(seg.label, atual);
      }
    }

    return {
      total: linhas.length,
      concluidas: concluidas.length,
      emAndamento: linhas.filter((l) => EM_ANDAMENTO.includes(l.status)).length,
      problemas,
      tempoMedio: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null,
      tempoMaximo: tempos.length ? Math.max(...tempos) : null,
      porDia: [...porDiaMapa.entries()].map(([dia, qtd]) => ({ dia, qtd })),
      porNatureza: [...porNaturezaMapa.entries()].map(([nome, qtd]) => ({ nome, qtd })),
      porSeguradora: [...porSeguradora.values()].sort((a, b) =>
        a.seguradora.localeCompare(b.seguradora, "pt-BR"),
      ),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!painel.total) {
    return (
      <div className="mb-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma demanda recebida no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Cartao rotulo="Recebidas" valor={String(painel.total)} />
        <Cartao rotulo="Concluídas" valor={String(painel.concluidas)} />
        <Cartao rotulo="Em andamento" valor={String(painel.emAndamento)} />
        <Cartao
          rotulo="Erro ou alerta"
          valor={String(painel.problemas)}
          destaque={painel.problemas > 0}
          onClick={painel.problemas > 0 ? onFiltrarProblemas : undefined}
        />
        <Cartao rotulo="Tempo médio até o e-mail" valor={duracao(painel.tempoMedio)} />
        <Cartao rotulo="Maior tempo no período" valor={duracao(painel.tempoMaximo)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Grafico titulo="Demandas por dia">
          <BarChart data={painel.porDia} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="qtd" name="Demandas" fill="#14405C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </Grafico>

        <Grafico titulo="Distribuição por natureza">
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={painel.porNatureza}
              dataKey="qtd"
              nameKey="nome"
              outerRadius={90}
              label={(e: { name?: unknown; value?: unknown }) => `${e.name}: ${e.value}`}
            >
              {painel.porNatureza.map((_, i) => (
                <Cell key={i} fill={CORES_NATUREZA[i % CORES_NATUREZA.length] as string} />
              ))}
            </Pie>
          </PieChart>
        </Grafico>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-1 font-display text-sm font-semibold text-foreground">
          Comportamento das seguradoras no período
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          “Não consultada” significa falha técnica na consulta automática, e não recusa comercial.
        </p>
        {painel.porSeguradora.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma consulta de mercado concluída no período.
          </p>
        ) : (
          <div style={{ height: Math.max(260, painel.porSeguradora.length * 28) }}>
            <ResponsiveContainer>
              <BarChart
                data={painel.porSeguradora}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="seguradora"
                  width={110}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="com_limite" name="Com limite" stackId="s" fill="#338B85" />
                <Bar dataKey="sem_limite" name="Sem limite" stackId="s" fill="#DC2626" />
                <Bar dataKey="nao_consultado" name="Não consultada" stackId="s" fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
