import type { Json } from "@/integrations/supabase/types";

export interface ValorComFonte<T = string | number | boolean | null> {
  valor: T;
  fonte: string | null;
}

export interface TrechoRelevanteIA {
  tema: string;
  trecho: string;
  pagina_ou_localizacao: string;
}

export interface ModalidadeSeguroGarantiaIA {
  nome: string;
  importancia_segurada: ValorComFonte<number | null>;
  base_calculo: ValorComFonte<string | null>;
  vigencia_inicio: ValorComFonte<string | null>;
  vigencia_fim: ValorComFonte<string | null>;
  vigencia_obs: ValorComFonte<string | null>;
  exige_acrescimo_90_dias: boolean;
  objeto_apolice: ValorComFonte<string | null>;
  clausulas_necessarias: Array<{ descricao: string; fonte: string }>;
}

export interface ResultadoSeguroGarantiaIA {
  tipo: "Seguro Garantia";
  documentos_analisados: string[];
  resumo_executivo: string;
  dados_licitacao_contrato: {
    numero_edital: string | null;
    numero_processo: string | null;
    modalidade_licitacao: string | null;
    numero_contrato: string | null;
    numero_ata: string | null;
    objeto: string | null;
  };
  modalidades: ModalidadeSeguroGarantiaIA[];
  trechos_relevantes: TrechoRelevanteIA[];
  pendencias_para_emissao: string[];
  perguntas_para_cliente_ou_comercial: string[];
  alertas_de_risco: string[];
  conclusao_operacional: {
    pode_cotar: boolean;
    pode_emitir: boolean;
    motivo: string;
    nivel_confianca: "ALTA" | "MEDIA" | "BAIXA";
  };
  parecer?: { recomendacao?: string; justificativa?: string; pendencias?: string[] };
  [chave: string]: unknown;
}

export interface ResultadoFiancaIA {
  tipo: "Fianca Locaticia";
  documentos_analisados: string[];
  dados_gerais: Record<string, ValorComFonte>;
  objeto_apolice: ValorComFonte<string | null>;
  clausulas_necessarias: Array<{ descricao: string; fonte: string }>;
  clausulas_criticas: Array<{ titulo: string; descricao: string; fonte: string; impacto: string }>;
  riscos: Array<{ descricao: string; fonte: string; nivel: string }>;
  parecer: { recomendacao: string; justificativa: string; condicoes: string[] };
  resumo: string;
  trechos_relevantes?: TrechoRelevanteIA[];
  [chave: string]: unknown;
}

export type ResultadoDocumentoIA = ResultadoSeguroGarantiaIA | ResultadoFiancaIA;

export interface CampoSugeridoComFonte<T = string | number | null> {
  valor: T;
  fonte: string;
}

export interface CamposSugeridosComFonteIA {
  objeto?: CampoSugeridoComFonte<string>;
  importancia_segurada?: CampoSugeridoComFonte<number>;
  vigencia_exigida?: CampoSugeridoComFonte<string>;
  numero_processo?: CampoSugeridoComFonte<string>;
  numero_contrato?: CampoSugeridoComFonte<string>;
  percentual_garantia?: CampoSugeridoComFonte<number>;
  modalidades?: Array<{ nome: string; campos: CamposSugeridosComFonteIA }>;
}

export const comoResultadoDocumento = (valor: Json | null): ResultadoDocumentoIA | null =>
  valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as unknown as ResultadoDocumentoIA) : null;
