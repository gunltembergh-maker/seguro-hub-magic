CREATE OR REPLACE FUNCTION public.rpc_lavoro_comissao_vencida_export_resumo(
  p_data_ini date DEFAULT DATE '2026-01-01'
)
RETURNS TABLE(
  tipo_de_ramo text,
  seguradora text,
  faixa_aging text,
  qtd_itens bigint,
  comissao_bruta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    g.tipo_de_ramo,
    g.seguradora,
    CASE
      WHEN (CURRENT_DATE - g.data_pagamento) <= 30 THEN '1-30'
      WHEN (CURRENT_DATE - g.data_pagamento) <= 60 THEN '31-60'
      WHEN (CURRENT_DATE - g.data_pagamento) <= 90 THEN '61-90'
      WHEN (CURRENT_DATE - g.data_pagamento) <= 180 THEN '91-180'
      ELSE '180+'
    END AS faixa_aging,
    COUNT(*) AS qtd_itens,
    SUM(g.comissao_bruta) AS comissao_bruta
  FROM public.vw_lavoro_gerencial g
  WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'vencida'
    AND g.data_pagamento >= p_data_ini
  GROUP BY g.tipo_de_ramo, g.seguradora,
    CASE
      WHEN (CURRENT_DATE - g.data_pagamento) <= 30 THEN '1-30'
      WHEN (CURRENT_DATE - g.data_pagamento) <= 60 THEN '31-60'
      WHEN (CURRENT_DATE - g.data_pagamento) <= 90 THEN '61-90'
      WHEN (CURRENT_DATE - g.data_pagamento) <= 180 THEN '91-180'
      ELSE '180+'
    END
  ORDER BY g.tipo_de_ramo, comissao_bruta DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_comissao_vencida_export_resumo(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_comissao_vencida_export_detalhe(
  p_data_ini date DEFAULT DATE '2026-01-01',
  p_tipo_de_ramo text DEFAULT NULL,
  p_seguradora text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  tomador text,
  segurado text,
  documento text,
  tipo_de_ramo text,
  ramo text,
  seguradora text,
  numero_apolice text,
  data_emissao date,
  data_pagamento date,
  dias_atraso integer,
  faixa_aging text,
  numero_da_parcela integer,
  comissao_bruta numeric,
  status_parcela_comissao text,
  responsavel text,
  observacao text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH d AS (
    SELECT g.*, regexp_replace(coalesce(g.documento,''), '\D', '', 'g') AS dig
    FROM public.vw_lavoro_gerencial g
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'vencida'
      AND g.data_pagamento >= p_data_ini
      AND (p_tipo_de_ramo IS NULL OR g.tipo_de_ramo = p_tipo_de_ramo)
      AND (p_seguradora IS NULL OR g.seguradora = p_seguradora)
  )
  SELECT
    d.tomador, d.segurado,
    (CASE
       WHEN public.has_role(auth.uid(), 'ADMIN'::app_role) THEN d.documento
       WHEN length(d.dig) = 11 THEN '***.'||substr(d.dig,4,3)||'.'||substr(d.dig,7,3)||'-**'
       WHEN length(d.dig) = 14 THEN substr(d.dig,1,2)||'.***.***/****-**'
       ELSE d.documento
     END)::text AS documento,
    d.tipo_de_ramo, d.ramo, d.seguradora, d.numero_apolice,
    d.data_emissao, d.data_pagamento,
    (CURRENT_DATE - d.data_pagamento)::integer AS dias_atraso,
    CASE
      WHEN (CURRENT_DATE - d.data_pagamento) <= 30 THEN '1-30'
      WHEN (CURRENT_DATE - d.data_pagamento) <= 60 THEN '31-60'
      WHEN (CURRENT_DATE - d.data_pagamento) <= 90 THEN '61-90'
      WHEN (CURRENT_DATE - d.data_pagamento) <= 180 THEN '91-180'
      ELSE '180+'
    END AS faixa_aging,
    d.numero_da_parcela, d.comissao_bruta, d.status_parcela_comissao,
    d.responsavel, d.observacao
  FROM d
  ORDER BY (CURRENT_DATE - d.data_pagamento) DESC, d.comissao_bruta DESC
  LIMIT GREATEST(COALESCE(p_limit,500),1)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_comissao_vencida_export_detalhe(date, text, text, integer, integer) TO authenticated;