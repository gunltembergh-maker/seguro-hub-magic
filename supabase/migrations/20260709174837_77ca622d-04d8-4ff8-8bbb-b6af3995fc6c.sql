
-- =====================================================
-- Refactor: tabelas raw com schema REAL das planilhas
-- =====================================================

-- Derruba views e tabelas (estavam vazias)
DROP VIEW IF EXISTS public.vw_lavoro_receita_competencia CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_receita_caixa CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_previsto_caixa CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_depara_ramo CASCADE;
DROP TABLE IF EXISTS public.raw_lavoro_gerencial CASCADE;
DROP TABLE IF EXISTS public.raw_lavoro_caixa_comissao CASCADE;
DROP TABLE IF EXISTS public.raw_lavoro_depara_ramo CASCADE;

-- ============ raw_lavoro_gerencial ============
CREATE TABLE public.raw_lavoro_gerencial (
  id BIGSERIAL PRIMARY KEY,
  grupo TEXT,
  tomador TEXT,
  segurado TEXT,
  documento TEXT,
  ramo TEXT,
  seguradora TEXT,
  numero_apolice TEXT,
  data_emissao DATE,
  inicio_vigencia DATE,
  fim_vigencia DATE,
  periodo_atualizacao TEXT,
  valor_is NUMERIC(18,2),
  premio_total NUMERIC(18,2),
  percentual_comissao NUMERIC(10,4),
  comissao_emitida NUMERIC(18,2),
  qtd_parcelas INTEGER,
  premio_parcela NUMERIC(18,2),
  comissao_bruta NUMERIC(18,2),
  imposto_ret NUMERIC(18,2),
  valor_iss NUMERIC(18,2),
  valor_recebido_a_receber NUMERIC(18,2),
  numero_da_parcela INTEGER,
  tipo_pagamento TEXT,
  empresa_faturada TEXT,
  data_pagamento DATE,
  mes INTEGER,
  ano INTEGER,
  fat_competencia TEXT,
  status_parcela_comissao TEXT,
  analise TEXT,
  possui_repasse TEXT,
  percentual_repasse NUMERIC(10,4),
  parcelas TEXT,
  percentual_imposto NUMERIC(10,4),
  valor_repasse_total NUMERIC(18,2),
  data_repasse DATE,
  status_repasse TEXT,
  observacao TEXT,
  card_id TEXT,
  responsavel TEXT,
  data_card_finalizado DATE,
  sync_id UUID NOT NULL DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.raw_lavoro_gerencial TO authenticated;
GRANT ALL ON public.raw_lavoro_gerencial TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.raw_lavoro_gerencial_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.raw_lavoro_gerencial_id_seq TO service_role;
ALTER TABLE public.raw_lavoro_gerencial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gerencial_read" ON public.raw_lavoro_gerencial
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "gerencial_import" ON public.raw_lavoro_gerencial
  FOR INSERT TO authenticated WITH CHECK (public.pode_importar(auth.uid(),'gerencial'));
CREATE POLICY "gerencial_delete" ON public.raw_lavoro_gerencial
  FOR DELETE TO authenticated USING (public.pode_importar(auth.uid(),'gerencial'));
CREATE INDEX idx_gerencial_ano_mes ON public.raw_lavoro_gerencial(ano, mes);
CREATE INDEX idx_gerencial_ramo ON public.raw_lavoro_gerencial(ramo);
CREATE INDEX idx_gerencial_seguradora ON public.raw_lavoro_gerencial(seguradora);

-- ============ raw_lavoro_caixa_comissao ============
CREATE TABLE public.raw_lavoro_caixa_comissao (
  id BIGSERIAL PRIMARY KEY,
  tipo_lancamento TEXT,
  mes_referencia TEXT,
  data_pagamento DATE,
  descricao TEXT,
  valor NUMERIC(18,2),
  categoria TEXT,
  sub_categoria TEXT,
  referencia TEXT,
  observacoes TEXT,
  data_emissao_nota_fiscal DATE,
  sync_id UUID NOT NULL DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.raw_lavoro_caixa_comissao TO authenticated;
GRANT ALL ON public.raw_lavoro_caixa_comissao TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.raw_lavoro_caixa_comissao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.raw_lavoro_caixa_comissao_id_seq TO service_role;
ALTER TABLE public.raw_lavoro_caixa_comissao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caixa_read" ON public.raw_lavoro_caixa_comissao
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "caixa_import" ON public.raw_lavoro_caixa_comissao
  FOR INSERT TO authenticated WITH CHECK (public.pode_importar(auth.uid(),'caixa'));
CREATE POLICY "caixa_delete" ON public.raw_lavoro_caixa_comissao
  FOR DELETE TO authenticated USING (public.pode_importar(auth.uid(),'caixa'));
CREATE INDEX idx_caixa_data_pagamento ON public.raw_lavoro_caixa_comissao(data_pagamento);

-- ============ raw_lavoro_depara_ramo ============
CREATE TABLE public.raw_lavoro_depara_ramo (
  id BIGSERIAL PRIMARY KEY,
  ramo TEXT NOT NULL UNIQUE,
  tipo_de_ramo TEXT NOT NULL,
  sync_id UUID NOT NULL DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_lavoro_depara_ramo TO authenticated;
GRANT ALL ON public.raw_lavoro_depara_ramo TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.raw_lavoro_depara_ramo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.raw_lavoro_depara_ramo_id_seq TO service_role;
ALTER TABLE public.raw_lavoro_depara_ramo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depara_read" ON public.raw_lavoro_depara_ramo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "depara_write" ON public.raw_lavoro_depara_ramo
  FOR ALL TO authenticated
  USING (public.pode_importar(auth.uid(),'gerencial'))
  WITH CHECK (public.pode_importar(auth.uid(),'gerencial'));

-- ============ Views ============
CREATE VIEW public.vw_lavoro_depara_ramo AS
SELECT ramo, tipo_de_ramo FROM public.raw_lavoro_depara_ramo;
ALTER VIEW public.vw_lavoro_depara_ramo SET (security_invoker = true);
GRANT SELECT ON public.vw_lavoro_depara_ramo TO authenticated;

CREATE VIEW public.vw_lavoro_receita_competencia AS
SELECT
  g.ano::int  AS ano,
  g.mes::int  AS mes,
  g.empresa_faturada AS canal,
  dr.tipo_de_ramo    AS tipo_de_ramo,
  g.ramo,
  g.seguradora,
  g.status_parcela_comissao,
  SUM(g.comissao_bruta) AS comissao_bruta,
  SUM(COALESCE(g.comissao_bruta,0)
      - COALESCE(g.imposto_ret,0)
      - COALESCE(g.valor_iss,0))     AS comissao_liquida,
  SUM(g.premio_parcela)              AS premio_liquido
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.raw_lavoro_depara_ramo dr ON dr.ramo = g.ramo
WHERE g.ano IS NOT NULL AND g.mes IS NOT NULL
GROUP BY 1,2,3,4,5,6,7;
ALTER VIEW public.vw_lavoro_receita_competencia SET (security_invoker = true);
GRANT SELECT ON public.vw_lavoro_receita_competencia TO authenticated;

CREATE VIEW public.vw_lavoro_receita_caixa AS
SELECT
  EXTRACT(YEAR  FROM c.data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM c.data_pagamento)::int AS mes,
  c.categoria      AS canal,
  c.sub_categoria  AS seguradora,
  c.referencia     AS ramo,
  SUM(c.valor)     AS valor_recebido
FROM public.raw_lavoro_caixa_comissao c
WHERE c.data_pagamento IS NOT NULL
GROUP BY 1,2,3,4,5;
ALTER VIEW public.vw_lavoro_receita_caixa SET (security_invoker = true);
GRANT SELECT ON public.vw_lavoro_receita_caixa TO authenticated;

CREATE VIEW public.vw_lavoro_previsto_caixa AS
SELECT
  EXTRACT(YEAR  FROM c.data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM c.data_pagamento)::int AS mes,
  c.categoria     AS canal,
  c.sub_categoria AS seguradora,
  c.referencia    AS ramo,
  SUM(c.valor)    AS valor_previsto
FROM public.raw_lavoro_caixa_comissao c
WHERE c.data_pagamento IS NOT NULL
  AND UPPER(COALESCE(c.tipo_lancamento,'')) LIKE '%PREVIST%'
GROUP BY 1,2,3,4,5;
ALTER VIEW public.vw_lavoro_previsto_caixa SET (security_invoker = true);
GRANT SELECT ON public.vw_lavoro_previsto_caixa TO authenticated;

-- ============ Ajuste da RPC de comissão vencida ============
CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(_ano INT, _mes INT, _periodo TEXT DEFAULT 'MTD')
RETURNS TABLE(canal TEXT, valor NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ini INT; v_fim INT;
BEGIN
  v_ini := CASE _periodo WHEN 'YTD' THEN 1 WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 1 ELSE 7 END ELSE _mes END;
  v_fim := CASE _periodo WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 6 ELSE 12 END ELSE _mes END;
  RETURN QUERY
    SELECT COALESCE(g.empresa_faturada,'(sem canal)'),
           COALESCE(SUM(COALESCE(g.comissao_bruta,0)
                        - COALESCE(g.imposto_ret,0)
                        - COALESCE(g.valor_iss,0)),0)
      FROM public.raw_lavoro_gerencial g
     WHERE g.ano = _ano
       AND g.mes BETWEEN v_ini AND v_fim
       AND UPPER(COALESCE(g.status_parcela_comissao,'')) IN ('VENCIDO','VENCIDA','EM ATRASO','ATRASADO')
     GROUP BY 1 ORDER BY 2 DESC;
END; $$;
REVOKE ALL ON FUNCTION public.rpc_comissao_vencida_por_canal(int,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_comissao_vencida_por_canal(int,int,text) TO authenticated, service_role;
