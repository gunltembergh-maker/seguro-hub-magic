// =====================================================================
// Normalizadores de payload de bureau judicial.
//
// Por que este arquivo existe separado: os processos chegam por DOIS
// caminhos — o webhook (monitoramento contínuo) e a consulta sob demanda
// (a solicitação que o time de Garantia abre na tela). Se cada caminho
// tivesse seu normalizador, eles divergiriam, e o classificador passaria
// a ver campos diferentes dependendo de como o processo entrou. Aqui é um
// só, sem dependência de banco, e por isso testável.
//
// Adicionar um fornecedor novo = escrever uma função `deXxx` e registrá-la
// em NORMALIZADORES. Nada mais.
// =====================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { soDigitos, toNum } from "./format.ts";

export interface MovNorm {
  data: string | null;
  tipo: string | null;
  codigo_tpu: string | null;
  texto: string | null;
}

export interface ProcNorm {
  documento: string;
  razao_social: string | null;
  numero: string;
  area: string | null;
  tribunal: string | null;
  uf: string | null;
  orgao_julgador: string | null;
  classe: string | null;
  classe_codigo: string | null;
  status: string | null;
  polo: string | null;
  distribuicao: string | null;
  valor_causa: number;
  valor_execucao: number;
  assuntos: string[];
  movimentacoes: MovNorm[];
  raw: unknown;
}

const soData = (v: unknown): string | null => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** Normaliza o polo para ATIVO | PASSIVO, preservando o desconhecido. */
function polo(bruto: unknown): string | null {
  const s = String(bruto ?? "").toUpperCase();
  if (s === "ACTIVE" || s === "ATIVO" || s === "AUTOR" || s === "EXEQUENTE") return "ATIVO";
  if (s === "PASSIVE" || s === "PASSIVO" || s === "REU" || s === "EXECUTADO") return "PASSIVO";
  return s || null;
}

// ---------------------------------------------------------------------
// Judit — https://docs.judit.io/
// ---------------------------------------------------------------------
export function deJudit(x: Record<string, any>, documentoBusca?: string): ProcNorm {
  const partes: any[] = x.parties ?? [];
  const alvo = documentoBusca ? soDigitos(documentoBusca) : "";
  let poloAlvo: string | null = null;
  let razao: string | null = null;
  for (const p of partes) {
    if (alvo && soDigitos(p.main_document) === alvo) {
      poloAlvo = polo(p.side);
      razao = p.name ?? null;
    }
  }
  return {
    documento: soDigitos(documentoBusca ?? partes[0]?.main_document),
    razao_social: razao,
    numero: soDigitos(x.code),
    area: (x.area ?? "").toUpperCase() || null,
    tribunal: x.tribunal_acronym ?? null,
    uf: x.state ?? null,
    orgao_julgador: x.judging_body ?? null,
    classe: x.classification ?? (Array.isArray(x.classifications) ? x.classifications[0] : null),
    classe_codigo: x.classification_code ?? null,
    status: x.status ?? null,
    // Sem parte identificada, presumir PASSIVO é o certo para o nosso
    // caso: quem precisa de garantia é quem está sendo executado.
    polo: poloAlvo ?? "PASSIVO",
    distribuicao: soData(x.distribution_date),
    valor_causa: toNum(x.amount),
    valor_execucao: toNum(x.execution_amount),
    assuntos: (x.subjects ?? []).map((s: any) => (typeof s === "string" ? s : s?.name ?? "")),
    movimentacoes: (x.steps ?? []).map((s: any) => ({
      data: soData(s.step_date),
      tipo: s.step_type ?? null,
      codigo_tpu: s.step_code ?? null,
      texto: s.content ?? null,
    })),
    raw: x,
  };
}

// ---------------------------------------------------------------------
// Digesto — entrega texto de anexo já extraído, mais rico que a ementa
// ---------------------------------------------------------------------
export function deDigesto(x: Record<string, any>, documentoBusca?: string): ProcNorm {
  return {
    documento: soDigitos(documentoBusca ?? x.documento),
    razao_social: x.nome ?? null,
    numero: soDigitos(x.numero),
    area: (x.area ?? "").toUpperCase() || null,
    tribunal: x.tribunal ?? null,
    uf: x.uf ?? null,
    orgao_julgador: x.vara ?? null,
    classe: x.classeNatureza ?? null,
    classe_codigo: x.classeCodigo ?? null,
    status: x.situacao ?? null,
    polo: polo(x.polo) ?? "PASSIVO",
    distribuicao: soData(x.distribuicaoData),
    valor_causa: toNum(x.valor),
    valor_execucao: toNum(x.valorExecucao),
    assuntos: x.assuntos ?? [],
    movimentacoes: (x.movs ?? []).map((m: any) => ({
      data: soData(m.data),
      tipo: m.tipo ?? null,
      codigo_tpu: m.codigo ?? null,
      // é aqui que o Digesto ganha: a decisão de penhora costuma estar no
      // PDF, não no resumo do andamento
      texto: [m.texto, m.anexoTexto].filter(Boolean).join("\n") || null,
    })),
    raw: x,
  };
}

// ---------------------------------------------------------------------
// Escavador — envelope documentado, ainda não exercitado contra a rede.
// Marcado VALIDAR: confira os nomes na primeira resposta real antes de
// confiar nos números.
// ---------------------------------------------------------------------
export function deEscavador(x: Record<string, any>, documentoBusca?: string): ProcNorm {
  const fontes: any[] = x.fontes ?? [];
  const principal = fontes[0] ?? {};
  const capa = principal.capa ?? {};
  return {
    documento: soDigitos(documentoBusca ?? x.documento),
    razao_social: null,
    numero: soDigitos(x.numero_cnj ?? x.numero),
    area: (capa.area ?? x.area ?? "").toUpperCase() || null,
    tribunal: principal.sigla_tribunal ?? x.tribunal ?? null,
    uf: x.estado_origem?.sigla ?? null,
    orgao_julgador: capa.orgao_julgador ?? null,
    classe: capa.classe ?? null,
    classe_codigo: null,
    status: capa.situacao ?? null,
    polo: polo(x.polo) ?? "PASSIVO",
    distribuicao: soData(x.data_inicio ?? capa.data_distribuicao),
    valor_causa: toNum(capa.valor_causa?.valor ?? capa.valor_causa),
    valor_execucao: 0,
    assuntos: (capa.assuntos ?? []).map((a: any) => (typeof a === "string" ? a : a?.titulo ?? "")),
    movimentacoes: (x.movimentacoes ?? principal.movimentacoes ?? []).map((m: any) => ({
      data: soData(m.data),
      tipo: m.tipo ?? m.tipo_publicacao ?? null,
      codigo_tpu: null,
      texto: m.conteudo ?? m.texto_categoria ?? null,
    })),
    raw: x,
  };
}

// ---------------------------------------------------------------------
export type Normalizador = (x: Record<string, any>, doc?: string) => ProcNorm;

export const NORMALIZADORES: Record<string, Normalizador> = {
  judit: deJudit,
  digesto: deDigesto,
  escavador: deEscavador,
  // Predictus e Jusbrasil entram aqui quando houver payload real para ler.
  // Sem uma resposta de verdade na mão, escrever o normalizador é chute —
  // e chute em normalizador vira número errado na fila de vendas.
};

/**
 * Extrai a lista de processos de um payload de fornecedor, seja o corpo de
 * um webhook, seja a resposta de uma consulta sob demanda.
 *
 * O piso de 15 dígitos no número é proposital, e não é o CNJ. O padrão CNJ
 * tem 20 dígitos, mas execução trabalhista antiga ainda circula com
 * numeração anterior, mais curta — exigir 20 descartaria processo real, e
 * processo real descartado é lead perdido em silêncio. Abaixo de 15 é
 * lixo de payload, e lead fantasma queima a confiança do time.
 */
export function normalizarPayload(payload: any, provedor: string): ProcNorm[] {
  const fn = NORMALIZADORES[(provedor ?? "").toLowerCase()] ?? deJudit;
  const doc = payload?.search_key ?? payload?.documento ?? payload?.document ?? undefined;

  const bruto: any[] =
    payload?.lawsuits ?? payload?.response_data ?? payload?.page_data ??
    payload?.processos ?? payload?.items ?? payload?.data ??
    (Array.isArray(payload) ? payload : payload?.lawsuit ? [payload.lawsuit] : []);

  return (bruto ?? [])
    .map((x) => fn(x, doc))
    .filter((p) => p.numero.length >= 15 && (p.documento.length === 11 || p.documento.length === 14));
}
