CREATE OR REPLACE FUNCTION public.rpc_lavoro_beneficios_tipo_pagamento(p_ano integer, p_mes integer)
RETURNS TABLE(tipo_pagamento text, previsto numeric, recebido numeric, competencia numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(btrim(g.tipo_pagamento), ''), 'Não informado') AS tp,
      g.comissao_bruta,
      g.status_parcela_comissao,
      COALESCE(EXTRACT(YEAR  FROM g.data_pagamento)::int, g.ano) AS ano_pgto,
      COALESCE(EXTRACT(MONTH FROM g.data_pagamento)::int, g.mes) AS mes_pgto,
      g.ano AS ano_comp,
      g.mes AS mes_comp
    FROM public.vw_lavoro_gerencial g
    WHERE public.lavoro_canal(g.tipo_de_ramo) = 'Benefícios'
      AND g.comissao_bruta IS NOT NULL
  )
  SELECT
    tp,
    COALESCE(SUM(comissao_bruta) FILTER (WHERE ano_pgto = p_ano AND mes_pgto = p_mes), 0),
    COALESCE(SUM(comissao_bruta) FILTER (WHERE ano_pgto = p_ano AND mes_pgto = p_mes
      AND lower(btrim(COALESCE(status_parcela_comissao,''))) = 'paga'), 0),
    COALESCE(SUM(comissao_bruta) FILTER (WHERE ano_comp = p_ano AND mes_comp = p_mes), 0)
  FROM base
  GROUP BY tp
  HAVING COALESCE(SUM(comissao_bruta) FILTER (WHERE ano_pgto = p_ano AND mes_pgto = p_mes), 0) <> 0
      OR COALESCE(SUM(comissao_bruta) FILTER (WHERE ano_comp = p_ano AND mes_comp = p_mes), 0) <> 0
  ORDER BY 2 DESC, 4 DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_beneficios_tipo_pagamento(integer, integer) TO authenticated, service_role;