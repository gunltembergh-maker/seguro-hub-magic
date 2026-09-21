-- KPIs: receita_caixa/atingimento_caixa/defasagem usam o valor baixado por canal quando restrito, em vez de NULL
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
  v_caixa_visivel boolean := public.lavoro_receita_caixa_visivel();
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
      AND public.lavoro_canal_visivel(c.tipo_de_ramo)
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
      AND public.lavoro_canal_visivel(pv.tipo_de_ramo)
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
      AND public.lavoro_canal_visivel(pv.tipo_de_ramo)
  ),
  caixa_final AS (
    SELECT CASE WHEN v_caixa_visivel THEN COALESCE(caixa.total, 0)
                ELSE COALESCE(caixa_mix.garantia,0) + COALESCE(caixa_mix.beneficios,0) + COALESCE(caixa_mix.demais,0)
           END AS total
    FROM caixa, caixa_mix
  )
  SELECT
    COALESCE(comp.total, 0),
    caixa_final.total,
    v_meta_periodo,
    public.divide_safe(COALESCE(comp.total, 0), v_meta_periodo),
    COALESCE(comp.total, 0) - caixa_final.total,
    COALESCE(previsto.total, 0),
    public.divide_safe(caixa_final.total, COALESCE(previsto.total, 0)),
    COALESCE(previsto.garantia, 0),
    COALESCE(previsto.beneficios, 0),
    COALESCE(previsto.total, 0) - COALESCE(previsto.garantia, 0) - COALESCE(previsto.beneficios, 0),
    COALESCE(caixa_mix.garantia, 0),
    COALESCE(caixa_mix.beneficios, 0),
    COALESCE(caixa_mix.demais, 0),
    COALESCE(comp.garantia, 0),
    COALESCE(comp.beneficios, 0),
    COALESCE(comp.total, 0) - COALESCE(comp.garantia, 0) - COALESCE(comp.beneficios, 0)
  FROM comp, caixa, previsto, caixa_mix, caixa_final;
END;
$function$;

-- Série mensal: coluna receita_caixa usa o baixado por canal quando restrito
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_serie_mensal(p_ano integer)
 RETURNS TABLE(mes integer, receita_competencia numeric, receita_caixa numeric, meta_mensal numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.mes::int,
    COALESCE((SELECT SUM(comissao_bruta) FROM public.vw_lavoro_receita_competencia
              WHERE ano = p_ano AND mes = m.mes AND public.lavoro_canal_visivel(tipo_de_ramo)), 0),
    CASE WHEN public.lavoro_receita_caixa_visivel()
      THEN COALESCE((SELECT SUM(valor) FROM public.vw_lavoro_receita_caixa
              WHERE ano = p_ano AND mes = m.mes), 0)
      ELSE COALESCE((SELECT SUM(valor_previsto) FROM public.vw_lavoro_previsto_caixa
              WHERE ano = p_ano AND mes = m.mes
                AND lower(btrim(coalesce(status_parcela_comissao,''))) = 'paga'
                AND public.lavoro_canal_visivel(tipo_de_ramo)), 0)
      END,
    public.rpc_lavoro_get_meta_anual(p_ano) / 12
  FROM generate_series(1,12) AS m(mes)
  ORDER BY m.mes;
$function$;

-- Variações (mês anterior / ano anterior): usa o baixado por canal quando restrito
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_variacoes(p_ano integer, p_mes integer)
 RETURNS TABLE(variacao_mes_anterior numeric, variacao_ano_anterior numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_atual numeric; v_mes_anterior numeric; v_ano_anterior numeric;
  v_ano_ref int := CASE WHEN p_mes = 1 THEN p_ano - 1 ELSE p_ano END;
  v_mes_ref int := CASE WHEN p_mes = 1 THEN 12 ELSE p_mes - 1 END;
  v_caixa_visivel boolean := public.lavoro_receita_caixa_visivel();
BEGIN
  IF v_caixa_visivel THEN
    SELECT SUM(valor) INTO v_atual FROM public.vw_lavoro_receita_caixa WHERE ano = p_ano AND mes = p_mes;
    SELECT SUM(valor) INTO v_mes_anterior FROM public.vw_lavoro_receita_caixa WHERE ano = v_ano_ref AND mes = v_mes_ref;
    SELECT SUM(valor) INTO v_ano_anterior FROM public.vw_lavoro_receita_caixa WHERE ano = p_ano - 1 AND mes = p_mes;
  ELSE
    SELECT SUM(valor_previsto) INTO v_atual FROM public.vw_lavoro_previsto_caixa
      WHERE ano = p_ano AND mes = p_mes AND lower(btrim(coalesce(status_parcela_comissao,''))) = 'paga' AND public.lavoro_canal_visivel(tipo_de_ramo);
    SELECT SUM(valor_previsto) INTO v_mes_anterior FROM public.vw_lavoro_previsto_caixa
      WHERE ano = v_ano_ref AND mes = v_mes_ref AND lower(btrim(coalesce(status_parcela_comissao,''))) = 'paga' AND public.lavoro_canal_visivel(tipo_de_ramo);
    SELECT SUM(valor_previsto) INTO v_ano_anterior FROM public.vw_lavoro_previsto_caixa
      WHERE ano = p_ano - 1 AND mes = p_mes AND lower(btrim(coalesce(status_parcela_comissao,''))) = 'paga' AND public.lavoro_canal_visivel(tipo_de_ramo);
  END IF;
  RETURN QUERY SELECT
    public.divide_safe(COALESCE(v_atual,0) - COALESCE(v_mes_anterior,0), NULLIF(v_mes_anterior,0)),
    public.divide_safe(COALESCE(v_atual,0) - COALESCE(v_ano_anterior,0), NULLIF(v_ano_anterior,0));
END;
$function$;

-- Comparativo anual de caixa: usa o baixado por canal quando restrito
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_caixa_comparativo_anual(p_anos integer[])
 RETURNS TABLE(ano integer, mes integer, receita_caixa numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.lavoro_receita_caixa_visivel() THEN
    RETURN QUERY
    SELECT cx.ano, cx.mes, SUM(cx.valor)
    FROM public.vw_lavoro_receita_caixa cx
    WHERE cx.ano = ANY(p_anos)
    GROUP BY cx.ano, cx.mes
    ORDER BY cx.ano, cx.mes;
  ELSE
    RETURN QUERY
    SELECT pv.ano, pv.mes, SUM(pv.valor_previsto)
    FROM public.vw_lavoro_previsto_caixa pv
    WHERE pv.ano = ANY(p_anos)
      AND lower(btrim(coalesce(pv.status_parcela_comissao,''))) = 'paga'
      AND public.lavoro_canal_visivel(pv.tipo_de_ramo)
    GROUP BY pv.ano, pv.mes
    ORDER BY pv.ano, pv.mes;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_kpis(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_serie_mensal(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_variacoes(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_caixa_comparativo_anual(integer[]) TO authenticated;
