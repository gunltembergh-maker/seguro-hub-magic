import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { AlertTriangle, Download, TrendingUp, TrendingDown } from "lucide-react";
import * as XLSX from "xlsx";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { SendNewsletterButton } from "@/components/admin/SendNewsletterButton";

export const Route = createFileRoute("/_authenticated/dashboard/report-fechamento")({
  component: ReportFechamento,
});

// Paleta (Master Doc)
const NAVY = "#1F2D3D";
const NAVY_DARK = "#0F1A26";
const GOLD = "#B89968";
const AZUL_MED = "#3A5775";
const VERDE = "#2E7D32";
const VERMELHO = "#C62828";
const AMBER = "#ED6C02";

const CANAIS = ["Benefícios", "Demais Ramos", "Garantia"] as const;
const CANAL_COLOR: Record<string, string> = {
  "Benefícios": AZUL_MED,
  "Demais Ramos": GOLD,
  "Garantia": NAVY,
};
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const BRL = (v: number | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const NUM = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const PCT = (v: number | null | undefined) =>
  `${((Number(v || 0)) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

type Gran = "MENSAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";

const STORAGE_KEY = "fechamento_filtro_v1";

function loadFiltro() {
  if (typeof sessionStorage === "undefined") return null;
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}
function saveFiltro(f: any) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

function periodoLabel(gran: Gran, per: number) {
  if (gran === "MENSAL") return MESES[per - 1];
  if (gran === "TRIMESTRAL") return `${per}º Trimestre`;
  if (gran === "SEMESTRAL") return `${per}º Semestre`;
  return "Ano completo";
}

function periodoOptions(gran: Gran) {
  if (gran === "MENSAL") return Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: MESES[i] }));
  if (gran === "TRIMESTRAL") return [1,2,3,4].map((i) => ({ value: i, label: `${i}T` }));
  if (gran === "SEMESTRAL") return [1,2].map((i) => ({ value: i, label: `${i}S` }));
  return [{ value: 1, label: "Ano" }];
}

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (!anterior) return <span className="text-xs text-muted-foreground">—</span>;
  const d = (atual - anterior) / anterior;
  const pos = d >= 0;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: pos ? VERDE : VERMELHO }}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {PCT(d)}
    </span>
  );
}

function KpiCard({ title, value, delta, loading }: { title: string; value: string; delta?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-32" /> : (
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="text-xl font-bold" style={{ color: NAVY }}>{value}</p>
          {delta}
        </div>
      )}
    </div>
  );
}

function Callout({ ano, gran, per, comparar }: { ano: number; gran: Gran; per: number; comparar: boolean }) {
  return (
    <div className="rounded-md border px-3 py-2 text-sm"
      style={{ background: "#FFF4D6", borderColor: GOLD, color: "#8B6914" }}>
      Período ativo: <strong>{periodoLabel(gran, per)} {ano}</strong>
      {comparar && <> · comparando com <strong>{periodoLabel(gran, per)} {ano - 1}</strong></>}
    </div>
  );
}

function useUltimaAtualizacao() {
  return useQuery({
    queryKey: ["fechamento-ultima-atualizacao"],
    queryFn: async () => {
      const { data } = await supabase.rpc("rpc_lavoro_ultima_atualizacao");
      return data as string | null;
    },
    staleTime: 60_000,
  });
}

function useRpc<T>(name: string, args: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: [name, args],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(name as any, args as any);
      if (error) throw error;
      return data as T;
    },
    enabled,
    staleTime: 60 * 60_000,
  });
}

// ──────────────────────────────────────────────────────────
function ReportFechamento() {
  const saved = loadFiltro();
  const [ano, setAno] = useState<number>(saved?.ano ?? new Date().getFullYear());
  const [gran, setGran] = useState<Gran>((saved?.gran as Gran) ?? "ANUAL");
  const [periodo, setPeriodo] = useState<number>(saved?.periodo ?? 1);
  const [comparar, setComparar] = useState<boolean>(saved?.comparar ?? true);

  useEffect(() => { saveFiltro({ ano, gran, periodo, comparar }); }, [ano, gran, periodo, comparar]);

  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, i) => atual - i);
  }, []);

  const args = { p_ano: ano, p_gran: gran, p_periodo: periodo, p_comparar: comparar };

  const sumario = useRpc<any>("rpc_fechamento_sumario", args);
  const caixaRamo = useRpc<any>("rpc_fechamento_caixa_ramo", args);
  const evolucao = useRpc<any>("rpc_fechamento_evolucao_mensal", args);
  const vencidos = useRpc<any>("rpc_fechamento_vencidos", { p_ano: ano, p_gran: gran, p_periodo: periodo });
  const aReceber = useRpc<any>("rpc_fechamento_a_receber", { p_ano: ano, p_gran: gran, p_periodo: periodo });
  const topTom = useRpc<any>("rpc_fechamento_top_tomadores", args);
  const ultima = useUltimaAtualizacao();

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const meta = [[`Report Fechamento — Lavoro Seguros`], [`Período: ${periodoLabel(gran, periodo)} ${ano}`],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Info");

    if (sumario.data?.atual) {
      const a = sumario.data.atual;
      const ant = sumario.data.anterior ?? {};
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Métrica","Atual","Anterior"],
        ["Prêmio Emitido", a.premio_emitido, ant.premio_emitido ?? 0],
        ["Comissão Bruta", a.comissao_bruta, ant.comissao_bruta ?? 0],
        ["Apólices Emitidas", a.apolices, ant.apolices ?? 0],
        ["Caixa Recebido", a.caixa_recebido, ant.caixa_recebido ?? 0],
        ["Parcelas", a.parcelas, ant.parcelas ?? 0],
        ["Ticket Médio", a.ticket_medio, ant.ticket_medio ?? 0],
      ]), "Sumário");
    }
    if (caixaRamo.data) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(caixaRamo.data.mix_atual ?? []), "Caixa por Ramo");
    if (evolucao.data) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evolucao.data.comissao ?? []), "Evolução Comissão");
    if (vencidos.data) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vencidos.data.por_ano_canal ?? []), "Vencidos");
    if (aReceber.data) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aReceber.data.por_ano_pagamento ?? []), "A Receber");
    if (topTom.data) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topTom.data.atual ?? []), "Top Tomadores");

    XLSX.writeFile(wb, `Lavoro_Seguros_-_Report_Fechamento_${ano}_${gran}_${periodo}.xlsx`);
  };

  const ultimaTs = ultima.data ? new Date(ultima.data) : null;
  const staleAlerta = ultimaTs && (Date.now() - ultimaTs.getTime()) > 24 * 3600_000;

  return (
    <div className="space-y-4 p-6">
      {/* Header + filtro */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Report Fechamento</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada da base gerencial</p>
        </div>
        <div className="flex items-center gap-2">
          <SendNewsletterButton modulo="fechamento_lavoro" ano={ano} mes={gran === "MENSAL" ? periodo : new Date().getMonth() + 1} />
          <Button onClick={exportExcel} className="gap-2" style={{ background: NAVY_DARK }}>
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      {staleAlerta && (
        <div className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" /> Dados desatualizados desde {ultimaTs!.toLocaleString("pt-BR")}
        </div>
      )}

      {/* Filtro global */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <div>
          <label className="text-xs text-muted-foreground">Granularidade</label>
          <Select value={gran} onValueChange={(v) => { setGran(v as Gran); setPeriodo(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MENSAL">Mensal</SelectItem>
              <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
              <SelectItem value="SEMESTRAL">Semestral</SelectItem>
              <SelectItem value="ANUAL">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Ano</label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {gran !== "ANUAL" && (
          <div>
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodoOptions(gran).map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={comparar} onCheckedChange={setComparar} id="cmp" />
          <label htmlFor="cmp" className="text-sm">Comparar com ano anterior</label>
        </div>
        {ultimaTs && (
          <div className="ml-auto pb-2 text-xs text-muted-foreground">
            Última atualização: {ultimaTs.toLocaleString("pt-BR")}
          </div>
        )}
      </div>

      <Tabs defaultValue="sumario">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="sumario">Sumário</TabsTrigger>
          <TabsTrigger value="caixa">Caixa por Ramo</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
          <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
          <TabsTrigger value="areceber">A Receber</TabsTrigger>
          <TabsTrigger value="top">Top Tomadores</TabsTrigger>
          <TabsTrigger value="base">Base</TabsTrigger>
        </TabsList>

        <TabsContent value="sumario" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaSumario data={sumario.data} loading={sumario.isLoading} comparar={comparar} />
        </TabsContent>
        <TabsContent value="caixa" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaCaixaRamo data={caixaRamo.data} loading={caixaRamo.isLoading} />
        </TabsContent>
        <TabsContent value="evolucao" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaEvolucao data={evolucao.data} loading={evolucao.isLoading} ano={ano} />
        </TabsContent>
        <TabsContent value="vencidos" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaVencidos data={vencidos.data} loading={vencidos.isLoading} />
        </TabsContent>
        <TabsContent value="areceber" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaAReceber data={aReceber.data} loading={aReceber.isLoading} />
        </TabsContent>
        <TabsContent value="top" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaTopTomadores data={topTom.data} loading={topTom.isLoading} comparar={comparar} />
        </TabsContent>
        <TabsContent value="base" className="space-y-4 pt-4">
          <Callout ano={ano} gran={gran} per={periodo} comparar={comparar} />
          <AbaBase ano={ano} gran={gran} periodo={periodo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Abas ───────────────────────────────────────────────────────────────

function AbaSumario({ data, loading, comparar }: { data: any; loading: boolean; comparar: boolean }) {
  const a = data?.atual ?? {};
  const ant = data?.anterior ?? {};
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>Visão Emissão (competência)</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiCard title="Prêmio Emitido" value={BRL(a.premio_emitido)} loading={loading}
            delta={comparar && <Delta atual={a.premio_emitido || 0} anterior={ant.premio_emitido || 0} />} />
          <KpiCard title="Comissão Bruta" value={BRL(a.comissao_bruta)} loading={loading}
            delta={comparar && <Delta atual={a.comissao_bruta || 0} anterior={ant.comissao_bruta || 0} />} />
          <KpiCard title="Apólices Emitidas" value={NUM(a.apolices)} loading={loading}
            delta={comparar && <Delta atual={a.apolices || 0} anterior={ant.apolices || 0} />} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>Visão Caixa (recebido)</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiCard title="Caixa Recebido" value={BRL(a.caixa_recebido)} loading={loading}
            delta={comparar && <Delta atual={a.caixa_recebido || 0} anterior={ant.caixa_recebido || 0} />} />
          <KpiCard title="Parcelas" value={NUM(a.parcelas)} loading={loading}
            delta={comparar && <Delta atual={a.parcelas || 0} anterior={ant.parcelas || 0} />} />
          <KpiCard title="Ticket Médio" value={BRL(a.ticket_medio)} loading={loading}
            delta={comparar && <Delta atual={a.ticket_medio || 0} anterior={ant.ticket_medio || 0} />} />
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Comparativo por Ramo</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Comissão atual</TableHead>
              {comparar && <TableHead className="text-right">Comissão anterior</TableHead>}
              {comparar && <TableHead className="text-right">Δ %</TableHead>}
              <TableHead className="text-right">Caixa atual</TableHead>
              {comparar && <TableHead className="text-right">Caixa anterior</TableHead>}
              {comparar && <TableHead className="text-right">Δ %</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CANAIS.map((canal) => {
              const at = (a.ramos ?? []).find((r: any) => r.canal === canal) ?? { comissao: 0, caixa: 0 };
              const an = (ant.ramos ?? []).find((r: any) => r.canal === canal) ?? { comissao: 0, caixa: 0 };
              return (
                <TableRow key={canal}>
                  <TableCell className="font-medium">{canal}</TableCell>
                  <TableCell className="text-right">{BRL(at.comissao)}</TableCell>
                  {comparar && <TableCell className="text-right">{BRL(an.comissao)}</TableCell>}
                  {comparar && <TableCell className="text-right"><Delta atual={at.comissao} anterior={an.comissao} /></TableCell>}
                  <TableCell className="text-right">{BRL(at.caixa)}</TableCell>
                  {comparar && <TableCell className="text-right">{BRL(an.caixa)}</TableCell>}
                  {comparar && <TableCell className="text-right"><Delta atual={at.caixa} anterior={an.caixa} /></TableCell>}
                </TableRow>
              );
            })}
            <TableRow style={{ background: "#F5F7FA", fontWeight: 600 }}>
              <TableCell>TOTAL</TableCell>
              <TableCell className="text-right">{BRL((a.ramos ?? []).reduce((s: number, r: any) => s + Number(r.comissao || 0), 0))}</TableCell>
              {comparar && <TableCell className="text-right">{BRL((ant.ramos ?? []).reduce((s: number, r: any) => s + Number(r.comissao || 0), 0))}</TableCell>}
              {comparar && <TableCell />}
              <TableCell className="text-right">{BRL((a.ramos ?? []).reduce((s: number, r: any) => s + Number(r.caixa || 0), 0))}</TableCell>
              {comparar && <TableCell className="text-right">{BRL((ant.ramos ?? []).reduce((s: number, r: any) => s + Number(r.caixa || 0), 0))}</TableCell>}
              {comparar && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>Pipeline A Receber</h3>
        {data?.pipeline ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <KpiCard title="Total a Receber" value={BRL(data.pipeline.total)} />
            <KpiCard title="Apólices no Pipeline" value={NUM(data.pipeline.apolices)} />
          </div>
        ) : <Skeleton className="h-16 w-full" />}
      </section>

      <p className="text-xs italic text-muted-foreground">
        Emissões hoje agrupadas por canal. Em breve serão segmentadas por Área e Finder.
      </p>
    </div>
  );
}

function AbaCaixaRamo({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;
  const mix: any[] = data.mix_atual ?? [];
  const mixAnt: any[] = data.mix_anterior ?? [];
  const total = mix.reduce((s, r) => s + Number(r.caixa || 0), 0);
  const totalAnt = mixAnt.reduce((s, r) => s + Number(r.caixa || 0), 0);

  const evol: any[] = data.evolucao_mensal ?? [];
  const evolChart = MESES.map((m, i) => {
    const linha: any = { mes: m };
    CANAIS.forEach((c) => {
      linha[c] = evol.filter((e) => e.mes === i + 1 && e.canal === c).reduce((s, r) => s + Number(r.caixa || 0), 0);
    });
    return linha;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {CANAIS.map((c) => {
          const r = mix.find((x) => x.canal === c) ?? { caixa: 0 };
          const ra = mixAnt.find((x) => x.canal === c) ?? { caixa: 0 };
          return (
            <KpiCard key={c} title={c} value={BRL(r.caixa)} delta={<Delta atual={r.caixa} anterior={ra.caixa} />} />
          );
        })}
      </div>
      <KpiCard title="Caixa Total" value={BRL(total)} delta={<Delta atual={total} anterior={totalAnt} />} />

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Mix de Caixa por Ramo</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Parcelas</TableHead>
              <TableHead className="text-right">Caixa atual</TableHead>
              <TableHead className="text-right">% Mix</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead className="text-right">Caixa anterior</TableHead>
              <TableHead className="text-right">Δ %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CANAIS.map((c) => {
              const r = mix.find((x) => x.canal === c) ?? { parcelas: 0, caixa: 0, ticket: 0 };
              const ra = mixAnt.find((x) => x.canal === c) ?? { caixa: 0 };
              return (
                <TableRow key={c}>
                  <TableCell>{c}</TableCell>
                  <TableCell className="text-right">{NUM(r.parcelas)}</TableCell>
                  <TableCell className="text-right">{BRL(r.caixa)}</TableCell>
                  <TableCell className="text-right">{PCT(total ? r.caixa / total : 0)}</TableCell>
                  <TableCell className="text-right">{BRL(r.ticket)}</TableCell>
                  <TableCell className="text-right">{BRL(ra.caixa)}</TableCell>
                  <TableCell className="text-right"><Delta atual={r.caixa} anterior={ra.caixa} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <PieRamo title="Mix período atual" data={mix} />
        <PieRamo title="Mix período anterior" data={mixAnt} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Composição mensal por canal</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={evolChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF1" />
            <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => BRL(v)} width={110} />
            <Tooltip formatter={(v: any) => BRL(v)} /><Legend />
            {CANAIS.map((c) => <Bar key={c} dataKey={c} stackId="a" fill={CANAL_COLOR[c]} />)}
          </BarChart>
        </ResponsiveContainer>
      </section>

      <TopTable title="Top 15 Tomadores — período atual" rows={data.top_atual ?? []} campo="caixa" />
      <TopTable title="Top 15 Tomadores — período anterior" rows={data.top_anterior ?? []} campo="caixa" />
    </div>
  );
}

function PieRamo({ title, data }: { title: string; data: any[] }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h4 className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="caixa" nameKey="canal" outerRadius={80} label={(e: any) => e.canal}>
            {(data ?? []).map((d, i) => <Cell key={i} fill={CANAL_COLOR[d.canal] ?? "#999"} />)}
          </Pie>
          <Tooltip formatter={(v: any) => BRL(v)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopTable({ title, rows, campo }: { title: string; rows: any[]; campo: string }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead><TableHead>Tomador</TableHead>
            <TableHead>Canal</TableHead><TableHead className="text-right">Apólices</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rows ?? []).map((r, i) => (
            <TableRow key={i}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{r.nome ?? r.tomador}</TableCell>
              <TableCell>{r.canal}</TableCell>
              <TableCell className="text-right">{NUM(r.apolices)}</TableCell>
              <TableCell className="text-right">{BRL(r[campo])}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function AbaEvolucao({ data, loading, ano }: { data: any; loading: boolean; ano: number }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const meses: number[] = data.meses ?? [];

  const buildSerie = (rows: any[]) => meses.map((m) => {
    const linha: any = { mes: MESES[m - 1] };
    [ano, ano - 1].forEach((a) => {
      linha[String(a)] = rows.filter((r) => r.mes === m && r.ano === a).reduce((s, r) => s + Number(r.valor || 0), 0);
    });
    return linha;
  });

  const blocos = [
    { titulo: "Comissão Bruta Emitida (Competência)", rows: data.comissao ?? [], fmt: BRL, kind: "money" as const },
    { titulo: "Caixa Recebido (Status Paga)", rows: data.caixa ?? [], fmt: BRL, kind: "money" as const },
    { titulo: "Apólices Emitidas", rows: data.apolices ?? [], fmt: NUM, kind: "count" as const },
  ];

  const getValor = (rows: any[], a: number, m: number, c: string) =>
    rows.filter((r: any) => r.ano === a && r.mes === m && r.canal === c).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);

  return (
    <div className="space-y-6">
      {blocos.map((b) => {
        const serie = buildSerie(b.rows);
        const anoAnt = ano - 1;
        // Totais por canal (YTD) e totais mês/YoY
        const totalCanalAno = (c: string, a: number) => b.rows.filter((r: any) => r.canal === c && r.ano === a).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
        const totalMesAno = (m: number, a: number) => CANAIS.reduce((s, c) => s + getValor(b.rows, a, m, c), 0);
        return (
          <section key={b.titulo} className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>{b.titulo}</h3>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2}>Mês</TableHead>
                    <TableHead colSpan={3} className="text-center border-l" style={{ background: "#F5F7FA" }}>{anoAnt}</TableHead>
                    <TableHead colSpan={3} className="text-center border-l" style={{ background: "#EEF2F7" }}>{ano}</TableHead>
                    <TableHead colSpan={3} className="text-center border-l">Δ % YoY por canal</TableHead>
                    <TableHead colSpan={3} className="text-center border-l" style={{ background: "#F5F7FA" }}>Totais mês</TableHead>
                  </TableRow>
                  <TableRow>
                    {CANAIS.map((c) => <TableHead key={`a-${c}`} className="text-right text-xs">{c}</TableHead>)}
                    {CANAIS.map((c) => <TableHead key={`b-${c}`} className="text-right text-xs">{c}</TableHead>)}
                    {CANAIS.map((c) => <TableHead key={`d-${c}`} className="text-right text-xs">{c}</TableHead>)}
                    <TableHead className="text-right text-xs">Tot {anoAnt}</TableHead>
                    <TableHead className="text-right text-xs">Tot {ano}</TableHead>
                    <TableHead className="text-right text-xs">Δ %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meses.map((m) => {
                    const tAnt = totalMesAno(m, anoAnt);
                    const tAtu = totalMesAno(m, ano);
                    const dTot = tAnt ? (tAtu - tAnt) / tAnt : null;
                    return (
                      <TableRow key={m}>
                        <TableCell className="font-medium">{MESES[m - 1]}</TableCell>
                        {CANAIS.map((c) => <TableCell key={`ra-${c}`} className="text-right">{b.fmt(getValor(b.rows, anoAnt, m, c))}</TableCell>)}
                        {CANAIS.map((c) => <TableCell key={`rb-${c}`} className="text-right">{b.fmt(getValor(b.rows, ano, m, c))}</TableCell>)}
                        {CANAIS.map((c) => {
                          const va = getValor(b.rows, anoAnt, m, c);
                          const vb = getValor(b.rows, ano, m, c);
                          return <TableCell key={`rd-${c}`} className="text-right"><Delta atual={vb} anterior={va} /></TableCell>;
                        })}
                        <TableCell className="text-right">{b.fmt(tAnt)}</TableCell>
                        <TableCell className="text-right font-semibold">{b.fmt(tAtu)}</TableCell>
                        <TableCell className="text-right">
                          {dTot === null ? <span className="text-xs text-muted-foreground">—</span> :
                            <span className="text-xs font-semibold" style={{ color: dTot >= 0 ? VERDE : VERMELHO }}>{PCT(dTot)}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow style={{ background: "#F5F7FA", fontWeight: 600 }}>
                    <TableCell>TOTAL YTD</TableCell>
                    {CANAIS.map((c) => <TableCell key={`ta-${c}`} className="text-right">{b.fmt(totalCanalAno(c, anoAnt))}</TableCell>)}
                    {CANAIS.map((c) => <TableCell key={`tb-${c}`} className="text-right">{b.fmt(totalCanalAno(c, ano))}</TableCell>)}
                    {CANAIS.map((c) => {
                      const va = totalCanalAno(c, anoAnt);
                      const vb = totalCanalAno(c, ano);
                      return <TableCell key={`td-${c}`} className="text-right"><Delta atual={vb} anterior={va} /></TableCell>;
                    })}
                    <TableCell className="text-right">{b.fmt(CANAIS.reduce((s, c) => s + totalCanalAno(c, anoAnt), 0))}</TableCell>
                    <TableCell className="text-right">{b.fmt(CANAIS.reduce((s, c) => s + totalCanalAno(c, ano), 0))}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const va = CANAIS.reduce((s, c) => s + totalCanalAno(c, anoAnt), 0);
                        const vb = CANAIS.reduce((s, c) => s + totalCanalAno(c, ano), 0);
                        const d = va ? (vb - va) / va : null;
                        return d === null ? "—" : <span className="text-xs font-semibold" style={{ color: d >= 0 ? VERDE : VERMELHO }}>{PCT(d)}</span>;
                      })()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="mt-4">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF1" />
                  <XAxis dataKey="mes" /><YAxis width={110} tickFormatter={(v) => b.kind === "money" ? BRL(v) : NUM(v)} />
                  <Tooltip formatter={(v: any) => b.kind === "money" ? BRL(v) : NUM(v)} /><Legend />
                  <Line type="monotone" dataKey={String(anoAnt)} stroke={AZUL_MED} strokeWidth={2} />
                  <Line type="monotone" dataKey={String(ano)} stroke={GOLD} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AbaVencidos({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;
  const porAno = data.por_ano_canal ?? [];
  const anos = Array.from(new Set(porAno.map((r: any) => r.ano_venc))) as string[];
  const aging = data.aging ?? [];
  const faixas = ["1-30","31-60","61-90","91-180","180+"];

  return (
    <div className="space-y-4">
      <Callout ano={0} gran={"ANUAL"} per={1} comparar={false} />
      <p className="text-xs italic text-muted-foreground">Snapshot em {new Date(data.snapshot).toLocaleDateString("pt-BR")}</p>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Vencidos por Ano de Vencimento × Canal</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              {CANAIS.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Apólices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anos.map((a) => {
              const totais = CANAIS.map((c) => porAno.find((x: any) => x.ano_venc === a && x.canal === c)?.saldo ?? 0);
              const totalLinha = totais.reduce((s, v) => s + Number(v), 0);
              const apolices = porAno.filter((x: any) => x.ano_venc === a).reduce((s: number, x: any) => s + Number(x.apolices || 0), 0);
              return (
                <TableRow key={a}>
                  <TableCell>{a}</TableCell>
                  {totais.map((t, i) => <TableCell key={i} className="text-right">{BRL(t)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{BRL(totalLinha)}</TableCell>
                  <TableCell className="text-right">{NUM(apolices)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Aging por Faixa × Canal</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faixa (dias)</TableHead>
              {CANAIS.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faixas.map((f) => {
              const totais = CANAIS.map((c) => aging.find((x: any) => x.faixa === f && x.canal === c)?.saldo ?? 0);
              const tot = totais.reduce((s, v) => s + Number(v), 0);
              return (
                <TableRow key={f}>
                  <TableCell>{f}</TableCell>
                  {totais.map((t, i) => <TableCell key={i} className="text-right">{BRL(t)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{BRL(tot)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <TopTable title="Top 10 Inadimplentes" rows={data.top_inadimplentes ?? []} campo="saldo" />
    </div>
  );
}

function AbaAReceber({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const porAno = data.por_ano_pagamento ?? [];
  const anosPagto = Array.from(new Set(porAno.map((r: any) => r.ano))) as number[];
  anosPagto.sort();
  const porSafra = data.por_safra ?? [];
  const safras = Array.from(new Set(porSafra.map((r: any) => r.ano_emissao))) as number[];
  safras.sort();

  const proxSem = data.proximo_semestre ?? [];
  const mesesSem = Array.from(new Set(proxSem.map((r: any) => `${r.ano}-${String(r.mes).padStart(2,"0")}`))) as string[];
  mesesSem.sort();

  return (
    <div className="space-y-4">
      <p className="text-xs italic text-muted-foreground">
        Snapshot em {new Date(data.snapshot).toLocaleDateString("pt-BR")} · Considera parcelas A Vencer &gt; {new Date(data.cutoff).toLocaleDateString("pt-BR")}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard title="Total a Receber" value={BRL(data.total?.valor)} />
        <KpiCard title="Apólices" value={NUM(data.total?.apolices)} />
        <KpiCard title="Parcelas" value={NUM(data.total?.parcelas)} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Por Ano de Pagamento Previsto</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              {CANAIS.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anosPagto.map((a) => {
              const totais = CANAIS.map((c) => porAno.find((x: any) => x.ano === a && x.canal === c)?.valor ?? 0);
              const tot = totais.reduce((s, v) => s + Number(v), 0);
              return (
                <TableRow key={a}>
                  <TableCell>{a}</TableCell>
                  {totais.map((t, i) => <TableCell key={i} className="text-right">{BRL(t)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{BRL(tot)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Próximo semestre — detalhamento mensal</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              {CANAIS.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mesesSem.map((mk) => {
              const [ay, mm] = mk.split("-").map(Number);
              const totais = CANAIS.map((c) => proxSem.find((x: any) => x.ano === ay && x.mes === mm && x.canal === c)?.valor ?? 0);
              const tot = totais.reduce((s, v) => s + Number(v), 0);
              return (
                <TableRow key={mk}>
                  <TableCell>{MESES[mm - 1]}/{ay}</TableCell>
                  {totais.map((t, i) => <TableCell key={i} className="text-right">{BRL(t)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{BRL(tot)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Por Safra (Ano de Emissão)</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano emissão</TableHead>
              {CANAIS.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safras.map((a) => {
              const totais = CANAIS.map((c) => porSafra.find((x: any) => x.ano_emissao === a && x.canal === c)?.valor ?? 0);
              const tot = totais.reduce((s, v) => s + Number(v), 0);
              return (
                <TableRow key={a}>
                  <TableCell>{a}</TableCell>
                  {totais.map((t, i) => <TableCell key={i} className="text-right">{BRL(t)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{BRL(tot)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <TopTable title="Top 10 Tomadores a Receber" rows={data.top_tomadores ?? []} campo="valor" />
    </div>
  );
}

function AbaTopTomadores({ data, loading, comparar }: { data: any; loading: boolean; comparar: boolean }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;
  const render = (rows: any[], titulo: string) => (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>{titulo}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead><TableHead>Tomador</TableHead><TableHead>Canal</TableHead>
            <TableHead className="text-right">Apólices</TableHead>
            <TableHead className="text-right">Prêmio</TableHead>
            <TableHead className="text-right">Comissão Bruta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rows ?? []).map((r, i) => (
            <TableRow key={i}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{r.nome}</TableCell>
              <TableCell>{r.canal}</TableCell>
              <TableCell className="text-right">{NUM(r.apolices)}</TableCell>
              <TableCell className="text-right">{BRL(r.premio)}</TableCell>
              <TableCell className="text-right">{BRL(r.comissao)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
  return (
    <div className="space-y-4">
      {render(data.atual, "Top 20 — Período atual")}
      {comparar && render(data.anterior, "Top 20 — Período anterior")}
      <p className="text-xs italic text-muted-foreground">'Apólices' = nº de apólices distintas, não parcelas.</p>
    </div>
  );
}

function AbaBase({ ano, gran, periodo }: { ano: number; gran: Gran; periodo: number }) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useRpc<any>("rpc_fechamento_base", { p_ano: ano, p_gran: gran, p_periodo: periodo, p_pagina: pagina, p_tamanho: 100 });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const linhas: any[] = data?.linhas ?? [];
  const total = data?.total ?? 0;
  const totalPag = Math.max(1, Math.ceil(total / 100));

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Base — {NUM(total)} linhas</h3>
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span>Página {pagina} de {totalPag}</span>
          <Button size="sm" variant="outline" disabled={pagina >= totalPag} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tomador</TableHead><TableHead>Segurado</TableHead>
              <TableHead>Apólice</TableHead><TableHead>Canal</TableHead>
              <TableHead>Seguradora</TableHead><TableHead>Emissão</TableHead>
              <TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Prêmio</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">A Receber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.tomador}</TableCell>
                <TableCell>{l.segurado}</TableCell>
                <TableCell>{l.numero_apolice}</TableCell>
                <TableCell>{l.canal}</TableCell>
                <TableCell>{l.seguradora}</TableCell>
                <TableCell>{l.data_emissao ? new Date(l.data_emissao).toLocaleDateString("pt-BR") : ""}</TableCell>
                <TableCell>{l.data_pagamento ? new Date(l.data_pagamento).toLocaleDateString("pt-BR") : ""}</TableCell>
                <TableCell>{l.status_parcela_comissao}</TableCell>
                <TableCell className="text-right">{BRL(l.premio_parcela)}</TableCell>
                <TableCell className="text-right">{BRL(l.comissao_bruta)}</TableCell>
                <TableCell className="text-right">{BRL(l.valor_recebido_a_receber)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
