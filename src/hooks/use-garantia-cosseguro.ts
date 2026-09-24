// Cosseguro (saída B do cadastro) e dispensa justificada (saída C).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface LinhaCosseguro {
  id: string;
  demanda_id: string;
  chave_mercado: string | null;
  seguradora_livre: string | null;
  importancia_segurada: number;
  lider: boolean;
  observacao: string | null;
  criado_em: string;
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["garantia", "cosseguro"] });
  qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
  qc.invalidateQueries({ queryKey: ["garantia"] });
}

// Tabela nova: o cliente tipado pode ainda não conhecê-la.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("garantia_cosseguro");

export function useCosseguro(demandaId: string) {
  return useQuery({
    queryKey: ["garantia", "cosseguro", demandaId],
    queryFn: async (): Promise<LinhaCosseguro[]> => {
      const { data, error } = await tabela()
        .select("id, demanda_id, chave_mercado, seguradora_livre, importancia_segurada, lider, observacao, criado_em")
        .eq("demanda_id", demandaId)
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as LinhaCosseguro[];
    },
  });
}

export function useIncluirCosseguro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      demanda_id: string;
      chave_mercado: string | null;
      seguradora_livre: string | null;
      importancia_segurada: number;
      lider: boolean;
      observacao: string | null;
    }) => {
      const { data: sessao } = await supabase.auth.getUser();
      if (v.lider) {
        // Só um líder por demanda: desmarca o anterior antes (o índice único garante).
        const { error: e1 } = await tabela().update({ lider: false }).eq("demanda_id", v.demanda_id).eq("lider", true);
        if (e1) throw e1;
      }
      const { error } = await tabela().insert({ ...v, criado_por: sessao.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useMarcarLider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, demandaId }: { id: string; demandaId: string }) => {
      const { error: e1 } = await tabela().update({ lider: false }).eq("demanda_id", demandaId).eq("lider", true);
      if (e1) throw e1;
      const { error } = await tabela().update({ lider: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useRemoverCosseguro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await tabela().delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Só um administrador pode remover uma linha do cosseguro.");
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Dispensa dos documentos de cadastro. Motivo obrigatório; o registro não se apaga. */
export function useDispensarCadastro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandaId, motivo }: { demandaId: string; motivo: string }) => {
      const texto = motivo.trim();
      if (!texto) throw new Error("Escreva o motivo da dispensa.");
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("garantia_demandas")
        .update({
          cadastro_dispensado_motivo: texto,
          cadastro_dispensado_por: sessao.user?.id ?? null,
          cadastro_dispensado_em: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", demandaId);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
