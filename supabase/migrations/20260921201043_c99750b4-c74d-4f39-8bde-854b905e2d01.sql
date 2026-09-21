-- 1) Receita por canal
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_canal(p_ano integer, p_mes integer, p_periodo text DEFAULT 'YTD'::text)
 RETURNS TABLE(tipo_de_ramo text, receita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END AS mes_ini)
  SELECT c.tipo_de_ramo, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c, cfg
  WHERE c.ano = p_ano AND (
    (p_periodo = 'YTD' AND c.mes <= p_mes) OR
    (p_periodo = 'MTD' AND c.mes = p_mes) OR
    (p_periodo = 'SEMESTRE' AND c.mes BETWEEN cfg.mes_ini AND p_mes))
    AND public.lavoro_canal_visivel(c.tipo_de_ramo)
  GROUP BY c.tipo_de_ramo ORDER BY 2 DESC;
$function$;

-- 2) Receita por ramo
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_ramo(p_ano integer, p_mes integer, p_periodo text DEFAULT 'YTD'::text)
 RETURNS TABLE(ramo text, receita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END AS mes_ini)
  SELECT c.ramo, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c, cfg
  WHERE c.ano = p_ano AND (
    (p_periodo = 'YTD' AND c.mes <= p_mes) OR
    (p_periodo = 'MTD' AND c.mes = p_mes) OR
    (p_periodo = 'SEMESTRE' AND c.mes BETWEEN cfg.mes_ini AND p_mes))
    AND public.lavoro_canal_visivel(c.tipo_de_ramo)
  GROUP BY c.ramo ORDER BY 2 DESC;
$function$;

-- 3) Comparativo anual de receita (competência)
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_comparativo_anual(p_anos integer[])
 RETURNS TABLE(ano integer, mes integer, receita_competencia numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.ano, c.mes, SUM(c.comissao_bruta)
  FROM public.vw_lavoro_receita_competencia c
  WHERE c.ano = ANY(p_anos) AND public.lavoro_canal_visivel(c.tipo_de_ramo)
  GROUP BY c.ano, c.mes ORDER BY c.ano, c.mes;
$function$;

-- 4) Comissão vencida por canal
CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(p_ano integer, p_mes integer DEFAULT NULL::integer, p_periodo text DEFAULT NULL::text)
 RETURNS TABLE(tipo_de_ramo text, comissao_vencida numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.tipo_de_ramo, SUM(g.valor_recebido_a_receber)
    FROM public.vw_lavoro_gerencial g
   WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'vencida'
     AND (p_ano IS NULL OR EXTRACT(YEAR FROM COALESCE(g.data_pagamento, g.data_emissao))::int = p_ano)
     AND public.lavoro_canal_visivel(g.tipo_de_ramo)
   GROUP BY g.tipo_de_ramo
   ORDER BY 2 DESC;
$function$;

-- 5) Export Comissão Vencida - resumo
CREATE OR REPLACE FUNCTION public.rpc_lavoro_comissao_vencida_export_resumo(
  p_data_ini date DEFAULT DATE '2026-01-01'
)
RETURNS TABLE(
  tipo_de_ramo text, seguradora text, faixa_aging text,
  qtd_itens bigint, comissao_bruta numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT g.tipo_de_ramo, g.seguradora,
    CASE WHEN (CURRENT_DATE - g.data_pagamento) <= 30 THEN '1-30'
         WHEN (CURRENT_DATE - g.data_pagamento) <= 60 THEN '31-60'
         WHEN (CURRENT_DATE - g.data_pagamento) <= 90 THEN '61-90'
         WHEN (CURRENT_DATE - g.data_pagamento) <= 180 THEN '91-180'
         ELSE '180+' END AS faixa_aging,
    COUNT(*) AS qtd_itens, SUM(g.comissao_bruta) AS comissao_bruta
  FROM public.vw_lavoro_gerencial g
  WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'vencida'
    AND g.data_pagamento >= p_data_ini
    AND public.lavoro_canal_visivel(g.tipo_de_ramo)
  GROUP BY g.tipo_de_ramo, g.seguradora,
    CASE WHEN (CURRENT_DATE - g.data_pagamento) <= 30 THEN '1-30'
         WHEN (CURRENT_DATE - g.data_pagamento) <= 60 THEN '31-60'
         WHEN (CURRENT_DATE - g.data_pagamento) <= 90 THEN '61-90'
         WHEN (CURRENT_DATE - g.data_pagamento) <= 180 THEN '91-180'
         ELSE '180+' END
  ORDER BY g.tipo_de_ramo, comissao_bruta DESC;
$function$;

-- 6) Export Comissão Vencida - detalhe
CREATE OR REPLACE FUNCTION public.rpc_lavoro_comissao_vencida_export_detalhe(
  p_data_ini date DEFAULT DATE '2026-01-01',
  p_tipo_de_ramo text DEFAULT NULL,
  p_seguradora text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  tomador text, segurado text, documento text, tipo_de_ramo text, ramo text,
  seguradora text, numero_apolice text, data_emissao date, data_pagamento date,
  dias_atraso integer, faixa_aging text, numero_da_parcela integer,
  comissao_bruta numeric, status_parcela_comissao text, responsavel text, observacao text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH d AS (
    SELECT g.*, regexp_replace(coalesce(g.documento,''), '\D', '', 'g') AS dig
    FROM public.vw_lavoro_gerencial g
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'vencida'
      AND g.data_pagamento >= p_data_ini
      AND (p_tipo_de_ramo IS NULL OR g.tipo_de_ramo = p_tipo_de_ramo)
      AND (p_seguradora IS NULL OR g.seguradora = p_seguradora)
      AND public.lavoro_canal_visivel(g.tipo_de_ramo)
  )
  SELECT d.tomador, d.segurado,
    (CASE WHEN public.has_role(auth.uid(), 'ADMIN'::app_role) THEN d.documento
          WHEN length(d.dig) = 11 THEN '***.'||substr(d.dig,4,3)||'.'||substr(d.dig,7,3)||'-**'
          WHEN length(d.dig) = 14 THEN substr(d.dig,1,2)||'.***.***/****-**'
          ELSE d.documento END)::text AS documento,
    d.tipo_de_ramo, d.ramo, d.seguradora, d.numero_apolice,
    d.data_emissao, d.data_pagamento,
    (CURRENT_DATE - d.data_pagamento)::integer AS dias_atraso,
    CASE WHEN (CURRENT_DATE - d.data_pagamento) <= 30 THEN '1-30'
         WHEN (CURRENT_DATE - d.data_pagamento) <= 60 THEN '31-60'
         WHEN (CURRENT_DATE - d.data_pagamento) <= 90 THEN '61-90'
         WHEN (CURRENT_DATE - d.data_pagamento) <= 180 THEN '91-180'
         ELSE '180+' END AS faixa_aging,
    d.numero_da_parcela, d.comissao_bruta, d.status_parcela_comissao,
    d.responsavel, d.observacao
  FROM d
  ORDER BY (CURRENT_DATE - d.data_pagamento) DESC, d.comissao_bruta DESC
  LIMIT GREATEST(COALESCE(p_limit,500),1) OFFSET GREATEST(COALESCE(p_offset,0),0);
$function$;

-- 7) KPIs de receita (mantém receita_caixa/atingimento_caixa sem filtro por enquanto)
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
    COALESCE(caixa_mix.garantia, 0),
    COALESCE(caixa_mix.beneficios, 0),
    COALESCE(caixa_mix.demais, 0),
    COALESCE(comp.garantia, 0),
    COALESCE(comp.beneficios, 0),
    COALESCE(comp.total, 0) - COALESCE(comp.garantia, 0) - COALESCE(comp.beneficios, 0)
  FROM comp, caixa, previsto, caixa_mix;
END;
$function$;

-- 8) Série mensal (mantém receita_caixa sem filtro por enquanto)
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_serie_mensal(p_ano integer)
 RETURNS TABLE(mes integer, receita_competencia numeric, receita_caixa numeric, meta_mensal numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.mes::int,
    COALESCE((SELECT SUM(comissao_bruta) FROM public.vw_lavoro_receita_competencia
              WHERE ano = p_ano AND mes = m.mes AND public.lavoro_canal_visivel(tipo_de_ramo)), 0),
    COALESCE((SELECT SUM(valor) FROM public.vw_lavoro_receita_caixa
              WHERE ano = p_ano AND mes = m.mes), 0),
    public.rpc_lavoro_get_meta_anual(p_ano) / 12
  FROM generate_series(1,12) AS m(mes)
  ORDER BY m.mes;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_por_canal(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_por_ramo(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_comparativo_anual(integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_comissao_vencida_por_canal(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_comissao_vencida_export_resumo(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_comissao_vencida_export_detalhe(date, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_kpis(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_serie_mensal(integer) TO authenticated;