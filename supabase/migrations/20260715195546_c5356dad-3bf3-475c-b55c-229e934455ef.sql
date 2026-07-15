
-- VENCIDOS: agora aceita filtro global (ano/gran/periodo) e filtra por data_pagamento na janela
CREATE OR REPLACE FUNCTION public.rpc_fechamento_vencidos(
  p_ano int, p_gran text, p_periodo int
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j RECORD;
BEGIN
  SELECT * INTO v_j FROM public._fechamento_janela(p_ano, p_gran, p_periodo);

  RETURN jsonb_build_object(
    'snapshot', CURRENT_DATE,
    'janela', jsonb_build_object('dt_ini', v_j.dt_ini, 'dt_fim', v_j.dt_fim),
    'por_ano_canal', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano_venc, canal)
      FROM (
        SELECT
          EXTRACT(YEAR FROM data_pagamento)::text AS ano_venc,
          COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
          COALESCE(SUM(valor_recebido_a_receber),0) AS saldo,
          COUNT(DISTINCT numero_apolice) AS apolices
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='vencida'
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2
      ) t
    ),
    'aging', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ord)
      FROM (
        SELECT faixa, canal, saldo,
          CASE faixa WHEN '1-30' THEN 1 WHEN '31-60' THEN 2 WHEN '61-90' THEN 3 WHEN '91-180' THEN 4 ELSE 5 END AS ord
        FROM (
          SELECT
            CASE
              WHEN (CURRENT_DATE - data_pagamento) <= 30 THEN '1-30'
              WHEN (CURRENT_DATE - data_pagamento) <= 60 THEN '31-60'
              WHEN (CURRENT_DATE - data_pagamento) <= 90 THEN '61-90'
              WHEN (CURRENT_DATE - data_pagamento) <= 180 THEN '91-180'
              ELSE '180+'
            END AS faixa,
            COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
            COALESCE(SUM(valor_recebido_a_receber),0) AS saldo
          FROM public.vw_lavoro_gerencial
          WHERE lower(status_parcela_comissao)='vencida'
            AND data_pagamento IS NOT NULL
            AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
          GROUP BY 1,2
        ) x
      ) t
    ),
    'top_inadimplentes', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY saldo DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(btrim(tomador),''), NULLIF(btrim(tomador),'-'), segurado || ' (s/ Tomador)') AS nome,
          COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
          COUNT(DISTINCT numero_apolice) AS apolices,
          COALESCE(SUM(valor_recebido_a_receber),0) AS saldo,
          COUNT(DISTINCT EXTRACT(YEAR FROM data_pagamento)) AS anos_com_vencidos
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='vencida'
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2 ORDER BY 4 DESC LIMIT 10
      ) t
    )
  );
END; $$;

-- Remove versão antiga sem argumentos
DROP FUNCTION IF EXISTS public.rpc_fechamento_vencidos();

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_vencidos(int,text,int) TO authenticated, service_role;

-- A RECEBER: agora aceita filtro global e filtra por data_pagamento dentro da janela
CREATE OR REPLACE FUNCTION public.rpc_fechamento_a_receber(
  p_ano int, p_gran text, p_periodo int
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j RECORD;
  v_cutoff date := date_trunc('month', CURRENT_DATE)::date - 1;
BEGIN
  SELECT * INTO v_j FROM public._fechamento_janela(p_ano, p_gran, p_periodo);

  RETURN jsonb_build_object(
    'snapshot', CURRENT_DATE,
    'cutoff', v_cutoff,
    'janela', jsonb_build_object('dt_ini', v_j.dt_ini, 'dt_fim', v_j.dt_fim),
    'total', (SELECT jsonb_build_object(
      'valor', COALESCE(SUM(valor_recebido_a_receber),0),
      'apolices', COUNT(DISTINCT numero_apolice),
      'parcelas', COUNT(*)
    ) FROM public.vw_lavoro_gerencial
      WHERE lower(status_parcela_comissao)='a vencer'
        AND data_pagamento > v_cutoff
        AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim),
    'por_ano_pagamento', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano)
      FROM (
        SELECT EXTRACT(YEAR FROM data_pagamento)::int AS ano,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(valor_recebido_a_receber),0) AS valor,
               COUNT(*) AS parcelas,
               COUNT(DISTINCT numero_apolice) AS apolices
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='a vencer'
          AND data_pagamento > v_cutoff
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2
      ) t
    ),
    'proximo_semestre', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY mes)
      FROM (
        SELECT EXTRACT(YEAR FROM data_pagamento)::int AS ano,
               EXTRACT(MONTH FROM data_pagamento)::int AS mes,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(valor_recebido_a_receber),0) AS valor
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='a vencer'
          AND data_pagamento > v_cutoff
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2,3
      ) t
    ),
    'por_safra', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano_emissao)
      FROM (
        SELECT EXTRACT(YEAR FROM data_emissao)::int AS ano_emissao,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(valor_recebido_a_receber),0) AS valor
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='a vencer'
          AND data_pagamento > v_cutoff
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2
      ) t
    ),
    'top_tomadores', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY valor DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(btrim(tomador),''), NULLIF(btrim(tomador),'-'), segurado || ' (s/ Tomador)') AS nome,
          COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
          COUNT(DISTINCT numero_apolice) AS apolices,
          COALESCE(SUM(valor_recebido_a_receber),0) AS valor
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='a vencer'
          AND data_pagamento > v_cutoff
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2 ORDER BY 4 DESC LIMIT 10
      ) t
    )
  );
END; $$;

DROP FUNCTION IF EXISTS public.rpc_fechamento_a_receber();

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_a_receber(int,text,int) TO authenticated, service_role;
