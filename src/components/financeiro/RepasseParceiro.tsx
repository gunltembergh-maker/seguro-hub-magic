import { useEffect, useMemo, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
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
import { exportarXlsx, type ColunaExport } from "@/lib/export-xlsx";
import {
  NAVY,
  NAVY_DEEP,
  CYAN,
  STEEL,
  LIGHT_BG,
  BORDER,
} from "@/lib/email-templates/_lavoro-shared";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type ModoExport = "INTERNO" | "PARCEIRO";

const COLS_INTERNO: ColunaExport[] = [
  { header: "Grupo", key: "grupo", formato: "texto" },
  { header: "Tomador", key: "tomador", formato: "texto", width: 34 },
  { header: "Segurado", key: "segurado", formato: "texto", width: 34 },
  { header: "Documento", key: "documento", formato: "texto", width: 20 },
  { header: "Ramo", key: "ramo", formato: "texto" },
  { header: "Seguradora", key: "seguradora", formato: "texto", width: 24 },
  { header: "Nº Apólice", key: "numero_apolice", formato: "texto", width: 26 },
  { header: "Data Emissão", key: "data_emissao", formato: "data" },
  { header: "Início Vigência", key: "inicio_vigencia", formato: "data" },
  { header: "Fim Vigência", key: "fim_vigencia", formato: "data" },
  { header: "Período Atualização", key: "periodo_atualizacao", formato: "texto" },
  { header: "Valor IS", key: "valor_is", formato: "moeda" },
  { header: "Prêmio Total", key: "premio_total", formato: "moeda" },
  { header: "% Comissão", key: "percentual_comissao", formato: "percentual" },
  { header: "Comissão Emitida", key: "comissao_emitida", formato: "moeda" },
  { header: "Qtd Parcelas", key: "qtd_parcelas", formato: "inteiro" },
  { header: "Prêmio Parcela", key: "premio_parcela", formato: "moeda" },
  { header: "Comissão Bruta", key: "comissao_bruta", formato: "moeda" },
  { header: "Imposto Ret", key: "imposto_ret", formato: "moeda" },
  { header: "Valor ISS", key: "valor_iss", formato: "moeda" },
  { header: "Valor Recebido / A Receber", key: "valor_recebido_a_receber", formato: "moeda", width: 20 },
  { header: "Nº da Parcela", key: "numero_da_parcela", formato: "inteiro" },
  { header: "Tipo Pagamento", key: "tipo_pagamento", formato: "texto" },
  { header: "Empresa Faturada", key: "empresa_faturada", formato: "texto", width: 22 },
  { header: "Data Pagamento", key: "data_pagamento", formato: "data" },
  { header: "Mês", key: "mes", formato: "inteiro" },
  { header: "Ano", key: "ano", formato: "inteiro" },
  { header: "Fat Competência", key: "fat_competencia", formato: "texto" },
  { header: "Status da Parcela de Comissão", key: "status_parcela_comissao", formato: "texto", width: 24 },
  { header: "Análise", key: "analise", formato: "texto", width: 24 },
  { header: "Possui Repasse", key: "possui_repasse", formato: "texto" },
  { header: "% Repasse", key: "percentual_repasse", formato: "percentual" },
  { header: "Parcelas", key: "parcelas", formato: "texto" },
  { header: "% Imposto", key: "percentual_imposto", formato: "percentual" },
  { header: "Valor Repasse Total", key: "valor_repasse_total", formato: "moeda", width: 18 },
  { header: "Data do Repasse", key: "data_repasse", formato: "data" },
  { header: "Status do Repasse", key: "status_repasse", formato: "texto" },
  { header: "Observação", key: "observacao", formato: "texto", width: 40 },
];

const COLS_PARCEIRO_RESUMO: ColunaExport[] = [
  { header: "Nº Apólice", key: "numero_apolice", formato: "texto", width: 26 },
  { header: "Tomador", key: "tomador", formato: "texto", width: 34 },
  { header: "Parcela", key: "parcela", formato: "texto", width: 10 },
  { header: "Data Pgto Comissão", key: "data_pagamento", formato: "data" },
  { header: "Base Líquida", key: "base_liquida", formato: "moeda" },
  { header: "% Repasse", key: "percentual_repasse", formato: "percentual" },
  { header: "Valor do Repasse", key: "valor_repasse_total", formato: "moeda", width: 18 },
];

const COLS_PARCEIRO_DETALHE: ColunaExport[] = [
  { header: "Nº Apólice", key: "numero_apolice", formato: "texto", width: 26 },
  { header: "Tomador", key: "tomador", formato: "texto", width: 34 },
  { header: "Segurado", key: "segurado", formato: "texto", width: 34 },
  { header: "Ramo", key: "ramo", formato: "texto" },
  { header: "Seguradora", key: "seguradora", formato: "texto", width: 24 },
  { header: "Data Emissão", key: "data_emissao", formato: "data" },
  { header: "Início Vigência", key: "inicio_vigencia", formato: "data" },
  { header: "Fim Vigência", key: "fim_vigencia", formato: "data" },
  { header: "Nº da Parcela", key: "numero_da_parcela", formato: "inteiro" },
  { header: "Qtd Parcelas", key: "qtd_parcelas", formato: "inteiro" },
  { header: "Data Pagamento", key: "data_pagamento", formato: "data" },
  { header: "Status da Parcela", key: "status_parcela_comissao", formato: "texto", width: 24 },
  { header: "Comissão Recebida", key: "valor_recebido_a_receber", formato: "moeda", width: 18 },
  { header: "% Imposto", key: "percentual_imposto", formato: "percentual" },
  { header: "Base Líquida", key: "base_liquida", formato: "moeda" },
  { header: "% Repasse", key: "percentual_repasse", formato: "percentual" },
  { header: "Valor do Repasse", key: "valor_repasse_total", formato: "moeda", width: 18 },
  { header: "Status do Repasse", key: "status_repasse", formato: "texto" },
];

// Colunas que NUNCA podem sair no arquivo do parceiro.
const COLS_PROIBIDAS_PARCEIRO = new Set([
  "documento", "observacao", "analise", "premio_total", "premio_parcela", "valor_is",
  "percentual_comissao", "comissao_emitida", "comissao_bruta", "imposto_ret", "valor_iss",
]);

function slugCanal(canal: string) {
  return canal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
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

  const mesCorrente = useMemo(() => {
    const d = nowBRT();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }, []);

  const [mesAncora, setMesAncora] = useState(mesCorrente);
  const [canal, setCanal] = useState<string | null>(null);
  const [situacaoKey, setSituacaoKey] = useState<SituacaoKey>("AVENCER_APURADO");

  const sit = SITUACOES.find((s) => s.key === situacaoKey)!;
  const isHistorico = sit.modo === "HISTORICO";

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
                style={{ background: "rgba(0,186,242,0.18)", color: CYAN }}
              >
                padrão: corrente
              </span>
            </label>
            <input
              type="month"
              style={{ ...selectStyle, minWidth: 150 }}
              value={`${mesAncora.ano}-${String(mesAncora.mes).padStart(2, "0")}`}
              onChange={(e) => {
                const [a, m] = e.target.value.split("-").map(Number);
                if (a && m) setMesAncora({ ano: a, mes: m });
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
              titulo={`A pagar em 10/${String(mesAncora.mes).padStart(2, "0")}`}
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
                          <TableCell className="font-medium" style={{ color: NAVY }}>{l.canal}</TableCell>
                          <TableCell className="border-l text-right font-mono tabular-nums" style={{ borderColor: BORDER }}>
                            {valorCell(l.pago)}
                          </TableCell>
                          <TableCell className="border-l text-right" style={{ borderColor: BORDER }}>{pill(l.situacao)}</TableCell>
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
                      </TableRow>
                    </>
                  ) : (
                    <>
                      {grupoAPagar.length > 0 && (
                        <>
                          {grupoAPagar.map((l) => (
                            <LinhaCanal key={l.canal} l={l} info={porCanal.get(l.canal)} pill={pill} valorCell={valorCell} border={BORDER} navy={NAVY} />
                          ))}
                          <SubtotalRow
                            label={`A pagar em 10/${String(mesAncora.mes).padStart(2, "0")}`}
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
                              colSpan={8}
                              className="text-[12px] font-medium"
                              style={{ background: "#FEF3C7", color: "#92400E" }}
                            >
                              Abaixo do mínimo de R$ 100,00 por parceiro · não sai neste ciclo e acumula sozinho para o próximo
                            </TableCell>
                          </TableRow>
                          {grupoRetido.map((l) => (
                            <LinhaCanal key={l.canal} l={l} info={porCanal.get(l.canal)} pill={pill} valorCell={valorCell} border={BORDER} navy={NAVY} />
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
                style={{ background: "rgba(0,186,242,0.18)", color: CYAN }}
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
    </div>
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

function LinhaCanal({
  l,
  info,
  pill,
  valorCell,
  border,
  navy,
}: {
  l: Linha;
  info?: { parcelas: number; maiorOrdem: number; maisAntigo: string | null };
  pill: (s: Linha["situacao"]) => React.ReactNode;
  valorCell: (v: number) => React.ReactNode;
  border: string;
  navy: string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium" style={{ color: navy }}>
        <div className="flex items-center gap-2">
          {l.canal}
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
      <TableCell className="border-l text-right" style={{ borderColor: border }}>{pill(l.situacao)}</TableCell>
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
    </TableRow>
  );
}
