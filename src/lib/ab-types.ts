// Tipos do módulo Análise Background (Jurídico → Análise Background).
//
// Se você regenerar os tipos do Supabase no Lovable, estes ficam como
// contrato de leitura do front — mais legíveis que os tipos gerados.

export type Modalidade =
  | "JUDICIAL"
  | "FISCAL"
  | "LICITACAO"
  | "PERFORMANCE"
  | "LOCATICIA"
  | "OUTROS";

export type StatusLead =
  | "NOVO"
  | "EM_CONTATO"
  | "COTANDO"
  | "GANHO"
  | "PERDIDO"
  | "DESCARTADO";

export type Perfil = "garantia" | "compliance" | "rh" | "admin";

export const STATUS_LABEL: Record<StatusLead, string> = {
  NOVO: "Novo",
  EM_CONTATO: "Em contato",
  COTANDO: "Cotando",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
  DESCARTADO: "Descartado",
};

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  JUDICIAL: "Judicial",
  FISCAL: "Fiscal",
  LICITACAO: "Licitação",
  PERFORMANCE: "Performance",
  LOCATICIA: "Locatícia e outros",
  OUTROS: "Outros",
};

export interface LinhaFila {
  lead_id: string;
  modalidade: Modalidade;
  produto: string;
  gatilhos: string[];
  valor_base: number;
  importancia_segurada: number;
  premio_estimado: number;
  prioridade: number;
  urgencia: number;
  prob_subscricao: number;
  /** Maior confiança entre os eventos do lead. Fator da prioridade. */
  confianca: number;
  /** Rótulo derivado da confiança, calculado na view. */
  qualificacao: "CONFIRMADO" | "PROVAVEL" | "A_QUALIFICAR";
  deadline: string | null;
  dias_para_prazo: number | null;
  bloqueios: string[] | null;
  status: StatusLead;
  responsavel: string | null;
  created_at: string;
  empresa_id: string;
  cnpj: string;
  razao_social: string;
  uf: string | null;
  municipio: string | null;
  cnae: string | null;
  cnae_descricao: string | null;
  porte: string | null;
  relacao: string;
  monitorado: boolean;
}

export interface LinhaCarteira {
  empresa_id: string;
  cnpj: string;
  razao_social: string;
  uf: string | null;
  cnae_descricao: string | null;
  porte: string | null;
  relacao: string;
  monitorado: boolean;
  situacao_cadastral: string | null;
  n_processos: number;
  exposicao_judicial: number;
  n_em_execucao: number;
  divida_ativa: number;
  contratos_publicos: number;
  restritivos: string[];
  /** IS somada dos leads em aberto. Era `comissao_potencial`, que dependia
   *  de um percentual estimado; IS é fato. */
  is_potencial: number;
  n_leads: number;
}

/**
 * A LINHA que o comercial usa: uma por processo (ou fonte) e modalidade.
 *
 * Não tem prêmio nem comissão de propósito. Os dois dependem de taxa que
 * varia por seguradora, e um número calculado com percentual fixo chega à
 * tela com cara de cálculo. Aqui só entra fato — valor de execução — e a
 * regra legal — IS = valor + 30% (CPC art. 835 §2º). O resto é simulação.
 */
export interface Oportunidade {
  empresa_id: string;
  cnpj: string;
  razao_social: string;
  uf: string | null;
  municipio: string | null;
  porte: string | null;
  telefone: string | null;
  telefone_2: string | null;
  monitorado: boolean;
  modalidade: Modalidade;
  processo_id: string | null;
  origem: "PROCESSO" | "OUTRA_FONTE";
  /** Número CNJ quando vem de processo; a chave da fonte quando não vem. */
  referencia: string;
  processo_numero: string | null;
  tribunal: string | null;
  area: string | null;
  classe: string | null;
  classe_codigo: string | null;
  polo: string | null;
  fase: string | null;
  distribuicao: string | null;
  valor_causa: number | null;
  valor_execucao: number | null;
  garantia_prestada: boolean | null;
  gatilhos: string[];
  valor_base: number;
  importancia_segurada: number | null;
  deadline: string | null;
  /**
   * `texto` = o prazo foi lido do andamento; a data pode ser dita ao
   * cliente. `padrao` = estimativa da parametrização; a tela mostra como
   * "prazo estimado" e o comercial NÃO deve afirmá-la.
   */
  deadline_fonte: "texto" | "padrao" | null;
  dias_para_prazo: number | null;
  confianca: number;
  qualificacao: "CONFIRMADO" | "PROVAVEL" | "A_QUALIFICAR";
  lead_id: string | null;
  lead_status: StatusLead | null;
  responsavel: string | null;
  bloqueios: string[] | null;
}

export interface Evento {
  id: string;
  gatilho: string;
  modalidade: Modalidade;
  referencia: string;
  descricao: string;
  valor_base: number;
  deadline: string | null;
  confianca: number;
  evidencia: {
    sinais?: string[];
    trecho?: string | null;
    processo?: string;
    objeto?: string | null;
    inscricoes?: unknown[];
    /**
     * O que ainda precisa ser confirmado para isto ser um lead de verdade.
     * O time de Garantia não precisa primeiro do valor — precisa saber se o
     * caso realmente demanda garantia e se a Lavoro pode atender.
     */
    verificar?: string[];
    [k: string]: unknown;
  } | null;
}

export interface Movimentacao {
  id: string;
  data: string | null;
  tipo: string | null;
  texto: string | null;
  sinais: string[];
}

export interface Processo {
  id: string;
  numero: string;
  area: string | null;
  tribunal: string | null;
  orgao_julgador: string | null;
  classe: string | null;
  classe_codigo: string | null;
  status: string | null;
  polo: string | null;
  fase: string | null;
  garantia_prestada: boolean;
  distribuicao: string | null;
  valor_causa: number | null;
  valor_execucao: number | null;
  assuntos: string[] | null;
  ab_movimentacao?: Movimentacao[];
}

export interface InscricaoDivida {
  id: string;
  ente: string;
  numero_inscricao: string | null;
  tipo: string | null;
  valor: number;
  situacao: string | null;
  data_inscricao: string | null;
}

export interface ContratoPublico {
  id: string;
  identificador: string;
  orgao: string | null;
  objeto: string | null;
  valor: number | null;
  data_assinatura: string | null;
  obra_engenharia: boolean;
}

export interface Restritivo {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number | null;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
}

export interface Socio {
  id: string;
  nome: string;
  documento_mascarado: string | null;
  qualificacao: string | null;
  tipo: string | null;
}

export interface Empresa {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  uf: string | null;
  municipio: string | null;
  cnae: string | null;
  cnae_descricao: string | null;
  porte: string | null;
  capital_social: number | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  relacao: string;
  monitorado: boolean;
}

export type Severidade = "ALTA" | "MEDIA" | "BAIXA" | "INFO";

export interface AchadoDossie {
  severidade: Severidade;
  categoria: string;
  titulo: string;
  detalhe: string;
  valor?: number | null;
  fonte?: string;
}

export interface ResultadoBgCheck {
  ok: boolean;
  documento: string;
  tipo: "CNPJ" | "CPF";
  nome: string | null;
  finalidade: string;
  veredito: "APROVADO" | "ATENCAO" | "REPROVADO" | "SEM_DADOS";
  score: number;
  achados: AchadoDossie[];
  fontes_consultadas: string[];
  fontes_indisponiveis: string[];
  empresa_id?: string;
}

export interface Dossie {
  id: string;
  tipo_documento: string;
  documento: string;
  nome: string | null;
  finalidade: string;
  veredito: string | null;
  score: number | null;
  created_at: string;
}

export interface Consentimento {
  id: string;
  documento: string;
  nome: string | null;
  finalidade: string;
  validade: string | null;
  revogado_em: string | null;
  created_at: string;
}

export interface IngestLog {
  id: string;
  fonte: string;
  status: string;
  recebidos: number;
  gravados: number;
  detalhe: string | null;
  duracao_ms: number | null;
  created_at: string;
}

export interface SinalDicionario {
  id: string;
  nome: string;
  padrao: string;
  peso: number;
  categoria: string;
  ativo: boolean;
}

export interface Parametro {
  chave: string;
  valor: number;
  descricao: string | null;
}

/** Catálogo estático de gatilhos, para a tela de Fontes e para tooltips. */
export const CATALOGO_GATILHOS: {
  codigo: string;
  nome: string;
  modalidade: Modalidade;
  produto: string;
  fonte: string;
  gratuita: boolean;
}[] = [
  { codigo: "T1", nome: "Depósito recursal já efetuado em dinheiro", modalidade: "JUDICIAL", produto: "Seguro garantia judicial — substituição de depósito recursal", fonte: "bureau / DJEN", gratuita: false },
  { codigo: "T2", nome: "Sentença condenatória com prazo recursal correndo", modalidade: "JUDICIAL", produto: "Seguro garantia judicial — depósito recursal", fonte: "DJEN / bureau", gratuita: false },
  { codigo: "T3", nome: "Execução trabalhista definitiva não paga (CNDT)", modalidade: "JUDICIAL", produto: "Seguro garantia judicial", fonte: "CNDT / BNDT", gratuita: true },
  { codigo: "T4", nome: "Penhora / bloqueio de ativos efetivado", modalidade: "JUDICIAL", produto: "Seguro garantia judicial — substituição de penhora", fonte: "bureau (texto) / DJEN", gratuita: false },
  { codigo: "T5", nome: "Execução fiscal ajuizada", modalidade: "FISCAL", produto: "Seguro garantia de execução fiscal", fonte: "DataJud (classe 1116) / bureau", gratuita: false },
  { codigo: "T6", nome: "Dívida ativa inscrita, sem garantia", modalidade: "FISCAL", produto: "Seguro garantia de execução fiscal", fonte: "PGFN dados abertos", gratuita: true },
  { codigo: "T7", nome: "Contencioso administrativo (CARF)", modalidade: "FISCAL", produto: "Seguro garantia administrativo tributário", fonte: "CARF / DOU", gratuita: true },
  { codigo: "T8", nome: "Edital exigindo garantia de proposta", modalidade: "LICITACAO", produto: "Seguro garantia licitante (bid bond)", fonte: "PNCP", gratuita: true },
  { codigo: "T9", nome: "Contrato público assinado", modalidade: "PERFORMANCE", produto: "Seguro garantia executante (performance bond)", fonte: "PNCP / Compras.gov", gratuita: true },
  { codigo: "T10", nome: "Obra de grande vulto (> R$ 200 mi)", modalidade: "PERFORMANCE", produto: "Seguro garantia com cláusula de retomada", fonte: "PNCP", gratuita: true },
  { codigo: "T13", nome: "Improbidade / ACP com indisponibilidade", modalidade: "JUDICIAL", produto: "Seguro garantia judicial", fonte: "bureau / DJEN", gratuita: false },
  { codigo: "T16", nome: "Cross-sell: fiança locatícia e demais produtos", modalidade: "LOCATICIA", produto: "Fiança locatícia / carta fiança / RC", fonte: "RFB + PNCP", gratuita: true },
];

// =====================================================================
// Separação de propósito — o eixo do módulo
//
// O mesmo acervo serve a dois públicos com finalidades diferentes, e essa
// diferença não é cosmética: ela define o que cada um enxerga (RLS), qual
// base legal sustenta a consulta e quem responde pelo custo.
//
//   ORIGINAÇÃO (Garantia)  → prospecção comercial. Vê prêmio, comissão,
//                            prioridade, fila por ramo.
//   JURÍDICO               → instrução de caso. Vê processo e andamento;
//                            NÃO vê prêmio, comissão nem prioridade.
//   COMPLIANCE             → due diligence de cliente e fornecedor (PJ).
//   RH                     → background de colaborador e candidato (CPF),
//                            com trava de base legal registrada.
// =====================================================================

export type Finalidade = "GARANTIA" | "JURIDICO" | "COMPLIANCE" | "RH";

export const FINALIDADE_LABEL: Record<Finalidade, string> = {
  GARANTIA: "Originação de garantia",
  JURIDICO: "Jurídico — instrução de caso",
  COMPLIANCE: "Compliance — cliente e fornecedor",
  RH: "RH — colaborador e candidato",
};

/** Chave de permissão que cada finalidade exige. */
export const FINALIDADE_CHAVE: Record<Finalidade, ChaveAbTodas> = {
  GARANTIA: "ab_garantia",
  JURIDICO: "ab_juridico",
  COMPLIANCE: "ab_compliance",
  RH: "ab_rh",
};

export type ChaveAbTodas =
  | "ab_garantia"
  | "ab_juridico"
  | "ab_compliance"
  | "ab_rh"
  | "ab_solicitar"
  | "ab_cota_gerir";

// ---------------------------------------------------------------------
// Ramos da fila de originação. Uma aba por ramo: cada um tem seu
// argumento de venda, seu prazo típico e seu jeito de dimensionar a IS.
// ---------------------------------------------------------------------
export interface Ramo {
  chave: Modalidade;
  titulo: string;
  produto: string;
  descricao: string;
  baseLegal: string;
}

export const RAMOS: Ramo[] = [
  {
    chave: "JUDICIAL",
    titulo: "Judicial",
    produto: "Seguro garantia judicial",
    descricao:
      "Substitui dinheiro bloqueado ou depósito recursal. O argumento é o custo " +
      "de oportunidade: o capital volta a girar e a garantia custa uma fração dele.",
    baseLegal: "CPC art. 835 §2º e 848 · CLT art. 899 §11 · Ato Conj. TST/CSJT/CGJT 1/2019",
  },
  {
    chave: "FISCAL",
    titulo: "Fiscal e tributária",
    produto: "Seguro garantia fiscal",
    descricao:
      "Dívida ativa inscrita ou execução fiscal ajuizada, sem garantia prestada. " +
      "Permite CND e suspende constrição sem imobilizar caixa.",
    baseLegal: "Lei 6.830/80 art. 9º II e §3º · Lei 14.689/2023 · Portaria PGFN/MF 2.044/2024",
  },
  {
    chave: "LICITACAO",
    titulo: "Licitação",
    produto: "Garantia de proposta",
    descricao:
      "Edital que exige garantia de participação. Prazo curto, decisão rápida: " +
      "quem chega depois do encerramento da proposta não vende.",
    baseLegal: "Lei 14.133/2021 art. 58",
  },
  {
    chave: "PERFORMANCE",
    titulo: "Performance",
    produto: "Seguro garantia de execução do contrato",
    descricao:
      "Contrato público assinado. 5% do valor, 10% justificado, 30% em obra de " +
      "grande vulto — e a cláusula de retomada muda a conversa com o órgão.",
    baseLegal: "Lei 14.133/2021 arts. 96, 98, 99 e 102",
  },
  {
    chave: "LOCATICIA",
    titulo: "Locatícia e demais ramos",
    produto: "Fiança locatícia e cross-sell",
    descricao:
      "Não tem gatilho público: nenhuma base revela contrato de locação. " +
      "Aqui a fila é de expansão de carteira, com confiança menor — trate como " +
      "cross-sell, não como gatilho legal.",
    baseLegal: "Lei 8.245/91 art. 37 · Circular SUSEP 662/2022",
  },
];

// ---------------------------------------------------------------------
export type StatusSolicitacao =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "SEM_PROVEDOR"
  | "BLOQUEADA_COTA"
  | "SEM_CONSENTIMENTO"
  | "RECUSADA"
  | "ERRO";

export const STATUS_SOLICITACAO_LABEL: Record<StatusSolicitacao, string> = {
  PENDENTE: "Na fila",
  EM_ANDAMENTO: "Consultando",
  CONCLUIDA: "Concluída",
  SEM_PROVEDOR: "Sem bureau contratado",
  BLOQUEADA_COTA: "Teto de custo atingido",
  SEM_CONSENTIMENTO: "Falta base legal",
  RECUSADA: "Recusada",
  ERRO: "Erro",
};

export type Escopo = "PROCESSOS" | "MONITORAMENTO" | "COMPLETO";

export interface Solicitacao {
  id: string;
  tipo_documento: "CNPJ" | "CPF";
  documento: string;
  nome: string | null;
  finalidade: Finalidade;
  escopo: Escopo;
  status: StatusSolicitacao;
  area: string | null;
  provedor: string | null;
  custo: number;
  processos_encontrados: number;
  movimentacoes_novas: number;
  leads_gerados: number;
  detalhe: string | null;
  empresa_id: string | null;
  razao_social: string | null;
  solicitante: string | null;
  solicitante_nome: string | null;
  created_at: string;
  iniciado_em: string | null;
  concluido_em: string | null;
  duracao_seg: number | null;
}

export type SituacaoCota = "OK" | "ATENCAO" | "ESGOTADA" | "BLOQUEADA" | "SEM_TETO";

export interface Cota {
  id: string;
  area: string;
  mes: string;
  limite_consultas: number | null;
  limite_valor: number | null;
  consumido_consultas: number;
  consumido_valor: number;
  restante_consultas: number | null;
  restante_valor: number | null;
  situacao: SituacaoCota;
  observacao: string | null;
  updated_at: string;
}

export interface CapacidadesProvedor {
  processos_por_documento?: boolean;
  texto_andamento?: boolean;
  anexo_texto?: boolean;
  monitoramento?: boolean;
  filtro_termos?: boolean;
  aceita_cpf?: boolean;
  callback?: boolean;
  certidoes?: boolean;
  cadastral?: boolean;
}

export interface ProvedorDados {
  chave: string;
  nome: string;
  ativo: boolean;
  custo_consulta: number;
  custo_monitoramento_mes: number;
  capacidades: CapacidadesProvedor;
  observacao: string | null;
  doc_url: string | null;
}

/** Linha de ab_v_processo — a visão jurídica, sem número comercial. */
export interface LinhaProcesso {
  id: string;
  empresa_id: string;
  cnpj: string;
  razao_social: string;
  numero: string;
  area: string | null;
  tribunal: string | null;
  uf: string | null;
  orgao_julgador: string | null;
  classe: string | null;
  classe_codigo: string | null;
  status: string | null;
  polo: string | null;
  fase: string | null;
  distribuicao: string | null;
  valor_causa: number | null;
  valor_execucao: number | null;
  assuntos: string[] | null;
  garantia_prestada: boolean | null;
  fonte: string | null;
  movimentacoes: number;
  ultima_movimentacao: string | null;
  movimentacoes_constricao: number;
  movimentacoes_exigencia: number;
  created_at: string;
  updated_at: string;
}
