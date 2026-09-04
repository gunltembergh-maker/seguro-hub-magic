-- PASSO 1: remove a sobrecarga indevida de 3 argumentos
DROP FUNCTION IF EXISTS public.rpc_lavoro_repasse_por_canal(int, int, text);

-- PASSO 2: recria a função original de 5 argumentos com o fix no modo HISTORICO
CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_por_canal(
  p_ano int DEFAULT NULL,
  p_mes int DEFAULT NULL,
  p_modo text DEFAULT 'PROVISIONADO',
  p_canal_repasse text DEFAULT NULL,
  p_situacao_repasse text DEFAULT NULL
)
RETURNS TABLE(
  ciclo_ano int, ciclo_mes int, canal_repasse text, situacao_repasse text,
  valor numeric, total_canal_no_ciclo numeric, situacao text
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
  base AS (
    SELECT
      public.normalize_canal_repasse(g.possui_repasse)     AS canal_key,
      btrim(coalesce(g.possui_repasse,''))                 AS canal_raw,
      initcap(lower(btrim(coalesce(g.status_repasse,'')))) AS situacao_repasse,
      CASE
        WHEN p_modo = 'HISTORICO' THEN date_trunc('month', g.data_repasse)::date
        WHEN g.data_pagamento <= c.fim_mes_anterior THEN c.mes_ancora
        ELSE c.mes_seguinte
      END                                                  AS mes_ciclo,
      coalesce(g.valor_repasse_total,0)                    AS v
    FROM public.vw_lavoro_gerencial g CROSS JOIN c
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'paga'
      AND public.normalize_canal_repasse(g.possui_repasse) NOT IN ('LAVORO','')
      AND (
        (p_modo = 'PROVISIONADO'
           AND lower(btrim(coalesce(g.status_repasse,''))) IN ('a vencer','apurado'))
        OR
        (p_modo = 'HISTORICO'
           AND lower(btrim(coalesce(g.status_repasse,''))) = 'paga'
           AND g.data_repasse IS NOT NULL
           AND g.data_repasse >= g.data_pagamento
           AND date_trunc('month', g.data_repasse)::date = c.mes_ancora)   -- FIX
      )
      AND (p_canal_repasse IS NULL
           OR public.normalize_canal_repasse(g.possui_repasse)
              = public.normalize_canal_repasse(p_canal_repasse))
      AND (p_situacao_repasse IS NULL
           OR lower(btrim(coalesce(g.status_repasse,''))) = lower(btrim(p_situacao_repasse)))
  ),
  por_celula AS (
    SELECT b.canal_key,
           mode() WITHIN GROUP (ORDER BY b.canal_raw) AS canal_repasse,
           b.mes_ciclo, b.situacao_repasse, sum(b.v) AS valor
    FROM base b
    GROUP BY b.canal_key, b.mes_ciclo, b.situacao_repasse
  ),
  tot AS (
    SELECT p.canal_key, p.mes_ciclo, sum(p.valor) AS total_ciclo
    FROM por_celula p GROUP BY 1,2
  )
  SELECT EXTRACT(YEAR  FROM p.mes_ciclo)::int,
         EXTRACT(MONTH FROM p.mes_ciclo)::int,
         p.canal_repasse,
         p.situacao_repasse,
         round(p.valor::numeric,2),
         round(t.total_ciclo::numeric,2),
         (CASE WHEN p_modo = 'HISTORICO' THEN 'PAGO'
               WHEN t.total_ciclo >= 100 THEN 'A_PAGAR'
               ELSE 'RETIDO_MINIMO' END)::text
  FROM por_celula p
  JOIN tot t ON t.canal_key = p.canal_key AND t.mes_ciclo = p.mes_ciclo
  ORDER BY 1, 2, 6 DESC, 4;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_por_canal(int,int,text,text,text) TO authenticated;