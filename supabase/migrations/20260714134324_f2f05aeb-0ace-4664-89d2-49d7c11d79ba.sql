-- Helpers
DROP FUNCTION IF EXISTS public.divide_safe(numeric, numeric);
CREATE FUNCTION public.divide_safe(numerador numeric, denominador numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT CASE WHEN denominador IS NULL OR denominador = 0 THEN NULL ELSE numerador / denominador END; $$;

CREATE OR REPLACE FUNCTION public.normalize_categoria_financeira(categoria text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT lower(btrim(translate(coalesce(categoria, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')));
$$;

-- Views
DROP VIEW IF EXISTS public.vw_lavoro_previsto_caixa CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_receita_competencia CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_receita_caixa CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_gerencial CASCADE;
DROP VIEW IF EXISTS public.vw_lavoro_depara_ramo CASCADE;

CREATE VIEW public.vw_lavoro_depara_ramo AS
SELECT DISTINCT ON (btrim(lower(ramo))) ramo, tipo_de_ramo
FROM public.raw_lavoro_depara_ramo
WHERE sync_id = (SELECT sync_id FROM public.raw_lavoro_depara_ramo ORDER BY criado_em DESC LIMIT 1)
ORDER BY btrim(lower(ramo)), id;

CREATE VIEW public.vw_lavoro_gerencial AS
SELECT
  g.id, g.grupo, g.tomador, g.segurado, g.documento, g.ramo,
  COALESCE(dp.tipo_de_ramo, 'Sem Categoria') AS tipo_de_ramo,
  btrim(g.seguradora) AS seguradora, g.numero_apolice, g.data_emissao,
  g.inicio_vigencia, g.fim_vigencia, g.valor_is, g.premio_total,
  g.percentual_comissao, g.comissao_emitida, g.qtd_parcelas, g.premio_parcela,
  g.comissao_bruta, g.imposto_ret, g.valor_iss, g.valor_recebido_a_receber,
  g.numero_da_parcela, g.tipo_pagamento, g.empresa_faturada, g.data_pagamento,
  COALESCE(EXTRACT(MONTH FROM g.data_emissao)::int, g.mes)::int AS mes,
  COALESCE(EXTRACT(YEAR FROM g.data_emissao)::int, g.ano)::int AS ano,
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

CREATE VIEW public.vw_lavoro_receita_competencia AS
SELECT tomador, segurado, documento, ramo, tipo_de_ramo, seguradora,
  data_emissao, comissao_bruta, data_pagamento, ano, mes, status_parcela_comissao
FROM public.vw_lavoro_gerencial
WHERE comissao_bruta IS NOT NULL AND ano IS NOT NULL AND mes IS NOT NULL;

CREATE VIEW public.vw_lavoro_receita_caixa AS
SELECT id, data_pagamento, descricao, valor, referencia, mes_referencia,
  EXTRACT(YEAR FROM data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM data_pagamento)::int AS mes,
  sync_id
FROM public.raw_lavoro_caixa_comissao
WHERE (public.normalize_categoria_financeira(categoria) = 'comissao'
    OR public.normalize_categoria_financeira(tipo_lancamento) = 'comissao')
  AND sync_id = (SELECT sync_id FROM public.raw_lavoro_caixa_comissao ORDER BY criado_em DESC LIMIT 1);

CREATE VIEW public.vw_lavoro_previsto_caixa AS
SELECT ramo, tipo_de_ramo,
  comissao_bruta AS valor_previsto, data_pagamento,
  EXTRACT(YEAR FROM data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM data_pagamento)::int AS mes
FROM public.vw_lavoro_gerencial
WHERE data_pagamento IS NOT NULL AND comissao_bruta IS NOT NULL;

GRANT SELECT ON public.vw_lavoro_depara_ramo TO authenticated, service_role;
GRANT SELECT ON public.vw_lavoro_gerencial TO authenticated, service_role;
GRANT SELECT ON public.vw_lavoro_receita_competencia TO authenticated, service_role;
GRANT SELECT ON public.vw_lavoro_receita_caixa TO authenticated, service_role;
GRANT SELECT ON public.vw_lavoro_previsto_caixa TO authenticated, service_role;

-- Meta anual: copia do formato antigo para o novo
INSERT INTO public.hub_admin_settings(key, value)
SELECT 'lavoro_meta_anual_' || pairs.k, to_jsonb(pairs.v::numeric)
FROM public.hub_admin_settings s,
LATERAL jsonb_each_text(s.value) AS pairs(k, v)
WHERE s.key = 'meta_anual' AND pairs.v ~ '^[0-9.]+$'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.hub_admin_settings(key, value)
VALUES ('lavoro_meta_anual_2026', to_jsonb(10000000::numeric))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_get_meta_anual(p_ano int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value#>>'{}')::numeric FROM public.hub_admin_settings
     WHERE key = 'lavoro_meta_anual_' || p_ano::text), 0);
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_set_meta_anual(p_ano int, p_valor numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_gerenciar_configuracoes(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;
  INSERT INTO public.hub_admin_settings (key, value, atualizado_por)
  VALUES ('lavoro_meta_anual_' || p_ano::text, to_jsonb(p_valor), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, atualizado_em = now(), atualizado_por = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_get_meta_anual(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_set_meta_anual(int, numeric) TO authenticated, service_role;

-- Receita
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_kpis(p_ano int, p_mes int, p_periodo text DEFAULT 'YTD')
RETURNS TABLE (
  receita_competencia numeric, receita_caixa numeric,
  meta_periodo numeric, atingimento numeric, defasagem numeric,
  previsto_caixa numeric, atingimento_caixa numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meta_mensal numeric := public.rpc_lavoro_get_meta_anual(p_ano) / 12;
  v_mes_inicio_semestre int := CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END;
  v_meses_no_periodo int := CASE
    WHEN p_periodo = 'MTD' THEN 1
    WHEN p_periodo = 'SEMESTRE' THEN (p_mes - v_mes_inicio_semestre + 1)
    ELSE p_mes END;
  v_meta_periodo numeric := v_meta_mensal * v_meses_no_periodo;
BEGIN
  RETURN QUERY
  WITH comp AS (
    SELECT SUM(c.comissao_bruta) AS total FROM public.vw_lavoro_receita_competencia c
    WHERE c.ano = p_ano AND (
      (p_periodo = 'MTD' AND c.mes = p_mes) OR
      (p_periodo = 'YTD' AND c.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND c.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  ),
  caixa AS (
    SELECT SUM(cx.valor) AS total FROM public.vw_lavoro_receita_caixa cx
    WHERE cx.ano = p_ano AND (
      (p_periodo = 'MTD' AND cx.mes = p_mes) OR
      (p_periodo = 'YTD' AND cx.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND cx.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  ),
  previsto AS (
    SELECT SUM(pv.valor_previsto) AS total FROM public.vw_lavoro_previsto_caixa pv
    WHERE pv.ano = p_ano AND (
      (p_periodo = 'MTD' AND pv.mes = p_mes) OR
      (p_periodo = 'YTD' AND pv.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND pv.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  )
  SELECT
    COALESCE(comp.total, 0), COALESCE(caixa.total, 0), v_meta_periodo,
    public.divide_safe(COALESCE(comp.total, 0), v_meta_periodo),
    COALESCE(comp.total, 0) - COALESCE(caixa.total, 0),
    COALESCE(previsto.total, 0),
    public.divide_safe(COALESCE(caixa.total, 0), COALESCE(previsto.total, 0))
  FROM comp, caixa, previsto;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_serie_mensal(p_ano int)
RETURNS TABLE (mes int, receita_competencia numeric, receita_caixa numeric, meta_mensal numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.mes::int,
    COALESCE((SELECT SUM(comissao_bruta) FROM public.vw_lavoro_receita_competencia
              WHERE ano = p_ano AND mes = m.mes), 0),
    COALESCE((SELECT SUM(valor) FROM public.vw_lavoro_receita_caixa
              WHERE ano = p_ano AND mes = m.mes), 0),
    public.rpc_lavoro_get_meta_anual(p_ano) / 12
  FROM generate_series(1,12) AS m(mes)
  ORDER BY m.mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_variacoes(p_ano int, p_mes int)
RETURNS TABLE (variacao_mes_anterior numeric, variacao_ano_anterior numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_atual numeric; v_mes_anterior numeric; v_ano_anterior numeric;
  v_ano_ref int := CASE WHEN p_mes = 1 THEN p_ano - 1 ELSE p_ano END;
  v_mes_ref int := CASE WHEN p_mes = 1 THEN 12 ELSE p_mes - 1 END;
BEGIN
  SELECT SUM(valor) INTO v_atual FROM public.vw_lavoro_receita_caixa WHERE ano = p_ano AND mes = p_mes;
  SELECT SUM(valor) INTO v_mes_anterior FROM public.vw_lavoro_receita_caixa WHERE ano = v_ano_ref AND mes = v_mes_ref;
  SELECT SUM(valor) INTO v_ano_anterior FROM public.vw_lavoro_receita_caixa WHERE ano = p_ano - 1 AND mes = p_mes;
  RETURN QUERY SELECT
    public.divide_safe(COALESCE(v_atual,0) - COALESCE(v_mes_anterior,0), NULLIF(v_mes_anterior,0)),
    public.divide_safe(COALESCE(v_atual,0) - COALESCE(v_ano_anterior,0), NULLIF(v_ano_anterior,0));
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_comparativo_anual(p_anos int[])
RETURNS TABLE (ano int, mes int, receita_competencia numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.ano, c.mes, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c
  WHERE c.ano = ANY(p_anos) GROUP BY c.ano, c.mes ORDER BY c.ano, c.mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_caixa_comparativo_anual(p_anos int[])
RETURNS TABLE (ano int, mes int, receita_caixa numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cx.ano, cx.mes, SUM(cx.valor)
  FROM public.vw_lavoro_receita_caixa cx
  WHERE cx.ano = ANY(p_anos) GROUP BY cx.ano, cx.mes ORDER BY cx.ano, cx.mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_canal(p_ano int, p_mes int, p_periodo text DEFAULT 'YTD')
RETURNS TABLE(tipo_de_ramo text, receita numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH cfg AS (SELECT CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END AS mes_ini)
  SELECT c.tipo_de_ramo, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c, cfg
  WHERE c.ano = p_ano AND (
    (p_periodo = 'YTD' AND c.mes <= p_mes) OR
    (p_periodo = 'MTD' AND c.mes = p_mes) OR
    (p_periodo = 'SEMESTRE' AND c.mes BETWEEN cfg.mes_ini AND p_mes))
  GROUP BY c.tipo_de_ramo ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_ramo(p_ano int, p_mes int, p_periodo text DEFAULT 'YTD')
RETURNS TABLE(ramo text, receita numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH cfg AS (SELECT CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END AS mes_ini)
  SELECT c.ramo, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c, cfg
  WHERE c.ano = p_ano AND (
    (p_periodo = 'YTD' AND c.mes <= p_mes) OR
    (p_periodo = 'MTD' AND c.mes = p_mes) OR
    (p_periodo = 'SEMESTRE' AND c.mes BETWEEN cfg.mes_ini AND p_mes))
  GROUP BY c.ramo ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_ultima_atualizacao()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT GREATEST(
    (SELECT MAX(criado_em) FROM public.raw_lavoro_gerencial),
    (SELECT MAX(criado_em) FROM public.raw_lavoro_caixa_comissao),
    (SELECT MAX(criado_em) FROM public.raw_lavoro_depara_ramo));
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_kpis(int, int, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_serie_mensal(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_variacoes(int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_comparativo_anual(int[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_caixa_comparativo_anual(int[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_por_canal(int, int, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_por_ramo(int, int, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_ultima_atualizacao() TO authenticated, service_role;

-- Apólices
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_kpis(
  p_status text DEFAULT NULL, p_seguradora text DEFAULT NULL, p_tipo_ramo text DEFAULT NULL,
  p_tomador text DEFAULT NULL, p_apolice text DEFAULT NULL, p_grupo text DEFAULT NULL,
  p_ramo text DEFAULT NULL, p_possui_repasse text DEFAULT NULL, p_ano int DEFAULT NULL)
RETURNS TABLE (premio_total numeric, comissao_emitida numeric, comissao_gerada numeric, repasse_parceiro numeric, comissao_menos_repasse numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT SUM(g.premio_parcela), SUM(g.comissao_emitida), SUM(g.comissao_bruta),
    SUM(g.valor_repasse_total),
    COALESCE(SUM(g.valor_recebido_a_receber),0) - COALESCE(SUM(g.valor_repasse_total),0)
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
  apolices text[], grupos text[], ramos text[], status_repasse text[], anos int[])
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

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_previsao_dezena(p_ano int DEFAULT NULL, p_mes int DEFAULT NULL)
RETURNS TABLE (ano int, mes int, dezena text, empresa_faturada text, valor_a_receber numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano int := COALESCE(p_ano, EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_mes int := COALESCE(p_mes, EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_inicio date := make_date(v_ano, v_mes, 1);
  v_fim date := (v_inicio + interval '4 months' - interval '1 day')::date;
BEGIN
  RETURN QUERY
  SELECT g.ano, g.mes, g.dezena, g.empresa_faturada, SUM(g.valor_recebido_a_receber)
  FROM public.vw_lavoro_gerencial g
  WHERE g.data_pagamento BETWEEN v_inicio AND v_fim
  GROUP BY g.ano, g.mes, g.dezena, g.empresa_faturada
  ORDER BY g.ano, g.mes, g.dezena;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_lista(p_filtros jsonb DEFAULT '{}'::jsonb, p_pagina int DEFAULT 1, p_tamanho_pagina int DEFAULT 100)
RETURNS TABLE (
  tomador text, segurado text, documento text, numero_apolice text, seguradora text,
  ramo text, tipo_de_ramo text, comissao_bruta numeric, status_parcela_comissao text,
  data_emissao date, total_linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.tomador, g.segurado, g.documento, g.numero_apolice, g.seguradora,
    g.ramo, g.tipo_de_ramo, g.comissao_bruta, g.status_parcela_comissao, g.data_emissao,
    COUNT(*) OVER() AS total_linhas
  FROM public.vw_lavoro_gerencial g
  WHERE (p_filtros->>'status' IS NULL OR g.status_parcela_comissao = p_filtros->>'status')
    AND (p_filtros->>'seguradora' IS NULL OR g.seguradora = p_filtros->>'seguradora')
    AND (p_filtros->>'tipo_ramo' IS NULL OR g.tipo_de_ramo = p_filtros->>'tipo_ramo')
  ORDER BY g.data_emissao DESC NULLS LAST
  LIMIT p_tamanho_pagina OFFSET (p_pagina - 1) * p_tamanho_pagina;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_kpis(text, text, text, text, text, text, text, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_filtros() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_por_seguradora(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_previsao_dezena(int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_lista(jsonb, int, int) TO authenticated, service_role;