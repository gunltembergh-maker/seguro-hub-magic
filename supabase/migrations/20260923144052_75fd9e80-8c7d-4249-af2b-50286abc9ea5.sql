CREATE OR REPLACE FUNCTION public.rpc_lavoro_recebimento_dezenas_empresas(p_ano integer, p_mes integer)
 RETURNS TABLE(ano integer, mes integer, dezena text, empresa text, valor numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH janela AS (
    SELECT
      (EXTRACT(YEAR  FROM d)::int) AS ano,
      (EXTRACT(MONTH FROM d)::int) AS mes,
      d::date AS inicio_mes,
      (d + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim_mes
    FROM generate_series(
      make_date(p_ano, p_mes, 1),
      make_date(p_ano, p_mes, 1) + INTERVAL '3 months',
      INTERVAL '1 month'
    ) AS d
  ),
  empresas(chave, nome, padrao) AS (
    VALUES
      ('l_farias', 'L Farias', '%farias%'),
      ('taicons',  'Taicons',  '%taicon%'),
      ('zin',      'ZIN',      '%zin%')
  ),
  base AS (
    SELECT
      (EXTRACT(YEAR  FROM g.data_pagamento)::int) AS ano,
      (EXTRACT(MONTH FROM g.data_pagamento)::int) AS mes,
      g.dezena,
      e.nome AS empresa,
      COALESCE(SUM(g.valor_recebido_a_receber), 0) AS valor
    FROM public.vw_lavoro_gerencial g
    JOIN empresas e
      ON g.empresa_faturada ILIKE e.padrao
    JOIN janela j
      ON g.data_pagamento BETWEEN j.inicio_mes AND j.fim_mes
    WHERE g.dezena IS NOT NULL
      AND lower(btrim(coalesce(g.status_parcela_comissao,''))) NOT IN
          ('cancelado','estornado','fechou com outra corretora','transferência de corretagem','transferencia de corretagem')
    GROUP BY 1, 2, g.dezena, e.nome
  ),
  dezenas(dezena) AS (VALUES ('1-10'), ('11-20'), ('21-31'))
  SELECT
    j.ano,
    j.mes,
    d.dezena,
    e.nome AS empresa,
    COALESCE(b.valor, 0) AS valor
  FROM janela j
  CROSS JOIN dezenas d
  CROSS JOIN empresas e
  LEFT JOIN base b
    ON b.ano = j.ano AND b.mes = j.mes AND b.dezena = d.dezena AND b.empresa = e.nome
  ORDER BY j.ano, j.mes, d.dezena, e.nome;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_dezenas_detalhe(p_data_ini date, p_data_fim date, p_dezena text DEFAULT NULL::text, p_empresa text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS TABLE(data_pagamento date, empresa_faturada text, dezena text, valor_recebido_a_receber numeric, tomador text, segurado text, documento text, seguradora text, ramo text, tipo_de_ramo text, numero_apolice text, data_emissao date, inicio_vigencia date, fim_vigencia date, numero_da_parcela integer, qtd_parcelas integer, status_parcela_comissao text, premio_total numeric, premio_parcela numeric, percentual_comissao numeric, comissao_bruta numeric, imposto_ret numeric, valor_iss numeric, possui_repasse text, percentual_repasse numeric, valor_repasse_total numeric, status_repasse text, observacao text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH empresas(nome, padrao) AS (
    VALUES ('L Farias','%farias%'), ('Taicons','%taicon%'), ('ZIN','%zin%')
  ),
  d AS (
    SELECT g.*, v.dezena AS dz, v.tipo_de_ramo AS tpr, e.nome AS emp,
           regexp_replace(coalesce(g.documento,''),'\D','','g') AS dig
    FROM public.raw_lavoro_gerencial g
    JOIN public.vw_lavoro_gerencial v ON v.id = g.id
    JOIN empresas e ON g.empresa_faturada ILIKE e.padrao
    WHERE v.dezena IS NOT NULL
      AND g.data_pagamento BETWEEN p_data_ini AND p_data_fim
      AND (p_dezena  IS NULL OR v.dezena = p_dezena)
      AND (p_empresa IS NULL OR e.nome   = p_empresa)
      AND lower(btrim(coalesce(g.status_parcela_comissao,''))) NOT IN
          ('cancelado','estornado','fechou com outra corretora','transferência de corretagem','transferencia de corretagem')
  )
  SELECT d.data_pagamento, d.emp::text, d.dz::text,
         d.valor_recebido_a_receber,
         d.tomador, d.segurado,
         (CASE
            WHEN public.has_role(auth.uid(),'ADMIN'::app_role) THEN d.documento
            WHEN length(d.dig) = 11 THEN '***.'||substr(d.dig,4,3)||'.'||substr(d.dig,7,3)||'-**'
            WHEN length(d.dig) = 14 THEN substr(d.dig,1,2)||'.***.***/****-**'
            ELSE NULL
          END)::text,
         d.seguradora, d.ramo, d.tpr::text, d.numero_apolice,
         d.data_emissao, d.inicio_vigencia, d.fim_vigencia,
         d.numero_da_parcela, d.qtd_parcelas, d.status_parcela_comissao,
         d.premio_total, d.premio_parcela, d.percentual_comissao,
         d.comissao_bruta, d.imposto_ret, d.valor_iss,
         d.possui_repasse, d.percentual_repasse, d.valor_repasse_total,
         d.status_repasse, d.observacao
  FROM d
  ORDER BY d.data_pagamento, d.valor_recebido_a_receber DESC NULLS LAST, d.id
  LIMIT GREATEST(COALESCE(p_limit,500),1)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
$function$;