DROP FUNCTION IF EXISTS public.rpc_lavoro_repasse_idade(int, int, text);

CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_idade(
  p_ano int DEFAULT NULL,
  p_mes int DEFAULT NULL,
  p_canal_repasse text DEFAULT NULL,
  p_situacao_repasse text DEFAULT NULL
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
      AND (p_situacao_repasse IS NULL
           OR lower(btrim(coalesce(g.status_repasse,''))) = lower(btrim(p_situacao_repasse)))  -- FIX
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

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_idade(int,int,text,text) TO authenticated;