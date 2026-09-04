CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_idade(
  p_ano int DEFAULT NULL,
  p_mes int DEFAULT NULL,
  p_canal_repasse text DEFAULT NULL
)
RETURNS TABLE(
  canal_repasse text, faixa text, ordem int,
  parcelas bigint, valor numeric, mes_mais_antigo date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT make_date(COALESCE(p_ano, EXTRACT(YEAR FROM current_date)::int),
                     COALESCE(p_mes, EXTRACT(MONTH FROM current_date)::int), 1) AS mes_ancora
  ),
  c AS (SELECT mes_ancora, (mes_ancora - 1) AS fim_mes_anterior FROM cfg),
  b AS (
    SELECT public.normalize_canal_repasse(g.possui_repasse) AS canal_key,
           btrim(coalesce(g.possui_repasse,''))             AS canal_raw,
           g.data_pagamento,
           coalesce(g.valor_repasse_total,0)                AS v,
           ((date_part('year',  c.mes_ancora) - date_part('year',  g.data_pagamento)) * 12
          + (date_part('month', c.mes_ancora) - date_part('month', g.data_pagamento)))::int AS meses
    FROM public.vw_lavoro_gerencial g CROSS JOIN c
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'paga'
      AND public.normalize_canal_repasse(g.possui_repasse) NOT IN ('LAVORO','')
      AND lower(btrim(coalesce(g.status_repasse,''))) IN ('a vencer','apurado')
      AND g.data_pagamento <= c.fim_mes_anterior
      AND (p_canal_repasse IS NULL
           OR public.normalize_canal_repasse(g.possui_repasse)
              = public.normalize_canal_repasse(p_canal_repasse))
  )
  SELECT mode() WITHIN GROUP (ORDER BY b.canal_raw)::text,
         (CASE WHEN b.meses <= 1 THEN 'Até 1 mês'
               WHEN b.meses <= 3 THEN '2 a 3 meses'
               WHEN b.meses <= 6 THEN '4 a 6 meses'
               ELSE 'Mais de 6 meses' END)::text,
         (CASE WHEN b.meses <= 1 THEN 1 WHEN b.meses <= 3 THEN 2
               WHEN b.meses <= 6 THEN 3 ELSE 4 END)::int,
         count(*),
         round(sum(b.v)::numeric,2),
         min(date_trunc('month', b.data_pagamento))::date
  FROM b
  GROUP BY b.canal_key,
           (CASE WHEN b.meses <= 1 THEN 'Até 1 mês'
                 WHEN b.meses <= 3 THEN '2 a 3 meses'
                 WHEN b.meses <= 6 THEN '4 a 6 meses'
                 ELSE 'Mais de 6 meses' END),
           (CASE WHEN b.meses <= 1 THEN 1 WHEN b.meses <= 3 THEN 2
                 WHEN b.meses <= 6 THEN 3 ELSE 4 END)
  ORDER BY 3, 5 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_idade(int, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_detalhe(
  p_ano int DEFAULT NULL,
  p_mes int DEFAULT NULL,
  p_modo text DEFAULT 'PROVISIONADO',
  p_canal_repasse text DEFAULT NULL,
  p_situacao_repasse text DEFAULT NULL,
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  grupo text, tomador text, segurado text, documento text, ramo text, seguradora text,
  numero_apolice text, data_emissao date, inicio_vigencia date, fim_vigencia date,
  periodo_atualizacao text, valor_is numeric, premio_total numeric, percentual_comissao numeric,
  comissao_emitida numeric, qtd_parcelas integer, premio_parcela numeric, comissao_bruta numeric,
  imposto_ret numeric, valor_iss numeric, valor_recebido_a_receber numeric,
  numero_da_parcela integer, tipo_pagamento text, empresa_faturada text, data_pagamento date,
  mes integer, ano integer, fat_competencia text, status_parcela_comissao text, analise text,
  possui_repasse text, percentual_repasse numeric, parcelas text, percentual_imposto numeric,
  valor_repasse_total numeric, data_repasse date, status_repasse text, observacao text,
  base_liquida numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT make_date(COALESCE(p_ano, EXTRACT(YEAR FROM current_date)::int),
                     COALESCE(p_mes, EXTRACT(MONTH FROM current_date)::int), 1) AS mes_ancora
  ),
  c AS (
    SELECT mes_ancora,
           (mes_ancora - 1)                        AS fim_mes_anterior,
           (mes_ancora + interval '1 month')::date AS mes_seguinte
    FROM cfg
  ),
  d AS (
    SELECT g.*, regexp_replace(coalesce(g.documento,''),'\D','','g') AS dig
    FROM public.raw_lavoro_gerencial g
    JOIN public.vw_lavoro_gerencial v ON v.id = g.id
    CROSS JOIN c
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'paga'
      AND public.normalize_canal_repasse(g.possui_repasse) NOT IN ('LAVORO','')
      AND (
        (p_modo = 'PROVISIONADO'
           AND lower(btrim(coalesce(g.status_repasse,''))) IN ('a vencer','apurado')
           AND g.data_pagamento <= c.fim_mes_anterior)
        OR
        (p_modo = 'HISTORICO'
           AND lower(btrim(coalesce(g.status_repasse,''))) = 'paga'
           AND g.data_repasse IS NOT NULL
           AND g.data_repasse >= g.data_pagamento
           AND date_trunc('month', g.data_repasse)::date = c.mes_ancora)
      )
      AND (p_canal_repasse IS NULL
           OR public.normalize_canal_repasse(g.possui_repasse)
              = public.normalize_canal_repasse(p_canal_repasse))
      AND (p_situacao_repasse IS NULL
           OR lower(btrim(coalesce(g.status_repasse,''))) = lower(btrim(p_situacao_repasse)))
  )
  SELECT d.grupo, d.tomador, d.segurado,
         (CASE
            WHEN public.has_role(auth.uid(),'ADMIN'::app_role) THEN d.documento
            WHEN length(d.dig) = 11 THEN '***.'||substr(d.dig,4,3)||'.'||substr(d.dig,7,3)||'-**'
            WHEN length(d.dig) = 14 THEN substr(d.dig,1,2)||'.***.***/****-**'
            ELSE NULL
          END)::text,
         d.ramo, d.seguradora, d.numero_apolice, d.data_emissao, d.inicio_vigencia,
         d.fim_vigencia, d.periodo_atualizacao, d.valor_is, d.premio_total,
         d.percentual_comissao, d.comissao_emitida, d.qtd_parcelas, d.premio_parcela,
         d.comissao_bruta, d.imposto_ret, d.valor_iss, d.valor_recebido_a_receber,
         d.numero_da_parcela, d.tipo_pagamento, d.empresa_faturada, d.data_pagamento,
         d.mes, d.ano, d.fat_competencia, d.status_parcela_comissao, d.analise,
         d.possui_repasse, d.percentual_repasse, d.parcelas, d.percentual_imposto,
         d.valor_repasse_total, d.data_repasse, d.status_repasse, d.observacao,
         round((d.valor_recebido_a_receber * (1 - coalesce(d.percentual_imposto,0)))::numeric, 2)
  FROM d
  ORDER BY d.valor_repasse_total DESC NULLS LAST, d.id
  LIMIT GREATEST(COALESCE(p_limit,500),1)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_detalhe(int, int, text, text, text, int, int) TO authenticated;