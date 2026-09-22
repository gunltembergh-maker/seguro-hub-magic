// Apólice, financeiro, carteira, sinistro e encerramento do ramo Garantia.
//
// Três regras estruturais desta camada:
//  1. Lançar apólice e dar baixa são RPCs — uma operação só. Meia apólice
//     (apólice sem financeiro, ou baixa sem devolução de limite) é erro grave.
//  2. O limite somado na emissão é devolvido na baixa pela MESMA função do
//     banco (garantia_ajustar_limite_utilizado).
//  3. Prêmio não pago NÃO mexe em situacao da apólice: o financeiro cobra.
//     Não existe aqui nenhuma automação ligando pagamento e situação.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";

/* ------------------------------------------------------------------ */
/* Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface ApoliceGarantia {
  id: string;
  demanda_id: string;
  apolice_mae_id: string | null;
  produto: string;
  chave_mercado: string | null;
  seguradora_livre: string | null;
  numero_apolice: string;
  numero_endosso: number;
  data_emissao: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  objeto: string | null;
  importancia_segurada: number | null;
  premio: number | null;
  comissao_pct: number | null;
  /** Coluna gerada no banco (prêmio × % / 100): exibida, nunca editada. */
  comissao_valor: number | null;
  tomador_id: string | null;
  segurado_id: string | null;
  locador_id: string | null;
  locatario_id: string | null;
  situacao: "vigente" | "em_sinistro" | "encerrada";
  criado_em: string;
  demanda?: {
    id: string;
    codigo: string | null;
    legenda: string | null;
    modalidade: string | null;
    cliente_id: string | null;
    segurado_id: string | null;
    canal_id: string | null;
    tipo_movimento: string | null;
    cliente: { id: string; nome: string } | null;
  } | null;
}

const CAMPOS_APOLICE =
  "id, demanda_id, apolice_mae_id, produto, chave_mercado, seguradora_livre, numero_apolice, " +
  "numero_endosso, data_emissao, vigencia_inicio, vigencia_fim, objeto, importancia_segurada, " +
  "premio, comissao_pct, comissao_valor, tomador_id, segurado_id, locador_id, locatario_id, " +
  "situacao, criado_em";

const CAMPOS_APOLICE_COM_DEMANDA =
  CAMPOS_APOLICE +
  ", demanda:garantia_demandas!garantia_apolices_demanda_id_fkey(" +
  "id, codigo, legenda, modalidade, cliente_id, segurado_id, canal_id, tipo_movimento, " +
  "cliente:hub_clientes(id, nome))";

export interface FinanceiroApolice {
  id: string;
  apolice_id: string;
  vencimento_boleto: string | null;
  status_premio: "pago" | "em_aberto" | "atrasado";
  data_pagamento_premio: string | null;
  comissao_prevista: number | null;
  comissao_recebida: number | null;
  data_recebimento: string | null;
  repasse_para: string | null;
  repasse_valor: number | null;
  enviado_financeiro_em: string | null;
  observacao: string | null;
}

export interface AvisoRenovacao {
  id: string;
  apolice_id: string;
  dias_antes: number;
  data_aviso: string;
  enviado: boolean;
  enviado_em: string | null;
  demanda_renovacao_id: string | null;
}

export interface SinistroApolice {
  id: string;
  apolice_id: string;
  tipo: string;
  data: string;
  prazos: string | null;
  situacao_regulacao: string | null;
  documento_id: string | null;
  observacao: string | null;
  criado_em: string;
}

export interface EncerramentoApolice {
  id: string;
  apolice_id: string;
  tipo: string;
  data: string;
  documento_id: string | null;
  premio_devolver: number | null;
  estorno_comissao: number | null;
  aprovado_por: string | null;
  observacao: string | null;
  criado_em: string;
}

export const TIPOS_ENCERRAMENTO = [
  { valor: "baixa_obrigacao_cumprida", rotulo: "Baixa por obrigação cumprida" },
  { valor: "cancelada_pedido", rotulo: "Cancelada a pedido" },
  { valor: "substituida", rotulo: "Substituída por outra garantia" },
  { valor: "decisao_judicial", rotulo: "Encerrada por decisão judicial" },
  { valor: "vencida_sem_renovacao", rotulo: "Vencida sem renovação" },
] as const;

/** Só nesses dois casos há prêmio a devolver e estorno de comissão. */
export const ENCERRAMENTO_COM_DEVOLUCAO = ["cancelada_pedido", "substituida"];

export const rotuloEncerramento = (tipo: string) =>
  TIPOS_ENCERRAMENTO.find((t) => t.valor === tipo)?.rotulo ?? tipo;

export const TIPOS_SINISTRO = [
  { valor: "expectativa", rotulo: "Expectativa de sinistro" },
  { valor: "aviso", rotulo: "Aviso de sinistro" },
] as const;

/* ------------------------------------------------------------------ */
/* Leituras                                                           */
/* ------------------------------------------------------------------ */

function invalidarApolices(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["garantia", "apolices"] });
  qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
  qc.invalidateQueries({ queryKey: ["garantia", "documentos"] });
  qc.invalidateQueries({ queryKey: ["garantia", "financeiro"] });
  qc.invalidateQueries({ queryKey: ["garantia", "limites"] });
}

/** Apólices de uma demanda (a mãe e os endossos/renovações dela). */
export function useApolicesDaDemanda(demandaId: string) {
  return useQuery({
    queryKey: ["garantia", "apolices", "demanda", demandaId],
    queryFn: async (): Promise<ApoliceGarantia[]> => {
      const { data, error } = await supabase
        .from("garantia_apolices")
        .select(CAMPOS_APOLICE)
        .eq("demanda_id", demandaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApoliceGarantia[];
    },
  });
}

export interface FiltrosCarteira {
  chave_mercado?: string;
  produto?: string;
  /** Janela de vencimento em dias, a partir de hoje. */
  janela_dias?: number;
  situacao?: string;
}

export function useCarteira(filtros: FiltrosCarteira) {
  return useQuery({
    queryKey: ["garantia", "apolices", "carteira", filtros],
    queryFn: async (): Promise<ApoliceGarantia[]> => {
      let q = supabase
        .from("garantia_apolices")
        .select(CAMPOS_APOLICE_COM_DEMANDA)
        .order("vigencia_fim", { ascending: true, nullsFirst: false })
        .limit(500);

      // A carteira ativa é vigente + em sinistro: sinistro não é encerramento,
      // a apólice continua na carteira, marcada.
      q = filtros.situacao
        ? q.eq("situacao", filtros.situacao)
        : q.in("situacao", ["vigente", "em_sinistro"]);

      if (filtros.chave_mercado) q = q.eq("chave_mercado", filtros.chave_mercado);
      if (filtros.produto) q = q.eq("produto", filtros.produto);
      if (filtros.janela_dias) {
        const limite = new Date();
        limite.setDate(limite.getDate() + filtros.janela_dias);
        q = q.lte("vigencia_fim", limite.toISOString().slice(0, 10));
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ApoliceGarantia[];
    },
  });
}

export function useFinanceiroDaApolice(apoliceId: string | null) {
  return useQuery({
    queryKey: ["garantia", "financeiro", apoliceId],
    enabled: !!apoliceId,
    queryFn: async (): Promise<FinanceiroApolice | null> => {
      const { data, error } = await supabase
        .from("garantia_financeiro")
        .select(
          "id, apolice_id, vencimento_boleto, status_premio, data_pagamento_premio, comissao_prevista, " +
            "comissao_recebida, data_recebimento, repasse_para, repasse_valor, enviado_financeiro_em, observacao",
        )
        .eq("apolice_id", apoliceId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as FinanceiroApolice | null;
    },
  });
}

export function useAvisosRenovacao(apoliceId: string | null) {
  return useQuery({
    queryKey: ["garantia", "apolices", "avisos", apoliceId],
    enabled: !!apoliceId,
    queryFn: async (): Promise<AvisoRenovacao[]> => {
      const { data, error } = await supabase
        .from("garantia_avisos_renovacao")
        .select("id, apolice_id, dias_antes, data_aviso, enviado, enviado_em, demanda_renovacao_id")
        .eq("apolice_id", apoliceId!)
        .order("dias_antes", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AvisoRenovacao[];
    },
  });
}

export function useSinistrosDaApolice(apoliceId: string | null) {
  return useQuery({
    queryKey: ["garantia", "apolices", "sinistros", apoliceId],
    enabled: !!apoliceId,
    queryFn: async (): Promise<SinistroApolice[]> => {
      const { data, error } = await supabase
        .from("garantia_sinistros")
        .select("id, apolice_id, tipo, data, prazos, situacao_regulacao, documento_id, observacao, criado_em")
        .eq("apolice_id", apoliceId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SinistroApolice[];
    },
  });
}

export function useEncerramentoDaApolice(apoliceId: string | null) {
  return useQuery({
    queryKey: ["garantia", "apolices", "encerramento", apoliceId],
    enabled: !!apoliceId,
    queryFn: async (): Promise<EncerramentoApolice | null> => {
      const { data, error } = await supabase
        .from("garantia_encerramentos")
        .select(
          "id, apolice_id, tipo, data, documento_id, premio_devolver, estorno_comissao, aprovado_por, observacao, criado_em",
        )
        .eq("apolice_id", apoliceId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as EncerramentoApolice | null;
    },
  });
}

/** Trilha da apólice: a mãe, seus endossos e renovações. */
export function useFamiliaApolice(apolice: ApoliceGarantia | null) {
  const raiz = apolice?.apolice_mae_id ?? apolice?.id ?? null;
  return useQuery({
    queryKey: ["garantia", "apolices", "familia", raiz],
    enabled: !!raiz,
    queryFn: async (): Promise<ApoliceGarantia[]> => {
      const { data, error } = await supabase
        .from("garantia_apolices")
        .select(CAMPOS_APOLICE)
        .or(`id.eq.${raiz},apolice_mae_id.eq.${raiz}`)
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as unknown as ApoliceGarantia[];
    },
  });
}

export interface LinhaAuditoria {
  id: string;
  tabela: string;
  registro_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_id: string | null;
  data: string;
}

export function useAuditoriaApolice(apoliceId: string | null) {
  return useQuery({
    queryKey: ["garantia", "apolices", "auditoria", apoliceId],
    enabled: !!apoliceId,
    queryFn: async (): Promise<LinhaAuditoria[]> => {
      const { data, error } = await supabase
        .from("garantia_auditoria")
        .select("id, tabela, registro_id, campo, valor_anterior, valor_novo, usuario_id, data")
        .eq("tabela", "garantia_apolices")
        .eq("registro_id", apoliceId!)
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaAuditoria[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Etapa 8 — lançamento da apólice                                    */
/* ------------------------------------------------------------------ */

export interface EntradaApolice {
  numero_apolice: string;
  numero_endosso: number;
  data_emissao: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  objeto: string | null;
  importancia_segurada: number | null;
  premio: number | null;
  comissao_pct: number | null;
  vencimento_boleto: string | null;
}

export interface ResultadoLancamento {
  apolice_id: string;
  /** false quando não havia linha de limite daquela seguradora na consulta vigente. */
  limite_atualizado: boolean;
}

export function useLancarApolice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demandaId,
      dados,
    }: {
      demandaId: string;
      dados: EntradaApolice;
    }): Promise<ResultadoLancamento> => {
      const { data, error } = await supabase.rpc("rpc_garantia_lancar_apolice", {
        _demanda_id: demandaId,
        _numero_apolice: dados.numero_apolice,
        _numero_endosso: dados.numero_endosso,
        _data_emissao: dados.data_emissao,
        _vigencia_inicio: dados.vigencia_inicio,
        _vigencia_fim: dados.vigencia_fim,
        _objeto: dados.objeto,
        _importancia_segurada: dados.importancia_segurada,
        _premio: dados.premio,
        _comissao_pct: dados.comissao_pct,
        _vencimento_boleto: dados.vencimento_boleto,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      const linha = (data as unknown as ResultadoLancamento[] | null)?.[0];
      if (!linha) throw new Error("O lançamento não retornou a apólice criada.");
      return linha;
    },
    onSuccess: () => invalidarApolices(qc),
  });
}

/* ------------------------------------------------------------------ */
/* Etapa 9 — financeiro                                               */
/* ------------------------------------------------------------------ */

export function useSalvarFinanceiro(apoliceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valores: Partial<FinanceiroApolice>) => {
      const { error } = await supabase
        .from("garantia_financeiro")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ ...valores, atualizado_em: new Date().toISOString() } as any)
        .eq("apolice_id", apoliceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garantia", "financeiro", apoliceId] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Sinistro                                                           */
/* ------------------------------------------------------------------ */

export interface EntradaSinistro {
  tipo: string;
  data: string;
  prazos: string | null;
  situacao_regulacao: string | null;
  documento_id: string | null;
  observacao: string | null;
  /** Quem está com a bola define o status da demanda. */
  status_demanda: "sinistro_regulacao" | "sinistro_acompanhamento";
}

/**
 * Sinistro NÃO é encerramento: a apólice fica em_sinistro e continua na
 * carteira, marcada.
 */
export function useRegistrarSinistro(apolice: ApoliceGarantia) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaSinistro) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase.from("garantia_sinistros").insert({
        apolice_id: apolice.id,
        tipo: entrada.tipo,
        data: entrada.data,
        prazos: entrada.prazos,
        situacao_regulacao: entrada.situacao_regulacao,
        documento_id: entrada.documento_id,
        observacao: entrada.observacao,
        criado_por: sessao.user?.id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;

      const { error: erroApolice } = await supabase
        .from("garantia_apolices")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ situacao: "em_sinistro", atualizado_em: new Date().toISOString() } as any)
        .eq("id", apolice.id);
      if (erroApolice) throw erroApolice;

      const { error: erroDemanda } = await supabase
        .from("garantia_demandas")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ etapa: "sinistro", status_atual: entrada.status_demanda } as any)
        .eq("id", apolice.demanda_id);
      if (erroDemanda) throw erroDemanda;
    },
    onSuccess: () => invalidarApolices(qc),
  });
}

/* ------------------------------------------------------------------ */
/* Etapa 11 — baixa                                                   */
/* ------------------------------------------------------------------ */

export interface EntradaBaixa {
  tipo: string;
  data: string;
  documento_id: string | null;
  premio_devolver: number | null;
  estorno_comissao: number | null;
  observacao: string | null;
}

export function useDarBaixa(apoliceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaBaixa) => {
      const { data, error } = await supabase.rpc("rpc_garantia_dar_baixa_apolice", {
        _apolice_id: apoliceId,
        _tipo: entrada.tipo,
        _data: entrada.data,
        _documento_id: entrada.documento_id,
        _premio_devolver: entrada.premio_devolver,
        _estorno_comissao: entrada.estorno_comissao,
        _observacao: entrada.observacao,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      return (data as unknown as { encerramento_id: string; limite_devolvido: boolean }[] | null)?.[0];
    },
    onSuccess: () => invalidarApolices(qc),
  });
}

/* ------------------------------------------------------------------ */
/* Renovação, endosso e executante                                    */
/* ------------------------------------------------------------------ */

export interface EntradaDerivada {
  tipo_movimento: "renovacao" | "endosso";
  tipo_alteracao?: string | null;
  /** Aviso de renovação que originou a demanda, quando vier da carteira. */
  aviso_id?: string | null;
}

/**
 * Cria a demanda derivada (renovação ou endosso) já em Triagem, herdando
 * cliente, segurado, produto, modalidade e canal. Nasce com
 * triagem_completa = false, como qualquer outra.
 */
export function useAbrirDemandaDerivada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apolice,
      entrada,
    }: {
      apolice: ApoliceGarantia;
      entrada: EntradaDerivada;
    }): Promise<string> => {
      const { data: sessao } = await supabase.auth.getUser();
      const { data: origem, error: erroOrigem } = await supabase
        .from("garantia_demandas")
        .select("cliente_id, segurado_id, produto, modalidade, canal_id, responsavel_cliente_id, responsavel_tecnico_id, publico_privado, objeto")
        .eq("id", apolice.demanda_id)
        .maybeSingle();
      if (erroOrigem) throw erroOrigem;
      if (!origem) throw new Error("Demanda de origem não encontrada.");

      const { data: nova, error } = await supabase
        .from("garantia_demandas")
        .insert({
          produto: origem.produto,
          fase: "negociacao",
          etapa: "1",
          status_atual: "triagem",
          triagem_completa: false,
          cliente_id: origem.cliente_id,
          segurado_id: origem.segurado_id,
          modalidade: origem.modalidade,
          publico_privado: origem.publico_privado,
          canal_id: origem.canal_id,
          responsavel_cliente_id: origem.responsavel_cliente_id,
          responsavel_tecnico_id: origem.responsavel_tecnico_id,
          objeto: origem.objeto,
          tipo_movimento: entrada.tipo_movimento,
          tipo_alteracao: entrada.tipo_movimento === "endosso" ? (entrada.tipo_alteracao ?? null) : null,
          apolice_anterior_id: apolice.id,
          importancia_segurada: apolice.importancia_segurada,
          cadastrado_por: sessao.user?.id ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      const novaId = (nova as { id: string }).id;
      if (entrada.aviso_id) {
        await supabase
          .from("garantia_avisos_renovacao")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ demanda_renovacao_id: novaId } as any)
          .eq("id", entrada.aviso_id);
      }
      return novaId;
    },
    onSuccess: () => invalidarApolices(qc),
  });
}

/**
 * Licitante que venceu a licitação vira executante: demanda nova, modalidade
 * executante, mesmos cliente e segurado.
 */
export function useAbrirDemandaExecutante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apolice: ApoliceGarantia): Promise<string> => {
      const { data: sessao } = await supabase.auth.getUser();
      const { data: origem } = await supabase
        .from("garantia_demandas")
        .select("cliente_id, segurado_id, produto, canal_id, responsavel_cliente_id, responsavel_tecnico_id, publico_privado, objeto")
        .eq("id", apolice.demanda_id)
        .maybeSingle();
      if (!origem) throw new Error("Demanda de origem não encontrada.");

      const { data: nova, error } = await supabase
        .from("garantia_demandas")
        .insert({
          produto: origem.produto,
          fase: "negociacao",
          etapa: "1",
          status_atual: "triagem",
          triagem_completa: false,
          cliente_id: origem.cliente_id,
          segurado_id: origem.segurado_id,
          modalidade: "executante",
          publico_privado: origem.publico_privado,
          canal_id: origem.canal_id,
          responsavel_cliente_id: origem.responsavel_cliente_id,
          responsavel_tecnico_id: origem.responsavel_tecnico_id,
          objeto: origem.objeto,
          tipo_movimento: "novo",
          apolice_anterior_id: apolice.id,
          cadastrado_por: sessao.user?.id ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (nova as { id: string }).id;
    },
    onSuccess: () => invalidarApolices(qc),
  });
}

/** Nome da seguradora da apólice, com o catálogo já carregado. */
export const nomeSeguradoraApolice = (
  a: ApoliceGarantia,
  seguradoras: { chave_mercado: string; rotulo: string }[],
): string =>
  a.chave_mercado
    ? (seguradoras.find((s) => s.chave_mercado === a.chave_mercado)?.rotulo ?? a.chave_mercado)
    : (a.seguradora_livre ?? "Seguradora não informada");

/** Dias que faltam para o fim da vigência. Negativo quando já venceu. */
export function diasParaVencer(apolice: ApoliceGarantia): number | null {
  if (!apolice.vigencia_fim) return null;
  const fim = new Date(`${apolice.vigencia_fim}T12:00:00`);
  return Math.ceil((fim.getTime() - Date.now()) / 86_400_000);
}

/** Rótulos das partes conforme o produto — o vocabulário muda na fiança. */
export function rotulosDasPartes(produto: string) {
  return produto === "fianca_locaticia"
    ? { cliente: "Locatário", segurado: "Locador" }
    : { cliente: "Tomador", segurado: "Segurado" };
}

export type { DemandaLista };
