import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChevronRight, Clock, Filter, RefreshCw, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { TailorFrame } from "@/components/layout/TailorFrame";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentoMask } from "@/lib/lgpd";
import { useAuth } from "@/hooks/useAuth";
import { GerencialApolicesOnboardingModal } from "@/components/relatorios/GerencialApolicesOnboardingModal";

// ─── Helpers ────────────────────────────────────────────────────────────
const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const fmtTs = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type FiltrosState = {
  ano: number | null;
  mes: number | null;
  status: string | null;
  seguradora: string | null;
  tipo_ramo: string | null;
  tomador: string | null;
  apolice: string | null;
  grupo: string | null;
  ramo: string | null;
  possui_repasse: string | null;
  status_repasse: string | null;
};

const FILTROS_INICIAIS: FiltrosState = {
  ano: null,
  mes: null,
  status: null,
  seguradora: null,
  tipo_ramo: null,
  tomador: null,
  apolice: null,
  grupo: null,
  ramo: null,
  possui_repasse: null,
  status_repasse: null,
};

const TAMANHO_PAGINA = 100;

// ─── PbiCard ────────────────────────────────────────────────────────────
function PbiCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className ?? ""}`}>
      <div className="px-3 py-1.5 border-b border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{title}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: (string | number)[];
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[#DFDBBE]/70">{label}</label>
      <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? null : v)}>
        <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 text-[#DFDBBE] mt-0.5">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="__all">Todos</SelectItem>
          {(options || []).filter(Boolean).map((o) => (
            <SelectItem key={String(o)} value={String(o)}>
              {String(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────
export default function RelatorioGerencialApolices() {
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(1);
  const maskDoc = useDocumentoMask();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    const key = `gerencial_apolices_onboarding_${user.id}`;
    if (!localStorage.getItem(key)) setShowOnboarding(true);
  }, [user?.id]);
  const handleCloseOnboarding = () => {
    if (user?.id) localStorage.setItem(`gerencial_apolices_onboarding_${user.id}`, "1");
    setShowOnboarding(false);
  };

  const setF = <K extends keyof FiltrosState>(k: K, v: FiltrosState[K]) => {
    setFiltros((prev) => ({ ...prev, [k]: v }));
    setPagina(1);
  };

  // ─── Filtros disponíveis ─────────────────────────────────────────────
  const filtrosOptsQ = useQuery({
    queryKey: ["lavoro-apolices-filtros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_apolices_filtros" as any);
      if (error) throw error;
      return (data?.[0] ?? null) as {
        status_parcela_comissao: string[];
        seguradoras: string[];
        tipos_ramo: string[];
        tomadores: string[];
        apolices: string[];
        grupos: string[];
        ramos: string[];
        status_repasse: string[];
        anos: number[];
      } | null;
    },
  });

  const filtrosJson = useMemo(() => filtros as any, [filtros]);

  // ─── KPIs ────────────────────────────────────────────────────────────
  const kpisQ = useQuery({
    queryKey: ["lavoro-apolices-kpis", filtros],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_apolices_kpis" as any, {
        p_status: filtros.status,
        p_seguradora: filtros.seguradora,
        p_tipo_ramo: filtros.tipo_ramo,
        p_tomador: filtros.tomador,
        p_apolice: filtros.apolice,
        p_grupo: filtros.grupo,
        p_ramo: filtros.ramo,
        p_possui_repasse: filtros.possui_repasse,
        p_ano: filtros.ano,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        premio_total: number;
        comissao_emitida: number;
        comissao_gerada: number;
        repasse_parceiro: number;
        comissao_menos_repasse: number;
      } | null;
    },
  });

  // ─── Por seguradora ──────────────────────────────────────────────────
  const porSeguradoraQ = useQuery({
    queryKey: ["lavoro-apolices-seguradora", filtros],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_apolices_por_seguradora" as any, {
        p_filtros: filtrosJson,
      });
      if (error) throw error;
      return (data || []) as Array<{ seguradora: string; comissao_bruta: number; premio_total: number }>;
    },
  });

  // ─── Previsão por dezena ─────────────────────────────────────────────
  const previsaoQ = useQuery({
    queryKey: ["lavoro-apolices-previsao", filtros.ano, filtros.mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_apolices_previsao_dezena" as any, {
        p_ano: filtros.ano,
        p_mes: filtros.mes,
      });
      if (error) throw error;
      return (data || []) as Array<{
        ano: number;
        mes: number;
        dezena: string;
        empresa_faturada: string;
        valor_a_receber: number;
      }>;
    },
  });

  // ─── Lista paginada ──────────────────────────────────────────────────
  const listaQ = useQuery({
    queryKey: ["lavoro-apolices-lista", filtros, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_apolices_lista" as any, {
        p_filtros: filtrosJson,
        p_pagina: pagina,
        p_tamanho_pagina: TAMANHO_PAGINA,
      });
      if (error) throw error;
      return (data || []) as Array<{
        tomador: string;
        segurado: string;
        documento: string;
        numero_apolice: string;
        seguradora: string;
        ramo: string;
        tipo_de_ramo: string;
        comissao_bruta: number;
        status_parcela_comissao: string;
        data_emissao: string;
        total_linhas: number;
      }>;
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

  const isRefreshing = kpisQ.isFetching || porSeguradoraQ.isFetching || listaQ.isFetching || previsaoQ.isFetching;
  const handleRefresh = async () => {
    await Promise.all([
      kpisQ.refetch(),
      porSeguradoraQ.refetch(),
      listaQ.refetch(),
      previsaoQ.refetch(),
      filtrosOptsQ.refetch(),
      ultimaAtQ.refetch(),
    ]);
    toast.success("Dados atualizados");
  };

  const totalLinhas = Number(listaQ.data?.[0]?.total_linhas || 0);
  const totalPaginas = Math.max(1, Math.ceil(totalLinhas / TAMANHO_PAGINA));
  const opts = filtrosOptsQ.data;
  const kpis = kpisQ.data;

  // Janela de 4 meses (mês âncora + 3 seguintes) para o card de Previsão
  const previsaoJanela = useMemo(() => {
    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const anoAnc = filtros.ano ?? nowBRT.getFullYear();
    const mesAnc = filtros.mes ?? (nowBRT.getMonth() + 1);
    const inicio = new Date(anoAnc, mesAnc - 1, 1);
    const fim = new Date(anoAnc, mesAnc - 1 + 3, 1);
    const mesmoAno = inicio.getFullYear() === fim.getFullYear();
    return mesmoAno
      ? `${MESES[inicio.getMonth()]} a ${MESES[fim.getMonth()]}/${fim.getFullYear()}`
      : `${MESES[inicio.getMonth()]}/${inicio.getFullYear()} a ${MESES[fim.getMonth()]}/${fim.getFullYear()}`;
  }, [filtros.ano, filtros.mes]);

  return (
    <AppLayout>
      <style>{`
        .lavoro-apolices { font-family: 'Source Sans 3', system-ui, sans-serif; color: #0A2337; }
        .lavoro-apolices .title-serif { font-family: 'DM Serif Display', 'Playfair Display', Georgia, serif; font-weight: 400; color: #DFDBBE; }
      `}</style>
      <TailorFrame>
        <GerencialApolicesOnboardingModal open={showOnboarding} onClose={handleCloseOnboarding} />
        <div className="lavoro-apolices">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="title-serif flex items-center gap-2" style={{ fontSize: 32, letterSpacing: "-0.5px", margin: 0 }}>
                Gerencial de Apólices
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="text-[#DFDBBE]/60 hover:text-[#DFDBBE] transition-colors"
                  title="Ver tutorial novamente"
                  aria-label="Ver tutorial novamente"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </h1>
              <ChevronRight className="h-4 w-4 text-[#DFDBBE]/40" />
              <span className="text-[18px] font-normal text-[#DFDBBE]/70">Lavoro Seguros</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs flex items-center gap-1 text-[#DFDBBE]/80">
                <Clock className="h-3 w-3 text-[#73A7B7]" />
                Dados atualizados em: {fmtTs(ultimaAtQ.data)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1 border-[#DFDBBE]/30 text-[#DFDBBE] bg-transparent hover:bg-white/10 hover:text-[#DFDBBE]"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar Dados
              </Button>
            </div>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "260px 1fr" }}>
            {/* Sidebar de filtros */}
            <aside className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2 h-fit sticky top-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-3.5 w-3.5 text-[#73A7B7]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[#DFDBBE]">Filtros</p>
              </div>
              <FilterSelect label="Ano" value={filtros.ano ? String(filtros.ano) : null} onChange={(v) => setF("ano", v ? Number(v) : null)} options={opts?.anos || []} />
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#DFDBBE]/70">Mês</label>
                <Select value={filtros.mes ? String(filtros.mes) : "__all"} onValueChange={(v) => setF("mes", v === "__all" ? null : Number(v))}>
                  <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 text-[#DFDBBE] mt-0.5">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__all">Todos</SelectItem>
                    {MESES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FilterSelect label="Status da parcela" value={filtros.status} onChange={(v) => setF("status", v)} options={opts?.status_parcela_comissao || []} />
              <FilterSelect label="Seguradora" value={filtros.seguradora} onChange={(v) => setF("seguradora", v)} options={opts?.seguradoras || []} />
              <FilterSelect label="Tipo de Ramo" value={filtros.tipo_ramo} onChange={(v) => setF("tipo_ramo", v)} options={opts?.tipos_ramo || []} />
              <FilterSelect label="Tomador" value={filtros.tomador} onChange={(v) => setF("tomador", v)} options={opts?.tomadores || []} />
              <FilterSelect label="Nº Apólice" value={filtros.apolice} onChange={(v) => setF("apolice", v)} options={opts?.apolices || []} />
              <FilterSelect label="Grupo" value={filtros.grupo} onChange={(v) => setF("grupo", v)} options={opts?.grupos || []} />
              <FilterSelect label="Ramo" value={filtros.ramo} onChange={(v) => setF("ramo", v)} options={opts?.ramos || []} />
              <FilterSelect label="Possui repasse" value={filtros.possui_repasse} onChange={(v) => setF("possui_repasse", v)} options={["Sim", "Não"]} />
              <FilterSelect label="Status do repasse" value={filtros.status_repasse} onChange={(v) => setF("status_repasse", v)} options={opts?.status_repasse || []} />

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs border-[#DFDBBE]/30 text-[#DFDBBE] bg-transparent hover:bg-white/10 hover:text-[#DFDBBE]"
                onClick={() => { setFiltros(FILTROS_INICIAIS); setPagina(1); }}
              >
                Limpar filtros
              </Button>
            </aside>

            {/* Conteúdo principal */}
            <div className="space-y-4 min-w-0">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MetricCard title="Prêmio Total" value={BRL(kpis?.premio_total)} loading={kpisQ.isLoading} />
                <MetricCard title="Comissão Emitida" value={BRL(kpis?.comissao_emitida)} loading={kpisQ.isLoading} />
                <MetricCard title="Comissão Gerada" value={BRL(kpis?.comissao_gerada)} loading={kpisQ.isLoading} />
                <MetricCard title="Repasse Parceiro" value={BRL(kpis?.repasse_parceiro)} loading={kpisQ.isLoading} />
                <MetricCard title="Comissão (−) Repasse" value={BRL(kpis?.comissao_menos_repasse)} loading={kpisQ.isLoading} />
              </div>

              {/* Comissão por seguradora */}
              <PbiCard title="Comissão Bruta por Seguradora" subtitle={porSeguradoraQ.isFetching ? "Atualizando…" : ""}>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={porSeguradoraQ.data || []} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="seguradora" type="category" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip formatter={(v: any) => BRL(Number(v))} />
                      <Bar dataKey="comissao_bruta" fill="#0A2337" name="Comissão Bruta" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </PbiCard>

              {/* Previsão dezena */}
              <PbiCard title={`Previsão de Recebimento — ${previsaoJanela}`} subtitle="Janela de 4 meses a partir do mês filtrado">
                <div className="max-h-72 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ano</TableHead>
                        <TableHead>Mês</TableHead>
                        <TableHead>Dezena</TableHead>
                        <TableHead>Empresa Faturada</TableHead>
                        <TableHead className="text-right">Valor a Receber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(previsaoQ.data || []).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.ano}</TableCell>
                          <TableCell>{MESES[(r.mes || 1) - 1]}</TableCell>
                          <TableCell>{r.dezena}</TableCell>
                          <TableCell className="truncate max-w-[220px]">{r.empresa_faturada}</TableCell>
                          <TableCell className="text-right font-mono">{BRL(r.valor_a_receber)}</TableCell>
                        </TableRow>
                      ))}
                      {(!previsaoQ.data || previsaoQ.data.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-gray-400 py-4">
                            Sem dados de previsão.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </PbiCard>

              {/* Grade */}
              <PbiCard
                title="Apólices"
                subtitle={
                  listaQ.isLoading
                    ? "Carregando…"
                    : `${totalLinhas.toLocaleString("pt-BR")} linhas — página ${pagina}/${totalPaginas}`
                }
              >
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tomador</TableHead>
                        <TableHead>Segurado</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Nº Apólice</TableHead>
                        <TableHead>Seguradora</TableHead>
                        <TableHead>Ramo</TableHead>
                        <TableHead>Tipo de Ramo</TableHead>
                        <TableHead className="text-right">Comissão Bruta</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(listaQ.data || []).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="truncate max-w-[180px]">{r.tomador}</TableCell>
                          <TableCell className="truncate max-w-[180px]">{r.segurado}</TableCell>
                          <TableCell className="font-mono text-xs">{maskDoc(r.documento)}</TableCell>
                          <TableCell className="font-mono text-xs">{r.numero_apolice}</TableCell>
                          <TableCell>{r.seguradora}</TableCell>
                          <TableCell>{r.ramo}</TableCell>
                          <TableCell>{r.tipo_de_ramo}</TableCell>
                          <TableCell className="text-right font-mono">{BRL(r.comissao_bruta)}</TableCell>
                          <TableCell>{r.status_parcela_comissao}</TableCell>
                        </TableRow>
                      ))}
                      {!listaQ.isLoading && (listaQ.data || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-xs text-gray-400 py-4">
                            Nenhuma apólice encontrada.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between mt-2 px-1 text-xs text-gray-500">
                  <span>
                    Exibindo {(listaQ.data || []).length} de {totalLinhas.toLocaleString("pt-BR")}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pagina <= 1 || listaQ.isFetching}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="px-2">
                      {pagina}/{totalPaginas}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pagina >= totalPaginas || listaQ.isFetching}
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </PbiCard>
            </div>
          </div>
        </div>
      </TailorFrame>
    </AppLayout>
  );
}
