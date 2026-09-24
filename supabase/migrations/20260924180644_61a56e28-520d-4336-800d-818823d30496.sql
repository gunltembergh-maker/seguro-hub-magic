ALTER TABLE public.garantia_analises_ia
  ADD COLUMN IF NOT EXISTS classificacao jsonb,
  ADD COLUMN IF NOT EXISTS modalidade_id text,
  ADD COLUMN IF NOT EXISTS modalidade_rotulo text;