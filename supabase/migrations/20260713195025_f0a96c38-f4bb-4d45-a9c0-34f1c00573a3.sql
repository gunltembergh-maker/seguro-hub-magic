
-- Recreate the competência view sourcing value from comissao_bruta.
-- The output column is still named "comissao_liquida" so all dependent RPCs
-- (rpc_receita_kpis, rpc_receita_por_ramo, rpc_receita_por_canal,
--  rpc_receita_serie_mensal, rpc_receita_variacoes, rpc_receita_comparativo_anual)
-- keep working with zero changes to their bodies or signatures.

DROP VIEW IF EXISTS public.vw_lavoro_receita_competencia CASCADE;

CREATE VIEW public.vw_lavoro_receita_competencia AS
SELECT
  g.ano::int              AS ano,
  g.mes::int              AS mes,
  g.ramo                  AS ramo,
  dr.tipo_de_ramo         AS canal,
  COALESCE(g.comissao_bruta, 0)::numeric AS comissao_liquida
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.vw_lavoro_depara_ramo dr
  ON LOWER(BTRIM(dr.ramo)) = LOWER(BTRIM(g.ramo))
WHERE g.ano IS NOT NULL
  AND g.mes IS NOT NULL;

GRANT SELECT ON public.vw_lavoro_receita_competencia TO authenticated;
GRANT ALL    ON public.vw_lavoro_receita_competencia TO service_role;

-- Recreate the RPCs dropped by CASCADE, IDENTICAL to their current definitions
-- (same signatures, same returned field names). They read comissao_liquida
-- from the view, which now comes from comissao_bruta under the hood.

CREATE OR REPLACE FUNCTION public.rpc_receita_kpis(_ano integer, _mes integer, _periodo text DEFAULT 'MTD'::text)
 RETURNS TABLE(competencia numeric, caixa numeric, meta numeric, atingimento numeric, defasagem numeric, previsto numeric, atingimento_caixa numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    SELECT COALESCE(SUM(comissao_liquida),0) AS v
      FROM public.vw_lavoro_receita_competencia
     WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  ), cx AS (
    SELECT COALESCE(SUM(valor_recebido),0) AS v
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
    public.divide_safe(cx.v, v_meta_periodo) * 100
  FROM comp, cx, pv;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_por_ramo(_ano integer, _mes integer, _periodo text DEFAULT 'MTD'::text)
 RETURNS TABLE(ramo text, valor numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ini INT; v_fim INT;
BEGIN
  v_ini := CASE _periodo WHEN 'YTD' THEN 1 WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 1 ELSE 7 END ELSE _mes END;
  v_fim := CASE _periodo WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 6 ELSE 12 END ELSE _mes END;
  RETURN QUERY
    SELECT COALESCE(v.ramo,'(sem ramo)'), COALESCE(SUM(v.comissao_liquida),0)
      FROM public.vw_lavoro_receita_competencia v
     WHERE v.ano=_ano AND v.mes BETWEEN v_ini AND v_fim
     GROUP BY 1 ORDER BY 2 DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_por_canal(_ano integer, _mes integer, _periodo text DEFAULT 'MTD'::text)
 RETURNS TABLE(canal text, valor numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ini INT; v_fim INT;
BEGIN
  v_ini := CASE _periodo WHEN 'YTD' THEN 1 WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 1 ELSE 7 END ELSE _mes END;
  v_fim := CASE _periodo WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 6 ELSE 12 END ELSE _mes END;
  RETURN QUERY
    SELECT COALESCE(v.canal,'(sem canal)'), COALESCE(SUM(v.comissao_liquida),0)
      FROM public.vw_lavoro_receita_competencia v
     WHERE v.ano=_ano AND v.mes BETWEEN v_ini AND v_fim
     GROUP BY 1 ORDER BY 2 DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_serie_mensal(_ano integer)
 RETURNS TABLE(mes integer, competencia numeric, caixa numeric, meta numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_meta NUMERIC := public.rpc_get_meta_anual(_ano);
BEGIN
  RETURN QUERY
  WITH meses AS (SELECT generate_series(1,12) AS mes)
  SELECT m.mes,
    COALESCE((SELECT SUM(comissao_liquida) FROM public.vw_lavoro_receita_competencia
              WHERE ano=_ano AND mes=m.mes),0),
    COALESCE((SELECT SUM(valor_recebido) FROM public.vw_lavoro_receita_caixa
              WHERE ano=_ano AND mes=m.mes),0),
    v_meta/12.0
  FROM meses m ORDER BY m.mes;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_variacoes(_ano integer, _mes integer)
 RETURNS TABLE(atual numeric, mes_anterior numeric, ano_anterior numeric, var_mes numeric, var_ano numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_atual NUMERIC; v_ma NUMERIC; v_aa NUMERIC;
        v_ma_ano INT; v_ma_mes INT;
BEGIN
  SELECT COALESCE(SUM(comissao_liquida),0) INTO v_atual
    FROM public.vw_lavoro_receita_competencia WHERE ano=_ano AND mes=_mes;

  v_ma_ano := CASE WHEN _mes=1 THEN _ano-1 ELSE _ano END;
  v_ma_mes := CASE WHEN _mes=1 THEN 12 ELSE _mes-1 END;

  SELECT COALESCE(SUM(comissao_liquida),0) INTO v_ma
    FROM public.vw_lavoro_receita_competencia WHERE ano=v_ma_ano AND mes=v_ma_mes;

  SELECT COALESCE(SUM(comissao_liquida),0) INTO v_aa
    FROM public.vw_lavoro_receita_competencia WHERE ano=_ano-1 AND mes=_mes;

  RETURN QUERY SELECT v_atual, v_ma, v_aa,
    public.divide_safe(v_atual - v_ma, v_ma) * 100,
    public.divide_safe(v_atual - v_aa, v_aa) * 100;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_comparativo_anual(_anos integer[])
 RETURNS TABLE(ano integer, mes integer, competencia numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano, mes, COALESCE(SUM(comissao_liquida),0)
    FROM public.vw_lavoro_receita_competencia
   WHERE ano = ANY(_anos)
   GROUP BY ano, mes ORDER BY ano, mes;
$function$;
