import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, LabelList,
  ComposedChart, Line, Legend, CartesianGrid,
} from "recharts";
import { ChevronDown, RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const Route = createFileRoute("/_authenticated/dashboard/receita")({
  component: DashboardReceita,
});

/* ---------------- Palette ---------------- */
const NAVY = "#14405C";
const AZUL_CLARO = "#8AAFC9";
const AZUL_VIVO = "#00BAF2";
const TEXT_DARK = "#0F172A";
const GREEN = "#3B6D11";
const RED = "#993C1D";
const AMBER = "#F59E0B";

/* ---------------- Helpers ---------------- */
type Periodo = "MTD" | "SEMESTRE" | "YTD";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const brl = (v: number | null | undefined) =>
  v == null ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const brlCompact = (v: number | null | undefined) => {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mi`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString("pt-BR")} mil`;
  return brl(v);
};

const pct = (v: number | null | undefined) =>
  v == null ? null : (v * 100).toFixed(1) + "%";

function mesesDoPeriodo(periodo: Periodo, mes: number): number[] {
  if (periodo === "MTD") return [mes];
  if (periodo === "SEMESTRE") {
    const inicio = mes <= 6 ? 1 : 7;
    return Array.from({ length: mes - inicio + 1 }, (_, i) => inicio + i);
  }
  // YTD
  return Array.from({ length: mes }, (_, i) => i + 1);
}

/* ---------------- Data hooks ---------------- */
function useKpis(ano: number, mes: number, periodo: Periodo) {
  return useQuery({
    queryKey: ["receita-kpis", ano, mes, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_kpis", { _ano: ano, _mes: mes, _periodo: periodo });
      if (error) throw error;
      return (data?.[0] ?? null);
    },
  });
}
function useVariacoes(ano: number, mes: number) {
  return useQuery({
    queryKey: ["receita-variacoes", ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_variacoes", { _ano: ano, _mes: mes });
      if (error) throw error;
      return (data?.[0] ?? null);
    },
  });
}
function useComissaoVencida(ano: number, mes: number, periodo: Periodo) {
  return useQuery({
    queryKey: ["comissao-vencida", ano, mes, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_comissao_vencida_por_canal", { p_ano: ano, p_mes: mes, p_periodo: periodo });
      if (error) throw error;
      return data ?? [];
    },
  });
}
function useCompAnual(anos: number[]) {
  return useQuery({
    queryKey: ["receita-comp-anual", anos],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_comparativo_anual", { _anos: anos });
      if (error) throw error;
      return data ?? [];
    },
  });
}
function useCaixaCompAnual(anos: number[]) {
  return useQuery({
    queryKey: ["receita-caixa-comp-anual", anos],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_caixa_comparativo_anual", { _anos: anos });
      if (error) throw error;
      return data ?? [];
    },
  });
}
function useSerieMensal(ano: number) {
  return useQuery({
    queryKey: ["receita-serie", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_serie_mensal", { _ano: ano });
      if (error) throw error;
      return data ?? [];
    },
  });
}
function usePorCanal(ano: number, mes: number, periodo: Periodo) {
  return useQuery({
    queryKey: ["receita-canal", ano, mes, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_por_canal", { _ano: ano, _mes: mes, _periodo: periodo });
      if (error) throw error;
      return data ?? [];
    },
  });
}
function usePorRamo(ano: number, mes: number, periodo: Periodo) {
  return useQuery({
    queryKey: ["receita-ramo", ano, mes, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_receita_por_ramo", { _ano: ano, _mes: mes, _periodo: periodo });
      if (error) throw error;
      return data ?? [];
    },
  });
}
function useLastImport() {
  return useQuery({
    queryKey: ["admin-last-import", "gerencial"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_last_import", { _tipo: "gerencial" });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

/* ---------------- Component ---------------- */
function DashboardReceita() {
  const qc = useQueryClient();
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.getMonth() + 1;

  const [ano, setAno] = useState<number>(anoAtual);
  const [mes, setMes] = useState<number>(mesAtual);
  const [periodo, setPeriodo] = useState<Periodo>("YTD");

  const anos = useMemo(() => {
    const arr: number[] = [];
    for (let a = anoAtual; a >= anoAtual - 4; a--) arr.push(a);
    return arr;
  }, [anoAtual]);

  const kpis = useKpis(ano, mes, periodo);
  const vars_ = useVariacoes(ano, mes);
  const vencidas = useComissaoVencida(ano, mes, periodo);
  const compAnual = useCompAnual([ano - 1, ano]);
  const caixaCompAnual = useCaixaCompAnual([ano - 1, ano]);
  const serie = useSerieMensal(ano);
  const canal = usePorCanal(ano, mes, periodo);
  const ramo = usePorRamo(ano, mes, periodo);
  const lastImport = useLastImport();

  const periodoLabel = periodo === "MTD" ? MESES[mes - 1] : periodo === "SEMESTRE" ? `${mes <= 6 ? "1º" : "2º"} sem/${ano}` : `YTD ${ano}`;
  const mesesVisiveis = mesesDoPeriodo(periodo, mes);

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["receita-kpis"] });
    qc.invalidateQueries({ queryKey: ["receita-variacoes"] });
    qc.invalidateQueries({ queryKey: ["comissao-vencida"] });
    qc.invalidateQueries({ queryKey: ["receita-comp-anual"] });
    qc.invalidateQueries({ queryKey: ["receita-caixa-comp-anual"] });
    qc.invalidateQueries({ queryKey: ["receita-serie"] });
    qc.invalidateQueries({ queryKey: ["receita-canal"] });
    qc.invalidateQueries({ queryKey: ["receita-ramo"] });
    qc.invalidateQueries({ queryKey: ["admin-last-import"] });
  };

  /* comparativo bars data */
  const compData = useMemo(() => {
    return mesesVisiveis.map((m) => {
      const prev = (compAnual.data ?? []).find((r: any) => r.mes === m && r.ano === ano - 1);
      const cur = (compAnual.data ?? []).find((r: any) => r.mes === m && r.ano === ano);
      return { mes: MESES[m - 1], [`${ano - 1}`]: Number(prev?.competencia ?? 0), [`${ano}`]: Number(cur?.competencia ?? 0) };
    });
  }, [compAnual.data, mesesVisiveis, ano]);
  const caixaCompData = useMemo(() => {
    return mesesVisiveis.map((m) => {
      const prev = (caixaCompAnual.data ?? []).find((r: any) => r.mes === m && r.ano === ano - 1);
      const cur = (caixaCompAnual.data ?? []).find((r: any) => r.mes === m && r.ano === ano);
      return { mes: MESES[m - 1], [`${ano - 1}`]: Number(prev?.caixa ?? 0), [`${ano}`]: Number(cur?.caixa ?? 0) };
    });
  }, [caixaCompAnual.data, mesesVisiveis, ano]);

  const serieData = useMemo(() => {
    return mesesVisiveis.map((m) => {
      const row = (serie.data ?? []).find((r: any) => r.mes === m);
      return {
        mes: MESES[m - 1],
        Competência: Number(row?.competencia ?? 0),
        Caixa: Number(row?.caixa ?? 0),
        Meta: Number(row?.meta ?? 0),
      };
    });
  }, [serie.data, mesesVisiveis]);

  const totalVencidas = (vencidas.data ?? []).reduce((s: number, r: any) => s + Number(r.comissao_vencida ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold" style={{ color: NAVY }}>Receita Lavoro Seguros</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Dados atualizados em: {lastImport.data ? new Date(lastImport.data).toLocaleString("pt-BR") : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <ToggleGroup type="single" value={periodo} onValueChange={(v) => v && setPeriodo(v as Periodo)}>
            <ToggleGroupItem value="MTD">Mês</ToggleGroupItem>
            <ToggleGroupItem value="SEMESTRE">Semestre</ToggleGroupItem>
            <ToggleGroupItem value="YTD">Ano</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={refetchAll} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar Dados
          </Button>
        </div>
      </div>

      {/* 2. Cards grandes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card style={{ backgroundColor: NAVY, color: "white", border: "none" }}>
          <CardHeader className="pb-2"><CardTitle className="text-white/80 text-sm font-medium">A Receber em {periodoLabel}</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold">{brl(Number(kpis.data?.previsto ?? 0))}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receita Caixa em {periodoLabel}</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold" style={{ color: TEXT_DARK }}>{brl(Number(kpis.data?.caixa ?? 0))}</div></CardContent>
        </Card>
      </div>

      {/* 3. Barras de atingimento */}
      <Card>
        <CardHeader><CardTitle className="text-base" style={{ color: NAVY }}>Atingimento em {periodoLabel}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <AtingimentoBar label="Competência" valor={kpis.data?.atingimento ?? null} detalhe={`${brl(Number(kpis.data?.competencia ?? 0))} / meta ${brl(Number(kpis.data?.meta ?? 0))}`} semDado="Sem meta no período" />
          <AtingimentoBar label="Caixa" valor={kpis.data?.atingimento_caixa ?? null} detalhe={`${brl(Number(kpis.data?.caixa ?? 0))} / previsto ${brl(Number(kpis.data?.previsto ?? 0))}`} semDado="Sem previsão no período" />
        </CardContent>
      </Card>

      {/* 4. Variações */}
      <div className="grid gap-4 md:grid-cols-2">
        <VariacaoCard title="vs. período anterior" valor={vars_.data?.var_mes ?? null} atual={vars_.data?.atual ?? null} base={vars_.data?.mes_anterior ?? null} />
        <VariacaoCard title="vs. mesmo período do ano anterior" valor={vars_.data?.var_ano ?? null} atual={vars_.data?.atual ?? null} base={vars_.data?.ano_anterior ?? null} />
      </div>

      {/* 5. Alerta vencidas */}
      <Card style={{ borderColor: AMBER, borderWidth: 2 }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base" style={{ color: AMBER }}>
            <AlertTriangle className="h-5 w-5" /> Comissão vencida por canal — atenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-4" style={{ color: TEXT_DARK }}>{brl(totalVencidas)}</div>
          {(vencidas.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem comissão vencida no período.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vencidas.data as any[]} layout="vertical" margin={{ left: 60, right: 40 }}>
                  <XAxis type="number" hide />
                  <Bar dataKey="comissao_vencida" fill={AMBER} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="comissao_vencida" position="right" formatter={(v: any) => brlCompact(Number(v))} style={{ fontSize: 12, fontWeight: 700, fill: TEXT_DARK }} />
                  </Bar>
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                  <XAxis type="category" dataKey="tipo_de_ramo" hide />
                </BarChart>
              </ResponsiveContainer>
              <ul className="mt-2 text-xs text-muted-foreground grid grid-cols-2 gap-x-4">
                {(vencidas.data as any[]).map((r) => (
                  <li key={r.tipo_de_ramo} className="flex justify-between"><span>{r.tipo_de_ramo}</span><span className="font-medium" style={{ color: TEXT_DARK }}>{brl(Number(r.comissao_vencida))}</span></li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Comparativos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ComparativoCard title={`Receita Competência — ${ano - 1} x ${ano}`} data={compData} anoPrev={ano - 1} anoCur={ano} />
        <ComparativoCard title={`Receita Caixa — ${ano - 1} x ${ano}`} data={caixaCompData} anoPrev={ano - 1} anoCur={ano} />
      </div>

      {/* 7. Detalhamento */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors">
              <span className="font-medium" style={{ color: NAVY }}>Ver detalhamento operacional completo</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-2">
              {/* Combo mensal */}
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>Competência x Caixa x Meta ({ano})</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={serieData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="mes" tick={{ fill: TEXT_DARK, fontSize: 12 }} />
                      <Tooltip formatter={(v: any) => brl(Number(v))} />
                      <Legend />
                      <Bar dataKey="Competência" fill={NAVY} />
                      <Bar dataKey="Caixa" fill={AZUL_VIVO} />
                      <Line type="monotone" dataKey="Meta" stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Multi-ano comparativo */}
              <MultiAnoBlock anosDisp={anos} mesesVisiveis={mesesVisiveis} />

              {/* Canal e Ramo */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>Receita por Canal ({periodoLabel})</h3>
                  <BreakdownList rows={(canal.data ?? []) as any[]} labelKey="canal" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>Receita por Ramo ({periodoLabel})</h3>
                  <BreakdownList rows={(ramo.data ?? []) as any[]} labelKey="ramo" />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */
function AtingimentoBar({ label, valor, detalhe, semDado }: { label: string; valor: number | null; detalhe: string; semDado: string }) {
  if (valor == null || !isFinite(Number(valor))) {
    return (
      <div>
        <div className="flex justify-between text-sm mb-1"><span className="font-medium" style={{ color: TEXT_DARK }}>{label}</span><span className="text-muted-foreground italic">{semDado}</span></div>
        <Progress value={0} className="h-3" />
      </div>
    );
  }
  const v = Number(valor);
  const clamped = Math.min(100, Math.max(0, v * 100));
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium" style={{ color: TEXT_DARK }}>{label}</span>
        <span className="font-bold" style={{ color: NAVY }}>{pct(v)}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: v >= 1 ? GREEN : AZUL_VIVO }} />
      </div>
      <div className="text-xs text-muted-foreground mt-1">{detalhe}</div>
    </div>
  );
}

function VariacaoCard({ title, valor, atual, base }: { title: string; valor: number | null; atual: number | null; base: number | null }) {
  const hasComparacao = valor != null && base != null && Number(base) !== 0;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        {!hasComparacao ? (
          <div className="text-lg font-medium text-muted-foreground italic">Sem dado para comparar</div>
        ) : (
          <div className="flex items-center gap-3">
            {Number(valor) >= 0 ? <TrendingUp className="h-6 w-6" style={{ color: GREEN }} /> : <TrendingDown className="h-6 w-6" style={{ color: RED }} />}
            <div>
              <div className="text-3xl font-bold" style={{ color: Number(valor) >= 0 ? GREEN : RED }}>
                {Number(valor) >= 0 ? "+" : ""}{(Number(valor) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">{brlCompact(Number(atual))} vs {brlCompact(Number(base))}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparativoCard({ title, data, anoPrev, anoCur }: { title: string; data: any[]; anoPrev: number; anoCur: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base" style={{ color: NAVY }}>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 12, bottom: 4, left: 4 }}>
              <XAxis dataKey="mes" tick={{ fill: TEXT_DARK, fontSize: 12 }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
              <Tooltip formatter={(v: any) => brl(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={String(anoPrev)} fill={AZUL_CLARO} radius={[3, 3, 0, 0]}>
                <LabelList dataKey={String(anoPrev)} position="top" formatter={(v: any) => Number(v) > 0 ? brlCompact(Number(v)) : ""} style={{ fontSize: 13, fontWeight: 700, fill: TEXT_DARK }} />
              </Bar>
              <Bar dataKey={String(anoCur)} fill={NAVY} radius={[3, 3, 0, 0]}>
                <LabelList dataKey={String(anoCur)} position="top" formatter={(v: any) => Number(v) > 0 ? brlCompact(Number(v)) : ""} style={{ fontSize: 13, fontWeight: 700, fill: TEXT_DARK }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function MultiAnoBlock({ anosDisp, mesesVisiveis }: { anosDisp: number[]; mesesVisiveis: number[] }) {
  const usados = anosDisp.slice(0, 3);
  const query = useCompAnual(usados);
  const data = useMemo(() => {
    return mesesVisiveis.map((m) => {
      const row: any = { mes: MESES[m - 1] };
      usados.forEach((a) => {
        const found = (query.data ?? []).find((r: any) => r.ano === a && r.mes === m);
        row[String(a)] = Number(found?.competencia ?? 0);
      });
      return row;
    });
  }, [query.data, mesesVisiveis, usados]);
  const cores = [NAVY, AZUL_VIVO, AZUL_CLARO];
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>Comparativo Competência — {usados.join(" x ")}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24 }}>
            <XAxis dataKey="mes" tick={{ fill: TEXT_DARK, fontSize: 12 }} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            {usados.map((a, i) => (
              <Bar key={a} dataKey={String(a)} fill={cores[i]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BreakdownList({ rows, labelKey }: { rows: any[]; labelKey: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  const total = rows.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const v = Number(r.valor ?? 0);
        const p = total > 0 ? (v / total) * 100 : 0;
        return (
          <li key={r[labelKey]}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium" style={{ color: TEXT_DARK }}>{r[labelKey]}</span>
              <span style={{ color: TEXT_DARK }}>{brlCompact(v)} <span className="text-muted-foreground">({p.toFixed(1)}%)</span></span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: NAVY }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
