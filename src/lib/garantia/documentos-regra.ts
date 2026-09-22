// Documentos da demanda de Garantia: lista fechada de tipos e checklists.
//
// A lista de tipos é a MESMA do CHECK de garantia_documentos. Tipo novo entra
// primeiro no banco, depois aqui — se divergir, o INSERT é recusado.
//
// Os checklists mudaram em relação ao desenho antigo: não há mais exigência de
// três exercícios de DRE/balanço, e nomeação e CCG deixaram de ser obrigatórias
// por padrão. Tudo que é obrigatório aqui nasce de uma condição explícita.

export type GrupoDocumento = "origem" | "cadastro" | "apolice";

export interface TipoDocumento {
  valor: string;
  rotulo: string;
  grupo: GrupoDocumento;
  /** Produto exclusivo, quando o tipo só faz sentido em um deles. */
  somenteProduto?: "seguro_garantia" | "fianca_locaticia";
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  // Origem e contrato
  { valor: "email_original", rotulo: "E-mail original", grupo: "origem" },
  { valor: "edital", rotulo: "Edital", grupo: "origem", somenteProduto: "seguro_garantia" },
  { valor: "contrato", rotulo: "Contrato", grupo: "origem" },
  {
    valor: "contrato_locacao",
    rotulo: "Contrato de locação",
    grupo: "origem",
    somenteProduto: "fianca_locaticia",
  },
  { valor: "aditivo", rotulo: "Aditivo", grupo: "origem" },
  { valor: "apostilamento", rotulo: "Apostilamento", grupo: "origem" },
  {
    valor: "processo_judicial",
    rotulo: "Processo/decisão judicial",
    grupo: "origem",
    somenteProduto: "seguro_garantia",
  },
  // Cadastro
  { valor: "dre", rotulo: "DRE", grupo: "cadastro" },
  { valor: "balanco", rotulo: "Balanço", grupo: "cadastro" },
  { valor: "alteracao_contratual", rotulo: "Alteração contratual", grupo: "cadastro" },
  { valor: "carta_nomeacao", rotulo: "Carta de nomeação", grupo: "cadastro" },
  { valor: "irpf", rotulo: "IRPF", grupo: "cadastro" },
  { valor: "outro_cadastro", rotulo: "Outro documento de cadastro", grupo: "cadastro" },
  // Negociação e apólice
  { valor: "comparativo", rotulo: "Comparativo de mercado", grupo: "cadastro" },
  { valor: "ccg", rotulo: "CCG", grupo: "cadastro" },
  { valor: "minuta", rotulo: "Minuta", grupo: "apolice" },
  { valor: "apolice", rotulo: "Apólice", grupo: "apolice" },
  { valor: "boleto", rotulo: "Boleto", grupo: "apolice" },
  { valor: "termo_liberacao", rotulo: "Termo de liberação", grupo: "apolice" },
  { valor: "endosso_cancelamento", rotulo: "Endosso de cancelamento", grupo: "apolice" },
  { valor: "notificacao_sinistro", rotulo: "Notificação de sinistro", grupo: "apolice" },
  { valor: "outro", rotulo: "Outro", grupo: "apolice" },
];

export const ROTULO_GRUPO_DOC: Record<GrupoDocumento, string> = {
  origem: "Origem e contrato",
  cadastro: "Cadastro",
  apolice: "Negociação e apólice",
};

export function rotuloTipoDocumento(tipo: string): string {
  return TIPOS_DOCUMENTO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

/**
 * Tipos oferecidos no envio, filtrados por contexto:
 *  · contrato de locação só na fiança locatícia; edital e processo judicial só
 *    no seguro garantia;
 *  · apólice e pós-venda ficam ocultos enquanto a demanda está em negociação —
 *    esses documentos só existem depois que a apólice é emitida.
 */
export function tiposDisponiveis(produto: string, fase: string): TipoDocumento[] {
  return TIPOS_DOCUMENTO.filter((t) => {
    if (t.somenteProduto && t.somenteProduto !== produto) return false;
    if (t.grupo === "apolice" && t.valor !== "outro" && fase === "negociacao") return false;
    return true;
  });
}

/** Tipos de contrato que a IA pode ler. Só eles oferecem o pedido de análise. */
export const TIPOS_ANALISAVEIS = [
  "edital",
  "contrato",
  "contrato_locacao",
  "processo_judicial",
  "aditivo",
] as const;

export const podeAnalisarPorIA = (tipo: string) =>
  (TIPOS_ANALISAVEIS as readonly string[]).includes(tipo);

export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
export const BUCKET_PIPELINE = "garantia-pipeline-anexos";

/* ------------------------------------------------------------------ */
/* Checklists por etapa                                               */
/* ------------------------------------------------------------------ */

/** O que o checklist precisa saber da demanda, sem depender da tela. */
export interface DemandaChecklist {
  produto: string;
  exige_cadastro: boolean;
  balancos_assinados: boolean | null;
  dre_assinados: boolean | null;
  precisa_nomeacao: boolean;
  precisa_ccg: boolean;
}

export interface Pendencia {
  /** Etapa a que a pendência pertence. */
  etapa: "2" | "3b";
  /** O que falta, em uma frase. */
  texto: string;
  /** Por que passou a ser obrigatório — a condição, não a regra genérica. */
  motivo: string;
  /** Pendências informativas não travam o avanço. */
  bloqueia: boolean;
}

/**
 * Etapa 2 (análise técnica): o documento do contrato é obrigatório.
 * Aditivo e apostilamento são opcionais e nunca travam.
 */
export function pendenciasEtapa2(
  demanda: DemandaChecklist,
  tiposPresentes: Set<string>,
): Pendencia[] {
  const aceitos =
    demanda.produto === "fianca_locaticia"
      ? ["contrato_locacao", "contrato"]
      : ["edital", "contrato", "processo_judicial"];
  if (aceitos.some((t) => tiposPresentes.has(t))) return [];
  const nomes = aceitos.map(rotuloTipoDocumento).join(", ");
  return [
    {
      etapa: "2",
      texto: `Anexe o documento do contrato (${nomes}).`,
      motivo:
        "A análise técnica é feita em cima do documento que define o objeto e as exigências. Sem ele não há o que analisar.",
      bloqueia: true,
    },
  ];
}

/**
 * Etapa 3b (documentos de cadastro): nada é obrigatório por padrão.
 *  · DRE e balanço só quando exige_cadastro = true (a consulta a mercado não
 *    achou limite em nenhuma seguradora). NÃO há mínimo de exercícios.
 *  · As duas conferências de assinatura precisam estar respondidas nesse caso;
 *    responder "não" não trava, mas fica visível como pendência.
 *  · Carta de nomeação e CCG só quando marcados como necessários.
 */
export function pendenciasEtapa3b(
  demanda: DemandaChecklist,
  tiposPresentes: Set<string>,
): Pendencia[] {
  const lista: Pendencia[] = [];
  const motivoCadastro =
    "a consulta a mercado não encontrou limite em nenhuma seguradora, então DRE e balanço passam a ser exigidos";

  if (demanda.exige_cadastro) {
    if (!tiposPresentes.has("dre")) {
      lista.push({
        etapa: "3b",
        texto: "Anexe pelo menos um DRE (um exercício já basta).",
        motivo: motivoCadastro,
        bloqueia: true,
      });
    }
    if (!tiposPresentes.has("balanco")) {
      lista.push({
        etapa: "3b",
        texto: "Anexe pelo menos um balanço (um exercício já basta).",
        motivo: motivoCadastro,
        bloqueia: true,
      });
    }
    if (demanda.balancos_assinados === null) {
      lista.push({
        etapa: "3b",
        texto:
          "Responda: os balanços estão assinados tanto pelo representante legal quanto pelo contador?",
        motivo: motivoCadastro,
        bloqueia: true,
      });
    } else if (demanda.balancos_assinados === false) {
      lista.push({
        etapa: "3b",
        texto: "Os balanços não estão assinados pelo representante legal e pelo contador.",
        motivo: "a seguradora devolve balanço sem as duas assinaturas — não trava, mas custa tempo",
        bloqueia: false,
      });
    }
    if (demanda.dre_assinados === null) {
      lista.push({
        etapa: "3b",
        texto:
          "Responda: os DRE estão assinados tanto pelo representante legal quanto pelo contador?",
        motivo: motivoCadastro,
        bloqueia: true,
      });
    } else if (demanda.dre_assinados === false) {
      lista.push({
        etapa: "3b",
        texto: "Os DRE não estão assinados pelo representante legal e pelo contador.",
        motivo: "a seguradora devolve DRE sem as duas assinaturas — não trava, mas custa tempo",
        bloqueia: false,
      });
    }
  }

  if (demanda.precisa_nomeacao && !tiposPresentes.has("carta_nomeacao")) {
    lista.push({
      etapa: "3b",
      texto: "Anexe a carta de nomeação.",
      motivo: "este caso foi marcado como “precisa de nomeação”",
      bloqueia: true,
    });
  }
  if (demanda.precisa_ccg && !tiposPresentes.has("ccg")) {
    lista.push({
      etapa: "3b",
      texto: "Anexe o CCG.",
      motivo: "este caso foi marcado como “precisa de CCG”",
      bloqueia: true,
    });
  }
  return lista;
}

export function pendenciasDaDemanda(
  demanda: DemandaChecklist,
  tiposPresentes: Set<string>,
): Pendencia[] {
  return [...pendenciasEtapa2(demanda, tiposPresentes), ...pendenciasEtapa3b(demanda, tiposPresentes)];
}
