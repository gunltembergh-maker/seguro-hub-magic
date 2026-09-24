// Co-corretagem: divisão da COMISSÃO entre corretoras (cosseguro divide o RISCO).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LinhaCocorretagem {
  id: string;
  demanda_id: string;
  corretora: string;
  cnpj: string | null;
  percentual_comissao: number;
  lider: boolean;
  eh_lavoro: boolean;
  observacao: string | null;
  criado_em: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("garantia_cocorretagem");
const chave = (id: string) => ["garantia", "cocorretagem", id];

export function useCocorretagem(demandaId: string) {
  return useQuery({
    queryKey: chave(demandaId),
    queryFn: async (): Promise<LinhaCocorretagem[]> => {
      const { data, error } = await tabela()
        .select("id, demanda_id, corretora, cnpj, percentual_comissao, lider, eh_lavoro, observacao, criado_em")
        .eq("demanda_id", demandaId)
        .order("criado_em");
      if (error) throw error;
      return ((data ?? []) as LinhaCocorretagem[]).map((l) => ({ ...l, percentual_comissao: Number(l.percentual_comissao) }));
    },
  });
}

export interface NovaCocorretagem {
  demanda_id: string;
  corretora: string;
  cnpj: string | null;
  percentual_comissao: number;
  lider: boolean;
  eh_lavoro: boolean;
}

export function useIncluirCocorretagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: NovaCocorretagem) => {
      const { data: s } = await supabase.auth.getUser();
      const { error } = await tabela().insert({ ...v, criado_por: s.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: chave(v.demanda_id) }),
  });
}

export function useMarcarLiderCocorretagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, demandaId }: { id: string; demandaId: string }) => {
      const { error: e1 } = await tabela().update({ lider: false }).eq("demanda_id", demandaId).eq("lider", true);
      if (e1) throw e1;
      const { error } = await tabela().update({ lider: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: chave(v.demandaId) }),
  });
}

export function useRemoverCocorretagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; demandaId: string }) => {
      const { data, error } = await tabela().delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Não foi possível remover a linha.");
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: chave(v.demandaId) }),
  });
}
