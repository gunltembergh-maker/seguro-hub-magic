CREATE OR REPLACE FUNCTION public.lavoro_status_gera_receita(p_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(btrim(coalesce(p_status,''))) NOT IN
    ('cancelado','estornado','fechou com outra corretora',
     'transferência de corretagem','transferencia de corretagem');
$$;

GRANT EXECUTE ON FUNCTION public.lavoro_status_gera_receita(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_previsao_dezena(p_ano integer DEFAULT NULL::integer, p_mes integer DEFAULT NULL::integer)
 RETURNS TABLE(ano integer, mes integer, dezena text, empresa_faturada text, valor_a_receber numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int := COALESCE(p_ano, EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_mes int := COALESCE(p_mes, EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_inicio date := make_date(v_ano, v_mes, 1);
  v_fim date := (v_inicio + interval '4 months' - interval '1 day')::date;
BEGIN
  RETURN QUERY
  SELECT g.ano, g.mes, g.dezena, g.empresa_faturada, SUM(g.valor_recebido_a_receber)
  FROM public.vw_lavoro_gerencial g
  WHERE g.data_pagamento BETWEEN v_inicio AND v_fim
    AND public.lavoro_status_gera_receita(g.status_parcela_comissao)
    AND public.lavoro_canal_visivel(g.tipo_de_ramo)
  GROUP BY g.ano, g.mes, g.dezena, g.empresa_faturada
  ORDER BY g.ano, g.mes, g.dezena;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_kpis(p_status text DEFAULT NULL::text, p_seguradora text DEFAULT NULL::text, p_tipo_ramo text DEFAULT NULL::text, p_tomador text DEFAULT NULL::text, p_apolice text DEFAULT NULL::text, p_grupo text DEFAULT NULL::text, p_ramo text DEFAULT NULL::text, p_possui_repasse text DEFAULT NULL::text, p_ano integer DEFAULT NULL::integer)
 RETURNS TABLE(premio_total numeric, comissao_emitida numeric, comissao_gerada numeric, repasse_parceiro numeric, comissao_menos_repasse numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT SUM(g.premio_parcela), SUM(g.comissao_emitida), SUM(g.comissao_bruta),
    SUM(g.valor_repasse_total),
    COALESCE(SUM(g.valor_recebido_a_receber),0) - COALESCE(SUM(g.valor_repasse_total),0)
  FROM public.vw_lavoro_gerencial g
  WHERE (p_status IS NULL OR g.status_parcela_comissao = p_status)
    AND (p_status IS NOT NULL OR public.lavoro_status_gera_receita(g.status_parcela_comissao))
    AND (p_seguradora IS NULL OR g.seguradora = p_seguradora)
    AND (p_tipo_ramo IS NULL OR g.tipo_de_ramo = p_tipo_ramo)
    AND (p_tomador IS NULL OR g.tomador = p_tomador)
    AND (p_apolice IS NULL OR g.numero_apolice = p_apolice)
    AND (p_grupo IS NULL OR g.grupo = p_grupo)
    AND (p_ramo IS NULL OR g.ramo = p_ramo)
    AND (p_possui_repasse IS NULL OR g.possui_repasse = p_possui_repasse)
    AND (p_ano IS NULL OR g.ano = p_ano)
    AND public.lavoro_canal_visivel(g.tipo_de_ramo);
$function$;

CREATE OR REPLACE FUNCTION public.rpc_inicio_lavoro_resumo()
 RETURNS TABLE(receita_competencia_mes numeric, receita_caixa_mes numeric, receita_caixa_recebida_mes numeric, atingimento_caixa_mes numeric, total_vencido_mes numeric, ultima_atualizacao timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int := extract(year from now() at time zone 'America/Sao_Paulo')::int;
  v_mes int := extract(month from now() at time zone 'America/Sao_Paulo')::int;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      g.ano,
      g.mes,
      COALESCE(g.comissao_emitida, 0)::numeric AS emitido,
      COALESCE(g.valor_recebido_a_receber, 0)::numeric AS caixa_previsto,
      CASE
        WHEN g.status_parcela_comissao ILIKE '%pago%'
          OR g.status_parcela_comissao ILIKE '%receb%'
          OR g.data_pagamento IS NOT NULL
        THEN COALESCE(g.valor_recebido_a_receber, 0)::numeric
        ELSE 0::numeric
      END AS caixa_recebido,
      CASE
        WHEN g.data_pagamento IS NULL
          AND g.data_repasse IS NOT NULL
          AND g.data_repasse::date < (now() at time zone 'America/Sao_Paulo')::date
        THEN COALESCE(g.valor_recebido_a_receber, 0)::numeric
        ELSE 0::numeric
      END AS vencido
    FROM public.raw_lavoro_gerencial g
    WHERE g.ano = v_ano AND g.mes = v_mes
      AND public.lavoro_status_gera_receita(g.status_parcela_comissao)
  ),
  agg AS (
    SELECT
      SUM(emitido)         AS receita_competencia_mes,
      SUM(caixa_previsto)  AS receita_caixa_mes,
      SUM(caixa_recebido)  AS receita_caixa_recebida_mes,
      SUM(vencido)         AS total_vencido_mes
    FROM base
  ),
  ts AS (
    SELECT MAX(criado_em) AS ultima_atualizacao FROM public.raw_lavoro_gerencial
  )
  SELECT
    COALESCE(a.receita_competencia_mes, 0),
    COALESCE(a.receita_caixa_mes, 0),
    COALESCE(a.receita_caixa_recebida_mes, 0),
    CASE WHEN COALESCE(a.receita_caixa_mes, 0) > 0
         THEN COALESCE(a.receita_caixa_recebida_mes, 0) / a.receita_caixa_mes
         ELSE 0
    END,
    COALESCE(a.total_vencido_mes, 0),
    ts.ultima_atualizacao
  FROM agg a CROSS JOIN ts;
END;
$function$;