import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NewsCategoria = "mercado_seguros" | "atuarial" | "beneficios" | "saude";

export interface NewsItem {
  id: string;
  titulo: string;
  link: string;
  fonte: string;
  categoria: NewsCategoria;
  publicado_em: string | null;
  criado_em: string;
}

export function useMarketNews() {
  return useQuery({
    queryKey: ["market-news-cache"],
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase
        .from("market_news_cache")
        .select("id, titulo, link, fonte, categoria, publicado_em, criado_em")
        .order("publicado_em", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as NewsItem[];
    },
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}
