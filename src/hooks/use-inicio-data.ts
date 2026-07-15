import { useQueries, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LavoroResumo {
  receita_competencia_mes: number | null;
  receita_caixa_mes: number | null;
  receita_caixa_recebida_mes: number | null;
  atingimento_caixa_mes: number | null;
  total_vencido_mes: number | null;
  ultima_atualizacao: string | null;
}

export interface TimestampRow {
  fonte: string;
  ultima_atualizacao: string | null;
  total_linhas: number;
}

async function rpcArr<T>(fn: string, args: unknown = {}): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    console.warn(`[useInicioData] ${fn}:`, error.message);
    return [];
  }
  return (Array.isArray(data) ? data : data ? [data] : []) as T[];
}

export function useInicioData() {
  const qc = useQueryClient();

  const queries = useQueries({
    queries: [
      {
        queryKey: ["inicio-lavoro-resumo"],
        queryFn: () => rpcArr<LavoroResumo>("rpc_inicio_lavoro_resumo"),
        staleTime: 60_000,
      },
      {
        queryKey: ["inicio-timestamps"],
        queryFn: () => rpcArr<TimestampRow>("rpc_inicio_timestamps"),
        staleTime: 60_000,
      },
    ],
  });

  const [resumoQ, tsQ] = queries;

  return {
    resumo: (resumoQ.data?.[0] ?? null) as LavoroResumo | null,
    timestamps: (tsQ.data ?? []) as TimestampRow[],
    isLoading: queries.some((q) => q.isLoading),
    isFetching: queries.some((q) => q.isFetching),
    lastUpdated: new Date(),
    refetch: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inicio-lavoro-resumo"] }),
        qc.invalidateQueries({ queryKey: ["inicio-timestamps"] }),
      ]);
    },
  };
}
