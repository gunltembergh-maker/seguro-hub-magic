
-- 1.1 Staging: Base Gerencial
CREATE TABLE IF NOT EXISTS public.raw_lavoro_gerencial (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo TEXT, tomador TEXT, segurado TEXT, documento TEXT, ramo TEXT,
  seguradora TEXT, numero_apolice TEXT, data_emissao DATE, inicio_vigencia DATE,
  fim_vigencia DATE, periodo_atualizacao TEXT, valor_is NUMERIC, premio_total NUMERIC,
  percentual_comissao NUMERIC, comissao_emitida NUMERIC, qtd_parcelas INTEGER,
  premio_parcela NUMERIC, comissao_bruta NUMERIC, imposto_ret NUMERIC, valor_iss NUMERIC,
  valor_recebido_a_receber NUMERIC, numero_da_parcela INTEGER, tipo_pagamento TEXT,
  empresa_faturada TEXT, data_pagamento DATE, mes INTEGER, ano INTEGER,
  fat_competencia TEXT, status_parcela_comissao TEXT, analise TEXT, possui_repasse TEXT,
  percentual_repasse NUMERIC, parcelas TEXT, percentual_imposto NUMERIC,
  valor_repasse_total NUMERIC, data_repasse DATE, status_repasse TEXT, observacao TEXT,
  card_id TEXT, responsavel TEXT, data_card_finalizado DATE,
  sync_id UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_raw_lavoro_gerencial_sync ON public.raw_lavoro_gerencial(sync_id);
CREATE INDEX IF NOT EXISTS idx_raw_lavoro_gerencial_status ON public.raw_lavoro_gerencial(status_parcela_comissao);
CREATE INDEX IF NOT EXISTS idx_raw_lavoro_gerencial_data_emissao ON public.raw_lavoro_gerencial(data_emissao);
GRANT SELECT ON public.raw_lavoro_gerencial TO authenticated;
GRANT ALL ON public.raw_lavoro_gerencial TO service_role;
ALTER TABLE public.raw_lavoro_gerencial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins e lideres podem ver gerencial lavoro" ON public.raw_lavoro_gerencial;
CREATE POLICY "Admins e lideres podem ver gerencial lavoro"
  ON public.raw_lavoro_gerencial FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN') OR public.has_role(auth.uid(),'LIDER'));

-- 1.2 DePara Ramo
CREATE TABLE IF NOT EXISTS public.raw_lavoro_depara_ramo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ramo TEXT NOT NULL, tipo_de_ramo TEXT NOT NULL,
  sync_id UUID NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.raw_lavoro_depara_ramo TO authenticated;
GRANT ALL ON public.raw_lavoro_depara_ramo TO service_role;
ALTER TABLE public.raw_lavoro_depara_ramo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins e lideres podem ver depara lavoro" ON public.raw_lavoro_depara_ramo;
CREATE POLICY "Admins e lideres podem ver depara lavoro"
  ON public.raw_lavoro_depara_ramo FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN') OR public.has_role(auth.uid(),'LIDER'));

CREATE OR REPLACE VIEW public.vw_lavoro_depara_ramo AS
SELECT DISTINCT ON (btrim(lower(ramo))) ramo, tipo_de_ramo
FROM public.raw_lavoro_depara_ramo
WHERE sync_id = (SELECT sync_id FROM public.raw_lavoro_depara_ramo ORDER BY criado_em DESC LIMIT 1)
ORDER BY btrim(lower(ramo)), id;

-- 1.3 Staging: Caixa
CREATE TABLE IF NOT EXISTS public.raw_lavoro_caixa_comissao (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_lancamento TEXT, mes_referencia TEXT, data_pagamento DATE, descricao TEXT,
  valor NUMERIC, categoria TEXT, sub_categoria TEXT, referencia TEXT, observacoes TEXT,
  data_emissao_nota_fiscal DATE,
  sync_id UUID NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_raw_lavoro_caixa_sync ON public.raw_lavoro_caixa_comissao(sync_id);
CREATE INDEX IF NOT EXISTS idx_raw_lavoro_caixa_categoria ON public.raw_lavoro_caixa_comissao(categoria);
CREATE INDEX IF NOT EXISTS idx_raw_lavoro_caixa_data_pagamento ON public.raw_lavoro_caixa_comissao(data_pagamento);
GRANT SELECT ON public.raw_lavoro_caixa_comissao TO authenticated;
GRANT ALL ON public.raw_lavoro_caixa_comissao TO service_role;
ALTER TABLE public.raw_lavoro_caixa_comissao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins e lideres podem ver caixa lavoro" ON public.raw_lavoro_caixa_comissao;
CREATE POLICY "Admins e lideres podem ver caixa lavoro"
  ON public.raw_lavoro_caixa_comissao FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN') OR public.has_role(auth.uid(),'LIDER'));

-- 1.4 Views
CREATE OR REPLACE VIEW public.vw_lavoro_gerencial AS
SELECT
  g.id, g.grupo, g.tomador, g.segurado, g.documento, g.ramo,
  COALESCE(dp.tipo_de_ramo, 'Sem Categoria') AS tipo_de_ramo,
  btrim(g.seguradora) AS seguradora, g.numero_apolice, g.data_emissao,
  g.inicio_vigencia, g.fim_vigencia, g.valor_is, g.premio_total,
  g.percentual_comissao, g.comissao_emitida, g.qtd_parcelas, g.premio_parcela,
  g.comissao_bruta, g.imposto_ret, g.valor_iss, g.valor_recebido_a_receber,
  g.numero_da_parcela, g.tipo_pagamento, g.empresa_faturada, g.data_pagamento,
  g.mes, g.ano,
  btrim(g.status_parcela_comissao) AS status_parcela_comissao,
  g.possui_repasse, g.percentual_repasse, g.valor_repasse_total, g.data_repasse,
  g.status_repasse, g.observacao, g.responsavel,
  COALESCE(g.data_emissao, g.inicio_vigencia) AS data_ajustada,
  CASE
    WHEN g.data_pagamento IS NULL THEN NULL
    WHEN EXTRACT(DAY FROM g.data_pagamento) <= 10 THEN '1-10'
    WHEN EXTRACT(DAY FROM g.data_pagamento) <= 20 THEN '11-20'
    ELSE '21-31'
  END AS dezena,
  g.sync_id
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.vw_lavoro_depara_ramo dp ON btrim(lower(dp.ramo)) = btrim(lower(g.ramo))
WHERE g.sync_id = (SELECT sync_id FROM public.raw_lavoro_gerencial ORDER BY criado_em DESC LIMIT 1);

CREATE OR REPLACE VIEW public.vw_lavoro_receita_competencia AS
SELECT tomador, segurado, documento, ramo, tipo_de_ramo, seguradora,
  data_emissao, comissao_bruta, data_pagamento, ano, mes, status_parcela_comissao
FROM public.vw_lavoro_gerencial
WHERE data_emissao IS NOT NULL AND comissao_bruta IS NOT NULL;

-- 1.5 Receita Caixa
CREATE OR REPLACE FUNCTION public.normalize_categoria_financeira(categoria text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT lower(btrim(categoria)); $$;

CREATE OR REPLACE VIEW public.vw_lavoro_receita_caixa AS
SELECT id, data_pagamento, descricao, valor, referencia, mes_referencia,
  EXTRACT(YEAR FROM data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM data_pagamento)::int AS mes,
  sync_id
FROM public.raw_lavoro_caixa_comissao
WHERE public.normalize_categoria_financeira(categoria) = 'comissão'
  AND sync_id = (SELECT sync_id FROM public.raw_lavoro_caixa_comissao ORDER BY criado_em DESC LIMIT 1);

-- 1.6 Meta anual (hub_admin_settings usa colunas key/value)
INSERT INTO public.hub_admin_settings (key, value, descricao)
VALUES ('lavoro_meta_anual_2026', '10000000', 'Meta anual de receita da Lavoro Seguros (regime de competência), editável pelo Admin')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_get_meta_anual(p_ano int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT value::numeric FROM public.hub_admin_settings WHERE key = 'lavoro_meta_anual_' || p_ano::text), 0);
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_configuracoes_hub(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('LIDER','ADMIN'))
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.perfis_acesso pa ON p.perfil_id = pa.id
    WHERE p.user_id = _user_id AND p.active = true
      AND (pa.permissoes->>'gerenciar_configuracoes_hub')::boolean = true
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_set_meta_anual(p_ano int, p_valor numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_gerenciar_configuracoes_hub(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO public.hub_admin_settings (key, value, descricao)
  VALUES ('lavoro_meta_anual_' || p_ano::text, p_valor::text, 'Meta anual Lavoro ' || p_ano::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, atualizado_em = now(), atualizado_por = auth.uid();
END;
$$;

-- 1.7 RPCs Dashboard Receita
CREATE OR REPLACE FUNCTION public.divide_safe(numerador numeric, denominador numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $$ SELECT CASE WHEN denominador IS NULL OR denominador = 0 THEN NULL ELSE numerador / denominador END; $$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_kpis(p_ano int, p_mes int, p_periodo text DEFAULT 'YTD')
RETURNS TABLE (receita_competencia numeric, receita_caixa numeric, meta_periodo numeric, atingimento numeric, defasagem numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meta_mensal numeric := public.rpc_lavoro_get_meta_anual(p_ano) / 12;
  v_meta_periodo numeric := CASE WHEN p_periodo = 'YTD' THEN v_meta_mensal * p_mes ELSE v_meta_mensal END;
BEGIN
  RETURN QUERY
  WITH comp AS (
    SELECT SUM(c.comissao_bruta) AS total FROM public.vw_lavoro_receita_competencia c
    WHERE c.ano = p_ano AND ((p_periodo = 'YTD' AND c.mes <= p_mes) OR (p_periodo = 'MTD' AND c.mes = p_mes))
  ),
  caixa AS (
    SELECT SUM(cx.valor) AS total FROM public.vw_lavoro_receita_caixa cx
    WHERE cx.ano = p_ano AND ((p_periodo = 'YTD' AND cx.mes <= p_mes) OR (p_periodo = 'MTD' AND cx.mes = p_mes))
  )
  SELECT COALESCE(comp.total,0), COALESCE(caixa.total,0), v_meta_periodo,
    public.divide_safe(COALESCE(comp.total,0), v_meta_periodo),
    COALESCE(comp.total,0) - COALESCE(caixa.total,0)
  FROM comp, caixa;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_serie_mensal(p_ano int)
RETURNS TABLE (mes int, receita_competencia numeric, receita_caixa numeric, meta_mensal numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.mes::int, COALESCE(SUM(c.comissao_bruta),0), COALESCE(SUM(cx.valor),0), public.rpc_lavoro_get_meta_anual(p_ano) / 12
  FROM generate_series(1,12) AS m(mes)
  LEFT JOIN public.vw_lavoro_receita_competencia c ON c.ano = p_ano AND c.mes = m.mes
  LEFT JOIN public.vw_lavoro_receita_caixa cx ON cx.ano = p_ano AND cx.mes = m.mes
  GROUP BY m.mes ORDER BY m.mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_comparativo_anual(p_anos int[])
RETURNS TABLE (ano int, mes int, receita_competencia numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.ano, c.mes, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c
  WHERE c.ano = ANY(p_anos)
  GROUP BY c.ano, c.mes ORDER BY c.ano, c.mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_canal(p_ano int, p_mes int)
RETURNS TABLE (tipo_de_ramo text, receita numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.tipo_de_ramo, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c
  WHERE c.ano = p_ano AND c.mes <= p_mes
  GROUP BY c.tipo_de_ramo ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_ramo(p_ano int, p_mes int)
RETURNS TABLE (ramo text, receita numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.ramo, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c
  WHERE c.ano = p_ano AND c.mes <= p_mes
  GROUP BY c.ramo ORDER BY 2 DESC;
$$;

-- 1.8 RPCs Gerencial de Apólices
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_kpis(
  p_status text DEFAULT NULL, p_seguradora text DEFAULT NULL, p_tipo_ramo text DEFAULT NULL,
  p_tomador text DEFAULT NULL, p_apolice text DEFAULT NULL, p_grupo text DEFAULT NULL,
  p_ramo text DEFAULT NULL, p_possui_repasse text DEFAULT NULL, p_ano int DEFAULT NULL
)
RETURNS TABLE (premio_total numeric, comissao_emitida numeric, comissao_gerada numeric, repasse_parceiro numeric, comissao_menos_repasse numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT SUM(g.premio_parcela), SUM(g.comissao_emitida), SUM(g.comissao_bruta),
    SUM(g.valor_repasse_total), SUM(g.valor_recebido_a_receber) - SUM(g.valor_repasse_total)
  FROM public.vw_lavoro_gerencial g
  WHERE (p_status IS NULL OR g.status_parcela_comissao = p_status)
    AND (p_seguradora IS NULL OR g.seguradora = p_seguradora)
    AND (p_tipo_ramo IS NULL OR g.tipo_de_ramo = p_tipo_ramo)
    AND (p_tomador IS NULL OR g.tomador = p_tomador)
    AND (p_apolice IS NULL OR g.numero_apolice = p_apolice)
    AND (p_grupo IS NULL OR g.grupo = p_grupo)
    AND (p_ramo IS NULL OR g.ramo = p_ramo)
    AND (p_possui_repasse IS NULL OR g.possui_repasse = p_possui_repasse)
    AND (p_ano IS NULL OR g.ano = p_ano);
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_filtros()
RETURNS TABLE (
  status_parcela_comissao text[], seguradoras text[], tipos_ramo text[], tomadores text[],
  apolices text[], grupos text[], ramos text[], status_repasse text[], anos int[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ARRAY(SELECT DISTINCT status_parcela_comissao FROM public.vw_lavoro_gerencial WHERE status_parcela_comissao IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT seguradora FROM public.vw_lavoro_gerencial WHERE seguradora IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT tipo_de_ramo FROM public.vw_lavoro_gerencial WHERE tipo_de_ramo IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT tomador FROM public.vw_lavoro_gerencial WHERE tomador IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT numero_apolice FROM public.vw_lavoro_gerencial WHERE numero_apolice IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT grupo FROM public.vw_lavoro_gerencial WHERE grupo IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT ramo FROM public.vw_lavoro_gerencial WHERE ramo IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT status_repasse FROM public.vw_lavoro_gerencial WHERE status_repasse IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT ano FROM public.vw_lavoro_gerencial WHERE ano IS NOT NULL ORDER BY 1);
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_por_seguradora(p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (seguradora text, comissao_bruta numeric, premio_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.seguradora, SUM(g.comissao_bruta), SUM(g.premio_parcela)
  FROM public.vw_lavoro_gerencial g
  WHERE (p_filtros->>'status' IS NULL OR g.status_parcela_comissao = p_filtros->>'status')
    AND (p_filtros->>'tipo_ramo' IS NULL OR g.tipo_de_ramo = p_filtros->>'tipo_ramo')
  GROUP BY g.seguradora ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_previsao_dezena(p_ano int, p_mes int DEFAULT NULL)
RETURNS TABLE (ano int, mes int, dezena text, empresa_faturada text, valor_a_receber numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.ano, g.mes, g.dezena, g.empresa_faturada, SUM(g.valor_recebido_a_receber)
  FROM public.vw_lavoro_gerencial g
  WHERE g.ano = p_ano AND (p_mes IS NULL OR g.mes = p_mes)
  GROUP BY g.ano, g.mes, g.dezena, g.empresa_faturada
  ORDER BY g.ano, g.mes, g.dezena;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_lista(p_filtros jsonb DEFAULT '{}'::jsonb, p_pagina int DEFAULT 1, p_tamanho_pagina int DEFAULT 100)
RETURNS TABLE (
  tomador text, segurado text, documento text, numero_apolice text, seguradora text,
  ramo text, tipo_de_ramo text, comissao_bruta numeric, status_parcela_comissao text,
  data_emissao date, total_linhas bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.tomador, g.segurado, g.documento, g.numero_apolice, g.seguradora,
    g.ramo, g.tipo_de_ramo, g.comissao_bruta, g.status_parcela_comissao, g.data_emissao,
    COUNT(*) OVER() AS total_linhas
  FROM public.vw_lavoro_gerencial g
  WHERE (p_filtros->>'status' IS NULL OR g.status_parcela_comissao = p_filtros->>'status')
    AND (p_filtros->>'seguradora' IS NULL OR g.seguradora = p_filtros->>'seguradora')
    AND (p_filtros->>'tipo_ramo' IS NULL OR g.tipo_de_ramo = p_filtros->>'tipo_ramo')
  ORDER BY g.data_emissao DESC
  LIMIT p_tamanho_pagina OFFSET (p_pagina - 1) * p_tamanho_pagina;
$$;
