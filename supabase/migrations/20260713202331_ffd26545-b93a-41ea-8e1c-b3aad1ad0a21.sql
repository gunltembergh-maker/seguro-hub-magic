
DROP VIEW IF EXISTS public.vw_lavoro_receita_competencia CASCADE;

CREATE VIEW public.vw_lavoro_receita_competencia AS
SELECT
  g.tomador, g.segurado, g.documento, g.ramo,
  COALESCE(dp.tipo_de_ramo, 'Sem Categoria') AS tipo_de_ramo,
  g.seguradora, g.data_emissao, g.comissao_bruta, g.data_pagamento,
  EXTRACT(YEAR FROM g.data_emissao)::int AS ano,
  EXTRACT(MONTH FROM g.data_emissao)::int AS mes,
  g.status_parcela_comissao
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.vw_lavoro_depara_ramo dp ON lower(btrim(dp.ramo)) = lower(btrim(g.ramo))
WHERE g.sync_id = (SELECT sync_id FROM public.raw_lavoro_gerencial ORDER BY criado_em DESC LIMIT 1)
  AND g.data_emissao IS NOT NULL
  AND g.comissao_bruta IS NOT NULL;

INSERT INTO public.hub_admin_settings(key, value)
VALUES ('meta_anual', jsonb_build_object('2026', 10000000))
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.hub_admin_settings.value, '{}'::jsonb) || jsonb_build_object('2026', 10000000),
    atualizado_em = now();

CREATE OR REPLACE FUNCTION public.rpc_receita_kpis(_ano integer, _mes integer, _periodo text DEFAULT 'MTD'::text)
RETURNS TABLE(competencia numeric, caixa numeric, meta numeric, atingimento numeric, defasagem numeric, previsto numeric, atingimento_caixa numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_inicio INT;
  v_mes_fim INT := _mes;
  v_meta NUMERIC := public.rpc_get_meta_anual(_ano);
  v_meta_periodo NUMERIC;
BEGIN
  v_mes_inicio := CASE
    WHEN _periodo = 'YTD' THEN 1
    WHEN _periodo = 'SEMESTRE' THEN CASE WHEN _mes <= 6 THEN 1 ELSE 7 END
    ELSE _mes
  END;
  v_mes_fim := CASE WHEN _periodo = 'SEMESTRE' THEN CASE WHEN _mes <= 6 THEN 6 ELSE 12 END ELSE _mes END;
  v_meta_periodo := v_meta * (v_mes_fim - v_mes_inicio + 1) / 12.0;

  RETURN QUERY
  WITH comp AS (
    SELECT COALESCE(SUM(comissao_bruta),0) AS v
    FROM public.vw_lavoro_receita_competencia
    WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  ), cx AS (
    SELECT COALESCE(SUM(valor),0) AS v
    FROM public.vw_lavoro_receita_caixa
    WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  ), pv AS (
    SELECT COALESCE(SUM(valor_previsto),0) AS v
    FROM public.vw_lavoro_previsto_caixa
    WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  )
  SELECT
    comp.v, cx.v, v_meta_periodo,
    public.divide_safe(comp.v, v_meta_periodo) * 100,
    v_meta_periodo - comp.v,
    pv.v,
    public.divide_safe(cx.v, pv.v) * 100
  FROM comp, cx, pv;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_variacoes(_ano integer, _mes integer)
RETURNS TABLE(atual numeric, mes_anterior numeric, ano_anterior numeric, var_mes numeric, var_ano numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_atual NUMERIC; v_ma NUMERIC; v_aa NUMERIC;
  v_ma_ano INT; v_ma_mes INT;
BEGIN
  SELECT COALESCE(SUM(comissao_bruta),0) INTO v_atual
  FROM public.vw_lavoro_receita_competencia WHERE ano=_ano AND mes=_mes;

  v_ma_ano := CASE WHEN _mes=1 THEN _ano-1 ELSE _ano END;
  v_ma_mes := CASE WHEN _mes=1 THEN 12 ELSE _mes-1 END;

  SELECT COALESCE(SUM(comissao_bruta),0) INTO v_ma
  FROM public.vw_lavoro_receita_competencia WHERE ano=v_ma_ano AND mes=v_ma_mes;

  SELECT COALESCE(SUM(comissao_bruta),0) INTO v_aa
  FROM public.vw_lavoro_receita_competencia WHERE ano=_ano-1 AND mes=_mes;

  RETURN QUERY SELECT v_atual, v_ma, v_aa,
    public.divide_safe(v_atual - v_ma, v_ma) * 100,
    public.divide_safe(v_atual - v_aa, v_aa) * 100;
END;
$function$;

GRANT SELECT ON public.vw_lavoro_receita_competencia TO authenticated;
GRANT ALL ON public.vw_lavoro_receita_competencia TO service_role;
