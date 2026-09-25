import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Ativo = { ativo: boolean; desde: string | null; por: string | null };

export function FaixaTreinamento() {
  const q = useQuery({
    queryKey: ["canal-treinamento-ativo"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Ativo | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("rpc_canal_treinamento_ativo");
      if (error) throw error;
      return ((Array.isArray(data) ? data[0] : data) as Ativo) ?? null;
    },
  });
  if (q.data?.ativo !== true) return null;
  return (
    <div className="sticky top-0 z-30 mb-4 rounded-md border border-amber-500 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      Modo treinamento: tudo o que for feito aqui é treinamento e será apagado depois. Os e-mails não vão para as pessoas reais.
    </div>
  );
}

export default FaixaTreinamento;
