// Exportação do repasse de parceiro — módulo único, usado pelo Financeiro
// (Fluxo Diário) e pelo Comercial (Canal Parceiros).
//
// A lista de colunas proibidas protege a margem da Lavoro: prêmio, comissão
// bruta e percentual de comissão NUNCA saem no arquivo do parceiro.
import { supabase } from "@/integrations/supabase/client";
import { exportarXlsx, type ColunaExport } from "@/lib/export-xlsx";

export type ModoExport = "INTERNO" | "PARCEIRO";
export type ModoDados = "PROVISIONADO" | "HISTORICO";

const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const COLS_INTERNO: ColunaExport[] = [
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

export const COLS_PARCEIRO_RESUMO: ColunaExport[] = [
  { header: "Nº Apólice", key: "numero_apolice", formato: "texto", width: 26 },
  { header: "Tomador", key: "tomador", formato: "texto", width: 34 },
  { header: "Parcela", key: "parcela", formato: "texto", width: 10 },
  { header: "Data Pgto Comissão", key: "data_pagamento", formato: "data" },
  { header: "Base Líquida", key: "base_liquida", formato: "moeda" },
  { header: "% Repasse", key: "percentual_repasse", formato: "percentual" },
  { header: "Valor do Repasse", key: "valor_repasse_total", formato: "moeda", width: 18 },
];

export const COLS_PARCEIRO_DETALHE: ColunaExport[] = [
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
export const COLS_PROIBIDAS_PARCEIRO = new Set([
  "documento", "observacao", "analise", "premio_total", "premio_parcela", "valor_is",
  "percentual_comissao", "comissao_emitida", "comissao_bruta", "imposto_ret", "valor_iss",
]);

export function slugCanal(canal: string) {
  return canal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Mesma normalização do banco: sem acento e em maiúsculas. */
export function chaveCanal(canal: string) {
  return canal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "";

export type ResultadoExportacao = { arquivo: string; truncado: boolean; dataPrevista: string | null };

export class NadaAExportar extends Error {
  constructor() {
    super("Nada a exportar para este parceiro neste ciclo");
    this.name = "NadaAExportar";
  }
}

/**
 * Autoriza no banco, busca o detalhe e baixa a planilha.
 * A data prevista vem SEMPRE do ciclo (o banco devolve); a tela não escolhe.
 */
export async function exportarRepasse(opts: {
  canal: string;
  ano: number;
  mes: number;
  modo: ModoExport;
  modoDados: ModoDados;
  situacaoRepasse: string | null;
}): Promise<ResultadoExportacao> {
  const { canal, ano, mes, modo, modoDados, situacaoRepasse } = opts;

  // O banco autoriza (ou recusa) a exportação ANTES de montar o arquivo.
  // No modo PARCEIRO a autorização depende da demanda aprovada pelo Financeiro.
  const { data: autz, error: erroAutz } = await supabase.rpc(
    (modo === "PARCEIRO"
      ? "rpc_canal_repasse_autorizar_envio_parceiro"
      : "rpc_canal_parceiro_autorizar_exportacao") as never,
    {
      p_canal_planilha: canal,
      p_ano: ano,
      p_mes: mes,
      p_linhas: null,
      p_valor: null,
    } as never,
  );
  if (erroAutz) throw new Error(erroAutz.message);

  const autorizacao = (Array.isArray(autz) ? autz[0] : autz) as {
    base?: string;
    liberado_por?: string | null;
    data_prevista?: string | null;
    rotulo_status?: string | null;
    aprovado_por_nome?: string | null;
  } | null;
  const dataPrevista = autorizacao?.data_prevista ?? null;

  const PAGINA = 500;
  let offset = 0;
  const todas: any[] = [];
  let truncado = false;
  for (let i = 0; i < 40; i++) {
    const { data, error } = await supabase.rpc("rpc_lavoro_repasse_detalhe" as never, {
      p_ano: ano,
      p_mes: mes,
      p_modo: modoDados,
      p_canal_repasse: canal,
      p_situacao_repasse: situacaoRepasse,
      p_limit: PAGINA,
      p_offset: offset,
    } as never);
    if (error) throw error;
    const lote = (data || []) as any[];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
    if (i === 39) truncado = true;
    offset += PAGINA;
  }

  if (todas.length === 0) throw new NadaAExportar();

  // Aviso (não trava): divergência entre o percentual da base gerencial e a regra do Hub.
  // Só no arquivo interno — o do parceiro não leva esse assunto. Erro aqui nunca impede a exportação.
  let avisoDivergencia: string | null = null;
  if (modo === "INTERNO") {
    try {
      const { data: div } = await supabase.rpc("rpc_canal_repasse_divergencia_pct" as never, {
        p_ano: ano,
        p_mes: mes,
        p_canal_repasse: canal,
      } as never);
      const primeira = (Array.isArray(div) ? div[0] : div) as { resumo?: string } | null;
      avisoDivergencia = primeira?.resumo ?? null;
    } catch {
      // ignorado: o aviso nunca pode impedir o arquivo de sair
    }
  }

  const totalRepasse = todas.reduce((acc, r) => acc + (Number(r.valor_repasse_total) || 0), 0);
  const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;
  const info = [
    { rotulo: "Parceiro", valor: canal },
    { rotulo: "Ciclo", valor: `${MESES_LONGOS[mes - 1]} / ${ano}` },
    { rotulo: "Total a repassar", valor: BRL(totalRepasse) },
    { rotulo: "Parcelas", valor: String(todas.length) },
    ...(dataPrevista
      ? [{ rotulo: "Data prevista de pagamento", valor: fmtBR(dataPrevista) }]
      : []),
    ...(modo === "PARCEIRO" && autorizacao?.rotulo_status
      ? [{ rotulo: "Status do repasse", valor: autorizacao.rotulo_status }]
      : []),
    ...(modo === "PARCEIRO" && autorizacao?.aprovado_por_nome
      ? [{ rotulo: "Autorizado por", valor: autorizacao.aprovado_por_nome }]
      : []),
    ...(autorizacao?.base === "LIBERACAO_EXCEPCIONAL"
      ? [{ rotulo: "Liberado por", valor: autorizacao.liberado_por ?? "" }]
      : []),
  ];

  let arquivo: string;
  if (modo === "INTERNO") {
    arquivo = `Repasse_${slugCanal(canal)}_${anoMes}.xlsx`;
    await exportarXlsx({
      arquivo,
      cabecalho: { titulo: "Repasse de Parceiro · conferência interna", subtitulo: `${canal} · ${anoMes}`, info },
      abas: [{ nome: "Detalhe", colunas: COLS_INTERNO, linhas: todas, totalizar: ["valor_repasse_total"], semLinhasDeGrade: true }],
    });
  } else {
    // Garantia: nenhuma coluna proibida sai no arquivo do parceiro.
    const abasCols = [COLS_PARCEIRO_RESUMO, COLS_PARCEIRO_DETALHE];
    for (const cols of abasCols) {
      for (const c of cols) if (COLS_PROIBIDAS_PARCEIRO.has(c.key)) throw new Error(`Coluna proibida no modo parceiro: ${c.key}`);
    }
    function projetar(linha: any, cols: ColunaExport[]) {
      const out: Record<string, unknown> = {};
      for (const c of cols) out[c.key] = linha[c.key];
      out.parcela = `${linha.numero_da_parcela ?? ""} / ${linha.qtd_parcelas ?? ""}`;
      return out;
    }
    const linhasResumo = todas.map((r) => projetar(r, COLS_PARCEIRO_RESUMO));
    const linhasDetalhe = todas.map((r) => projetar(r, COLS_PARCEIRO_DETALHE));
    arquivo = `Repasse_${slugCanal(canal)}_${anoMes}_parceiro.xlsx`;
    await exportarXlsx({
      arquivo,
      cabecalho: { titulo: "Repasse de Parceiro", subtitulo: "RELAÇÃO PARA CONFERÊNCIA E EMISSÃO DE NOTA", info },
      abas: [
        {
          nome: "Resumo",
          colunas: COLS_PARCEIRO_RESUMO,
          linhas: linhasResumo,
          totalizar: ["base_liquida", "valor_repasse_total"],
          nota:
            "Valor do Repasse = Comissão Recebida × (1 − % Imposto) × % Repasse. A aba Detalhe traz a conta aberta linha a linha.\n" +
            "O pagamento será efetuado somente após o envio da nota fiscal.",
          semLinhasDeGrade: true,
        },
        { nome: "Detalhe", colunas: COLS_PARCEIRO_DETALHE, linhas: linhasDetalhe, totalizar: ["valor_repasse_total"], semLinhasDeGrade: true },
      ],
    });
  }

  return { arquivo, truncado, dataPrevista };
}
