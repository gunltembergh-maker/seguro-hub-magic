// =====================================================================
// Classificador de andamentos — o ativo proprietário do Hub.
//
// Nenhum fornecedor de dados no Brasil vende um campo "bloqueio judicial".
// O SISBAJUD é sistema fechado (LC 105/2001). O que é público é o ATO
// PROCESSUAL: o movimento e o texto da decisão. Este módulo transforma
// esse texto em sinais tipados.
//
// Começa como dicionário curado + regex, porque a linguagem judicial é
// formulaica e a precisão inicial é alta. O dicionário também vive na
// tabela ab_sinal, para o jurídico ajustar sem deploy — o código aqui
// é o fallback e a fonte da verdade dos testes.
// =====================================================================

export type Categoria = "CONSTRICAO" | "EXIGENCIA" | "FASE" | "RESOLVIDO" | "NEGATIVO";

export interface Sinal {
  nome: string;
  padrao: string;
  peso: number;
  categoria: Categoria;
}

export const SINAIS: Sinal[] = [
  // --- constrição efetivada (urgência máxima) ---
  {
    nome: "BLOQUEIO_ATIVOS",
    padrao:
      "(\\bsisbajud\\b|\\bbacenjud\\b" +
      "|bloqueio (de (ativos|valores|quantia|numerario)|judicial|de contas?)" +
      "|ordem de bloqueio" +
      "|penhora (on ?line|de ativos financeiros|de dinheiro em (deposito|aplicacao))" +
      "|(valores?|ativos|quantias?) (foram )?(tornados?|tornada|declarados?) indisponive" +
      "|indisponibilidade de (ativos|valores|quantia)" +
      "|constricao de ativos financeiros)",
    peso: 0.95,
    categoria: "CONSTRICAO",
  },
  {
    nome: "PENHORA_DEFERIDA",
    padrao:
      "\\b(defiro a penhora|deferida a penhora|determino a penhora|penhora deferida" +
      "|auto de penhora|termo de penhora)\\b",
    peso: 0.92,
    categoria: "CONSTRICAO",
  },
  {
    nome: "ARRESTO",
    padrao: "\\b(arresto|sequestro de bens|indisponibilidade de bens)\\b",
    peso: 0.88,
    categoria: "CONSTRICAO",
  },
  { nome: "PENHORA_MENCAO", padrao: "\\bpenhora\\b", peso: 0.55, categoria: "CONSTRICAO" },

  // --- exigência explícita de garantia (o gatilho perfeito) ---
  {
    nome: "EXIGE_GARANTIA",
    padrao:
      "\\b(preste? caucao|prestar caucao|apresente? garantia|garantia do juizo" +
      "|reforco de penhora|garantir o juizo|intime-se para garantir)\\b",
    peso: 0.97,
    categoria: "EXIGENCIA",
  },
  { nome: "SEGURO_GARANTIA_MENCAO", padrao: "\\bseguro[- ]garantia\\b", peso: 0.8, categoria: "EXIGENCIA" },
  { nome: "FIANCA_BANCARIA", padrao: "\\b(fianca bancaria|carta de fianca)\\b", peso: 0.8, categoria: "EXIGENCIA" },

  // --- fase de execução ---
  {
    nome: "EXECUCAO_INICIADA",
    padrao:
      "\\b(cumprimento de sentenca|inicio da execucao|execucao (definitiva|provisoria)" +
      "|citacao para pagar|intime-se para pagamento)\\b",
    peso: 0.85,
    categoria: "FASE",
  },
  {
    nome: "EXECUCAO_FISCAL",
    padrao: "\\b(execucao fiscal|certidao de divida ativa|\\bcda\\b|embargos a execucao fiscal)\\b",
    peso: 0.88,
    categoria: "FASE",
  },
  {
    nome: "DEPOSITO_RECURSAL",
    padrao:
      "\\b(deposito recursal|guia (de )?gfip|comprovacao do deposito recursal|preparo recursal)\\b",
    peso: 0.9,
    categoria: "FASE",
  },
  {
    nome: "SENTENCA_CONDENATORIA",
    padrao:
      "\\b(julgo\\s+(parcialmente\\s+)?procedent" +
      "|julgo\\s+procedentes?\\s+em\\s+parte" +
      "|conden(o|ei)\\s+(a|o)\\s" +
      "|conden(ada|ado)\\s+(a|o|ao)\\s" +
      "|sentenca\\s+de\\s+procedencia" +
      "|acolho\\s+(parcialmente\\s+)?(o\\s+pedido|os\\s+pedidos))",
    peso: 0.82,
    categoria: "FASE",
  },
  {
    nome: "RECURSO_INTERPOSTO",
    padrao: "\\b(recurso ordinario|apelacao|agravo de peticao|recurso de revista)\\b",
    peso: 0.65,
    categoria: "FASE",
  },

  // --- garantia já prestada: o filtro anti-falso-positivo mais importante ---
  {
    nome: "GARANTIA_ACEITA",
    padrao:
      "\\b(garantia (aceita|homologada|suficiente)|homologo a (apolice|garantia)" +
      "|substituicao da penhora (deferida|homologada)" +
      "|apolice de seguro garantia (juntada|aceita)" +
      "|deposito (integral|judicial) (realizado|efetuado)|carta de fianca aceita)\\b",
    peso: 0.9,
    categoria: "RESOLVIDO",
  },
  {
    nome: "PENHORA_LEVANTADA",
    padrao:
      "\\b(levantamento da penhora|desbloqueio de valores|penhora (indeferida|cancelada)" +
      "|liberacao dos valores)\\b",
    peso: 0.85,
    categoria: "RESOLVIDO",
  },
  {
    nome: "EXTINCAO",
    padrao:
      "\\b(extincao da execucao|acordo homologado|quitacao|arquivamento definitivo" +
      "|transito em julgado com quitacao)\\b",
    peso: 0.8,
    categoria: "RESOLVIDO",
  },

  // --- sinais negativos de subscrição ---
  {
    nome: "RECUPERACAO_JUDICIAL",
    padrao: "\\b(recuperacao judicial|falencia|autofalencia)\\b",
    peso: 0.9,
    categoria: "NEGATIVO",
  },
  {
    nome: "IMPROBIDADE",
    padrao: "\\b(improbidade administrativa|acao civil publica)\\b",
    peso: 0.7,
    categoria: "FASE",
  },
];

// Códigos da Tabela Processual Unificada (CNJ). Quando o fornecedor entrega
// o código, ele é mais confiável que o texto. Validar na SGT do CNJ:
// https://www.cnj.jus.br/sgt/consulta_publica_classes.php
export const TPU_CONSTRICAO = new Set(["246", "11383", "11384", "11385"]);
export const TPU_CLASSE_EXEC_FISCAL = "1116";

const SINAIS_CONSTRICAO = new Set(["BLOQUEIO_ATIVOS", "PENHORA_DEFERIDA", "ARRESTO"]);
const SINAIS_RESOLVIDO = new Set(["GARANTIA_ACEITA", "PENHORA_LEVANTADA", "EXTINCAO"]);

const VALOR_RX = /r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/g;

// ---------------------------------------------------------------------
// PRAZO DECLARADO NO TEXTO
//
// Por que isto existe: até aqui todo deadline do módulo era um padrão —
// 8 dias para recurso, 15 para substituir penhora. Padrão serve para
// ordenar a fila, mas NÃO serve para o comercial dizer ao cliente "o
// senhor tem até dia 20". Uma data inventada apresentada como firme queima
// a credibilidade da Lavoro numa ligação, e ninguém teria como saber que
// era palpite.
//
// Então quando o andamento declara o prazo, é ele que vale, e o evento
// registra que a data veio do TEXTO. Quando não declara, o padrão entra
// marcado como padrão. A tela mostra a diferença.
//
// O texto chega normalizado (sem acento, minúsculo), por isso os padrões
// não têm acento.
// ---------------------------------------------------------------------
const PRAZO_POR_EXTENSO: Record<string, number> = {
  cinco: 5, oito: 8, dez: 10, quinze: 15, vinte: 20, trinta: 30, sessenta: 60,
};

const PRAZO_RX: RegExp[] = [
  // "no prazo de 15 dias", "prazo legal de 15 (quinze) dias"
  /prazo\s+(?:legal\s+|improrrogavel\s+|comum\s+)?de\s+(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?dias/,
  // "no prazo de quinze dias"
  /prazo\s+(?:legal\s+|improrrogavel\s+|comum\s+)?de\s+(cinco|oito|dez|quinze|vinte|trinta|sessenta)\s+dias/,
  // "15 dias para apresentar garantia", "5 (cinco) dias uteis para indicar bens"
  /(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?dias\s+(?:uteis\s+)?para\s+(?:apresentar|indicar|oferecer|garantir|efetuar|pagar|comprovar|substituir|nomear)/,
  // "cite-se para pagar em 5 dias ou garantir a execucao" — a formula do
  // art. 8º da LEF, e o caso que eu tinha deixado passar: o numero vem
  // DEPOIS do verbo. `[^.;]` impede atravessar frase: prazo de uma
  // determinacao nao pode virar prazo de outra.
  /(?:pagar|garantir|apresentar|indicar|oferecer|comprovar|substituir|nomear|efetuar|quitar)\b[^.;]{0,40}?\bem\s+(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?dias/,
  // "em 15 dias, sob pena de penhora, garantir o juizo" — o inverso
  /\bem\s+(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?dias\b[^.;]{0,40}?(?:pagar|garantir|apresentar|indicar|oferecer|comprovar|substituir|nomear)/,
];

function extrairPrazoDias(base: string): number | null {
  for (const rx of PRAZO_RX) {
    const m = rx.exec(base);
    if (!m) continue;
    const bruto = m[1];
    const n = /^\d+$/.test(bruto) ? Number(bruto) : PRAZO_POR_EXTENSO[bruto];
    // Acima de 180 dias quase certamente não é prazo processual — é
    // parcelamento, prescrição ou vigência de contrato.
    if (Number.isFinite(n) && n >= 1 && n <= 180) return n;
  }
  return null;
}

export interface Analise {
  sinais: string[];
  confianca: number;
  valores: number[];
  valorMaximo: number;
  fase: string | null;
  garantiaPrestada: boolean;
  bloqueio: boolean;
  exigeGarantia: boolean;
  /** Prazo em dias declarado no texto do andamento, quando declarado. */
  prazoDias: number | null;
  /**
   * Data do andamento de onde o prazo foi lido — a contagem parte dela, não
   * de hoje. Só é preenchida por `analisarProcesso`, que conhece as datas.
   */
  prazoBase: string | null;
}

/** Remove acento e normaliza espaços — o dicionário trabalha sem acento. */
export function normalizar(txt: string | null | undefined): string {
  if (!txt) return "";
  return String(txt)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseBRL(s: string): number {
  const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const v = Number.parseFloat(t);
  return Number.isFinite(v) ? v : 0;
}

let compilados: { nome: string; rx: RegExp; peso: number }[] | null = null;
let dicionarioAtual: Sinal[] = SINAIS;

/** Substitui o dicionário em memória (usado quando lemos de ab_sinal). */
export function carregarDicionario(sinais: Sinal[]): void {
  dicionarioAtual = sinais.length ? sinais : SINAIS;
  compilados = null;
}

function getCompilados() {
  if (!compilados) {
    compilados = dicionarioAtual.map((s) => ({
      nome: s.nome,
      rx: new RegExp(s.padrao),
      peso: s.peso,
    }));
  }
  return compilados;
}

function vazia(): Analise {
  return {
    sinais: [],
    confianca: 0,
    valores: [],
    valorMaximo: 0,
    fase: null,
    garantiaPrestada: false,
    bloqueio: false,
    exigeGarantia: false,
    prazoDias: null,
    prazoBase: null,
  };
}

/** Classifica um andamento (ou um bloco de texto de publicação do DJEN). */
export function analisar(
  texto?: string | null,
  codigoTpu?: string | null,
  tipo?: string | null,
): Analise {
  const base = normalizar(`${tipo ?? ""} ${texto ?? ""}`);
  const a = vazia();
  if (!base.trim()) return a;

  for (const { nome, rx, peso } of getCompilados()) {
    if (rx.test(base)) {
      a.sinais.push(nome);
      a.confianca = Math.max(a.confianca, peso);
    }
  }

  if (codigoTpu && TPU_CONSTRICAO.has(String(codigoTpu))) {
    if (!a.sinais.includes("BLOQUEIO_ATIVOS")) a.sinais.push("BLOQUEIO_ATIVOS");
    a.confianca = Math.max(a.confianca, 0.97);
  }

  a.valores = [...base.matchAll(VALOR_RX)]
    .map((m) => parseBRL(m[1]))
    .filter((v) => v >= 1000);
  a.valorMaximo = a.valores.length ? Math.max(...a.valores) : 0;
  a.prazoDias = extrairPrazoDias(base);

  const s = new Set(a.sinais);
  a.bloqueio = [...SINAIS_CONSTRICAO].some((x) => s.has(x));
  a.exigeGarantia = s.has("EXIGE_GARANTIA");
  a.garantiaPrestada = [...SINAIS_RESOLVIDO].some((x) => s.has(x));

  if (s.has("EXECUCAO_INICIADA") || s.has("EXECUCAO_FISCAL") || a.bloqueio) {
    a.fase = "EXECUCAO";
  } else if (s.has("DEPOSITO_RECURSAL") || s.has("RECURSO_INTERPOSTO") || s.has("SENTENCA_CONDENATORIA")) {
    a.fase = "RECURSAL";
  }
  return a;
}

export interface MovEntrada {
  tipo?: string | null;
  texto?: string | null;
  codigo_tpu?: string | null;
  data?: string | null;
}

/**
 * Consolida a análise de um processo. `movs` deve vir da MAIS RECENTE para a
 * mais antiga — a ordem decide a pergunta que mais importa:
 *   garantia homologada DEPOIS do bloqueio  → não é lead
 *   bloqueio DEPOIS da garantia             → é lead (reabriu)
 */
export function analisarProcesso(movs: MovEntrada[]): Analise {
  const consolidado = vazia();

  for (const m of movs) {
    const a = analisar(m.texto, m.codigo_tpu, m.tipo);
    for (const sig of a.sinais) {
      if (!consolidado.sinais.includes(sig)) consolidado.sinais.push(sig);
    }
    consolidado.confianca = Math.max(consolidado.confianca, a.confianca);
    consolidado.valores.push(...a.valores);
    if (consolidado.fase === null && a.fase) consolidado.fase = a.fase;
  }

  consolidado.valorMaximo = consolidado.valores.length ? Math.max(...consolidado.valores) : 0;
  const s = new Set(consolidado.sinais);
  consolidado.bloqueio = [...SINAIS_CONSTRICAO].some((x) => s.has(x));
  consolidado.exigeGarantia = s.has("EXIGE_GARANTIA");

  // Prazo: vale o do andamento MAIS RECENTE que declara prazo E fala do
  // assunto. Prazo declarado numa intimação de dois anos atrás não é o prazo
  // de hoje, e prazo declarado num andamento sem relação (juntada, vista,
  // conclusão) não é prazo de garantia.
  const SINAIS_COM_PRAZO = new Set([
    "DEPOSITO_RECURSAL", "SENTENCA_CONDENATORIA",
    "EXECUCAO_INICIADA", "EXECUCAO_FISCAL",
  ]);
  for (const m of movs) {
    const a = analisar(m.texto, m.codigo_tpu, m.tipo);
    if (a.prazoDias === null) continue;
    const relevante =
      a.bloqueio || a.exigeGarantia || a.sinais.some((s) => SINAIS_COM_PRAZO.has(s));
    if (!relevante) continue;
    consolidado.prazoDias = a.prazoDias;
    consolidado.prazoBase = m.data ?? null;
    break;
  }

  // a movimentação mais recente que fala do assunto é quem decide
  for (const m of movs) {
    const a = analisar(m.texto, m.codigo_tpu, m.tipo);
    if (a.garantiaPrestada) {
      consolidado.garantiaPrestada = true;
      break;
    }
    if (a.bloqueio || a.exigeGarantia) {
      consolidado.garantiaPrestada = false;
      break;
    }
  }
  return consolidado;
}

/** Termos enviados ao bureau (filtro nativo da Judit: step_terms). */
export const TERMOS_CONSTRICAO = [
  "penhora", "bloqueio", "sisbajud", "bacenjud", "indisponibilidade",
  "arresto", "constrição", "caução", "depósito recursal", "seguro garantia",
  "carta de fiança", "fiança bancária", "cumprimento de sentença",
  "execução fiscal", "citação para pagar", "garantia do juízo",
];
