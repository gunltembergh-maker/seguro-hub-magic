// =====================================================================
// Precificação e priorização.
//
// Toda a matemática comercial em um lugar só, para o time de Garantia
// auditar e calibrar. Os números vêm da tabela ab_parametro — mudar taxa
// ou comissão é UPDATE no banco, não deploy.
//
//   IS   = valor_base × fator × (1 + acréscimo)      ← fato + regra legal
//   prio = IS × urgência × p(subscrição) × confiança  ← ordenação
//
// ---------------------------------------------------------------------
// POR QUE NÃO HÁ COMISSÃO AQUI (decisão do Alessandro, 25/08/2026)
//
// Comissão varia por seguradora e por empresa; taxa de prêmio varia por
// seguradora, prazo, limite de crédito e apetite. Um número calculado a
// partir de um percentual fixo chega à tela com cara de cálculo e é
// palpite — e o comercial cotaria cliente com base nele.
//
// Então prêmio e comissão saíram do caminho automático e viraram
// SIMULAÇÃO de campo aberto: o comercial digita a taxa (ou o prêmio que a
// seguradora cotou) e a tela devolve o resto. É a função `simular()` no
// fim deste arquivo, e ela não grava nada.
//
// A fila continua na mesma ordem: `taxa_ref` era um valor único aplicado
// a todos os leads, então prêmio era sempre IS × 0,015. Multiplicar tudo
// pela mesma constante não muda ordenação nenhuma — ranquear por IS dá
// exatamente a mesma fila, sem número fictício no meio.
// =====================================================================

export interface Parametros {
  selic_aa: number;
  taxa_min: number;
  taxa_ref: number;
  taxa_max: number;
  acrescimo_execucao: number;
  ticket_minimo: number;
  /** Prazo presumido para apresentar garantia contratual, em dias. */
  prazo_garantia_dias: number;
}

/**
 * Padrões de partida. Dois destes são estimativa, não dado da Lavoro:
 *
 *   taxa_min / taxa_ref / taxa_max — não existe taxa única. A faixa de
 *               0,5% a 3% entra na tela como REFERÊNCIA ao lado do campo
 *               de simulação, nunca como "o prêmio é este".
 *   prazo_garantia_dias — a lei não fixa prazo; ele vem do edital. E é ele
 *               que move a urgência da modalidade PERFORMANCE.
 *
 * Calibrar é UPDATE em ab_parametro.
 */
export const PARAMETROS_PADRAO: Parametros = {
  selic_aa: 0.15,
  taxa_min: 0.005,
  taxa_ref: 0.015,
  taxa_max: 0.03,
  acrescimo_execucao: 0.3,
  ticket_minimo: 50_000,
  prazo_garantia_dias: 10,
};

export type Modalidade =
  | "JUDICIAL"
  | "FISCAL"
  | "LICITACAO"
  | "PERFORMANCE"
  | "LOCATICIA"
  | "OUTROS";

/** Acréscimo legal sobre o débito. CPC 835 §2º e Ato Conjunto TST 1/2019. */
export function acrescimo(mod: Modalidade, p: Parametros): number {
  return mod === "JUDICIAL" || mod === "FISCAL" ? p.acrescimo_execucao : 0;
}

/** Percentual do valor de referência que se torna Importância Segurada. */
export const FATOR_IS: Record<Modalidade, number> = {
  JUDICIAL: 1.0,
  FISCAL: 1.0,
  LICITACAO: 0.01, // art. 58 da Lei 14.133/2021 — até 1% do valor estimado
  PERFORMANCE: 0.05, // art. 98 — 5% (10% justificado)
  LOCATICIA: 1.0,
  OUTROS: 1.0,
};

export interface Preco {
  valorBase: number;
  /** O que o cliente precisa apresentar. Fato + regra legal, não estimativa. */
  importanciaSegurada: number;
  /** Faixa de referência de mercado. Serve de dica ao lado do campo, não de cotação. */
  premioMin: number;
  premioRef: number;
  premioMax: number;
}

export function precificar(
  valorBase: number,
  modalidade: Modalidade,
  opts: { fatorIs?: number | null; grandeVulto?: boolean; params?: Parametros } = {},
): Preco {
  const p = opts.params ?? PARAMETROS_PADRAO;
  let fator = opts.fatorIs ?? FATOR_IS[modalidade] ?? 1;
  // art. 99: obras de grande vulto (> R$ 200 mi) — até 30% com cláusula de retomada
  if (modalidade === "PERFORMANCE" && opts.grandeVulto) fator = 0.3;

  const base = Math.max(0, valorBase);
  const is = base * fator * (1 + acrescimo(modalidade, p));
  const premioRef = is * p.taxa_ref;

  return {
    valorBase: base,
    importanciaSegurada: is,
    premioMin: is * p.taxa_min,
    premioRef,
    premioMax: is * p.taxa_max,
  };
}

// ---------------------------------------------------------------------
// SIMULAÇÃO — o que o comercial faz na tela, com os números dele.
//
// Pura de propósito: nada aqui é gravado, e por isso pode ser recalculada
// a cada tecla. Aceita os dois caminhos que o comercial usa de verdade:
// digitar a taxa e ver o prêmio, ou digitar o prêmio que a seguradora
// cotou e ver a comissão.
// ---------------------------------------------------------------------
export interface Simulacao {
  premio: number;
  comissao: number;
  /** Custo de deixar o dinheiro parado no juízo, menos o prêmio. */
  economiaCliente: number;
}

export function simular(args: {
  importanciaSegurada: number;
  /** Valor que ficaria imobilizado. Em regra é a IS sem os 30% legais. */
  valorImobilizado?: number;
  /** Fração, não percentual: 0,015 e não 1,5. Ignorada se `premio` vier. */
  taxaPremio?: number;
  /** Prêmio cotado pela seguradora, em reais. Ganha da taxa quando vem. */
  premio?: number;
  /** Fração. Sem isto, a comissão volta zero — não há padrão a inventar. */
  taxaComissao?: number;
  selicAa?: number;
}): Simulacao {
  const is = Math.max(0, args.importanciaSegurada || 0);
  const premio = args.premio !== undefined && args.premio !== null
    ? Math.max(0, args.premio)
    : is * Math.max(0, args.taxaPremio ?? 0);
  const comissao = premio * Math.max(0, args.taxaComissao ?? 0);
  const imobilizado = args.valorImobilizado ?? is;
  const selic = args.selicAa ?? PARAMETROS_PADRAO.selic_aa;
  return {
    premio,
    comissao,
    economiaCliente: Math.max(0, imobilizado * selic - premio),
  };
}

/** 1,0 = vence hoje. Prazo muito vencido decai: vale contato, não corrida. */
export function urgencia(deadline: string | Date | null | undefined, hoje = new Date()): number {
  if (!deadline) return 0.45;
  const d = typeof deadline === "string" ? new Date(deadline + "T00:00:00") : deadline;
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < -45) return 0.3;
  if (dias < -7) return 0.6;
  if (dias <= 0) return 1.0;
  if (dias <= 8) return 0.95;
  if (dias <= 15) return 0.85;
  if (dias <= 30) return 0.7;
  if (dias <= 90) return 0.5;
  return 0.3;
}

/** Heurística de apetite da seguradora. Calibrar com as parceiras. */
export function probSubscricao(args: {
  porte?: string | null;
  capitalSocial?: number | null;
  situacaoCadastral?: string | null;
  restritivos: string[];
  cnaePrioritario: boolean;
}): number {
  let p = 0.62;
  const porte = (args.porte ?? "").toUpperCase();
  if (porte.includes("DEMAIS") || porte.includes("GRANDE")) p += 0.12;
  else if (porte.includes("MEDIO") || porte.includes("MÉDIO")) p += 0.05;
  else if (porte.includes("MICRO") || porte === "ME") p -= 0.12;

  if (args.capitalSocial && args.capitalSocial > 0) {
    p += Math.min(0.12, Math.log10(Math.max(args.capitalSocial, 1)) / 100);
  }
  if (args.situacaoCadastral && !args.situacaoCadastral.toUpperCase().includes("ATIVA")) p -= 0.35;
  if (args.cnaePrioritario) p += 0.06;

  const r = new Set(args.restritivos);
  if (r.has("CEIS") || r.has("CNEP") || r.has("CEPIM")) p -= 0.3;
  if (r.has("RJ")) p -= 0.45;
  if (r.has("PROTESTO")) p -= 0.08;

  return Math.max(0.03, Math.min(0.97, p));
}

/**
 * Ordem de atendimento da fila.
 *
 *   prioridade = prêmio × urgência × p(subscrição) × confiança
 *
 * A confiança entrou aqui depois de um erro meu: ela existia por evento,
 * mas não chegava à prioridade. O efeito era o avesso do certo para uma
 * fila de vendas — uma HIPÓTESE com prêmio maior ficava na frente de um
 * FATO com prêmio menor. Penhora encontrada no texto do andamento é fato
 * (0,95); contrato público assinado é hipótese (0,55), porque a garantia
 * contratual é facultativa (Lei 14.133/2021, art. 96).
 *
 * O padrão 1 mantém compatibilidade com chamadas antigas, mas o motor
 * sempre informa a confiança.
 */
export function prioridade(
  importanciaSegurada: number,
  urg: number,
  pSub: number,
  bloqueado: boolean,
  confianca = 1,
): number {
  if (bloqueado) return 0;
  const c = Math.min(1, Math.max(0, confianca));
  return Math.round(importanciaSegurada * urg * pSub * c * 100) / 100;
}

/**
 * Como somar o valor base quando há vários gatilhos na mesma modalidade.
 * "max" evita contar duas vezes o MESMO crédito — dívida ativa e a execução
 * fiscal que a cobra são o mesmo débito.
 */
export const AGREGACAO: Record<Modalidade, "sum" | "max"> = {
  FISCAL: "max",
  LICITACAO: "max",
  LOCATICIA: "max",
  JUDICIAL: "sum",
  PERFORMANCE: "sum",
  OUTROS: "sum",
};

export function agregar(valores: number[], modalidade: Modalidade): number {
  if (!valores.length) return 0;
  return AGREGACAO[modalidade] === "max"
    ? Math.max(...valores)
    : valores.reduce((a, b) => a + b, 0);
}

/** CNAEs (2 dígitos) que formam o mercado natural de garantia. */
export const CNAE_PRIORITARIOS = new Set([
  "41", "42", "43", // construção
  "35", "36", "37", "38", "39", // energia, água, saneamento
  "49", "50", "51", "52", // transporte e logística
  "71", "72", // serviços de engenharia e pesquisa
  "45", "46", "47", // comércio
  "10", "11", "20", "21", "22", "23", "24", "25", // indústria
]);
