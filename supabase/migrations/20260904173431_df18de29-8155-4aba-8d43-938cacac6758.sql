-- 1) CORRIGIR rpc_lavoro_repasse_por_canal: modo HISTORICO respeita p_ano/p_mes
CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_por_canal(
  p_ano int DEFAULT NULL,
  p_mes int DEFAULT NULL,
  p_modo text DEFAULT 'PROVISIONADO'
)
RETURNS TABLE(ciclo_ano int, ciclo_mes int, situacao text, canal_repasse text, linhas bigint, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT make_date(COALESCE(p_ano, EXTRACT(YEAR FROM current_date)::int),
                    COALESCE(p_mes, EXTRACT(MONTH FROM current_date)::int), 1) AS mes_ancora
  ),
  base AS (
    SELECT
      public.normalize_canal_repasse(g.possui_repasse) AS canal_key,
      btrim(coalesce(g.possui_repasse,''))             AS canal_raw,
      EXTRACT(YEAR FROM g.data_pagamento)::int         AS ciclo_ano,
      EXTRACT(MONTH FROM g.data_pagamento)::int        AS ciclo_mes,
      coalesce(g.valor_repasse_total,0)                AS v,
      cfg.mes_ancora
    FROM public.vw_lavoro_gerencial g CROSS JOIN cfg
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'paga'
      AND public.normalize_canal_repasse(g.possui_repasse) NOT IN ('LAVORO','')
      AND coalesce(g.valor_repasse_total,0) <> 0
      AND (
        (p_modo = 'PROVISIONADO'
         AND lower(btrim(coalesce(g.status_repasse,''))) NOT IN ('paga','retido momentaneamente','suspenso')
         AND g.data_pagamento IS NOT NULL
         AND g.data_pagamento <= (cfg.mes_ancora - interval '1 day')::date
        )
        OR
        (p_modo = 'HISTORICO'
         AND lower(btrim(coalesce(g.status_repasse,''))) = 'paga'
         AND g.data_repasse IS NOT NULL
         AND g.data_repasse >= g.data_pagamento
         AND date_trunc('month', g.data_repasse)::date = cfg.mes_ancora
        )
      )
  )
  SELECT b.ciclo_ano::int,
         b.ciclo_mes::int,
         CASE
           WHEN b.ciclo_ano < EXTRACT(YEAR FROM b.mes_ancora)::int
                OR (b.ciclo_ano = EXTRACT(YEAR FROM b.mes_ancora)::int
                    AND b.ciclo_mes < EXTRACT(MONTH FROM b.mes_ancora)::int)
             THEN 'A_PAGAR'
           ELSE 'RETIDO_MINIMO'
         END::text AS situacao,
         mode() WITHIN GROUP (ORDER BY b.canal_raw)::text AS canal_repasse,
         count(*)::bigint AS linhas,
         round(sum(b.v)::numeric,2) AS valor
  FROM base b
  GROUP BY b.ciclo_ano, b.ciclo_mes, b.canal_key, b.mes_ancora
  HAVING p_modo = 'HISTORICO'
         OR (p_modo = 'PROVISIONADO' AND round(sum(b.v)::numeric,2) >= 100)
  ORDER BY b.ciclo_ano, b.ciclo_mes, 6 DESC;
$$;

-- 2) NOVA: rodapé com o que fica FORA da soma provisionada
CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_rodape()
RETURNS TABLE(grupo text, situacao_repasse text, linhas bigint, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (CASE WHEN lower(btrim(coalesce(g.status_repasse,'')))
                    IN ('retido momentaneamente','suspenso')
               THEN 'RETIDO_SUSPENSO' ELSE 'SEM_CADASTRO' END)::text,
         initcap(lower(btrim(coalesce(nullif(g.status_repasse,'-'),'(vazio)'))))::text,
         count(*),
         round(sum(coalesce(g.valor_repasse_total,0))::numeric,2)
  FROM public.vw_lavoro_gerencial g
  WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'paga'
    AND public.normalize_canal_repasse(g.possui_repasse) NOT IN ('LAVORO','')
    AND (lower(btrim(coalesce(g.status_repasse,''))) IN ('retido momentaneamente','suspenso','-','')
         OR g.status_repasse IS NULL)
  GROUP BY 1, 2
  ORDER BY 1, 4 DESC;
$$;

-- 3) NOVA: previsão longa (comissão AINDA NÃO recebida)
CREATE OR REPLACE FUNCTION public.rpc_lavoro_repasse_previsao_longa(
  p_ano int DEFAULT NULL,
  p_mes int DEFAULT NULL,
  p_canal_repasse text DEFAULT NULL
)
RETURNS TABLE(previsto_ano int, previsto_mes int, canal_repasse text, linhas bigint, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT make_date(COALESCE(p_ano, EXTRACT(YEAR FROM current_date)::int),
                     COALESCE(p_mes, EXTRACT(MONTH FROM current_date)::int), 1) AS mes_ancora
  ),
  b AS (
    SELECT public.normalize_canal_repasse(g.possui_repasse) AS canal_key,
           btrim(coalesce(g.possui_repasse,''))             AS canal_raw,
           (date_trunc('month', g.data_pagamento) + interval '1 month')::date AS mes_previsto,
           coalesce(g.valor_repasse_total,0) AS v
    FROM public.vw_lavoro_gerencial g
    WHERE lower(btrim(coalesce(g.status_parcela_comissao,''))) = 'a vencer'
      AND public.normalize_canal_repasse(g.possui_repasse) NOT IN ('LAVORO','')
      AND coalesce(g.valor_repasse_total,0) <> 0
      AND g.data_pagamento IS NOT NULL
      AND (p_canal_repasse IS NULL
           OR public.normalize_canal_repasse(g.possui_repasse)
              = public.normalize_canal_repasse(p_canal_repasse))
  )
  SELECT EXTRACT(YEAR  FROM b.mes_previsto)::int,
         EXTRACT(MONTH FROM b.mes_previsto)::int,
         mode() WITHIN GROUP (ORDER BY b.canal_raw)::text,
         count(*),
         round(sum(b.v)::numeric,2)
  FROM b CROSS JOIN cfg
  WHERE b.mes_previsto >= cfg.mes_ancora
  GROUP BY b.mes_previsto, b.canal_key
  ORDER BY 1, 2, 5 DESC;
$$;

-- 4) GRANT EXECUTE das funções para authenticated
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_por_canal(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_rodape() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_previsao_longa(int, int, text) TO authenticated;