import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
} from "recharts";
import { AlertTriangle, Calendar } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SendNewsletterButton } from "@/components/admin/SendNewsletterButton";

export const Route = createFileRoute("/_authenticated/dashboard/receita-executivo")({
  component: DashboardReceitaExecutivo,
});

// ── Paleta (Master Doc) ──────────────────────────────────────────────
const NAVY = "#14405C";
const AZUL_CLARO = "#8AAFC9";
const LARANJA = "#00BAF2";
const VERDE = "#1E7F4F";
const FUNDO = "#14405C";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_COMPLETOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BRL_COMPACT = (v: number | null | undefined) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const PCT = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

type MensalRow = {
  mes: number;
  emitido: number;
  caixa: number;
  caixa_corrente: number;
  saldo_vencido: number;
  a_receber_futuro: number | null;
};

type ComplementaresRow = {
  emissoes_ate_2025_a_receber: number;
  vencidos_anteriores_2026: number;
  posicao_total_vencida: number;
};

type CanalRow = {
  canal: string;
  caixa: number;
  caixa_corrente: number;
  a_receber_futuro: number;
};

const CANAIS_ORDEM = ["Garantia", "Benefícios", "Demais Ramos"] as const;

function KpiCard({
  title, value, accent, subtitle, loading, breakdown,
}: {
  title: string; value: string; accent: string; subtitle?: string; loading?: boolean;
  breakdown?: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      className="rounded-lg p-4 shadow-sm border bg-white"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>{title}</p>
      {loading ? (
        <div className="h-8 mt-2 w-40 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: NAVY }}>{value}</p>
      )}
      {subtitle && <p className="text-[11px] mt-1" style={{ color: "#6B7280" }}>{subtitle}</p>}
      {breakdown && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2">
          {breakdown.map((b) => (
            <div key={b.label}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9CA3AF" }}>{b.label}</p>
              {loading ? (
                <div className="h-4 mt-1 w-14 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-sm font-semibold tabular-nums" style={{ color: NAVY }}>{b.value}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardReceitaExecutivo() {
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const mesLimiteYtd = ano === anoAtual ? mesAtual : 12;

  const anosDisponiveis = useMemo(() => {
    const atual = hoje.getFullYear();
    return [atual + 1, atual, atual - 1, atual - 2];
  }, []);

  const mensalQ = useQuery({
    queryKey: ["receita-executivo-mensal", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_executivo_mensal" as any, { p_ano: ano });
      if (error) throw error;
      return (data || []) as MensalRow[];
    },
  });

  const compQ = useQuery({
    queryKey: ["receita-executivo-complementares", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_executivo_complementares" as any, { p_ano: ano });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as ComplementaresRow | null;
    },
  });

  const canaisQ = useQuery({
    queryKey: ["receita-executivo-canais", ano, mesLimiteYtd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_executivo_canais" as any, {
        p_ano: ano, p_mes: mesLimiteYtd,
      });
      if (error) throw error;
      return (data || []) as CanalRow[];
    },
  });

  // Quebra por canal — rateada para bater exatamente com o total exibido
  const breakdownCanais = (campo: keyof Omit<CanalRow, "canal">, total: number) => {
    const linhas = canaisQ.data ?? [];
    const valores = CANAIS_ORDEM.map((c) =>
      Number(linhas.find((l) => l.canal === c)?.[campo] ?? 0),
    );
    const soma = valores.reduce((a, b) => a + b, 0);
    const fator = soma > 0 ? Number(total || 0) / soma : 0;
    return CANAIS_ORDEM.map((c, i) => ({ label: c, value: BRL(valores[i] * fator) }));
  };


  const ultAtualQ = useQuery({
    queryKey: ["lavoro-ultima-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_ultima_atualizacao" as any);
      if (error) throw error;
      return data as string | null;
    },
  });

  const linhas = mensalQ.data ?? [];
  const ytd = linhas.filter((r) => r.mes <= mesLimiteYtd);

  const totYtd = useMemo(() => {
    const s = { emitido: 0, caixa: 0, caixa_corrente: 0, saldo_vencido: 0 };
    for (const r of ytd) {
      s.emitido += Number(r.emitido || 0);
      s.caixa += Number(r.caixa || 0);
      s.caixa_corrente += Number(r.caixa_corrente || 0);
      s.saldo_vencido += Number(r.saldo_vencido || 0);
    }
    return s;
  }, [ytd]);

  const aReceberPosicaoAtual = useMemo(() => {
    const linhaAtual = linhas.find((r) => r.mes === mesLimiteYtd);
    return Number(linhaAtual?.a_receber_futuro ?? 0);
  }, [linhas, mesLimiteYtd]);

  const pctCaixa = totYtd.caixa > 0 ? totYtd.caixa_corrente / totYtd.caixa : 0;

  const chartCompCaixa = linhas.map((r) => ({
    mes: MESES[r.mes - 1],
    Emitido: Number(r.emitido || 0),
    Caixa: Number(r.caixa || 0),
  }));

  const chartCaixaEsperadoRecebido = linhas.map((r) => ({
    mes: MESES[r.mes - 1],
    "Caixa Esperado": Number(r.caixa || 0),
    "Caixa Recebido": Number(r.caixa_corrente || 0),
  }));

  const chartAReceber = linhas.map((r) => ({
    mes: MESES[r.mes - 1],
    "A Receber Futuro": Number(r.a_receber_futuro ?? 0),
  }));

  const fmtAtualizacao = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen p-6" style={{ background: FUNDO }}>
      <div className="mx-auto max-w-[1400px] space-y-4">

        {/* Cabeçalho */}
        <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>
              Receita Lavoro Seguros · Resumo Executivo {ano}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
              Janeiro a {MESES_COMPLETOS[mesLimiteYtd - 1]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: NAVY }} />
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs" style={{ color: "#6B7280" }}>
              Dados atualizados em: <span className="font-medium">{fmtAtualizacao(ultAtualQ.data)}</span>
            </div>
            <SendNewsletterButton modulo="executivo_lavoro" ano={ano} mes={mesLimiteYtd} />
          </div>
        </div>

        {/* KPIs YTD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title={`Emitido YTD ${ano}`} value={BRL(totYtd.emitido)} accent={AZUL_CLARO} loading={mensalQ.isLoading} />
          <KpiCard title={`Caixa Esperado YTD ${ano}`} value={BRL(totYtd.caixa)} accent={NAVY} loading={mensalQ.isLoading} />
          <KpiCard
            title={`Caixa Recebido YTD ${ano}`}
            value={BRL(totYtd.caixa_corrente)}
            accent={VERDE}
            subtitle={`${PCT(pctCaixa)} do Caixa Esperado`}
            loading={mensalQ.isLoading}
            breakdown={breakdownCanais("caixa_corrente", totYtd.caixa_corrente)}
          />
          <KpiCard
            title="A Receber Futuro"
            value={BRL(aReceberPosicaoAtual)}
            accent={LARANJA}
            subtitle={`Posição em ${MESES_COMPLETOS[mesLimiteYtd - 1]}/${ano}`}
            loading={mensalQ.isLoading}
            breakdown={breakdownCanais("a_receber_futuro", aReceberPosicaoAtual)}
          />
        </div>

        {/* Tabela mensal */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ background: NAVY }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Detalhamento Mensal</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead style={{ background: "#F9FAFB" }}>
                <tr className="text-xs uppercase tracking-wider" style={{ color: "#6B7280" }}>
                  <th className="text-left px-4 py-2 font-semibold">Mês</th>
                  <th className="text-right px-4 py-2 font-semibold">Emitido</th>
                  <th className="text-right px-4 py-2 font-semibold">Caixa</th>
                  <th className="text-right px-4 py-2 font-semibold" style={{ color: VERDE }}>Caixa Corrente</th>
                  <th className="text-right px-4 py-2 font-semibold" style={{ color: LARANJA }}>Caixa Saldo Vencido</th>
                  <th className="text-right px-4 py-2 font-semibold">A Receber Futuro</th>
                </tr>
              </thead>
              <tbody>
                {mensalQ.isLoading && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Carregando…</td></tr>
                )}
                {!mensalQ.isLoading && ytd.map((r) => (
                  <tr key={r.mes} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium" style={{ color: NAVY }}>{MESES_COMPLETOS[r.mes - 1]}</td>
                    <td className="px-4 py-2 text-right">{BRL(r.emitido)}</td>
                    <td className="px-4 py-2 text-right">{BRL(r.caixa)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: VERDE }}>{BRL(r.caixa_corrente)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: LARANJA }}>{BRL(r.saldo_vencido)}</td>
                    <td className="px-4 py-2 text-right">{BRL(r.a_receber_futuro ?? 0)}</td>
                  </tr>
                ))}
                {!mensalQ.isLoading && (
                  <tr className="border-t-2 font-semibold" style={{ background: "#F9FAFB", borderColor: NAVY }}>
                    <td className="px-4 py-2" style={{ color: NAVY }}>Total YTD</td>
                    <td className="px-4 py-2 text-right" style={{ color: NAVY }}>{BRL(totYtd.emitido)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: NAVY }}>{BRL(totYtd.caixa)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: VERDE }}>{BRL(totYtd.caixa_corrente)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: LARANJA }}>{BRL(totYtd.saldo_vencido)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">—</td>
                  </tr>
                )}
                {!mensalQ.isLoading && compQ.data && (
                  <tr className="border-t text-xs" style={{ color: "#6B7280" }}>
                    <td className="px-4 py-2 italic" colSpan={5}>
                      Emissões até {ano - 1} ainda a receber
                    </td>
                    <td className="px-4 py-2 text-right font-medium" style={{ color: NAVY }}>
                      {BRL(compQ.data.emissoes_ate_2025_a_receber)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Faixa laranja - Comissão Vencida */}
        <div
          className="rounded-lg p-4 flex items-center justify-between gap-3 shadow-sm"
          style={{ background: LARANJA, color: "#fff" }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider">Comissão Vencida YTD — Atenção</p>
              <p className="text-xs opacity-90">
                Vencidos anteriores a {ano}: {BRL(compQ.data?.vencidos_anteriores_2026 ?? 0)}
                {" · "}Posição total Vencida: {BRL(compQ.data?.posicao_total_vencida ?? 0)}
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums">{BRL(totYtd.saldo_vencido)}</p>
        </div>

        {/* Gráficos: Competência x Caixa e Caixa Esperado x Recebido */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: NAVY }}>
              Receita Competência x Caixa
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartCompCaixa}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" style={{ fontSize: 11 }} />
                <YAxis tickFormatter={BRL_COMPACT} style={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number) => BRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Emitido" fill={AZUL_CLARO} radius={[4,4,0,0]} />
                <Bar dataKey="Caixa" fill={NAVY} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: NAVY }}>
              Caixa Esperado x Caixa Recebido
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartCaixaEsperadoRecebido}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" style={{ fontSize: 11 }} />
                <YAxis tickFormatter={BRL_COMPACT} style={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number) => BRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Caixa Esperado" fill={NAVY} radius={[4,4,0,0]} />
                <Bar dataKey="Caixa Recebido" fill={VERDE} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução A Receber Futuro */}
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: NAVY }}>
            Evolução Mensal do A Receber Futuro
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartAReceber}>
              <defs>
                <linearGradient id="gradAReceber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={LARANJA} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={LARANJA} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="mes" style={{ fontSize: 11 }} />
              <YAxis tickFormatter={BRL_COMPACT} style={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: number) => BRL(v)} />
              <Area type="monotone" dataKey="A Receber Futuro" stroke={LARANJA} fill="url(#gradAReceber)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Rodapé - Regras */}
        <div className="bg-white rounded-lg border shadow-sm p-4 text-[11px] leading-relaxed" style={{ color: "#6B7280" }}>
          <p className="font-semibold mb-2 uppercase tracking-wider" style={{ color: NAVY }}>Regras de cálculo</p>
          <ul className="space-y-1 list-disc pl-5">
            <li><strong>Emitido:</strong> soma do valor das parcelas cuja Data de Emissão cai no mês (grupo Paga + Pendente).</li>
            <li><strong>Caixa:</strong> soma do valor das parcelas cuja Data de Pagamento cai no mês (grupo Paga + Pendente).</li>
            <li><strong>Caixa Corrente:</strong> soma do valor das parcelas Paga cuja Data de Pagamento cai no mês.</li>
            <li><strong>Saldo Vencido:</strong> soma do valor das parcelas com status Vencida cuja Data de Pagamento cai no mês. No mês corrente, exibido como zero (posição fecha só ao final do mês).</li>
            <li><strong>A Receber Futuro:</strong> posição acumulada ao fim do mês — Pendentes emitidas até o fim do mês com pagamento posterior a essa data.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
