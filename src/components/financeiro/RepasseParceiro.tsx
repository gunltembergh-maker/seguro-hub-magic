import { useEffect, useMemo, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";
import ExportacaoBloqueada from "@/components/financeiro/ExportacaoBloqueada";
import DataPrevistaPagamento from "@/components/financeiro/DataPrevistaPagamento";
import {
  exportarRepasse,
  chaveCanal,
  type ModoExport,
} from "@/lib/repasse/exportar-repasse";
import { useCicloRepasse } from "@/hooks/use-ciclo-repasse";
import {
  NAVY,
  NAVY_DEEP,
  CYAN,
  STEEL,
  LIGHT_BG,
  BORDER,
} from "@/lib/email-templates/_lavoro-shared";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];


type LiberacaoPendente = {
  liberacao_id: string;
  canal_planilha?: string | null;
  parceiro?: string | null;
  nome?: string | null;
  ano?: number | null;
  mes?: number | null;
  justificativa?: string | null;
  solicitado_por_nome?: string | null;
  solicitado_por_email?: string | null;
  sou_o_aprovador?: boolean | null;
  status?: string | null;
};

type SituacaoContrato = {
  chave_planilha: string;
  canal_id: string | null;
  nome: string | null;
  situacao: "ATIVO" | "SEM_CONTRATO" | "VENCIDO" | "VINCULO_A_CONFIRMAR";
  pode_exportar: boolean;
  vigencia_fim: string | null;
  dias_para_vencer: number | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais_efetivo: number | null;
  minimo_repasse: number | null;
};

const fmtBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "";

function motivoBloqueio(s?: SituacaoContrato | null) {
  if (!s) return "Parceiro sem contrato assinado no Hub";
  if (s.situacao === "VENCIDO") return `Contrato vencido em ${fmtBR(s.vigencia_fim)}`;
  if (s.situacao === "VINCULO_A_CONFIRMAR")
    return "Contrato recebido, aguardando um administrador confirmar o vínculo";
  return "Parceiro sem contrato assinado no Hub";
}

function BadgeContrato({ s }: { s?: SituacaoContrato | null }) {
  const situacao = s?.situacao ?? "SEM_CONTRATO";
  const estilos: Record<string, { bg: string; color: string; label: string }> = {
    ATIVO: { bg: "#DCFCE7", color: "#166534", label: "Ativo" },
    VINCULO_A_CONFIRMAR: { bg: "#FEF3C7", color: "#92400E", label: "A confirmar" },
    SEM_CONTRATO: { bg: "#FEE2E2", color: "#991B1B", label: "Sem contrato" },
    VENCIDO: { bg: "#FEE2E2", color: "#991B1B", label: "Vencido" },
  };
  const st = estilos[situacao] ?? estilos.SEM_CONTRATO;
  return (
    <Badge variant="outline" style={{ background: st.bg, color: st.color, borderColor: "transparent" }}>
      {st.label}
    </Badge>
  );
}

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const chaveData = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function ehDiaUtil(d: Date, feriados: Set<string>) {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !feriados.has(chaveData(d));
}

/** Data do repasse: dia 10 do ciclo ou, se não for útil, o dia útil mais próximo (empate = o anterior). */
function dataRepasseDoCiclo(ano: number, mes: number, feriados: Set<string>) {
  const base = new Date(ano, mes - 1, 10);
  if (ehDiaUtil(base, feriados)) return base;
  for (let i = 1; i <= 15; i++) {
    const antes = new Date(ano, mes - 1, 10 - i);
    if (ehDiaUtil(antes, feriados)) return antes;
    const depois = new Date(ano, mes - 1, 10 + i);
    if (ehDiaUtil(depois, feriados)) return depois;
  }
  return base;
}

const soData = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Ciclo padrão: o corrente até a data de pagamento; depois dela, rola para o mês seguinte. */
function cicloPadrao(feriados: Set<string>) {
  const hoje = soData(nowBRT());
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const pagamento = soData(dataRepasseDoCiclo(ano, mes, feriados));
  if (hoje <= pagamento) return { ano, mes };
  const prox = new Date(ano, mes, 1);
  return { ano: prox.getFullYear(), mes: prox.getMonth() + 1 };
}

type SituacaoKey = "AVENCER_APURADO" | "AVENCER" | "APURADO" | "PAGA";

const SITUACOES: Array<{
  key: SituacaoKey;
  label: string;
  modo: "PROVISIONADO" | "HISTORICO";
  situacaoRepasse: string | null;
}> = [
  { key: "AVENCER_APURADO", label: "A Vencer + Apurado", modo: "PROVISIONADO", situacaoRepasse: null },
  { key: "AVENCER", label: "A Vencer", modo: "PROVISIONADO", situacaoRepasse: "A vencer" },
  { key: "APURADO", label: "Apurado", modo: "PROVISIONADO", situacaoRepasse: "Apurado" },
  { key: "PAGA", label: "Paga (histórico)", modo: "HISTORICO", situacaoRepasse: null },
];

type CanalRow = {
  ciclo_ano: number;
  ciclo_mes: number;
  canal_repasse: string;
  situacao_repasse: string | null;
  valor: number;
  total_canal_no_ciclo: number;
  situacao: "A_PAGAR" | "RETIDO_MINIMO" | "PAGO";
};

type RodapeRow = {
  grupo: "RETIDO_SUSPENSO" | "SEM_CADASTRO";
  situacao_repasse: string | null;
  linhas: number;
  valor: number;
};

type PrevisaoRow = {
  previsto_ano: number;
  previsto_mes: number;
  canal_repasse: string;
  linhas: number;
  valor: number;
};

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  border: `1px solid ${STEEL}55`,
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 13,
  outline: "none",
  minWidth: 180,
};

export function RepasseParceiro() {
  const queryClient = useQueryClient();

  // Feriados nacionais para apurar o dia útil do repasse
  const { data: feriadosRows } = useQuery({
    queryKey: ["feriados-nacionais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feriados_nacionais").select("data");
      if (error) throw error;
      return (data || []) as Array<{ data: string }>;
    },
    staleTime: 60 * 60 * 1000,
  });

  const feriados = useMemo(
    () => new Set((feriadosRows || []).map((f) => String(f.data).slice(0, 10))),
    [feriadosRows],
  );

  const mesCorrente = useMemo(() => cicloPadrao(feriados), [feriados]);

  const [mesAncora, setMesAncora] = useState(() => cicloPadrao(new Set<string>()));
  const [mesTocado, setMesTocado] = useState(false);
  const [canal, setCanal] = useState<string | null>(null);
  const [situacaoKey, setSituacaoKey] = useState<SituacaoKey>("AVENCER_APURADO");

  // Quando os feriados chegam, reavalia o ciclo padrão (se o usuário não escolheu outro mês)
  useEffect(() => {
    if (mesTocado) return;
    setMesAncora((atual) =>
      atual.ano === mesCorrente.ano && atual.mes === mesCorrente.mes ? atual : mesCorrente,
    );
  }, [mesCorrente, mesTocado]);

  const dataRepasse = useMemo(
    () => dataRepasseDoCiclo(mesAncora.ano, mesAncora.mes, feriados),
    [mesAncora, feriados],
  );
  const dataRepasseCurta = `${pad2(dataRepasse.getDate())}/${pad2(dataRepasse.getMonth() + 1)}`;

  const sit = SITUACOES.find((s) => s.key === situacaoKey)!;
  const isHistorico = sit.modo === "HISTORICO";

  // Situação do contrato de cada parceiro (trava da exportação)
  const { data: situacoes } = useQuery({
    queryKey: ["canal-parceiro-situacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_canal_parceiro_situacao" as never);
      if (error) throw error;
      return (data ?? []) as SituacaoContrato[];
    },
    staleTime: 60_000,
  });

  const situacaoPorCanal = useMemo(() => {
    const m = new Map<string, SituacaoContrato>();
    for (const s of situacoes ?? []) m.set(s.chave_planilha, s);
    return m;
  }, [situacoes]);

  const situacaoDe = (canalNome: string) => situacaoPorCanal.get(chaveCanal(canalNome)) ?? null;

  // Diálogos: trava por falta de contrato e definição da data do ciclo
  const [bloqueado, setBloqueado] = useState<{ canal: string; valor: number } | null>(null);
  const [definindoData, setDefinindoData] = useState(false);

  // Exportação do detalhe por parceiro (ExcelJS carregado sob demanda)
  const [exportando, setExportando] = useState<string | null>(null);

  /** Clique no Exportar de um parceiro liberado. A data vem do ciclo. */
  const pedirExport = async (canalClicado: string, modo: ModoExport) => {
    if (exportando) return;
    setExportando(canalClicado);
    const toastId = toast.loading("Gerando planilha…");
    try {
      const r = await exportarRepasse({
        canal: canalClicado,
        ano: mesAncora.ano,
        mes: mesAncora.mes,
        modo,
        modoDados: sit.modo,
        situacaoRepasse: sit.situacaoRepasse,
      });
      if (r.truncado) {
        toast.warning("Resultado truncado em 20.000 linhas. Ajuste os filtros para exportar tudo.", { duration: 8000 });
      }
      toast.success(r.arquivo, { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar a planilha", { id: toastId });
    } finally {
      setExportando(null);
    }
  };


  /** Clique no botão "Sem contrato". */
  const abrirBloqueio = (canalClicado: string, valor: number) => {
    setBloqueado({ canal: canalClicado, valor });
  };

  // Pedidos de liberação excepcional pendentes (só o aprovador vê o painel)
  const { data: liberacoes } = useQuery({
    queryKey: ["canal-parceiro-liberacoes", "PENDENTE"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_liberacoes" as never,
        { p_status: "PENDENTE" } as never,
      );
      if (error) throw error;
      return (data ?? []) as LiberacaoPendente[];
    },
    staleTime: 60_000,
  });

  const pendentesDoAprovador = useMemo(
    () => (liberacoes ?? []).filter((l) => l.sou_o_aprovador === true),
    [liberacoes],
  );


  const mesSeguinte = useMemo(() => {
    const d = new Date(mesAncora.ano, mesAncora.mes, 1);
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }, [mesAncora]);

  const corteLabel = useMemo(() => {
    const d = new Date(mesAncora.ano, mesAncora.mes - 1, 0);
    return d.toLocaleDateString("pt-BR");
  }, [mesAncora]);

  // Filtros: canais de repasse
  const { data: filtros } = useQuery({
    queryKey: ["lavoro-repasse-filtros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_repasse_filtros" as never);
      if (error) throw error;
      return (data || []) as Array<{ tipo: string; valor: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const canais = useMemo(
    () => (filtros || []).filter((f) => f.tipo === "canal_repasse").map((f) => f.valor),
    [filtros],
  );

  // Quadro principal
  const queryKey = [
    "lavoro-repasse-por-canal",
    mesAncora.ano,
    mesAncora.mes,
    sit.modo,
    canal,
    sit.situacaoRepasse,
  ];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_lavoro_repasse_por_canal" as never,
        {
          p_ano: mesAncora.ano,
          p_mes: mesAncora.mes,
          p_modo: sit.modo,
          p_canal_repasse: canal,
          p_situacao_repasse: sit.situacaoRepasse,
        } as never,
      );
      if (error) throw error;
      return (data || []) as CanalRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Rodapé (não reage aos filtros)
  const { data: rodape } = useQuery({
    queryKey: ["lavoro-repasse-rodape"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_repasse_rodape" as never);
      if (error) throw error;
      return (data || []) as RodapeRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Previsão longa (só PROVISIONADO)
  const { data: previsao } = useQuery({
    queryKey: ["lavoro-repasse-previsao-longa", mesAncora.ano, mesAncora.mes, canal],
    enabled: !isHistorico,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_lavoro_repasse_previsao_longa" as never,
        { p_ano: mesAncora.ano, p_mes: mesAncora.mes, p_canal_repasse: canal } as never,
      );
      if (error) throw error;
      return (data || []) as PrevisaoRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Idade do provisionado
  const { data: idade } = useQuery({
    queryKey: ["lavoro-repasse-idade", mesAncora.ano, mesAncora.mes, canal, sit.situacaoRepasse],
    enabled: !isHistorico,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_lavoro_repasse_idade" as never,
        {
          p_ano: mesAncora.ano,
          p_mes: mesAncora.mes,
          p_canal_repasse: canal,
          p_situacao_repasse: sit.situacaoRepasse,
        } as never,
      );
      if (error) throw error;
      return (data || []) as Array<{
        canal_repasse: string; faixa: string; ordem: number;
        parcelas: number; valor: number; mes_mais_antigo: string;
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Realtime: revalida quando uma sync termina com sucesso
  useEffect(() => {
    const channel = supabase
      .channel("lavoro-sync-log-repasse")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lavoro_sync_log" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { status?: string } | null;
          if (!row || row.status === "sucesso") {
            queryClient.invalidateQueries({ queryKey: ["lavoro-repasse-por-canal"] });
            queryClient.invalidateQueries({ queryKey: ["lavoro-repasse-rodape"] });
            queryClient.invalidateQueries({ queryKey: ["lavoro-repasse-previsao-longa"] });
            queryClient.invalidateQueries({ queryKey: ["lavoro-repasse-idade"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const limpar = () => {
    setMesTocado(false);
    setMesAncora(mesCorrente);
    setCanal(null);
    setSituacaoKey("AVENCER_APURADO");
  };

  // Pivot por canal: situação que decide o grupo é sempre a do mês âncora;
  // só fallback para o mês seguinte quando não há linha no mês âncora.
  const linhas = useMemo(() => {
    type Acc = Omit<Linha, "situacao"> & {
      situacaoAncora: Linha["situacao"] | null;
      situacaoSeguinte: Linha["situacao"] | null;
    };
    const map = new Map<string, Acc>();
    for (const r of data || []) {
      const cur: Acc =
        map.get(r.canal_repasse) || {
          canal: r.canal_repasse,
          situacaoAncora: null,
          situacaoSeguinte: null,
          m1avencer: 0, m1apurado: 0, m2avencer: 0, m2apurado: 0, pago: 0,
        };
      const v = Number(r.valor || 0);
      const ehMesSeguinte = r.ciclo_ano === mesSeguinte.ano && r.ciclo_mes === mesSeguinte.mes;
      const sr = (r.situacao_repasse || "").toLowerCase();
      if (isHistorico) {
        cur.pago += v;
        cur.situacaoAncora = r.situacao;
      } else if (ehMesSeguinte) {
        cur.situacaoSeguinte = r.situacao;
        if (sr === "apurado") cur.m2apurado += v;
        else cur.m2avencer += v;
      } else {
        cur.situacaoAncora = r.situacao;
        if (sr === "apurado") cur.m1apurado += v;
        else cur.m1avencer += v;
      }
      map.set(r.canal_repasse, cur);
    }
    const arr: Linha[] = Array.from(map.values()).map(({ situacaoAncora, situacaoSeguinte, ...rest }) => ({
      ...rest,
      situacao: (situacaoAncora ?? situacaoSeguinte ?? "A_PAGAR") as Linha["situacao"],
    }));
    const total = (l: Linha) => l.m1avencer + l.m1apurado + l.m2avencer + l.m2apurado;
    arr.sort((a, b) => (isHistorico ? b.pago - a.pago : total(b) - total(a)));
    return arr;
  }, [data, isHistorico, mesSeguinte]);

  const grupoAPagar = linhas.filter((l) => l.situacao === "A_PAGAR");
  const grupoRetido = linhas.filter((l) => l.situacao === "RETIDO_MINIMO");

  const soma = (arr: typeof linhas, f: (l: (typeof linhas)[number]) => number) =>
    arr.reduce((acc, l) => acc + f(l), 0);

  const cicloAncora = (l: (typeof linhas)[number]) => l.m1avencer + l.m1apurado;
  const cicloSeguinte = (l: (typeof linhas)[number]) => l.m2avencer + l.m2apurado;

  const totalAPagar = soma(grupoAPagar, cicloAncora);
  const totalRetido = soma(grupoRetido, cicloAncora);
  const totalCicloSeguinte = soma(linhas, cicloSeguinte);

  const totalPago = soma(linhas, (l) => l.pago);
  const maiorRepasse = linhas.reduce(
    (top, l) => (l.pago > (top?.pago ?? -1) ? l : top),
    null as (typeof linhas)[number] | null,
  );

  // Previsão longa: agrega por mês
  const prevMeses = useMemo(() => {
    const map = new Map<string, { ano: number; mes: number; valor: number }>();
    for (const r of previsao || []) {
      const k = `${r.previsto_ano}-${r.previsto_mes}`;
      const cur = map.get(k) || { ano: r.previsto_ano, mes: r.previsto_mes, valor: 0 };
      cur.valor += Number(r.valor || 0);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.ano * 100 + a.mes - (b.ano * 100 + b.mes));
  }, [previsao]);

  const prevTotal = prevMeses.reduce((acc, m) => acc + m.valor, 0);

  // Faixas etárias agregadas por faixa
  const faixas = useMemo(() => {
    const map = new Map<number, { ordem: number; faixa: string; parcelas: number; valor: number }>();
    for (const r of idade || []) {
      const cur = map.get(r.ordem) || { ordem: r.ordem, faixa: r.faixa, parcelas: 0, valor: 0 };
      cur.parcelas += Number(r.parcelas || 0);
      cur.valor += Number(r.valor || 0);
      map.set(r.ordem, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.ordem - b.ordem);
  }, [idade]);

  const pctParadoMais1Mes = useMemo(() => {
    const total = faixas.reduce((acc, f) => acc + f.valor, 0);
    const parado = faixas.filter((f) => f.ordem >= 2).reduce((acc, f) => acc + f.valor, 0);
    if (!total) return 0;
    return Math.round((parado / total) * 100);
  }, [faixas]);

  const porCanal = useMemo(() => {
    const map = new Map<string, { parcelas: number; maiorOrdem: number; maisAntigo: string | null }>();
    for (const r of idade || []) {
      const cur = map.get(r.canal_repasse) || { parcelas: 0, maiorOrdem: 0, maisAntigo: null };
      cur.parcelas += Number(r.parcelas || 0);
      if (r.ordem > cur.maiorOrdem) { cur.maiorOrdem = r.ordem; cur.maisAntigo = r.mes_mais_antigo; }
      map.set(r.canal_repasse, cur);
    }
    return map;
  }, [idade]);

  const pill = (s: CanalRow["situacao"]) => {
    const styles: Record<CanalRow["situacao"], { bg: string; color: string; label: string }> = {
      A_PAGAR: { bg: "#DCFCE7", color: "#166534", label: "A pagar" },
      RETIDO_MINIMO: { bg: "#FEF3C7", color: "#92400E", label: "Retido" },
      PAGO: { bg: "#E5E7EB", color: "#4B5563", label: "Pago" },
    };
    const st = styles[s];
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: st.bg, color: st.color }}
      >
        {st.label}
      </span>
    );
  };

  const valorCell = (v: number) => (
    <span style={v === 0 ? { color: "#9CA3AF" } : undefined}>{BRL(v)}</span>
  );

  const rodapeRetido = (rodape || []).filter((r) => r.grupo === "RETIDO_SUSPENSO");
  const rodapeSemCadastro = (rodape || []).filter((r) => r.grupo === "SEM_CADASTRO");

  return (
    <div className="mt-6 space-y-6">
      {/* FAIXA DE FILTROS */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: NAVY_DEEP }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: STEEL }}>
              Canal (Repasse)
            </label>
            <select
              style={selectStyle}
              value={canal ?? ""}
              onChange={(e) => setCanal(e.target.value || null)}
            >
              <option value="" style={{ color: "#111" }}>Todos os parceiros</option>
              {canais.map((c) => (
                <option key={c} value={c} style={{ color: "#111" }}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: STEEL }}>
              Mês
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal"
                style={{ background: "rgba(51,139,133,0.18)", color: CYAN }}
              >
                padrão: ciclo {dataRepasseCurta}
              </span>
            </label>
            <input
              type="month"
              style={{ ...selectStyle, minWidth: 150 }}
              value={`${mesAncora.ano}-${String(mesAncora.mes).padStart(2, "0")}`}
              onChange={(e) => {
                const [a, m] = e.target.value.split("-").map(Number);
                if (a && m) { setMesTocado(true); setMesAncora({ ano: a, mes: m }); }
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: STEEL }}>
              Situação Repasse
            </label>
            <select
              style={selectStyle}
              value={situacaoKey}
              onChange={(e) => setSituacaoKey(e.target.value as SituacaoKey)}
            >
              {SITUACOES.map((s) => (
                <option key={s.key} value={s.key} style={{ color: "#111" }}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={limpar}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.10)", color: "#fff", border: `1px solid ${STEEL}55` }}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* BLOCO 1: resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isHistorico ? (
          <>
            <ResumoCard titulo={`Pago em ${MESES[mesAncora.mes - 1]}/${String(mesAncora.ano).slice(2)}`} valor={BRL(totalPago)} destaque />
            <ResumoCard titulo="Parceiros" valor={String(linhas.length)} />
            <ResumoCard
              titulo="Maior repasse"
              valor={maiorRepasse ? BRL(maiorRepasse.pago) : BRL(0)}
              legenda={maiorRepasse?.canal}
            />
            <ResumoCard titulo="Mês de referência" valor={`${MESES[mesAncora.mes - 1]}/${mesAncora.ano}`} />
          </>
        ) : (
          <>
            <ResumoCard
              titulo={`A pagar em ${dataRepasseCurta}`}
              valor={BRL(totalAPagar)}
              destaque
            />
            <ResumoCard titulo="Retido pelo mínimo" valor={BRL(totalRetido)} />
            <ResumoCard
              titulo={`Ciclo ${MESES[mesSeguinte.mes - 1].toLowerCase()}/${String(mesSeguinte.ano).slice(2)}`}
              valor={BRL(totalCicloSeguinte)}
            />
            <ResumoCard titulo="Corte da apuração" valor={corteLabel} />
          </>
        )}
      </div>

      {/* FAIXA DE IDADE */}
      {!isHistorico && faixas.length > 0 && (
        <div className="rounded-xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: BORDER }}>
          <h3 className="font-display text-base font-semibold" style={{ color: NAVY }}>
            Há quanto tempo está parado
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {faixas.map((f) => (
              <div key={f.ordem} className="rounded-lg border p-3" style={{ borderColor: BORDER }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{f.faixa}</div>
                <div
                  className="mt-1 font-mono text-lg font-bold tabular-nums"
                  style={{ color: f.ordem >= 3 ? "#92400E" : NAVY_DEEP }}
                >
                  {BRL(f.valor)}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">{f.parcelas} parcelas</div>
              </div>
            ))}
          </div>
          {pctParadoMais1Mes > 0 && (
            <p className="mt-3 text-[11px] text-gray-500">
              {pctParadoMais1Mes}% do total provisionado está parado há mais de 1 mês
            </p>
          )}
        </div>
      )}

      {/* Data do ciclo: definida pelo Financeiro, uma vez por ciclo */}
      {!isHistorico && (
        <BlocoDataCiclo
          ano={mesAncora.ano}
          mes={mesAncora.mes}
          onDefinir={() => setDefinindoData(true)}
        />
      )}

      {/* Liberações excepcionais pendentes: só para o aprovador designado */}
      {pendentesDoAprovador.length > 0 && (
        <PainelLiberacoes pendentes={pendentesDoAprovador} />
      )}


      {/* BLOCO 2 + 3: quadro e rodapé */}
      <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
        <div className="border-b px-5 py-4" style={{ borderColor: BORDER }}>
          <h3 className="font-display text-base font-semibold" style={{ color: NAVY }}>
            Repasse de Parceiro
          </h3>
          <p className="text-xs text-gray-500">
            {isHistorico
              ? `Comissões pagas aos parceiros em ${MESES[mesAncora.mes - 1]}/${mesAncora.ano}`
              : `Ciclo ${MESES[mesAncora.mes - 1]}/${mesAncora.ano} · corte da apuração em ${corteLabel}`}
          </p>
        </div>

        <div className="p-4 md:p-5">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Não foi possível carregar o repasse: {(error as Error).message}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="align-bottom">Canal (Repasse)</TableHead>
                    {isHistorico ? (
                      <TableHead className="border-l text-center" style={{ borderColor: BORDER, color: NAVY }}>
                        {MESES[mesAncora.mes - 1]}/{mesAncora.ano}
                      </TableHead>
                    ) : (
                      <>
                        <TableHead
                          colSpan={3}
                          className="border-l text-center"
                          style={{ borderColor: BORDER, color: NAVY }}
                        >
                          {MESES[mesAncora.mes - 1]}/{mesAncora.ano}
                        </TableHead>
                        <TableHead
                          colSpan={3}
                          className="border-l text-center"
                          style={{ borderColor: BORDER, color: NAVY }}
                        >
                          {MESES[mesSeguinte.mes - 1]}/{mesSeguinte.ano}
                        </TableHead>
                      </>
                    )}
                    <TableHead rowSpan={2} className="border-l text-right align-bottom" style={{ borderColor: BORDER }}>
                      Contrato
                    </TableHead>
                    <TableHead rowSpan={2} className="text-right align-bottom">
                      Situação
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    {isHistorico ? (
                      <TableHead className="border-l text-right text-[11px] font-medium text-gray-500" style={{ borderColor: BORDER }}>
                        Pago
                      </TableHead>
                    ) : (
                      <>
                        <TableHead className="border-l text-right text-[11px] font-medium text-gray-500" style={{ borderColor: BORDER }}>A Vencer</TableHead>
                        <TableHead className="text-right text-[11px] font-medium text-gray-500">Apurado</TableHead>
                        <TableHead className="text-right text-[11px] font-medium text-gray-500">Total</TableHead>
                        <TableHead className="border-l text-right text-[11px] font-medium text-gray-500" style={{ borderColor: BORDER }}>A Vencer</TableHead>
                        <TableHead className="text-right text-[11px] font-medium text-gray-500">Apurado</TableHead>
                        <TableHead className="text-right text-[11px] font-medium text-gray-500">Total</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isHistorico ? (
                    <>
                      {linhas.map((l) => (
                        <TableRow key={l.canal}>
                          <TableCell className="font-medium" style={{ color: NAVY }}>
                            <div className="flex items-center gap-2">
                            {l.canal}
                            <ExportBtn
                              canal={l.canal}
                              situacao={situacaoDe(l.canal)}
                              exportando={exportando === l.canal}
                              bloqueado={exportando !== null}
                              onExport={pedirExport}
                              onBloqueado={() => abrirBloqueio(l.canal, l.pago)}
                            />
                            </div>
                          </TableCell>
                          <TableCell className="border-l text-right font-mono tabular-nums" style={{ borderColor: BORDER }}>
                            {valorCell(l.pago)}
                          </TableCell>
                          <TableCell className="border-l text-right" style={{ borderColor: BORDER }}>
                            <BadgeContrato s={situacaoDe(l.canal)} />
                          </TableCell>
                          <TableCell className="text-right">{pill(l.situacao)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50">
                        <TableCell className="font-semibold" style={{ color: NAVY, borderTop: `2px solid ${NAVY}` }}>
                          Pago no mês
                        </TableCell>
                        <TableCell
                          className="border-l text-right font-mono font-semibold tabular-nums"
                          style={{ color: NAVY, borderColor: BORDER, borderTop: `2px solid ${NAVY}` }}
                        >
                          {BRL(totalPago)}
                        </TableCell>
                        <TableCell className="border-l" style={{ borderColor: BORDER, borderTop: `2px solid ${NAVY}` }} />
                        <TableCell style={{ borderTop: `2px solid ${NAVY}` }} />
                      </TableRow>
                    </>
                  ) : (
                    <>
                      {grupoAPagar.length > 0 && (
                        <>
                          {grupoAPagar.map((l) => (
                            <LinhaCanal key={l.canal} l={l} info={porCanal.get(l.canal)} pill={pill} valorCell={valorCell} border={BORDER} navy={NAVY} exportando={exportando === l.canal} bloqueado={exportando !== null} onExport={pedirExport} situacao={situacaoDe(l.canal)} onBloqueado={() => abrirBloqueio(l.canal, cicloAncora(l))} />
                          ))}
                          <SubtotalRow
                            label={`A pagar em ${dataRepasseCurta}`}
                            grupo={grupoAPagar}
                            navy={NAVY}
                            border={BORDER}
                          />
                        </>
                      )}
                      {grupoRetido.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-[12px] font-medium"
                              style={{ background: "#FEF3C7", color: "#92400E" }}
                            >
                              Abaixo do mínimo de R$ 100,00 por parceiro · não sai neste ciclo e acumula sozinho para o próximo
                            </TableCell>
                          </TableRow>
                          {grupoRetido.map((l) => (
                            <LinhaCanal key={l.canal} l={l} info={porCanal.get(l.canal)} pill={pill} valorCell={valorCell} border={BORDER} navy={NAVY} exportando={exportando === l.canal} bloqueado={exportando !== null} onExport={pedirExport} situacao={situacaoDe(l.canal)} onBloqueado={() => abrirBloqueio(l.canal, cicloAncora(l))} />
                          ))}
                          <SubtotalRow
                            label="Retido pelo mínimo"
                            grupo={grupoRetido}
                            navy={NAVY}
                            border={BORDER}
                          />
                        </>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* BLOCO 3: rodapé de exceções */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4" style={{ borderColor: BORDER, background: LIGHT_BG }}>
              <h4 className="text-[13px] font-semibold" style={{ color: NAVY_DEEP }}>
                Fora da soma · retido e suspenso
              </h4>
              <div className="mt-2 space-y-1.5">
                {rodapeRetido.map((r) => (
                  <div key={r.situacao_repasse} className="flex items-center justify-between text-[13px]">
                    <span className="text-gray-600">
                      {r.situacao_repasse} · {r.linhas} parcelas
                    </span>
                    <span className="font-mono font-semibold tabular-nums" style={{ color: NAVY }}>
                      {BRL(r.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: BORDER, background: LIGHT_BG }}>
              <h4 className="text-[13px] font-semibold" style={{ color: NAVY_DEEP }}>
                Pendência de cadastro na planilha
              </h4>
              <div className="mt-2 space-y-1.5">
                {rodapeSemCadastro.map((r) => (
                  <div key={r.situacao_repasse} className="flex items-center justify-between text-[13px]">
                    <span className="text-gray-600">
                      {r.situacao_repasse ?? "(Vazio)"} · {r.linhas} parcelas
                    </span>
                    <span className="font-mono font-semibold tabular-nums" style={{ color: NAVY }}>
                      {BRL(r.valor)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                A coluna Status do repasse está em branco na Controle Gerencial.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 4: previsão longa */}
      {!isHistorico && prevMeses.length > 0 && (
        <div className="rounded-xl px-5 py-5" style={{ background: NAVY }}>
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(51,139,133,0.18)", color: CYAN }}
              >
                Previsão, não é provisão
              </span>
              <h3 className="font-display mt-2 text-base font-semibold text-white">
                Repasse futuro de comissão ainda não recebida
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-white/60">
                Parcelas de comissão com status A Vencer, projetadas para o mês seguinte ao recebimento previsto.
                Não somar com o quadro acima: são parcelas diferentes.
              </p>
            </div>
            <div className="mt-3 text-right md:mt-0">
              <div className="text-[11px] uppercase tracking-wider text-white/50">Total previsto</div>
              <div className="font-mono text-xl font-bold tabular-nums" style={{ color: CYAN }}>
                {BRL(prevTotal)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {prevMeses.slice(0, 6).map((m) => (
              <div
                key={`${m.ano}-${m.mes}`}
                className="min-w-[110px] rounded-lg px-4 py-3"
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${STEEL}33` }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: STEEL }}>
                  {MESES[m.mes - 1]}/{String(m.ano).slice(2)}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                  {BRL(m.valor)}
                </div>
              </div>
            ))}
            {prevMeses.length > 6 && (
              <div
                className="flex min-w-[70px] items-center justify-center rounded-lg px-4 py-3 font-mono text-lg text-white/40"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px dashed ${STEEL}33` }}
              >
                …
              </div>
            )}
          </div>
        </div>
      )}

      {bloqueado && (
        <ExportacaoBloqueada
          aberto
          parceiro={bloqueado.canal}
          chavePlanilha={chaveCanal(bloqueado.canal)}
          canalId={situacaoDe(bloqueado.canal)?.canal_id ?? null}
          situacao={situacaoDe(bloqueado.canal)?.situacao ?? null}
          motivo={motivoBloqueio(situacaoDe(bloqueado.canal))}
          valor={bloqueado.valor}
          ano={mesAncora.ano}
          mes={mesAncora.mes}
          onFechar={() => setBloqueado(null)}
        />
      )}

      <DataPrevistaPagamento
        aberto={definindoData}
        ano={mesAncora.ano}
        mes={mesAncora.mes}
        sugestao={`${dataRepasse.getFullYear()}-${pad2(dataRepasse.getMonth() + 1)}-${pad2(dataRepasse.getDate())}`}
        onFechar={() => setDefinindoData(false)}
      />

    </div>
  );
}

/** Data prevista de pagamento do ciclo — quem define é o Financeiro. */
function BlocoDataCiclo({
  ano,
  mes,
  onDefinir,
}: {
  ano: number;
  mes: number;
  onDefinir: () => void;
}) {
  const { data: ciclo } = useCicloRepasse(ano, mes);
  const cicloLabel = `${pad2(mes)}/${ano}`;
  const podeDefinir = ciclo?.posso_definir === true;

  if (!ciclo) return null;

  if (!ciclo.data_prevista) {
    return (
      <Alert className="border-amber-600/40 bg-amber-50 text-amber-900">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Ciclo sem data de pagamento</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            O ciclo de {cicloLabel} ainda não tem data prevista de pagamento. Sem ela o Comercial
            não consegue enviar a relação aos parceiros.
          </span>
          {podeDefinir && (
            <Button size="sm" onClick={onDefinir}>
              Definir data do ciclo
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const definidaEm = ciclo.definida_em
    ? new Date(ciclo.definida_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-5 py-3 text-sm"
      style={{ borderColor: BORDER }}
    >
      <span style={{ color: NAVY }}>
        Pagamento previsto para <strong>{fmtBR(ciclo.data_prevista)}</strong>
        {ciclo.definida_por_nome ? `, definido por ${ciclo.definida_por_nome}` : ""}
        {definidaEm ? ` em ${definidaEm}` : ""}.
      </span>
      {Number(ciclo.excecoes || 0) > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {ciclo.excecoes} {Number(ciclo.excecoes) === 1 ? "exceção" : "exceções"}
        </span>
      )}
      {podeDefinir && (
        <Button size="sm" variant="outline" onClick={onDefinir}>
          Alterar
        </Button>
      )}
    </div>
  );
}

function PainelLiberacoes({ pendentes }: { pendentes: LiberacaoPendente[] }) {

  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [decidindo, setDecidindo] = useState<string | null>(null);

  const decidir = async (id: string, aprovar: boolean) => {
    if (decidindo) return;
    setDecidindo(id);
    try {
      const { error } = await supabase.rpc(
        "rpc_canal_parceiro_decidir_liberacao" as never,
        { p_liberacao_id: id, p_aprovar: aprovar, p_observacao: null } as never,
      );
      if (error) throw error;
      toast.success(aprovar ? "Liberação aprovada." : "Pedido recusado.");
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-liberacoes"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDecidindo(null);
    }
  };

  return (
    <>
      <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>
          {pendentes.length === 1
            ? "1 pedido de liberação excepcional aguardando sua decisão"
            : `${pendentes.length} pedidos de liberação excepcional aguardando sua decisão`}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
            Ver pedidos
          </Button>
        </AlertDescription>
      </Alert>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Liberações excepcionais pendentes</DialogTitle>
            <DialogDescription>
              Aprovar libera a exportação do repasse sem contrato válido no Hub.
            </DialogDescription>
          </DialogHeader>

          <SuperAdminGate area="canal-parceiro-liberacoes" titulo="Aprovar liberações de repasse">
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {pendentes.map((p) => (
                <div key={p.liberacao_id} className="rounded-lg border p-3" style={{ borderColor: BORDER }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold" style={{ color: NAVY }}>
                      {p.parceiro ?? p.nome ?? p.canal_planilha ?? "Parceiro"}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ciclo {p.mes ? `${MESES[p.mes - 1]}/${p.ano}` : "—"}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Pedido por {p.solicitado_por_nome ?? p.solicitado_por_email ?? "—"}
                  </p>
                  <p className="mt-2 text-sm text-gray-700">{p.justificativa ?? "Sem justificativa."}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => decidir(p.liberacao_id, true)}
                      disabled={decidindo !== null}
                    >
                      {decidindo === p.liberacao_id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decidir(p.liberacao_id, false)}
                      disabled={decidindo !== null}
                    >
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SuperAdminGate>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResumoCard({ titulo, valor, destaque, legenda }:
  { titulo: string; valor: string; destaque?: boolean; legenda?: string }) {
  return (
    <div
      className="rounded-xl border bg-white px-4 py-3 shadow-sm"
      style={{ borderColor: BORDER, borderLeft: destaque ? `4px solid ${CYAN}` : undefined }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{titulo}</div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums" style={{ color: destaque ? CYAN : NAVY_DEEP }}>
        {valor}
      </div>
      {legenda && <div className="mt-0.5 truncate text-[11px] text-gray-500">{legenda}</div>}
    </div>
  );
}

type Linha = {
  canal: string;
  situacao: "A_PAGAR" | "RETIDO_MINIMO" | "PAGO";
  m1avencer: number;
  m1apurado: number;
  m2avencer: number;
  m2apurado: number;
  pago: number;
};

function mesAnoISO(iso: string) {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function ExportBtn({
  canal,
  situacao,
  exportando,
  bloqueado,
  onExport,
  onBloqueado,
}: {
  canal: string;
  situacao?: SituacaoContrato | null;
  exportando: boolean;
  bloqueado: boolean;
  onExport: (canal: string, modo: ModoExport) => void;
  onBloqueado: (canal: string) => void;
}) {
  const travado = situacao?.pode_exportar !== true;

  if (travado) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onBloqueado(canal)}
              className="h-6 gap-1 border-amber-500/60 px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            >
              <Lock className="h-3 w-3" />
              Sem contrato
            </Button>
          </TooltipTrigger>
          <TooltipContent>{motivoBloqueio(situacao)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={bloqueado}
          aria-label={`Exportar repasse de ${canal}`}
          title="Exportar planilha"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onExport(canal, "INTERNO")}>Exportar completo (interno)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport(canal, "PARCEIRO")}>Exportar para o parceiro</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LinhaCanal({
  l,
  info,
  pill,
  valorCell,
  border,
  navy,
  exportando,
  bloqueado,
  onExport,
  situacao,
  onBloqueado,
}: {
  l: Linha;
  info?: { parcelas: number; maiorOrdem: number; maisAntigo: string | null };
  pill: (s: Linha["situacao"]) => React.ReactNode;
  valorCell: (v: number) => React.ReactNode;
  border: string;
  navy: string;
  exportando: boolean;
  bloqueado: boolean;
  onExport: (canal: string, modo: ModoExport) => void;
  situacao?: SituacaoContrato | null;
  onBloqueado: (canal: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium" style={{ color: navy }}>
        <div className="flex items-center gap-2">
          {l.canal}
          <ExportBtn
            canal={l.canal}
            situacao={situacao}
            exportando={exportando}
            bloqueado={bloqueado}
            onExport={onExport}
            onBloqueado={onBloqueado}
          />
          {info && info.maiorOrdem >= 3 && info.maisAntigo && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "#92400E" }}
              title={`Parcela mais antiga: ${mesAnoISO(info.maisAntigo)}`}
            />
          )}
        </div>
        {info && <div className="text-[11px] text-gray-500">{info.parcelas} parcelas</div>}
      </TableCell>
      <TableCell className="border-l text-right font-mono tabular-nums" style={{ borderColor: border }}>
        {valorCell(l.m1avencer)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{valorCell(l.m1apurado)}</TableCell>
      <TableCell className="text-right font-mono font-semibold tabular-nums" style={{ color: navy }}>
        {valorCell(l.m1avencer + l.m1apurado)}
      </TableCell>
      <TableCell className="border-l text-right font-mono tabular-nums" style={{ borderColor: border }}>
        {valorCell(l.m2avencer)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{valorCell(l.m2apurado)}</TableCell>
      <TableCell className="text-right font-mono font-semibold tabular-nums" style={{ color: navy }}>
        {valorCell(l.m2avencer + l.m2apurado)}
      </TableCell>
      <TableCell className="border-l text-right" style={{ borderColor: border }}>
        <BadgeContrato s={situacao} />
      </TableCell>
      <TableCell className="text-right">{pill(l.situacao)}</TableCell>
    </TableRow>
  );
}

function SubtotalRow({
  label,
  grupo,
  navy,
  border,
}: {
  label: string;
  grupo: Linha[];
  navy: string;
  border: string;
}) {
  const s = (f: (l: Linha) => number) => grupo.reduce((acc, l) => acc + f(l), 0);
  const top = `2px solid ${navy}`;
  return (
    <TableRow className="bg-gray-50">
      <TableCell className="font-semibold" style={{ color: navy, borderTop: top }}>
        {label}
      </TableCell>
      <TableCell className="border-l text-right font-mono font-semibold tabular-nums" style={{ color: navy, borderColor: border, borderTop: top }}>
        {BRL(s((l) => l.m1avencer))}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold tabular-nums" style={{ color: navy, borderTop: top }}>
        {BRL(s((l) => l.m1apurado))}
      </TableCell>
      <TableCell className="text-right font-mono font-bold tabular-nums" style={{ color: navy, borderTop: top }}>
        {BRL(s((l) => l.m1avencer + l.m1apurado))}
      </TableCell>
      <TableCell className="border-l text-right font-mono font-semibold tabular-nums" style={{ color: navy, borderColor: border, borderTop: top }}>
        {BRL(s((l) => l.m2avencer))}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold tabular-nums" style={{ color: navy, borderTop: top }}>
        {BRL(s((l) => l.m2apurado))}
      </TableCell>
      <TableCell className="text-right font-mono font-bold tabular-nums" style={{ color: navy, borderTop: top }}>
        {BRL(s((l) => l.m2avencer + l.m2apurado))}
      </TableCell>
      <TableCell className="border-l" style={{ borderColor: border, borderTop: top }} />
      <TableCell style={{ borderTop: top }} />
    </TableRow>
  );
}
