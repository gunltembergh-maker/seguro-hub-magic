DROP FUNCTION IF EXISTS public.rpc_lavoro_receita_kpis(integer, integer, text, uuid);
DROP FUNCTION IF EXISTS public.rpc_lavoro_receita_kpis(integer, integer, text);

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_kpis(p_ano integer, p_mes integer, p_periodo text DEFAULT 'YTD'::text)
 RETURNS TABLE(receita_competencia numeric, receita_caixa numeric, meta_periodo numeric, atingimento numeric, defasagem numeric, previsto_caixa numeric, atingimento_caixa numeric, previsto_garantia numeric, previsto_beneficios numeric, previsto_demais numeric, caixa_garantia numeric, caixa_beneficios numeric, caixa_demais numeric, competencia_garantia numeric, competencia_beneficios numeric, competencia_demais numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT
      SUM(c.comissao_bruta) AS total,
      SUM(c.comissao_bruta) FILTER (WHERE public.lavoro_canal(c.tipo_de_ramo) = 'Garantia') AS garantia,
      SUM(c.comissao_bruta) FILTER (WHERE public.lavoro_canal(c.tipo_de_ramo) = 'Benefícios') AS beneficios
    FROM public.vw_lavoro_receita_competencia c
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
    SELECT
      SUM(pv.valor_previsto) AS total,
      SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Garantia') AS garantia,
      SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Benefícios') AS beneficios,
      SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Demais Ramos') AS demais
    FROM public.vw_lavoro_previsto_caixa pv
    WHERE pv.ano = p_ano AND (
      (p_periodo = 'MTD' AND pv.mes = p_mes) OR
      (p_periodo = 'YTD') OR
      (p_periodo = 'SEMESTRE' AND pv.mes BETWEEN v_mes_inicio_semestre AND (CASE WHEN p_mes <= 6 THEN 6 ELSE 12 END)))
  ),
  caixa_mix AS (
    SELECT
      COALESCE(SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Garantia'), 0) AS garantia,
      COALESCE(SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Benefícios'), 0) AS beneficios,
      COALESCE(SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Demais Ramos'), 0) AS demais
    FROM public.vw_lavoro_previsto_caixa pv
    WHERE lower(btrim(coalesce(pv.status_parcela_comissao,''))) = 'paga'
      AND pv.ano = p_ano AND (
      (p_periodo = 'MTD' AND pv.mes = p_mes) OR
      (p_periodo = 'YTD' AND pv.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND pv.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  )
  SELECT
    COALESCE(comp.total, 0), COALESCE(caixa.total, 0), v_meta_periodo,
    public.divide_safe(COALESCE(comp.total, 0), v_meta_periodo),
    COALESCE(comp.total, 0) - COALESCE(caixa.total, 0),
    COALESCE(previsto.total, 0),
    public.divide_safe(COALESCE(caixa.total, 0), COALESCE(previsto.total, 0)),
    COALESCE(previsto.garantia, 0),
    COALESCE(previsto.beneficios, 0),
    COALESCE(previsto.total, 0) - COALESCE(previsto.garantia, 0) - COALESCE(previsto.beneficios, 0),
    LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0), 0)),
    LEAST(caixa_mix.beneficios, GREATEST(COALESCE(caixa.total,0) - LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0),0)), 0)),
    COALESCE(caixa.total,0)
      - LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0), 0))
      - LEAST(caixa_mix.beneficios, GREATEST(COALESCE(caixa.total,0) - LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0),0)), 0)),
    COALESCE(comp.garantia, 0),
    COALESCE(comp.beneficios, 0),
    COALESCE(comp.total, 0) - COALESCE(comp.garantia, 0) - COALESCE(comp.beneficios, 0)
  FROM comp, caixa, previsto, caixa_mix;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_kpis(p_ano integer, p_mes integer, p_periodo text, p_user_id uuid)
 RETURNS TABLE(receita_competencia numeric, receita_caixa numeric, meta_periodo numeric, atingimento numeric, defasagem numeric, previsto_caixa numeric, atingimento_caixa numeric, previsto_garantia numeric, previsto_beneficios numeric, previsto_demais numeric, caixa_garantia numeric, caixa_beneficios numeric, caixa_demais numeric, competencia_garantia numeric, competencia_beneficios numeric, competencia_demais numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_receita_kpis(p_ano, p_mes, p_periodo);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_kpis(integer, integer, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_kpis(integer, integer, text, uuid) TO authenticated, service_role;