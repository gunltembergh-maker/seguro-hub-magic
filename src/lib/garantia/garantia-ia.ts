// Análise de contrato por IA — contrato de tipos e aplicação dos campos.
//
// O motor é acionado pela função protegida de análise, que reutiliza o proxy
// da tela Operacional. As credenciais Cloudflare Access existem só no servidor.
//
// A IA SUGERE, A PESSOA CONFERE E APLICA: nada do resultado é gravado na
// demanda automaticamente. `aplicarCamposSugeridos` é a única porta de
// entrada, e ela é sempre disparada por um clique.

import { supabase } from "@/integrations/supabase/client";

export type FluxoIA = "seguro_garantia" | "fianca_locaticia" | "financeiro";

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
  numero_processo?: string | null;
  numero_contrato?: string | null;
  /** Nome do segurado/locador como está no documento. */
  segurado?: string | null;
  /** CNPJ do segurado, quando a leitura trouxe — ajuda a achar o cadastro. */
  segurado_cnpj?: string | null;
  /** Data limite (AAAA-MM-DD), lida do prazo do edital. */
  data_limite?: string | null;
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
  { chave: "segurado", rotulo: "Segurado" },
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "importancia_segurada", rotulo: "Importância segurada" },
  { chave: "vigencia_exigida", rotulo: "Vigência exigida" },
  { chave: "percentual_garantia", rotulo: "Percentual de garantia" },
  { chave: "numero_processo", rotulo: "Nº do processo" },
  { chave: "numero_contrato", rotulo: "Nº do contrato" },
  { chave: "data_limite", rotulo: "Data limite" },
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
  /** Todos os documentos lidos; documento_id guarda o primeiro. */
  documentos_ids: string[];
  fluxo: string;
  situacao: string;
  resumo: string | null;
  resultado: import("@/integrations/supabase/types").Json | null;
  campos_sugeridos: CamposSugeridosIA | null;
  aplicada: boolean;
  aplicada_por: string | null;
  aplicada_em: string | null;
  erro_mensagem: string | null;
  solicitada_por: string | null;
  criado_em: string;
  atualizado_em: string;
  job_id: string | null;
  /** Saída do agente 1 (classificador); null em análises antigas. */
  classificacao?: import("@/integrations/supabase/types").Json | null;
  modalidade_id?: string | null;
  modalidade_rotulo?: string | null;
}

/**
 * O segurado da demanda é uma referência ao cadastro, não texto solto. Acha
 * pelo CNPJ (ou pelo nome exato); sem cadastro e com CNPJ, cadastra; sem os
 * dois, pede para escolher na conferência em vez de inventar.
 */
async function resolverSegurado(nome: string, cnpj: string | null): Promise<string> {
  const digitos = (cnpj ?? "").replace(/\D+/g, "");
  if (digitos) {
    const { data } = await supabase.from("garantia_segurados").select("id").eq("cpf_cnpj", digitos).maybeSingle();
    if (data) return data.id;
  }
  const { data: porNome } = await supabase.from("garantia_segurados").select("id").ilike("nome", nome.trim()).limit(1).maybeSingle();
  if (porNome) return porNome.id;
  if (digitos.length !== 11 && digitos.length !== 14) {
    throw new Error(`O segurado “${nome}” não está cadastrado e a leitura não trouxe o CNPJ. Escolha ou cadastre na conferência dos dados.`);
  }
  const { data: sessao } = await supabase.auth.getUser();
  const { data: criado, error } = await supabase.from("garantia_segurados").insert({
    nome: nome.trim(), cpf_cnpj: digitos, tipo_pessoa: digitos.length === 14 ? "PJ" : "PF",
    criado_por: sessao.user?.id ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).select("id").single();
  if (error) throw error;
  return criado.id;
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
  if (campos.numero_processo !== undefined) valores.numero_processo = campos.numero_processo;
  if (campos.numero_contrato !== undefined) valores.numero_contrato = campos.numero_contrato;
  if (campos.data_limite !== undefined) valores.data_limite = campos.data_limite;
  if (campos.segurado) valores.segurado_id = await resolverSegurado(campos.segurado, campos.segurado_cnpj ?? null);

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
