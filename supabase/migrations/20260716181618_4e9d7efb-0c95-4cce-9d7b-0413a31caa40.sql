CREATE TABLE IF NOT EXISTS public.market_news_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  link TEXT NOT NULL,
  fonte TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('mercado_seguros','atuarial','beneficios','saude')),
  publicado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS market_news_cache_link_uk ON public.market_news_cache (link);
CREATE INDEX IF NOT EXISTS market_news_cache_cat_pub_idx ON public.market_news_cache (categoria, publicado_em DESC);

GRANT SELECT ON public.market_news_cache TO authenticated;
GRANT ALL ON public.market_news_cache TO service_role;

ALTER TABLE public.market_news_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem noticias" ON public.market_news_cache;
CREATE POLICY "Autenticados leem noticias"
  ON public.market_news_cache
  FOR SELECT
  TO authenticated
  USING (true);
