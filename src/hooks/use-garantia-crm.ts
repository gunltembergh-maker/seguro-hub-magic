// CRM do ramo Garantia: cotações, aceite, curadoria e minuta.
//
// Duas regras estruturais:
//  1. O aceite NÃO é troca de status: é o RPC rpc_garantia_registrar_aceite,
//     que gera o código GAR-xxxxx dentro da transação. Dois cliques devolvem o
//     mesmo código — a idempotência é do banco, não da tela.
//  2. Nada é redigitado na passagem: a demanda é a mesma, só muda de fase.
//     Seguradora, prêmio e taxa da minuta vêm da cotação escolhida.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  carregarTiposPresentes,
  type DemandaLista,
} from "@/hooks/use-garantia-negociacao";

/* ------------------------------------------------------------------ */
/* Seguradoras                                                        */
/* ------------------------------------------------------------------ */

export interface SeguradoraConfig {
  chave_mercado: string;
  rotulo: string;
  ativa_garantia: boolean;
}

export function useSeguradorasGarantia() {
  return useQuery({
    queryKey: ["garantia", "seguradoras-config"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SeguradoraConfig[]> => {
      const { data, error } = await supabase
        .from("garantia_seguradoras_config")
        .select("chave_mercado, rotulo, ativa_garantia")
        .eq("ativa_garantia", true)
        .order("rotulo");
      if (error) throw error;
      return (data ?? []) as SeguradoraConfig[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Cotações                                                           */
/* ------------------------------------------------------------------ */

export interface CotacaoDemanda {
  id: string;
  demanda_id: string;
  chave_mercado: string | null;
  seguradora_livre: string | null;
  taxa: number | null;
  premio: number | null;
  comissao_pct: number | null;
  /** Coluna gerada no banco: exibida, nunca editada pela tela. */
  comissao_valor: number | null;
  cosseguro: boolean;
  escolhida: boolean;
  observacao: string | null;
  recebida_em: string | null;
  criado_em: string;
}

const CAMPOS_COTACAO =
  "id, demanda_id, chave_mercado, seguradora_livre, taxa, premio, comissao_pct, " +
  "comissao_valor, cosseguro, escolhida, observacao, recebida_em, criado_em";

export function useCotacoes(demandaId: string) {
  return useQuery({
    queryKey: ["garantia", "cotacoes", demandaId],
    queryFn: async (): Promise<CotacaoDemanda[]> => {
      const { data, error } = await supabase
        .from("garantia_cotacoes")
        .select(CAMPOS_COTACAO)
        .eq("demanda_id", demandaId)
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as unknown as CotacaoDemanda[];
    },
  });
}

export interface EntradaCotacao {
  chave_mercado: string | null;
  seguradora_livre: string | null;
  taxa: number | null;
  premio: number | null;
  comissao_pct: number | null;
  cosseguro: boolean;
  recebida_em: string | null;
  observacao: string | null;
}

function invalidarCrm(qc: ReturnType<typeof useQueryClient>, demandaId?: string) {
  if (demandaId) qc.invalidateQueries({ queryKey: ["garantia", "cotacoes", demandaId] });
  qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
  qc.invalidateQueries({ queryKey: ["garantia", "historico"] });
}

export function useSalvarCotacao(demandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valores }: { id?: string; valores: EntradaCotacao }) => {
      if (id) {
        const { error } = await supabase
          .from("garantia_cotacoes")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(valores as any)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase.from("garantia_cotacoes").insert({
        demanda_id: demandaId,
        ...valores,
        criado_por: sessao.user?.id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onSuccess: () => invalidarCrm(qc, demandaId),
  });
}

/**
 * Marca a cotação aceita e copia prêmio e comissão para a demanda — é isso
 * que alimenta o "em jogo" e o "deixado na mesa". O índice único parcial do
 * banco garante uma só escolhida por demanda; por isso as outras são
 * desmarcadas antes.
 */
export function useEscolherCotacao(demandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cotacao: CotacaoDemanda) => {
      const { error: erroLimpa } = await supabase
        .from("garantia_cotacoes")
        .update({ escolhida: false })
        .eq("demanda_id", demandaId)
        .neq("id", cotacao.id);
      if (erroLimpa) throw erroLimpa;

      const { error } = await supabase
        .from("garantia_cotacoes")
        .update({ escolhida: true })
        .eq("id", cotacao.id);
      if (error) throw error;

      const { error: erroDemanda } = await supabase
        .from("garantia_demandas")
        .update({
          premio_estimado: cotacao.premio,
          comissao_estimada: cotacao.comissao_valor,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", demandaId);
      if (erroDemanda) throw erroDemanda;
    },
    onSuccess: () => invalidarCrm(qc, demandaId),
  });
}

export const nomeSeguradoraCotacao = (
  c: CotacaoDemanda,
  seguradoras: SeguradoraConfig[],
): string =>
  c.chave_mercado
    ? (seguradoras.find((s) => s.chave_mercado === c.chave_mercado)?.rotulo ?? c.chave_mercado)
    : (c.seguradora_livre ?? "Seguradora não informada");

/* ------------------------------------------------------------------ */
/* Aceite                                                             */
/* ------------------------------------------------------------------ */

export interface ResultadoAceite {
  codigo: string;
  legenda: string | null;
}

/**
 * Aceite do cliente: a fronteira entre negociação e CRM. Tudo acontece dentro
 * do RPC (trava da linha, geração do código, mudança de fase). A tela só
 * mostra o código devolvido.
 */
export function useRegistrarAceite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (demandaId: string): Promise<ResultadoAceite> => {
      const { data, error } = await supabase.rpc("rpc_garantia_registrar_aceite", {
        _demanda_id: demandaId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw new Error(error.message);
      const linha = (data as unknown as ResultadoAceite[] | null)?.[0];
      if (!linha) throw new Error("O aceite não devolveu o código da demanda.");
      return linha;
    },
    onSuccess: () => invalidarCrm(qc),
  });
}

/* ------------------------------------------------------------------ */
/* Demandas do CRM                                                    */
/* ------------------------------------------------------------------ */

export function useStatusCrm() {
  return useQuery({
    queryKey: ["garantia", "status-catalogo", "crm"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garantia_status_catalogo")
        .select("codigo, nome, etapa, fase, relogio, com_quem, sla_horas, ordem, ativo")
        .eq("fase", "crm")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Aprovações da minuta                                               */
/* ------------------------------------------------------------------ */

export interface AprovacaoMinuta {
  id: string;
  demanda_id: string;
  quem: string;
  data: string;
  forma: string | null;
  observacao: string | null;
  criado_em: string;
}

export function useAprovacoesMinuta(demandaId: string) {
  return useQuery({
    queryKey: ["garantia", "aprovacoes-minuta", demandaId],
    queryFn: async (): Promise<AprovacaoMinuta[]> => {
      const { data, error } = await supabase
        .from("garantia_aprovacoes_minuta")
        .select("id, demanda_id, quem, data, forma, observacao, criado_em")
        .eq("demanda_id", demandaId);
      if (error) throw error;
      return (data ?? []) as unknown as AprovacaoMinuta[];
    },
  });
}

/** Upsert por (demanda_id, quem): corrigir a data não pode estourar a chave. */
export function useSalvarAprovacaoMinuta(demandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quem,
      data,
      forma,
      observacao,
    }: {
      quem: "cliente" | "segurado";
      data: string;
      forma: string | null;
      observacao?: string | null;
    }) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase.from("garantia_aprovacoes_minuta").upsert(
        {
          demanda_id: demandaId,
          quem,
          data,
          forma,
          observacao: observacao ?? null,
          registrado_por: sessao.user?.id ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "demanda_id,quem" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garantia", "aprovacoes-minuta", demandaId] });
    },
  });
}

/** Segurado da demanda — só interessa saber se ele exige texto próprio. */
export function useSeguradoDaDemanda(seguradoId: string | null) {
  return useQuery({
    queryKey: ["garantia", "segurado-detalhe", seguradoId],
    enabled: !!seguradoId,
    queryFn: async (): Promise<{ id: string; nome: string; exige_texto_proprio: boolean } | null> => {
      const { data, error } = await supabase
        .from("garantia_segurados")
        .select("id, nome, exige_texto_proprio")
        .eq("id", seguradoId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as { id: string; nome: string; exige_texto_proprio: boolean } | null;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Contexto das travas do CRM                                         */
/* ------------------------------------------------------------------ */

export interface ContextoCrm {
  temCotacaoEscolhida: boolean;
  temMinuta: boolean;
  aprovouCliente: boolean;
  aprovouSegurado: boolean;
  seguradoExigeTexto: boolean;
}

/** Lê tudo que as travas das etapas 4, 6 e 7 precisam saber. */
export async function carregarContextoCrm(demanda: DemandaLista): Promise<ContextoCrm> {
  const [cotacoes, tipos, aprovacoes, segurado] = await Promise.all([
    supabase
      .from("garantia_cotacoes")
      .select("id")
      .eq("demanda_id", demanda.id)
      .eq("escolhida", true)
      .limit(1),
    carregarTiposPresentes(demanda.id),
    supabase.from("garantia_aprovacoes_minuta").select("quem").eq("demanda_id", demanda.id),
    demanda.segurado_id
      ? supabase
          .from("garantia_segurados")
          .select("exige_texto_proprio")
          .eq("id", demanda.segurado_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const quem = new Set(((aprovacoes.data ?? []) as { quem: string }[]).map((a) => a.quem));
  return {
    temCotacaoEscolhida: (cotacoes.data ?? []).length > 0,
    temMinuta: tipos.has("minuta"),
    aprovouCliente: quem.has("cliente"),
    aprovouSegurado: quem.has("segurado"),
    seguradoExigeTexto:
      !!(segurado.data as { exige_texto_proprio?: boolean } | null)?.exige_texto_proprio,
  };
}
