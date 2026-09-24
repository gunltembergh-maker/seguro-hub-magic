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
  // A minuta entra com fluxo próprio: a leitura compara o texto com o edital.
  "minuta",
  // A apólice emitida também: a leitura traz os dados para conferência.
  "apolice",
] as const;

export const podeAnalisarPorIA = (tipo: string) =>
  (TIPOS_ANALISAVEIS as readonly string[]).includes(tipo);

/** Pergunta da caixa de IA — cada leitura tem o seu convite. */
export const perguntaIA = (tipo: string) =>
  tipo === "minuta"
    ? "Deseja que a IA analise a minuta e traga os dados?"
    : tipo === "apolice"
      ? "Deseja que a IA leia a apólice e traga os dados?"
      : "Deseja que a IA analise o contrato e já te dê um resumo?";

/** Fluxo gravado em garantia_analises_ia para o tipo enviado. */
export const fluxoIADoTipo = (tipo: string, produto: string) =>
  tipo === "minuta"
    ? "minuta"
    : tipo === "apolice"
      ? "apolice"
      : produto === "fianca_locaticia"
        ? "fianca_locaticia"
        : "seguro_garantia";

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
  /** IS da demanda — usada para ver se o cosseguro alcança o valor. */
  importancia_segurada?: number | null;
  /** Soma da IS assumida no cosseguro (saída B). */
  cosseguro_total?: number;
  /** Dispensa com motivo (saída C). */
  cadastro_dispensado_motivo?: string | null;
}

/** Tipos que satisfazem a saída A do cadastro: basta UM deles. */
export const TIPOS_SAIDA_CADASTRO = ["dre", "balanco", "alteracao_contratual"] as const;

/** Cosseguro só satisfaz quando a soma alcança ou passa a IS. */
export function cosseguroCobre(demanda: DemandaChecklist): boolean {
  const is = Number(demanda.importancia_segurada ?? 0);
  return is > 0 && Number(demanda.cosseguro_total ?? 0) >= is;
}

export interface Pendencia {
  /** Etapa a que a pendência pertence. */
  etapa: "1" | "3b" | "8";
  /** Tipo de documento que resolve a pendência, quando houver um só. */
  tipo?: string;
  /** O que falta, em uma frase. */
  texto: string;
  /** Por que passou a ser obrigatório — a condição, não a regra genérica. */
  motivo: string;
  /** Pendências informativas não travam o avanço. */
  bloqueia: boolean;
}

/**
 * Etapa 1 (análise da demanda): o documento do contrato é obrigatório.
 * Aditivo e apostilamento são opcionais e nunca travam.
 */
export function pendenciasAnaliseDemanda(
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
      etapa: "1",
      texto: `Anexe o documento do contrato (${nomes}).`,
      motivo:
        "A análise da demanda é feita em cima do documento que define o objeto e as exigências. Sem ele não há o que analisar.",
      bloqueia: true,
    },
  ];
}

/**
 * Etapa 3b (documentos de cadastro): nada é obrigatório por padrão.
 *  · Documento de cadastro só quando exige_cadastro = true (nenhuma com
 *    portal cobre sozinha a IS). Um entre DRE, balanço e alteração basta.
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
    "nenhuma seguradora com portal tem limite disponível que cubra sozinha a importância segurada";

  // Três saídas quando o cadastro é exigido:
  //   A) pelo menos UM documento entre DRE, balanço e alteração contratual;
  //   B) cosseguro cuja soma de IS alcança a IS da demanda;
  //   C) dispensa com motivo escrito (fica registrada mesmo se chegar documento).
  const resolvidoSemDocs = cosseguroCobre(demanda) || !!demanda.cadastro_dispensado_motivo?.trim();
  if (demanda.exige_cadastro && !resolvidoSemDocs) {
    const temDoc = TIPOS_SAIDA_CADASTRO.some((t) => tiposPresentes.has(t));
    if (!temDoc) {
      lista.push({
        etapa: "3b",
        texto:
          "Anexe pelo menos um documento de cadastro (DRE, balanço ou alteração contratual — um basta), feche um cosseguro que alcance a IS ou siga com a dispensa justificada.",
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

/**
 * Etapa 8 (emissão): a apólice só é lançada com a apólice e o boleto anexados.
 * O RPC de lançamento faz a mesma checagem — a tela avisa antes, o banco
 * garante depois.
 */
export function pendenciasEtapa8(tiposPresentes: Set<string>): Pendencia[] {
  const lista: Pendencia[] = [];
  if (!tiposPresentes.has("apolice")) {
    lista.push({
      etapa: "8",
      tipo: "apolice",
      texto: "Anexe a apólice emitida pela seguradora.",
      motivo: "o lançamento grava os dados que estão no documento da apólice",
      bloqueia: true,
    });
  }
  if (!tiposPresentes.has("boleto")) {
    lista.push({
      etapa: "8",
      tipo: "boleto",
      texto: "Anexe o boleto do prêmio.",
      motivo: "o financeiro é aberto com o vencimento do boleto",
      bloqueia: true,
    });
  }
  return lista;
}

export function pendenciasDaDemanda(
  demanda: DemandaChecklist,
  tiposPresentes: Set<string>,
): Pendencia[] {
  return [...pendenciasAnaliseDemanda(demanda, tiposPresentes), ...pendenciasEtapa3b(demanda, tiposPresentes)];
}

/* ------------------------------------------------------------------ */
/* Entrada e seleção para a IA                                        */
/* ------------------------------------------------------------------ */

/** Tipos que podem subir já no registro da Entrada. */
const VALORES_ENTRADA = [
  "edital", "contrato", "contrato_locacao", "processo_judicial", "aditivo", "apostilamento",
  "email_original", "dre", "balanco", "alteracao_contratual", "outro_cadastro",
];

export function tiposDaEntrada(produto: string): TipoDocumento[] {
  return TIPOS_DOCUMENTO.filter(
    (t) => VALORES_ENTRADA.includes(t.valor) && (!t.somenteProduto || t.somenteProduto === produto),
  );
}

/** Documento que define o objeto — pelo menos um é obrigatório na Entrada. */
export function tiposContratoObrigatorios(produto: string): string[] {
  return produto === "fianca_locaticia" ? ["contrato_locacao"] : ["edital", "contrato", "processo_judicial"];
}

/** Família "contrato" da IA: vem marcada por padrão. */
export const TIPOS_IA_CONTRATO = ["edital", "contrato", "contrato_locacao", "processo_judicial", "aditivo"];
/** Família "financeiro" da IA: outro prompt, vem desmarcada. */
export const TIPOS_IA_FINANCEIRO = ["dre", "balanco", "alteracao_contratual"];

/**
 * O prompt sai do que foi selecionado. Misturar famílias não roda: cada uma
 * tem a sua leitura, e não existe prompt combinado.
 */
export function fluxoDaSelecao(
  tipos: string[],
  produto: string,
): { fluxo: "seguro_garantia" | "fianca_locaticia" | "financeiro" } | { erro: string } {
  if (!tipos.length) return { erro: "Selecione pelo menos um documento." };
  const contrato = tipos.filter((t) => TIPOS_IA_CONTRATO.includes(t)).length;
  const financeiro = tipos.filter((t) => TIPOS_IA_FINANCEIRO.includes(t)).length;
  if (contrato + financeiro < tipos.length) {
    return { erro: "Algum documento selecionado não é de contrato nem financeiro, e a IA não tem leitura para ele." };
  }
  if (contrato && financeiro) {
    return {
      erro:
        "Contrato e documento financeiro usam leituras diferentes. Rode em duas vezes: primeiro os de contrato, depois DRE, balanço e alteração contratual.",
    };
  }
  if (financeiro) return { fluxo: "financeiro" };
  return { fluxo: produto === "fianca_locaticia" ? "fianca_locaticia" : "seguro_garantia" };
}
