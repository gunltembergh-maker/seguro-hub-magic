// Estado do ciclo de repasse: quem define a data prevista é o Financeiro,
// uma vez por ciclo. Quem exporta apenas lê o que foi definido.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CicloRepasse {
  data_prevista: string | null;
  definida_por_nome: string | null;
  definida_em: string | null;
  observacao: string | null;
  excecoes: number | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  posso_definir: boolean | null;
}

export function useCicloRepasse(ano: number, mes: number) {
  return useQuery({
    queryKey: ["canal-parceiro-ciclo", ano, mes],
    queryFn: async (): Promise<CicloRepasse | null> => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_ciclo" as never,
        { p_ano: ano, p_mes: mes } as never,
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as CicloRepasse | undefined;
      return row ?? null;
    },
    staleTime: 60_000,
  });
}
