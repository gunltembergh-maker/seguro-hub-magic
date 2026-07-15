
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_kpis(p_ano integer, p_mes integer, p_periodo text DEFAULT 'YTD'::text)
 RETURNS TABLE(receita_competencia numeric, receita_caixa numeric, meta_periodo numeric, atingimento numeric, defasagem numeric, previsto_caixa numeric, atingimento_caixa numeric)
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
    -- Previsto sempre soma o ano inteiro selecionado, independente do período/mês
    SELECT SUM(pv.valor_previsto) AS total FROM public.vw_lavoro_previsto_caixa pv
    WHERE pv.ano = p_ano
  )
  SELECT
    COALESCE(comp.total, 0), COALESCE(caixa.total, 0), v_meta_periodo,
    public.divide_safe(COALESCE(comp.total, 0), v_meta_periodo),
    COALESCE(comp.total, 0) - COALESCE(caixa.total, 0),
    COALESCE(previsto.total, 0),
    public.divide_safe(COALESCE(caixa.total, 0), COALESCE(previsto.total, 0))
  FROM comp, caixa, previsto;
END;
$function$;
