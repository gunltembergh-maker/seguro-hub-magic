-- Fix: RPCs that read from vw_lavoro_receita_caixa were using wrong column name.
-- The view exposes the value column as "valor" (from Excel "Valor:" column).

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
    public.divide_safe(cx.v, v_meta_periodo) * 100
  FROM comp, cx, pv;
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_caixa_comparativo_anual(_anos integer[])
 RETURNS TABLE(ano integer, mes integer, caixa numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano, mes, COALESCE(SUM(valor),0)
    FROM public.vw_lavoro_receita_caixa
   WHERE ano = ANY(_anos)
   GROUP BY ano, mes ORDER BY ano, mes;
$function$;
