CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(p_ano integer, p_mes integer DEFAULT NULL, p_periodo text DEFAULT NULL)
 RETURNS TABLE(tipo_de_ramo text, comissao_vencida numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT g.tipo_de_ramo, SUM(g.valor_recebido_a_receber)
    FROM public.vw_lavoro_gerencial g
   WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'vencida'
     AND (p_ano IS NULL OR EXTRACT(YEAR FROM COALESCE(g.data_pagamento, g.data_emissao))::int = p_ano)
   GROUP BY g.tipo_de_ramo
   ORDER BY 2 DESC;
$function$;