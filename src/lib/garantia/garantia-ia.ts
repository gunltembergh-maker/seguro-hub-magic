// Análise de contrato por IA — contrato de tipos e aplicação dos campos.
//
// O MOTOR NÃO ESTÁ LIGADO nesta etapa: nada aqui chama Worker, prompt ou
// /api/tc-lavoro/analysis-jobs. Quando for ligado, ele usará esse mesmo
// endpoint (o da tela de Operacional), com as credenciais Cloudflare Access
// existindo só no servidor. Nenhuma chave vai para o navegador.
//
// A IA SUGERE, A PESSOA CONFERE E APLICA: nada do resultado é gravado na
// demanda automaticamente. `aplicarCamposSugeridos` é a única porta de
// entrada, e ela é sempre disparada por um clique.

import { supabase } from "@/integrations/supabase/client";

export type FluxoIA = "seguro_garantia" | "fianca_locaticia";

export type SituacaoIA = "solicitada" | "processando" | "concluida" | "erro";

/** Campos da demanda que a IA poderá sugerir a partir do contrato. */
export interface CamposSugeridosIA {
  /** Objeto do contrato, em texto corrido. */
  objeto?: string | null;
  /** Importância segurada, em reais. */
  importancia_segurada?: number | null;
  /** Vigência exigida pelo edital/contrato, como está escrita no documento. */
  vigencia_exigida?: string | null;
  /** Cláusulas que o documento torna obrigatórias na apólice. */
  clausulas_obrigatorias?: string[] | null;
  /** Coberturas adicionais pedidas (trabalhista, previdenciária, etc.). */
  coberturas_adicionais?: string[] | null;
  /** Percentual de garantia exigido, em pontos percentuais (5 = 5%). */
  percentual_garantia?: number | null;
}

/**
 * Campos que a leitura da MINUTA poderá sugerir. É outra leitura: além dos
 * dados da apólice, ela aponta o que diverge do edital ou do contrato.
 */
export interface CamposSugeridosMinutaIA {
  /** Importância segurada escrita na minuta. */
  importancia_segurada?: number | null;
  /** Início da vigência (ISO yyyy-mm-dd). */
  vigencia_inicial?: string | null;
  /** Fim da vigência (ISO yyyy-mm-dd). */
  vigencia_final?: string | null;
  /** Objeto conforme a minuta. */
  objeto?: string | null;
  /** Segurado nomeado na minuta. */
  segurado?: string | null;
  /** Cláusulas obrigatórias presentes no texto. */
  clausulas_obrigatorias?: string[] | null;
  /** Divergências em relação ao edital ou contrato, uma por item. */
  divergencias?: string[] | null;
}

/** Resultado da leitura da minuta, quando o motor for ligado. */
export interface ResultadoMinutaIA {
  resumo: string;
  campos_sugeridos: CamposSugeridosMinutaIA;
}

/**
 * Campos que a leitura da APÓLICE emitida poderá sugerir — é o que o técnico
 * confere contra o documento antes de lançar.
 */
export interface CamposSugeridosApoliceIA {
  numero_apolice?: string | null;
  numero_endosso?: number | null;
  data_emissao?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  objeto?: string | null;
  importancia_segurada?: number | null;
  premio?: number | null;
}

/** Resultado da leitura da apólice, quando o motor for ligado. */
export interface ResultadoApoliceIA {
  resumo: string;
  campos_sugeridos: CamposSugeridosApoliceIA;
}

/** Resultado completo que o motor devolverá quando for ligado. */
export interface ResultadoIA {
  /** Resumo em linguagem corrente, para leitura humana. */
  resumo: string;
  campos_sugeridos: CamposSugeridosIA;
}

/** Campos aplicáveis diretamente em garantia_demandas (os demais são leitura). */
export const CAMPOS_APLICAVEIS = [
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "importancia_segurada", rotulo: "Importância segurada" },
  { chave: "vigencia_exigida", rotulo: "Vigência exigida" },
  { chave: "percentual_garantia", rotulo: "Percentual de garantia" },
] as const;

/** Campos que a IA sugere, mas que hoje só existem como leitura/observação. */
export const CAMPOS_INFORMATIVOS = [
  { chave: "clausulas_obrigatorias", rotulo: "Cláusulas obrigatórias" },
  { chave: "coberturas_adicionais", rotulo: "Coberturas adicionais" },
] as const;

export interface AnaliseIA {
  id: string;
  demanda_id: string | null;
  documento_id: string | null;
  fluxo: string;
  situacao: string;
  resumo: string | null;
  campos_sugeridos: CamposSugeridosIA | null;
  aplicada: boolean;
  aplicada_por: string | null;
  aplicada_em: string | null;
  erro_mensagem: string | null;
  solicitada_por: string | null;
  criado_em: string;
}

/**
 * Grava na demanda os campos que a pessoa escolheu aplicar e carimba a
 * análise como aplicada. Funciona hoje, sem depender do motor: quando o
 * resultado chegar, é só chamar esta função com os campos conferidos.
 */
export async function aplicarCamposSugeridos(
  demandaId: string,
  campos: CamposSugeridosIA,
  analiseId?: string,
): Promise<void> {
  const valores: Record<string, unknown> = {};
  if (campos.objeto !== undefined) valores.objeto = campos.objeto;
  if (campos.importancia_segurada !== undefined)
    valores.importancia_segurada = campos.importancia_segurada;
  if (campos.vigencia_exigida !== undefined) valores.vigencia_exigida = campos.vigencia_exigida;
  if (campos.percentual_garantia !== undefined)
    valores.percentual_garantia = campos.percentual_garantia;

  if (Object.keys(valores).length) {
    const { error } = await supabase
      .from("garantia_demandas")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(valores as any)
      .eq("id", demandaId);
    if (error) throw error;
  }

  if (analiseId) {
    const { data: sessao } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("garantia_analises_ia")
      .update({
        aplicada: true,
        aplicada_por: sessao.user?.id ?? null,
        aplicada_em: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", analiseId);
    if (error) throw error;
  }
}
