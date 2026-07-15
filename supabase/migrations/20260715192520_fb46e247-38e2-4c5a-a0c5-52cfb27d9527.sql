
-- =============================================================
-- REPORT FECHAMENTO — RPCs
-- Reusa raw_lavoro_gerencial + vw_lavoro_gerencial + vw_lavoro_depara_ramo
-- =============================================================

-- Helper: janela de datas conforme granularidade/período
CREATE OR REPLACE FUNCTION public._fechamento_janela(
  p_ano int, p_gran text, p_periodo int
) RETURNS TABLE(dt_ini date, dt_fim date)
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE upper(p_gran)
      WHEN 'MENSAL'     THEN make_date(p_ano, GREATEST(1, LEAST(12, p_periodo)), 1)
      WHEN 'TRIMESTRAL' THEN make_date(p_ano, ((GREATEST(1, LEAST(4, p_periodo)) - 1) * 3) + 1, 1)
      WHEN 'SEMESTRAL'  THEN make_date(p_ano, CASE WHEN p_periodo <= 1 THEN 1 ELSE 7 END, 1)
      ELSE                    make_date(p_ano, 1, 1)
    END AS dt_ini,
    CASE upper(p_gran)
      WHEN 'MENSAL'     THEN (make_date(p_ano, GREATEST(1, LEAST(12, p_periodo)), 1) + INTERVAL '1 month' - INTERVAL '1 day')::date
      WHEN 'TRIMESTRAL' THEN (make_date(p_ano, ((GREATEST(1, LEAST(4, p_periodo)) - 1) * 3) + 1, 1) + INTERVAL '3 months' - INTERVAL '1 day')::date
      WHEN 'SEMESTRAL'  THEN (make_date(p_ano, CASE WHEN p_periodo <= 1 THEN 1 ELSE 7 END, 1) + INTERVAL '6 months' - INTERVAL '1 day')::date
      ELSE                    make_date(p_ano, 12, 31)
    END AS dt_fim;
$$;

GRANT EXECUTE ON FUNCTION public._fechamento_janela(int,text,int) TO authenticated, service_role;

-- Predicado: linhas válidas (exclui Cancelado, Analisar, Transferência De Corretagem)
-- Usamos vw_lavoro_gerencial que já normaliza status e junta canal.

-- =============================================================
-- 1) SUMÁRIO EXECUTIVO
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_sumario(
  p_ano int, p_gran text, p_periodo int, p_comparar bool DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual RECORD;
  v_ant   RECORD;
  v_cutoff date := date_trunc('month', CURRENT_DATE)::date - 1;
  v_janela RECORD;
BEGIN
  SELECT * INTO v_janela FROM public._fechamento_janela(p_ano, p_gran, p_periodo);

  -- Métricas do período atual
  WITH base AS (
    SELECT g.*
    FROM public.vw_lavoro_gerencial g
    WHERE lower(coalesce(g.status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
  ),
  emissao AS (
    SELECT
      COALESCE(SUM(premio_parcela),0)   AS premio_emitido,
      COALESCE(SUM(comissao_bruta),0)   AS comissao_bruta,
      COUNT(DISTINCT numero_apolice)    AS apolices
    FROM base WHERE data_emissao BETWEEN v_janela.dt_ini AND v_janela.dt_fim
  ),
  caixa AS (
    SELECT
      COALESCE(SUM(valor_recebido_a_receber),0) AS caixa_recebido,
      COUNT(*)                                  AS parcelas
    FROM base
    WHERE lower(status_parcela_comissao) = 'paga'
      AND data_pagamento BETWEEN v_janela.dt_ini AND v_janela.dt_fim
  ),
  ramo AS (
    SELECT
      COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
      SUM(CASE WHEN data_emissao BETWEEN v_janela.dt_ini AND v_janela.dt_fim THEN comissao_bruta ELSE 0 END) AS comissao,
      SUM(CASE WHEN lower(status_parcela_comissao)='paga' AND data_pagamento BETWEEN v_janela.dt_ini AND v_janela.dt_fim THEN valor_recebido_a_receber ELSE 0 END) AS caixa
    FROM base
    GROUP BY 1
  )
  SELECT
    jsonb_build_object(
      'premio_emitido', emissao.premio_emitido,
      'comissao_bruta', emissao.comissao_bruta,
      'apolices',       emissao.apolices,
      'caixa_recebido', caixa.caixa_recebido,
      'parcelas',       caixa.parcelas,
      'ticket_medio',   CASE WHEN caixa.parcelas>0 THEN caixa.caixa_recebido/caixa.parcelas ELSE 0 END,
      'ramos', (SELECT jsonb_agg(jsonb_build_object('canal',canal,'comissao',comissao,'caixa',caixa)
                       ORDER BY CASE canal WHEN 'Benefícios' THEN 1 WHEN 'Demais Ramos' THEN 2 WHEN 'Garantia' THEN 3 ELSE 4 END) FROM ramo)
    )
  INTO v_atual FROM emissao, caixa;

  -- Comparação com mesma janela ano-1
  IF p_comparar THEN
    DECLARE v_janela_ant RECORD;
    BEGIN
      SELECT * INTO v_janela_ant FROM public._fechamento_janela(p_ano-1, p_gran, p_periodo);
      WITH base AS (
        SELECT g.*
        FROM public.vw_lavoro_gerencial g
        WHERE lower(coalesce(g.status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
      ),
      emissao AS (
        SELECT COALESCE(SUM(premio_parcela),0) AS premio_emitido,
               COALESCE(SUM(comissao_bruta),0) AS comissao_bruta,
               COUNT(DISTINCT numero_apolice)  AS apolices
        FROM base WHERE data_emissao BETWEEN v_janela_ant.dt_ini AND v_janela_ant.dt_fim
      ),
      caixa AS (
        SELECT COALESCE(SUM(valor_recebido_a_receber),0) AS caixa_recebido,
               COUNT(*) AS parcelas
        FROM base
        WHERE lower(status_parcela_comissao)='paga'
          AND data_pagamento BETWEEN v_janela_ant.dt_ini AND v_janela_ant.dt_fim
      ),
      ramo AS (
        SELECT COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
          SUM(CASE WHEN data_emissao BETWEEN v_janela_ant.dt_ini AND v_janela_ant.dt_fim THEN comissao_bruta ELSE 0 END) AS comissao,
          SUM(CASE WHEN lower(status_parcela_comissao)='paga' AND data_pagamento BETWEEN v_janela_ant.dt_ini AND v_janela_ant.dt_fim THEN valor_recebido_a_receber ELSE 0 END) AS caixa
        FROM base GROUP BY 1
      )
      SELECT jsonb_build_object(
        'premio_emitido', emissao.premio_emitido,
        'comissao_bruta', emissao.comissao_bruta,
        'apolices',       emissao.apolices,
        'caixa_recebido', caixa.caixa_recebido,
        'parcelas',       caixa.parcelas,
        'ticket_medio',   CASE WHEN caixa.parcelas>0 THEN caixa.caixa_recebido/caixa.parcelas ELSE 0 END,
        'ramos', (SELECT jsonb_agg(jsonb_build_object('canal',canal,'comissao',comissao,'caixa',caixa)
                         ORDER BY CASE canal WHEN 'Benefícios' THEN 1 WHEN 'Demais Ramos' THEN 2 WHEN 'Garantia' THEN 3 ELSE 4 END) FROM ramo)
      ) INTO v_ant FROM emissao, caixa;
    END;
  END IF;

  RETURN jsonb_build_object(
    'janela',    jsonb_build_object('dt_ini', v_janela.dt_ini, 'dt_fim', v_janela.dt_fim),
    'atual',     v_atual,
    'anterior',  CASE WHEN p_comparar THEN v_ant ELSE NULL END,
    'cutoff',    v_cutoff,
    'pipeline',  (
      SELECT jsonb_build_object(
        'total',    COALESCE(SUM(valor_recebido_a_receber),0),
        'apolices', COUNT(DISTINCT numero_apolice)
      )
      FROM public.vw_lavoro_gerencial
      WHERE lower(status_parcela_comissao)='a vencer'
        AND data_pagamento > v_cutoff
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_sumario(int,text,int,bool) TO authenticated, service_role;

-- =============================================================
-- 2) CAIXA POR RAMO
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_caixa_ramo(
  p_ano int, p_gran text, p_periodo int, p_comparar bool DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j RECORD; v_j_ant RECORD;
BEGIN
  SELECT * INTO v_j FROM public._fechamento_janela(p_ano, p_gran, p_periodo);
  SELECT * INTO v_j_ant FROM public._fechamento_janela(p_ano-1, p_gran, p_periodo);

  RETURN jsonb_build_object(
    'janela', jsonb_build_object('dt_ini', v_j.dt_ini, 'dt_fim', v_j.dt_fim),
    'mix_atual', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ord)
      FROM (
        SELECT COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(*) AS parcelas,
               COALESCE(SUM(valor_recebido_a_receber),0) AS caixa,
               CASE WHEN COUNT(*)>0 THEN COALESCE(SUM(valor_recebido_a_receber),0)/COUNT(*) ELSE 0 END AS ticket,
               CASE COALESCE(tipo_de_ramo,'Sem Categoria') WHEN 'Benefícios' THEN 1 WHEN 'Demais Ramos' THEN 2 WHEN 'Garantia' THEN 3 ELSE 4 END AS ord
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='paga'
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1
      ) t
    ),
    'mix_anterior', CASE WHEN p_comparar THEN (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ord)
      FROM (
        SELECT COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(*) AS parcelas,
               COALESCE(SUM(valor_recebido_a_receber),0) AS caixa,
               CASE COALESCE(tipo_de_ramo,'Sem Categoria') WHEN 'Benefícios' THEN 1 WHEN 'Demais Ramos' THEN 2 WHEN 'Garantia' THEN 3 ELSE 4 END AS ord
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='paga'
          AND data_pagamento BETWEEN v_j_ant.dt_ini AND v_j_ant.dt_fim
        GROUP BY 1
      ) t
    ) ELSE NULL END,
    'evolucao_mensal', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY mes)
      FROM (
        SELECT EXTRACT(MONTH FROM data_pagamento)::int AS mes,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(valor_recebido_a_receber),0) AS caixa
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='paga'
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
        GROUP BY 1,2
      ) t
    ),
    'top_atual', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY caixa DESC)
      FROM (
        SELECT tomador, COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(DISTINCT numero_apolice) AS apolices,
               COALESCE(SUM(valor_recebido_a_receber),0) AS caixa
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='paga'
          AND data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim
          AND tomador IS NOT NULL AND btrim(tomador) NOT IN ('','-')
        GROUP BY 1,2 ORDER BY 4 DESC LIMIT 15
      ) t
    ),
    'top_anterior', CASE WHEN p_comparar THEN (
      SELECT jsonb_agg(row_to_json(t) ORDER BY caixa DESC)
      FROM (
        SELECT tomador, COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(DISTINCT numero_apolice) AS apolices,
               COALESCE(SUM(valor_recebido_a_receber),0) AS caixa
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='paga'
          AND data_pagamento BETWEEN v_j_ant.dt_ini AND v_j_ant.dt_fim
          AND tomador IS NOT NULL AND btrim(tomador) NOT IN ('','-')
        GROUP BY 1,2 ORDER BY 4 DESC LIMIT 15
      ) t
    ) ELSE NULL END
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_caixa_ramo(int,text,int,bool) TO authenticated, service_role;

-- =============================================================
-- 3) EVOLUÇÃO MENSAL (Comissão / Caixa / Apólices, ano vs ano-1)
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_evolucao_mensal(
  p_ano int, p_gran text, p_periodo int, p_comparar bool DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j RECORD;
  v_mes_ini int; v_mes_fim int;
BEGIN
  SELECT * INTO v_j FROM public._fechamento_janela(p_ano, p_gran, p_periodo);
  v_mes_ini := EXTRACT(MONTH FROM v_j.dt_ini)::int;
  v_mes_fim := EXTRACT(MONTH FROM v_j.dt_fim)::int;

  RETURN jsonb_build_object(
    'meses', (SELECT jsonb_agg(m ORDER BY m) FROM generate_series(v_mes_ini, v_mes_fim) m),
    'comissao', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano, mes)
      FROM (
        SELECT EXTRACT(YEAR FROM data_emissao)::int AS ano,
               EXTRACT(MONTH FROM data_emissao)::int AS mes,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(comissao_bruta),0) AS valor
        FROM public.vw_lavoro_gerencial
        WHERE lower(coalesce(status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
          AND EXTRACT(YEAR FROM data_emissao) IN (p_ano, p_ano-1)
          AND EXTRACT(MONTH FROM data_emissao) BETWEEN v_mes_ini AND v_mes_fim
        GROUP BY 1,2,3
      ) t
    ),
    'caixa', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano, mes)
      FROM (
        SELECT EXTRACT(YEAR FROM data_pagamento)::int AS ano,
               EXTRACT(MONTH FROM data_pagamento)::int AS mes,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(valor_recebido_a_receber),0) AS valor
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='paga'
          AND EXTRACT(YEAR FROM data_pagamento) IN (p_ano, p_ano-1)
          AND EXTRACT(MONTH FROM data_pagamento) BETWEEN v_mes_ini AND v_mes_fim
        GROUP BY 1,2,3
      ) t
    ),
    'apolices', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano, mes)
      FROM (
        SELECT EXTRACT(YEAR FROM data_emissao)::int AS ano,
               EXTRACT(MONTH FROM data_emissao)::int AS mes,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(DISTINCT numero_apolice) AS valor
        FROM public.vw_lavoro_gerencial
        WHERE lower(coalesce(status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
          AND EXTRACT(YEAR FROM data_emissao) IN (p_ano, p_ano-1)
          AND EXTRACT(MONTH FROM data_emissao) BETWEEN v_mes_ini AND v_mes_fim
        GROUP BY 1,2,3
      ) t
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_evolucao_mensal(int,text,int,bool) TO authenticated, service_role;

-- =============================================================
-- 4) VENCIDOS (snapshot, ignora filtro de período)
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_vencidos()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_atual int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  RETURN jsonb_build_object(
    'snapshot', CURRENT_DATE,
    'por_ano_canal', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano_venc, canal)
      FROM (
        SELECT
          CASE
            WHEN EXTRACT(YEAR FROM data_pagamento)::int < v_ano_atual-1 THEN 'Anteriores a ' || (v_ano_atual-1)::text
            ELSE EXTRACT(YEAR FROM data_pagamento)::text
          END AS ano_venc,
          COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
          COALESCE(SUM(valor_recebido_a_receber),0) AS saldo,
          COUNT(DISTINCT numero_apolice) AS apolices
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='vencida'
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
          WHERE lower(status_parcela_comissao)='vencida' AND data_pagamento IS NOT NULL
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
        GROUP BY 1,2 ORDER BY 4 DESC LIMIT 10
      ) t
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_vencidos() TO authenticated, service_role;

-- =============================================================
-- 5) A RECEBER (Pipeline, snapshot)
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_a_receber()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cutoff date := date_trunc('month', CURRENT_DATE)::date - 1;
BEGIN
  RETURN jsonb_build_object(
    'snapshot', CURRENT_DATE,
    'cutoff', v_cutoff,
    'total', (SELECT jsonb_build_object(
      'valor', COALESCE(SUM(valor_recebido_a_receber),0),
      'apolices', COUNT(DISTINCT numero_apolice),
      'parcelas', COUNT(*)
    ) FROM public.vw_lavoro_gerencial
      WHERE lower(status_parcela_comissao)='a vencer' AND data_pagamento > v_cutoff),
    'por_ano_pagamento', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY ano)
      FROM (
        SELECT EXTRACT(YEAR FROM data_pagamento)::int AS ano,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COALESCE(SUM(valor_recebido_a_receber),0) AS valor,
               COUNT(*) AS parcelas,
               COUNT(DISTINCT numero_apolice) AS apolices
        FROM public.vw_lavoro_gerencial
        WHERE lower(status_parcela_comissao)='a vencer' AND data_pagamento > v_cutoff
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
          AND data_pagamento <= (v_cutoff + INTERVAL '6 months')::date
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
        WHERE lower(status_parcela_comissao)='a vencer' AND data_pagamento > v_cutoff
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
        WHERE lower(status_parcela_comissao)='a vencer' AND data_pagamento > v_cutoff
        GROUP BY 1,2 ORDER BY 4 DESC LIMIT 10
      ) t
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_a_receber() TO authenticated, service_role;

-- =============================================================
-- 6) TOP TOMADORES (comissão emitida, atual + anterior)
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_top_tomadores(
  p_ano int, p_gran text, p_periodo int, p_comparar bool DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_j RECORD; v_j_ant RECORD;
BEGIN
  SELECT * INTO v_j FROM public._fechamento_janela(p_ano, p_gran, p_periodo);
  SELECT * INTO v_j_ant FROM public._fechamento_janela(p_ano-1, p_gran, p_periodo);

  RETURN jsonb_build_object(
    'atual', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY comissao DESC)
      FROM (
        SELECT tomador AS nome, COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(DISTINCT numero_apolice) AS apolices,
               COALESCE(SUM(premio_parcela),0) AS premio,
               COALESCE(SUM(comissao_bruta),0) AS comissao
        FROM public.vw_lavoro_gerencial
        WHERE lower(coalesce(status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
          AND data_emissao BETWEEN v_j.dt_ini AND v_j.dt_fim
          AND tomador IS NOT NULL AND btrim(tomador) NOT IN ('','-')
        GROUP BY 1,2 ORDER BY 5 DESC LIMIT 20
      ) t
    ),
    'anterior', CASE WHEN p_comparar THEN (
      SELECT jsonb_agg(row_to_json(t) ORDER BY comissao DESC)
      FROM (
        SELECT tomador AS nome, COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
               COUNT(DISTINCT numero_apolice) AS apolices,
               COALESCE(SUM(premio_parcela),0) AS premio,
               COALESCE(SUM(comissao_bruta),0) AS comissao
        FROM public.vw_lavoro_gerencial
        WHERE lower(coalesce(status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
          AND data_emissao BETWEEN v_j_ant.dt_ini AND v_j_ant.dt_fim
          AND tomador IS NOT NULL AND btrim(tomador) NOT IN ('','-')
        GROUP BY 1,2 ORDER BY 5 DESC LIMIT 20
      ) t
    ) ELSE NULL END
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_top_tomadores(int,text,int,bool) TO authenticated, service_role;

-- =============================================================
-- 7) BASE (drill-down paginado)
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_fechamento_base(
  p_ano int, p_gran text, p_periodo int,
  p_pagina int DEFAULT 1, p_tamanho int DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_j RECORD; v_off int;
BEGIN
  SELECT * INTO v_j FROM public._fechamento_janela(p_ano, p_gran, p_periodo);
  v_off := GREATEST(0, (p_pagina-1) * p_tamanho);

  RETURN jsonb_build_object(
    'total', (
      SELECT COUNT(*) FROM public.vw_lavoro_gerencial
      WHERE lower(coalesce(status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
        AND (data_emissao BETWEEN v_j.dt_ini AND v_j.dt_fim
          OR data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim)
    ),
    'linhas', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT tomador, segurado, numero_apolice, ramo,
               COALESCE(tipo_de_ramo,'Sem Categoria') AS canal, seguradora,
               data_emissao, data_pagamento, status_parcela_comissao,
               premio_parcela, comissao_bruta, valor_recebido_a_receber,
               numero_da_parcela
        FROM public.vw_lavoro_gerencial
        WHERE lower(coalesce(status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
          AND (data_emissao BETWEEN v_j.dt_ini AND v_j.dt_fim
            OR data_pagamento BETWEEN v_j.dt_ini AND v_j.dt_fim)
        ORDER BY data_emissao DESC NULLS LAST
        LIMIT p_tamanho OFFSET v_off
      ) t
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_base(int,text,int,int,int) TO authenticated, service_role;
