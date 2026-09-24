// Parâmetros de referência da Garantia (taxa anual e comissão) e a taxa média
// da modalidade. Leitura para quem opera o pipeline; alteração só ADMIN (RLS).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PARAM_TAXA = "taxa_referencia_anual_pct";
export const PARAM_COMISSAO = "comissao_referencia_pct";
export const PADRAO: Record<string, number> = { [PARAM_TAXA]: 1, [PARAM_COMISSAO]: 15 };

export interface ParametroGarantia {
  chave: string;
  valor: number;
  descricao: string | null;
  atualizado_em: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useParametrosGarantia() {
  return useQuery({
    queryKey: ["garantia-parametros"],
    queryFn: async (): Promise<ParametroGarantia[]> => {
      const { data, error } = await sb
        .from("garantia_parametros")
        .select("chave, valor, descricao, atualizado_em")
        .order("chave");
      if (error) throw error;
      return ((data ?? []) as ParametroGarantia[]).map((p) => ({ ...p, valor: Number(p.valor) }));
    },
  });
}

export function valorParametro(lista: ParametroGarantia[] | undefined, chave: string) {
  return lista?.find((p) => p.chave === chave)?.valor ?? PADRAO[chave];
}

export function useSalvarParametro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: number }) => {
      const { error } = await sb.from("garantia_parametros").update({ valor }).eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garantia-parametros"] }),
  });
}

export function useTaxaMediaModalidade(modalidade: string | null, habilitado = true) {
  return useQuery({
    queryKey: ["garantia-taxa-media", modalidade],
    enabled: !!modalidade && habilitado,
    queryFn: async () => {
      const { data, error } = await sb.rpc("rpc_garantia_taxa_media_modalidade", {
        _modalidade: modalidade,
      });
      if (error) throw error;
      const l = (data ?? [])[0];
      return {
        media: l?.media == null ? null : Number(l.media),
        amostras: Number(l?.amostras ?? 0),
      };
    },
  });
}
