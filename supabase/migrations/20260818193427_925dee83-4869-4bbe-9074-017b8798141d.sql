DROP FUNCTION IF EXISTS public.rpc_receita_executivo_canais(integer, integer, uuid);
DROP FUNCTION IF EXISTS public.rpc_receita_executivo_canais(integer, integer);

CREATE FUNCTION public.rpc_receita_executivo_canais(p_ano integer, p_mes integer DEFAULT 12)
RETURNS TABLE(canal text, caixa numeric, caixa_corrente numeric, a_receber_futuro numeric,
              emitido numeric, caixa_esperado numeric, saldo_vencido numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      public.lavoro_canal(g.tipo_de_ramo) AS canal,
      g.valor_recebido_a_receber AS valor,
      g.data_emissao,
      g.data_pagamento,
      lower(btrim(g.status_parcela_comissao)) AS status
    FROM public.vw_lavoro_gerencial g
  ),
  fim AS (
    SELECT (make_date(p_ano, GREATEST(LEAST(p_mes,12),1), 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS d
  )
  SELECT
    c.canal,
    COALESCE(SUM(CASE WHEN b.status IN ('paga','a vencer','vencida')
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) <= p_mes
                      THEN b.valor END), 0) AS caixa,
    COALESCE(SUM(CASE WHEN b.status = 'paga'
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) <= p_mes
                      THEN b.valor END), 0) AS caixa_corrente,
    COALESCE(SUM(CASE WHEN b.status IN ('a vencer','vencida')
                       AND b.data_emissao <= (SELECT d FROM fim)
                       AND b.data_pagamento > (SELECT d FROM fim)
                      THEN b.valor END), 0) AS a_receber_futuro,
    COALESCE(SUM(CASE WHEN b.status IN ('paga','a vencer','vencida')
                       AND b.data_emissao IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_emissao) = p_ano
                       AND EXTRACT(MONTH FROM b.data_emissao) <= p_mes
                      THEN b.valor END), 0) AS emitido,
    COALESCE(SUM(CASE WHEN b.status IN ('paga','a vencer','vencida')
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) <= p_mes
                      THEN b.valor END), 0) AS caixa_esperado,
    COALESCE(SUM(CASE WHEN b.status = 'vencida'
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) <= p_mes
                      THEN b.valor END), 0) AS saldo_vencido
  FROM (SELECT unnest(ARRAY['Garantia','Benefícios','Demais Ramos']) AS canal) c
  LEFT JOIN base b ON b.canal = c.canal
  GROUP BY c.canal
  ORDER BY c.canal;
$function$;

CREATE FUNCTION public.rpc_receita_executivo_canais(p_ano integer, p_mes integer, p_user_id uuid)
RETURNS TABLE(canal text, caixa numeric, caixa_corrente numeric, a_receber_futuro numeric,
              emitido numeric, caixa_esperado numeric, saldo_vencido numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_receita_executivo_canais(p_ano, p_mes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_executivo_canais_mes(p_ano integer, p_mes integer)
RETURNS TABLE(canal text, emitido numeric, caixa_esperado numeric, caixa_recebido numeric, saldo_vencido numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      public.lavoro_canal(g.tipo_de_ramo) AS canal,
      g.valor_recebido_a_receber AS valor,
      g.data_emissao,
      g.data_pagamento,
      lower(btrim(g.status_parcela_comissao)) AS status
    FROM public.vw_lavoro_gerencial g
  )
  SELECT
    c.canal,
    COALESCE(SUM(CASE WHEN b.status IN ('paga','a vencer','vencida')
                       AND b.data_emissao IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_emissao) = p_ano
                       AND EXTRACT(MONTH FROM b.data_emissao) = p_mes
                      THEN b.valor END), 0) AS emitido,
    COALESCE(SUM(CASE WHEN b.status IN ('paga','a vencer','vencida')
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) = p_mes
                      THEN b.valor END), 0) AS caixa_esperado,
    COALESCE(SUM(CASE WHEN b.status = 'paga'
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) = p_mes
                      THEN b.valor END), 0) AS caixa_recebido,
    COALESCE(SUM(CASE WHEN b.status = 'vencida'
                       AND b.data_pagamento IS NOT NULL
                       AND EXTRACT(YEAR FROM b.data_pagamento) = p_ano
                       AND EXTRACT(MONTH FROM b.data_pagamento) = p_mes
                      THEN b.valor END), 0) AS saldo_vencido
  FROM (SELECT unnest(ARRAY['Garantia','Benefícios','Demais Ramos']) AS canal) c
  LEFT JOIN base b ON b.canal = c.canal
  GROUP BY c.canal
  ORDER BY c.canal;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_receita_executivo_canais_mes(p_ano integer, p_mes integer, p_user_id uuid)
RETURNS TABLE(canal text, emitido numeric, caixa_esperado numeric, caixa_recebido numeric, saldo_vencido numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_receita_executivo_canais_mes(p_ano, p_mes);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_canais(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_canais(integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_canais_mes(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_canais_mes(integer, integer, uuid) TO authenticated, service_role;