// Painel da Gerência — Garantia.
//
// Nenhuma consulta desta tela lê tabela direto: tudo passa pelas RPCs
// `rpc_garantia_painel_*`, que já vêm agregadas do banco e devolvem ZERO
// linhas para quem não tem `pode_garantia_painel()`. O corte é no banco, não
// na tela — e o teto de 1000 linhas do PostgREST nunca é alcançado porque a
// soma acontece em SQL.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FiltrosPainel {
  de: string | null;
  ate: string | null;
  produto: string | null;
  modalidade: string | null;
  canal: string | null;
  responsavel: string | null;
}

export const FILTROS_VAZIOS: FiltrosPainel = {
  de: null,
  ate: null,
  produto: null,
  modalidade: null,
  canal: null,
  responsavel: null,
};

/** Filtro não escolhido vira ausente: o default da RPC é `null`. */
const ou = (v: string | null) => v ?? undefined;

function argumentos(f: FiltrosPainel) {
  return {
    _de: ou(f.de),
    _ate: ou(f.ate),
    _produto: ou(f.produto),
    _modalidade: ou(f.modalidade),
    _canal: ou(f.canal),
    _responsavel: ou(f.responsavel),
  };
}

/** Linha agregada genérica: agrupamento + chave + medidas. */
export interface LinhaAgrupada {
  agrupamento: string;
  chave: string;
  rotulo: string;
  quantidade: number;
  premio: number;
  comissao: number;
}

export interface LinhaResultado {
  mes: string;
  apolices: number;
  premio_emitido: number;
  comissao_prevista: number;
  comissao_recebida: number;
}

export interface LinhaVelocidade {
  agrupamento: string;
  chave: string;
  rotulo: string;
  relogio: string;
  amostras: number;
  horas_media: number | null;
}

export interface LinhaConversao {
  agrupamento: string;
  chave: string;
  rotulo: string;
  ganhos: number;
  perdidos: number;
  abertas: number;
  pct_ganho: number | null;
}

export interface LinhaCarteira {
  agrupamento: string;
  chave: string;
  rotulo: string;
  quantidade: number;
  valor: number;
}

export interface LinhaSeguradora {
  seguradora: string;
  com_limite: number;
  sem_limite: number;
  nao_consultado: number;
}

const OPCOES = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

export function useEmJogo(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "em-jogo", f],
    queryFn: async (): Promise<LinhaAgrupada[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_em_jogo", argumentos(f));
      if (error) throw error;
      return (data ?? []) as LinhaAgrupada[];
    },
  });
}

export function usePerdas(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "perdas", f],
    queryFn: async (): Promise<LinhaAgrupada[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_perdas", argumentos(f));
      if (error) throw error;
      return (data ?? []) as LinhaAgrupada[];
    },
  });
}

export function useResultado(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "resultado", f],
    queryFn: async (): Promise<LinhaResultado[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_resultado", argumentos(f));
      if (error) throw error;
      return (data ?? []) as LinhaResultado[];
    },
  });
}

export function useVelocidade(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "velocidade", f],
    queryFn: async (): Promise<LinhaVelocidade[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_velocidade", argumentos(f));
      if (error) throw error;
      return (data ?? []) as LinhaVelocidade[];
    },
  });
}

export function useConversao(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "conversao", f],
    queryFn: async (): Promise<LinhaConversao[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_conversao", argumentos(f));
      if (error) throw error;
      return (data ?? []) as LinhaConversao[];
    },
  });
}

export function useCarteiraPainel(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "carteira", f],
    queryFn: async (): Promise<LinhaCarteira[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_carteira", {
        _produto: ou(f.produto),
        _modalidade: ou(f.modalidade),
        _canal: ou(f.canal),
        _responsavel: ou(f.responsavel),
      });
      if (error) throw error;
      return (data ?? []) as LinhaCarteira[];
    },
  });
}

export function useSeguradorasPainel(f: FiltrosPainel) {
  return useQuery({
    ...OPCOES,
    queryKey: ["garantia-painel", "seguradoras", f],
    queryFn: async (): Promise<LinhaSeguradora[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_painel_seguradoras", argumentos(f));
      if (error) throw error;
      return (data ?? []) as LinhaSeguradora[];
    },
  });
}
