CREATE INDEX IF NOT EXISTS idx_gerencial_sync_id ON public.raw_lavoro_gerencial(sync_id);
CREATE INDEX IF NOT EXISTS idx_gerencial_criado_em ON public.raw_lavoro_gerencial(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_caixa_sync_id ON public.raw_lavoro_caixa_comissao(sync_id);
CREATE INDEX IF NOT EXISTS idx_caixa_criado_em ON public.raw_lavoro_caixa_comissao(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_depara_ramo_sync_id ON public.raw_lavoro_depara_ramo(sync_id);