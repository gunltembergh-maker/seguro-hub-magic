import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, BarChart, RadialBarChart, RadialBar,
  PolarAngleAxis, LabelList,
} from "recharts";
import { Calendar, ChevronRight, ChevronDown, Clock, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SendNewsletterButton } from "@/components/admin/SendNewsletterButton";
import { useEscopoReceita } from "@/hooks/use-escopo-receita";
import { SEM_ACESSO_RECEITA_MSG } from "@/lib/receita-escopo";


export const Route = createFileRoute("/_authenticated/dashboard/receita")({
  component: DashboardReceitaLavoro,
});

// ─── Helpers ────────────────────────────────────────────────────────────
const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BRL_COMPACT = (v: number | null | undefined) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const PCT = (v: number | null | undefined) =>
  `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const formatarAtingimento = (v: number | null | undefined, fallback = "Sem meta no período"): string => {
  if (v === null || v === undefined || !isFinite(Number(v))) return fallback;
  return `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
};

const isAtingimentoValido = (v: number | null | undefined) =>
  v !== null && v !== undefined && isFinite(Number(v));

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmtTs = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

type Periodo = "MTD" | "SEMESTRE" | "YTD";

const labelPeriodo = (p: Periodo, mes: number, ano: number) => {
  if (p === "MTD") return `${MESES[mes - 1]}/${ano}`;
  if (p === "SEMESTRE") return `${mes <= 6 ? "S1" : "S2"}/${ano}`;
  return `YTD ${ano}`;
};

// ─── PbiCard reutilizável ───────────────────────────────────────────────
function PbiCard({
  title, subtitle, children, className, headerRight,
}: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string; headerRight?: React.ReactNode;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className ?? ""}`}>
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>{title}</p>
          {subtitle && <p className="text-[10px]" style={{ color: "#9CA3AF" }}>{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function BigStatCard({
  title, subtitle, value, accent, loading, breakdown,
}: {
  title: string; subtitle?: string; value: string; accent: string; loading?: boolean;
  breakdown?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-lg shadow-sm p-5 border"
      style={{ background: "#fff", borderColor: "#e5e7eb", borderLeft: `4px solid ${accent}` }}>
      <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>{title}</p>
      {subtitle && <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>{subtitle}</p>}
      {loading ? (
        <div className="h-10 mt-2 w-40 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold mt-2" style={{ color: "#14405C" }}>{value}</p>
      )}
      {breakdown && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2">
          {breakdown.map((b) => (
            <div key={b.label}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9CA3AF" }}>{b.label}</p>
              {loading ? (
                <div className="h-4 mt-1 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-sm font-semibold" style={{ color: "#14405C" }}>{b.value}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VarCard({ title, value, loading }: { title: string; value: number | null | undefined; loading?: boolean }) {
  const hasValue = value !== null && value !== undefined && isFinite(Number(value));
  const v = hasValue ? Number(value) * 100 : 0;
  const up = v >= 0;
  const color = !hasValue ? "#9CA3AF" : up ? "#16a34a" : "#dc2626";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
      <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>{title}</p>
      {loading ? (
        <div className="h-6 mt-1 w-24 bg-gray-100 rounded animate-pulse" />
      ) : !hasValue ? (
        <p className="text-sm font-medium mt-1" style={{ color: "#9CA3AF" }}>Sem dado para comparar</p>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <Icon className="h-5 w-5" style={{ color }} />
          <p className="text-2xl font-bold" style={{ color }}>
            {up ? "+" : ""}{v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────
function DashboardReceitaLavoro() {
  const escopo = useEscopoReceita();
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [periodo, setPeriodo] = useState<Periodo>("YTD");
  const [mesRef, setMesRef] = useState<number>(hoje.getMonth() + 1);
  const [detOpen, setDetOpen] = useState(false);
  const mesAtual = mesRef;

  const anosDisponiveis = useMemo(() => {
    const atual = hoje.getFullYear();
    return [atual, atual - 1, atual - 2];
  }, [hoje]);

  const periodoLabel = labelPeriodo(periodo, mesRef, ano);

  // ─── Queries ──────────────────────────────────────────────────────────
  const kpisQ = useQuery({
    queryKey: ["lavoro-receita-kpis", ano, mesAtual, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_kpis" as any, {
        p_ano: ano, p_mes: mesAtual, p_periodo: periodo,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        receita_competencia: number; receita_caixa: number; meta_periodo: number;
        atingimento: number; defasagem: number; previsto_caixa: number; atingimento_caixa: number;
        previsto_garantia: number; previsto_beneficios: number; previsto_demais: number;
        caixa_garantia: number; caixa_beneficios: number; caixa_demais: number;
        competencia_garantia: number; competencia_beneficios: number; competencia_demais: number;
      } | null;
    },
  });

  const variacoesQ = useQuery({
    queryKey: ["lavoro-receita-variacoes", ano, mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_variacoes" as any, {
        p_ano: ano, p_mes: mesAtual,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        variacao_mes_anterior: number; variacao_ano_anterior: number;
      } | null;
    },
  });

  const caixaYoyQ = useQuery({
    queryKey: ["lavoro-caixa-yoy", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_caixa_comparativo_anual" as any, {
        p_anos: [ano - 1, ano],
      });
      if (error) throw error;
      return (data || []) as Array<{ ano: number; mes: number; receita_caixa: number }>;
    },
  });

  const competenciaYoyQ = useQuery({
    queryKey: ["lavoro-competencia-yoy", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_comparativo_anual" as any, {
        p_anos: [ano - 1, ano],
      });
      if (error) throw error;
      return (data || []) as Array<{ ano: number; mes: number; receita_competencia: number }>;
    },
  });

  const serieQ = useQuery({
    queryKey: ["lavoro-receita-serie", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_serie_mensal" as any, { p_ano: ano });
      if (error) throw error;
      return (data || []) as Array<{ mes: number; receita_competencia: number; receita_caixa: number; meta_mensal: number }>;
    },
    enabled: detOpen,
  });

  const comparativoQ = useQuery({
    queryKey: ["lavoro-receita-comparativo", anosDisponiveis],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_comparativo_anual" as any, {
        p_anos: anosDisponiveis,
      });
      if (error) throw error;
      return (data || []) as Array<{ ano: number; mes: number; receita_competencia: number }>;
    },
    enabled: detOpen,
  });

  const canalQ = useQuery({
    queryKey: ["lavoro-receita-canal", ano, mesAtual, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_por_canal" as any, {
        p_ano: ano, p_mes: mesAtual, p_periodo: periodo,
      });
      if (error) throw error;
      return (data || []) as Array<{ tipo_de_ramo: string; receita: number }>;
    },
    enabled: detOpen,
  });

  const ramoQ = useQuery({
    queryKey: ["lavoro-receita-ramo", ano, mesAtual, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_por_ramo" as any, {
        p_ano: ano, p_mes: mesAtual, p_periodo: periodo,
      });
      if (error) throw error;
      return (data || []) as Array<{ ramo: string; receita: number }>;
    },
    enabled: detOpen,
  });

  // Usa o RPC de vencidos que já existe neste projeto
  const vencidosQ = useQuery({
    queryKey: ["lavoro-comissao-vencida", ano, mesAtual, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_comissao_vencida_por_canal" as any, {
        p_ano: ano, p_mes: mesAtual, p_periodo: periodo,
      });
      if (error) throw error;
      return (data || []) as Array<{ tipo_de_ramo: string; comissao_vencida: number }>;
    },
  });

  const ultimaAtQ = useQuery({
    queryKey: ["lavoro-ultima-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_ultima_atualizacao" as any);
      if (error) throw error;
      return data as string | null;
    },
  });

  const isRefreshing =
    kpisQ.isFetching || variacoesQ.isFetching || caixaYoyQ.isFetching || competenciaYoyQ.isFetching || vencidosQ.isFetching ||
    serieQ.isFetching || comparativoQ.isFetching || canalQ.isFetching || ramoQ.isFetching;

  const handleRefresh = async () => {
    await Promise.all([
      kpisQ.refetch(), variacoesQ.refetch(), caixaYoyQ.refetch(), competenciaYoyQ.refetch(), vencidosQ.refetch(),
      serieQ.refetch(), comparativoQ.refetch(), canalQ.refetch(), ramoQ.refetch(), ultimaAtQ.refetch(),
    ]);
    toast.success("Dados atualizados");
  };

  const kpis = kpisQ.data;
  const atingCaixa = Number(kpis?.atingimento_caixa || 0) * 100;
  const atingCaixaColor = atingCaixa >= 100 ? "#16a34a" : atingCaixa >= 80 ? "#f59e0b" : "#dc2626";
  const atingimento = Number(kpis?.atingimento || 0) * 100;
  const atingColor = atingimento >= 100 ? "#16a34a" : atingimento >= 80 ? "#f59e0b" : "#dc2626";

  const cortePorPeriodo = <T extends { mesNum: number }>(rows: T[]): T[] => {
    if (periodo === "MTD") return rows.filter((r) => r.mesNum === mesRef);
    if (periodo === "SEMESTRE") {
      const ini = mesRef <= 6 ? 1 : 7;
      return rows.filter((r) => r.mesNum >= ini && r.mesNum <= mesRef);
    }
    return rows.filter((r) => r.mesNum <= mesRef);
  };

  const caixaYoyChart = useMemo(() => {
    const rows = caixaYoyQ.data || [];
    const full = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const prev = rows.find((r) => Number(r.ano) === ano - 1 && Number(r.mes) === mes);
      const cur = rows.find((r) => Number(r.ano) === ano && Number(r.mes) === mes);
      return {
        mes: MESES[i], mesNum: mes,
        [String(ano - 1)]: Number(prev?.receita_caixa || 0),
        [String(ano)]: Number(cur?.receita_caixa || 0),
      };
    });
    return cortePorPeriodo(full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixaYoyQ.data, ano, periodo, mesRef]);

  const competenciaYoyChart = useMemo(() => {
    const rows = competenciaYoyQ.data || [];
    const full = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const prev = rows.find((r) => Number(r.ano) === ano - 1 && Number(r.mes) === mes);
      const cur = rows.find((r) => Number(r.ano) === ano && Number(r.mes) === mes);
      return {
        mes: MESES[i], mesNum: mes,
        [String(ano - 1)]: Number(prev?.receita_competencia || 0),
        [String(ano)]: Number(cur?.receita_competencia || 0),
      };
    });
    return cortePorPeriodo(full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competenciaYoyQ.data, ano, periodo, mesRef]);

  const mesAtualReal = new Date().getMonth() + 1;
  const anoAtualReal = new Date().getFullYear();
  const serieChart = useMemo(() => {
    const src = serieQ.data || [];
    const full = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const row = src.find((r) => Number(r.mes) === mes);
      return {
        mes: MESES[i], mesNum: mes,
        Competência: Number(row?.receita_competencia || 0),
        Caixa: Number(row?.receita_caixa || 0),
        Meta: Number(row?.meta_mensal || 0),
      };
    });
    if (periodo === "MTD") return full.filter((r) => r.mesNum === mesRef);
    if (periodo === "SEMESTRE") {
      const ini = mesRef <= 6 ? 1 : 7;
      return full.filter((r) => r.mesNum >= ini && r.mesNum <= mesRef);
    }
    const limite = ano === anoAtualReal ? Math.min(mesRef, mesAtualReal) : mesRef;
    return full.filter((r) => r.mesNum <= limite);
  }, [serieQ.data, mesRef, periodo, ano, mesAtualReal, anoAtualReal]);

  const comparativoChart = useMemo(() => {
    const rows = comparativoQ.data || [];
    const anos = Array.from(new Set(rows.map((r) => Number(r.ano)))).sort();
    return {
      anos,
      data: Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const point: Record<string, any> = { mes: MESES[i] };
        anos.forEach((a) => {
          const row = rows.find((r) => Number(r.ano) === a && Number(r.mes) === mes);
          point[String(a)] = Number(row?.receita_competencia || 0);
        });
        return point;
      }),
    };
  }, [comparativoQ.data]);

  const CORES_LINHAS = ["#14405C", "#4B6D88", "#00BAF2", "#8AAFC9"];

  if (escopo.semAcesso) {
    return (
      <div className="min-h-screen p-6" style={{ background: "#14405C" }}>
        <div className="rounded-lg border border-white/20 bg-white/10 p-8 text-center text-white">
          <p className="text-sm">{SEM_ACESSO_RECEITA_MSG}</p>
          <p className="mt-1 text-xs text-white/70">
            Solicite ao administrador a liberação do(s) seu(s) time(s) de receita.
          </p>
        </div>
      </div>
    );
  }

  return (

    <div className="min-h-screen p-6" style={{ background: "#14405C" }}>
      <style>{`
        .lavoro-receita { font-family: 'Source Sans 3', system-ui, sans-serif; color: #14405C; }
        .lavoro-receita .title-serif { font-family: 'Inter', system-ui, sans-serif; font-weight: 400; color: #FFFFFF; }
      `}</style>
      <div className="lavoro-receita">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="title-serif" style={{ fontSize: 32, letterSpacing: "-0.5px", margin: 0 }}>
              Receita Lavoro Seguros
            </h1>
            <ChevronRight className="h-4 w-4 text-[#FFFFFF]/40" />
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white/10 backdrop-blur-sm border border-white/15">
              <Calendar className="h-3.5 w-3.5 text-[#00BAF2]" />
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="bg-transparent border-0 h-6 w-[90px] focus:ring-0 p-0 text-[#FFFFFF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((a) => (<SelectItem key={a} value={String(a)}>{a}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white/10 backdrop-blur-sm border border-white/15">
              <Select value={String(mesRef)} onValueChange={(v) => setMesRef(Number(v))}>
                <SelectTrigger className="bg-transparent border-0 h-6 w-[80px] focus:ring-0 p-0 text-[#FFFFFF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex rounded-md overflow-hidden border border-white/15">
              {([
                { k: "MTD", label: "Mês" },
                { k: "SEMESTRE", label: "Semestre" },
                { k: "YTD", label: "Ano" },
              ] as const).map(({ k, label }) => (
                <button
                  key={k}
                  onClick={() => setPeriodo(k as Periodo)}
                  className={`px-3 py-1 text-xs font-semibold ${
                    periodo === k ? "bg-[#00BAF2] text-[#14405C]" : "bg-white/10 text-[#FFFFFF]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SendNewsletterButton modulo="receita_lavoro" ano={ano} mes={mesRef} />
            <span className="text-xs flex items-center gap-1 text-[#FFFFFF]/80">
              <Clock className="h-3 w-3 text-[#00BAF2]" />
              Dados atualizados em: {fmtTs(ultimaAtQ.data)}
            </span>
            <Button
              variant="outline" size="sm"
              className="h-6 text-xs gap-1 border-[#FFFFFF]/30 text-[#FFFFFF] bg-transparent hover:bg-white/10 hover:text-[#FFFFFF]"
              onClick={handleRefresh} disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              Atualizar Dados
            </Button>
          </div>
        </div>

        {escopo.restrito && (
          <p className="mb-3 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/90">
            {escopo.frase}
          </p>
        )}

        {/* 2 cards grandes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <BigStatCard
            title={`A receber em ${periodoLabel}${escopo.sufixo}`}
            subtitle="Previsto Caixa (parcelas emitidas por data de pagamento)"
            value={BRL(kpis?.previsto_caixa)} accent="#8AAFC9" loading={kpisQ.isLoading}
            breakdown={escopo.filtrar([
              { label: "Garantia", value: BRL(kpis?.previsto_garantia) },
              { label: "Benefícios", value: BRL(kpis?.previsto_beneficios) },
              { label: "Demais Ramos", value: BRL(kpis?.previsto_demais) },
            ])}
          />
          <BigStatCard
            title={`Receita Caixa em ${periodoLabel}`}
            subtitle="Receita Caixa (efetivamente recebido)"
            value={BRL(kpis?.receita_caixa)} accent="#14405C" loading={kpisQ.isLoading}
            breakdown={[
              { label: "Garantia", value: BRL(kpis?.caixa_garantia) },
              { label: "Benefícios", value: BRL(kpis?.caixa_beneficios) },
              { label: "Demais Ramos", value: BRL(kpis?.caixa_demais) },
            ]}
          />
        </div>

        {/* Atingimento */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-3 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Atingimento de Competência ({periodoLabel})
                </p>
                <p className="text-[11px] text-gray-400">
                  Receita / Meta — {BRL(kpis?.receita_competencia)} / {BRL(kpis?.meta_periodo)}
                </p>
              </div>
              {isAtingimentoValido(kpis?.atingimento) && Number(kpis?.meta_periodo || 0) > 0 ? (
                <p className="text-2xl font-bold" style={{ color: atingColor }}>
                  {formatarAtingimento(kpis?.atingimento)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-gray-400">Sem meta no período</p>
              )}
            </div>
            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Number(kpis?.meta_periodo || 0) > 0 ? Math.min(atingimento, 100) : 0}%`, background: atingColor }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Atingimento de Caixa ({periodoLabel})
                </p>
                <p className="text-[11px] text-gray-400">
                  Receita Caixa / Previsto — {BRL(kpis?.receita_caixa)} / {BRL(kpis?.previsto_caixa)}
                </p>
              </div>
              {isAtingimentoValido(kpis?.atingimento_caixa) && Number(kpis?.previsto_caixa || 0) > 0 ? (
                <p className="text-2xl font-bold" style={{ color: atingCaixaColor }}>
                  {formatarAtingimento(kpis?.atingimento_caixa)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-gray-400">Sem previsão no período</p>
              )}
            </div>
            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Number(kpis?.previsto_caixa || 0) > 0 ? Math.min(atingCaixa, 100) : 0}%`, background: atingCaixaColor }}
              />
            </div>
          </div>
        </div>

        {/* Variações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <VarCard title="vs. mês anterior" value={variacoesQ.data?.variacao_mes_anterior} loading={variacoesQ.isLoading} />
          <VarCard title="vs. mesmo mês do ano anterior" value={variacoesQ.data?.variacao_ano_anterior} loading={variacoesQ.isLoading} />
        </div>

        {/* YoY Competência + Caixa */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
          <PbiCard title={`Receita Competência — ${ano - 1} x ${ano}`} subtitle="Receita emitida por mês (barras lado a lado)">
            <div style={{ width: "100%", height: 400 }}>
              <ResponsiveContainer>
                <BarChart data={competenciaYoyChart} margin={{ top: 28, right: 12, left: 8, bottom: 4 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#0F172A", fontWeight: 600 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: any) => BRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }} />
                  <Bar dataKey={String(ano - 1)} fill="#00BAF2">
                    <LabelList dataKey={String(ano - 1)} position="top"
                      formatter={(v: any) => (Number(v) > 0 ? BRL_COMPACT(Number(v)) : "")}
                      style={{ fontSize: 13, fill: "#0F172A", fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey={String(ano)} fill="#14405C">
                    <LabelList dataKey={String(ano)} position="top"
                      formatter={(v: any) => (Number(v) > 0 ? BRL_COMPACT(Number(v)) : "")}
                      style={{ fontSize: 13, fill: "#0F172A", fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PbiCard>

          <PbiCard title={`Receita Caixa — ${ano - 1} x ${ano}`} subtitle="Receita Caixa mensal (barras lado a lado)">
            <div style={{ width: "100%", height: 400 }}>
              <ResponsiveContainer>
                <BarChart data={caixaYoyChart} margin={{ top: 28, right: 12, left: 8, bottom: 4 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#0F172A", fontWeight: 600 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: any) => BRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }} />
                  <Bar dataKey={String(ano - 1)} fill="#8AAFC9">
                    <LabelList dataKey={String(ano - 1)} position="top"
                      formatter={(v: any) => (Number(v) > 0 ? BRL_COMPACT(Number(v)) : "")}
                      style={{ fontSize: 13, fill: "#0F172A", fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey={String(ano)} fill="#14405C">
                    <LabelList dataKey={String(ano)} position="top"
                      formatter={(v: any) => (Number(v) > 0 ? BRL_COMPACT(Number(v)) : "")}
                      style={{ fontSize: 13, fill: "#0F172A", fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PbiCard>
        </div>

        {/* Comissão vencida */}
        {(() => {
          const rows = (vencidosQ.data || []).filter((r) => Number(r.comissao_vencida || 0) > 0);
          const totalVencido = rows.reduce((acc, r) => acc + Number(r.comissao_vencida || 0), 0);
          return (
            <div className="rounded-lg shadow-sm border-2 mb-4 overflow-hidden"
              style={{ background: "#FFF7ED", borderColor: "#F59E0B" }}>
              <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "#FCD9A8" }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#B45309" }}>
                    Comissão vencida por canal — atenção
                  </p>
                  <p className="text-[11px]" style={{ color: "#92400E" }}>
                    Parcelas com status "Vencida" no período {periodoLabel}
                  </p>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#B45309" }}>{BRL(totalVencido)}</p>
              </div>
              <div className="p-2">
                {vencidosQ.isLoading ? (
                  <div className="h-40 bg-amber-50 animate-pulse rounded" />
                ) : rows.length === 0 ? (
                  <p className="text-center text-sm py-8" style={{ color: "#92400E" }}>
                    Nenhuma comissão vencida no período selecionado.
                  </p>
                ) : (
                  <div style={{ width: "100%", height: Math.max(220, rows.length * 34) }}>
                    <ResponsiveContainer>
                      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 60, left: 20, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#FCD9A8" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={BRL_COMPACT} />
                        <YAxis dataKey="tipo_de_ramo" type="category" tick={{ fontSize: 11 }} width={140} />
                        <Tooltip formatter={(v: any) => BRL(Number(v))} />
                        <Bar dataKey="comissao_vencida" fill="#D97706" radius={[0, 4, 4, 0]}>
                          <LabelList dataKey="comissao_vencida" position="right"
                            formatter={(v: any) => (Number(v) > 0 ? BRL_COMPACT(Number(v)) : "")}
                            style={{ fontSize: 10, fill: "#B45309", fontWeight: 600 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Detalhamento operacional */}
        <Collapsible open={detOpen} onOpenChange={setDetOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-md bg-white/10 border border-white/15 text-[#FFFFFF] text-sm font-semibold hover:bg-white/15 transition-colors">
              <span>Ver detalhamento operacional completo</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${detOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                title={`Receita Competência (${periodoLabel})`}
                value={BRL(kpis?.receita_competencia)}
                loading={kpisQ.isLoading}
                breakdown={escopo.filtrar([
                  { label: "Garantia", value: BRL(kpis?.competencia_garantia) },
                  { label: "Benefícios", value: BRL(kpis?.competencia_beneficios) },
                  { label: "Demais Ramos", value: BRL(kpis?.competencia_demais) },
                ])}
              />
              <MetricCard title={`Meta (${periodoLabel})`} value={BRL(kpis?.meta_periodo)} loading={kpisQ.isLoading} />
              <MetricCard title="Atingimento (Competência)" value={PCT(atingimento)} loading={kpisQ.isLoading}
                headerRight={
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: atingColor, color: "#fff" }}>
                    {atingimento >= 100 ? "OK" : atingimento >= 80 ? "ATENÇÃO" : "ABAIXO"}
                  </span>
                }
              />
              <MetricCard title="Defasagem (Comp - Caixa)" value={BRL(kpis?.defasagem)} loading={kpisQ.isLoading} />
            </div>

            <PbiCard title="Receita Mensal" subtitle={`Competência x Caixa x Meta — ${periodoLabel}`}>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <ComposedChart data={serieChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={BRL_COMPACT} width={80} />
                    <Tooltip formatter={(v: any) => BRL(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Competência" fill="#14405C" />
                    <Bar dataKey="Caixa" fill="#00BAF2" />
                    <Line type="monotone" dataKey="Meta" stroke="#8AAFC9" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </PbiCard>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <PbiCard title="Atingimento — Mês Corrente" subtitle={`Competência vs Meta — ${MESES[mesAtual - 1]}/${ano}`}>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <RadialBarChart innerRadius="70%" outerRadius="100%"
                      data={[{ name: "at", value: Math.min(atingimento, 100), fill: atingColor }]}
                      startAngle={180} endAngle={0} cx="50%" cy="80%">
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" background={{ fill: "#e5e7eb" } as any} cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="text-center -mt-16">
                    <p className="text-3xl font-bold" style={{ color: atingColor }}>{PCT(atingimento)}</p>
                    <p className="text-xs text-gray-500">
                      {BRL(kpis?.receita_competencia)} / {BRL(kpis?.meta_periodo)}
                    </p>
                  </div>
                </div>
              </PbiCard>

              <PbiCard title="Comparativo Anual" subtitle="Receita Competência por ano" className="lg:col-span-2">
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={comparativoChart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={BRL_COMPACT} width={80} />
                      <Tooltip formatter={(v: any) => BRL(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {comparativoChart.anos.map((a, i) => (
                        <Line key={a} type="monotone" dataKey={String(a)}
                          stroke={CORES_LINHAS[i % CORES_LINHAS.length]} strokeWidth={2} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </PbiCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <PbiCard title="Receita por Canal (Tipo de Ramo)" subtitle={periodoLabel}>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={canalQ.data || []} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={BRL_COMPACT} />
                      <YAxis dataKey="tipo_de_ramo" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(v: any) => BRL(Number(v))} />
                      <Bar dataKey="receita" fill="#14405C" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </PbiCard>

              <PbiCard title="Receita por Ramo" subtitle={periodoLabel}>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={ramoQ.data || []} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={BRL_COMPACT} />
                      <YAxis dataKey="ramo" type="category" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip formatter={(v: any) => BRL(Number(v))} />
                      <Bar dataKey="receita" fill="#00BAF2" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </PbiCard>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
