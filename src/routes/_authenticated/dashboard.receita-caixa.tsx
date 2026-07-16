import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from "recharts";
import { Calendar, ChevronRight, ChevronDown, Clock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { SendNewsletterButton } from "@/components/admin/SendNewsletterButton";

export const Route = createFileRoute("/_authenticated/dashboard/receita-caixa")({
  component: ReceitaCaixaPage,
});

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BRL_COMPACT = (v: number | null | undefined) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const COLORS = [
  "#0A2337", "#1A3A52", "#2C5572", "#4B6D88", "#5F8294", "#73A7B7",
  "#8FB8C5", "#A8C8D2", "#C0D6DD", "#D4E1E6",
];

type RawCaixa = {
  tipo_lancamento: string | null;
  mes_referencia: string | null;
  data_pagamento: string | null;
  descricao: string | null;
  valor: number | null;
  categoria: string | null;
  sub_categoria: string | null;
  referencia: string | null;
};

function parseAnoMes(row: RawCaixa): { ano: number; mes: number } | null {
  // mes_referencia esperado tipo "2026-01" / "01/2026" / "jan/26"
  const mr = (row.mes_referencia ?? "").trim();
  const m1 = mr.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m1) return { ano: +m1[1], mes: +m1[2] };
  const m2 = mr.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m2) return { ano: +m2[2], mes: +m2[1] };
  if (row.data_pagamento) {
    const d = new Date(row.data_pagamento);
    if (!isNaN(d.getTime())) return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }
  return null;
}

function ReceitaCaixaPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("__todas__");

  const rawQ = useQuery({
    queryKey: ["lavoro-caixa-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_lavoro_caixa_comissao")
        .select("tipo_lancamento,mes_referencia,data_pagamento,descricao,valor,categoria,sub_categoria,referencia")
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as RawCaixa[];
    },
    staleTime: 30_000,
  });

  const ultimaAtualQ = useQuery({
    queryKey: ["lavoro-ultima-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_ultima_atualizacao");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });

  const dados = useMemo(() => {
    const rows = rawQ.data ?? [];
    return rows
      .map((r) => {
        const p = parseAnoMes(r);
        return p ? { ...r, ano: p.ano, mes: p.mes, valor: Number(r.valor) || 0 } : null;
      })
      .filter(Boolean) as (RawCaixa & { ano: number; mes: number; valor: number })[];
  }, [rawQ.data]);

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(dados.map((d) => d.ano))).sort((a, b) => b - a),
    [dados],
  );

  const categoriasDisponiveis = useMemo(
    () => Array.from(new Set(dados.map((d) => (d.categoria ?? "(sem categoria)")))).sort(),
    [dados],
  );

  const dadosAno = useMemo(
    () => dados.filter((d) => d.ano === ano && (categoriaFiltro === "__todas__" || (d.categoria ?? "(sem categoria)") === categoriaFiltro)),
    [dados, ano, categoriaFiltro],
  );

  const totalAno = useMemo(() => dadosAno.reduce((s, d) => s + d.valor, 0), [dadosAno]);
  const totalEntradas = useMemo(() => dadosAno.filter(d => d.valor > 0).reduce((s, d) => s + d.valor, 0), [dadosAno]);
  const totalSaidas = useMemo(() => dadosAno.filter(d => d.valor < 0).reduce((s, d) => s + Math.abs(d.valor), 0), [dadosAno]);
  const mesAtual = new Date().getMonth() + 1;
  const totalMesAtual = useMemo(
    () => dadosAno.filter(d => d.mes === mesAtual).reduce((s, d) => s + d.valor, 0),
    [dadosAno, mesAtual],
  );

  // Série mensal
  const serieMensal = useMemo(() => {
    const map = new Map<number, number>();
    for (let m = 1; m <= 12; m++) map.set(m, 0);
    dadosAno.forEach((d) => map.set(d.mes, (map.get(d.mes) ?? 0) + d.valor));
    return Array.from(map.entries()).map(([m, valor]) => ({ mes: MESES[m - 1], valor }));
  }, [dadosAno]);

  // Por categoria
  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    dadosAno.forEach((d) => {
      const c = d.categoria ?? "(sem categoria)";
      map.set(c, (map.get(c) ?? 0) + d.valor);
    });
    return Array.from(map.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  }, [dadosAno]);

  // Por sub_categoria (pivot em categoria)
  const porSub = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    dadosAno.forEach((d) => {
      const c = d.categoria ?? "(sem categoria)";
      const s = d.sub_categoria ?? "(sem sub)";
      if (!map.has(c)) map.set(c, new Map());
      const inner = map.get(c)!;
      inner.set(s, (inner.get(s) ?? 0) + d.valor);
    });
    return Array.from(map.entries()).map(([cat, inner]) => ({
      categoria: cat,
      total: Array.from(inner.values()).reduce((a, b) => a + b, 0),
      subs: Array.from(inner.entries())
        .map(([sub, valor]) => ({ sub, valor }))
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)),
    })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [dadosAno]);

  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const toggleCat = (c: string) => {
    setExpandidas((s) => {
      const n = new Set(s);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  };

  const fmtTs = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Receita</h1>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-lg text-muted-foreground">Caixa</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="bg-transparent border-0 h-6 w-[90px] focus:ring-0 p-0">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {(anosDisponiveis.length ? anosDisponiveis : [anoAtual]).map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border">
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="bg-transparent border-0 h-6 w-[220px] focus:ring-0 p-0">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas as categorias</SelectItem>
                {categoriasDisponiveis.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SendNewsletterButton modulo="receita_lavoro" ano={ano} mes={new Date().getMonth() + 1} />
          <span className="text-xs flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Última importação {fmtTs(ultimaAtualQ.data)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => { rawQ.refetch(); ultimaAtualQ.refetch(); }}
          >
            <RefreshCw className={`h-3 w-3 ${rawQ.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title={`Total ${ano}`} value={BRL(totalAno)} subtitle="Entradas − saídas" />
        <MetricCard title="Entradas" value={BRL(totalEntradas)} subtitle="Valores positivos" />
        <MetricCard title="Saídas" value={BRL(totalSaidas)} subtitle="Valores negativos (mod.)" />
        <MetricCard title={`${MESES[mesAtual - 1]}/${ano}`} value={BRL(totalMesAtual)} subtitle="Mês corrente" />
      </div>

      {/* Série mensal */}
      <div className="bg-card border rounded-lg p-4">
        <div className="mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evolução mensal</h3>
          <p className="text-[11px] text-muted-foreground">Total por mês em {ano}</p>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={serieMensal} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => BRL_COMPACT(v)} />
              <Tooltip formatter={(v: number) => BRL(v)} />
              <Line type="monotone" dataKey="valor" stroke="#0A2337" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="mb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Por categoria</h3>
            <p className="text-[11px] text-muted-foreground">Total agregado em {ano}</p>
          </div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={porCategoria} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => BRL_COMPACT(v)} />
                <YAxis type="category" dataKey="categoria" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => BRL(v)} />
                <Bar dataKey="valor" fill="#1A3A52" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="mb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detalhe por sub-categoria</h3>
            <p className="text-[11px] text-muted-foreground">Clique em uma categoria para expandir</p>
          </div>
          <div className="max-h-[320px] overflow-auto">
            {porSub.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">Sem dados no período.</p>
            )}
            {porSub.map((c, i) => (
              <Collapsible key={c.categoria} open={expandidas.has(c.categoria)} onOpenChange={() => toggleCat(c.categoria)}>
                <CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-muted text-left">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    {expandidas.has(c.categoria) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <span className="text-sm font-medium">{c.categoria}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{BRL(c.total)}</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-8 pr-2 pb-1">
                  {c.subs.map((s) => (
                    <div key={s.sub} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-muted-foreground">{s.sub}</span>
                      <span className="tabular-nums">{BRL(s.valor)}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </div>

      {rawQ.isLoading && (
        <p className="text-xs text-muted-foreground text-center py-4">Carregando dados de caixa…</p>
      )}
      {!rawQ.isLoading && dados.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhum lançamento em <code>raw_lavoro_caixa_comissao</code>. Importe pela tela de Admin → Importar Bases.
        </p>
      )}
    </div>
  );
}
