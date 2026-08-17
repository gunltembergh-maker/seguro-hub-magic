-- Helper de canal
CREATE OR REPLACE FUNCTION public.lavoro_canal(p_tipo_de_ramo text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_tipo_de_ramo,'')))
    WHEN 'garantia' THEN 'Garantia'
    WHEN 'benefícios' THEN 'Benefícios'
    WHEN 'beneficios' THEN 'Benefícios'
    ELSE 'Demais Ramos'
  END;
$$;

DROP FUNCTION IF EXISTS public.rpc_lavoro_receita_kpis(integer, integer, text);

CREATE FUNCTION public.rpc_lavoro_receita_kpis(p_ano integer, p_mes integer, p_periodo text DEFAULT 'YTD'::text)
RETURNS TABLE(
  receita_competencia numeric, receita_caixa numeric, meta_periodo numeric,
  atingimento numeric, defasagem numeric, previsto_caixa numeric, atingimento_caixa numeric,
  previsto_garantia numeric, previsto_beneficios numeric, previsto_demais numeric,
  caixa_garantia numeric, caixa_beneficios numeric, caixa_demais numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_meta_mensal numeric := public.rpc_lavoro_get_meta_anual(p_ano) / 12;
  v_mes_inicio_semestre int := CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END;
  v_meses_no_periodo int := CASE
    WHEN p_periodo = 'MTD' THEN 1
    WHEN p_periodo = 'SEMESTRE' THEN (p_mes - v_mes_inicio_semestre + 1)
    ELSE p_mes END;
  v_meta_periodo numeric := v_meta_mensal * v_meses_no_periodo;
BEGIN
  RETURN QUERY
  WITH comp AS (
    SELECT SUM(c.comissao_bruta) AS total FROM public.vw_lavoro_receita_competencia c
    WHERE c.ano = p_ano AND (
      (p_periodo = 'MTD' AND c.mes = p_mes) OR
      (p_periodo = 'YTD' AND c.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND c.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  ),
  caixa AS (
    SELECT SUM(cx.valor) AS total FROM public.vw_lavoro_receita_caixa cx
    WHERE cx.ano = p_ano AND (
      (p_periodo = 'MTD' AND cx.mes = p_mes) OR
      (p_periodo = 'YTD' AND cx.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND cx.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  ),
  previsto AS (
    SELECT
      SUM(pv.valor_previsto) AS total,
      SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Garantia') AS garantia,
      SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Benefícios') AS beneficios,
      SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Demais Ramos') AS demais
    FROM public.vw_lavoro_previsto_caixa pv
    WHERE pv.ano = p_ano AND (
      (p_periodo = 'MTD' AND pv.mes = p_mes) OR
      (p_periodo = 'YTD') OR
      (p_periodo = 'SEMESTRE' AND pv.mes BETWEEN v_mes_inicio_semestre AND (CASE WHEN p_mes <= 6 THEN 6 ELSE 12 END)))
  ),
  -- distribuição do caixa por canal a partir das parcelas pagas (gerencial)
  caixa_mix AS (
    SELECT
      COALESCE(SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Garantia'), 0) AS garantia,
      COALESCE(SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Benefícios'), 0) AS beneficios,
      COALESCE(SUM(pv.valor_previsto) FILTER (WHERE public.lavoro_canal(pv.tipo_de_ramo) = 'Demais Ramos'), 0) AS demais
    FROM public.vw_lavoro_previsto_caixa pv
    WHERE lower(btrim(coalesce(pv.status_parcela_comissao,''))) = 'paga'
      AND pv.ano = p_ano AND (
      (p_periodo = 'MTD' AND pv.mes = p_mes) OR
      (p_periodo = 'YTD' AND pv.mes <= p_mes) OR
      (p_periodo = 'SEMESTRE' AND pv.mes BETWEEN v_mes_inicio_semestre AND p_mes))
  )
  SELECT
    COALESCE(comp.total, 0), COALESCE(caixa.total, 0), v_meta_periodo,
    public.divide_safe(COALESCE(comp.total, 0), v_meta_periodo),
    COALESCE(comp.total, 0) - COALESCE(caixa.total, 0),
    COALESCE(previsto.total, 0),
    public.divide_safe(COALESCE(caixa.total, 0), COALESCE(previsto.total, 0)),
    COALESCE(previsto.garantia, 0),
    COALESCE(previsto.beneficios, 0),
    COALESCE(previsto.total, 0) - COALESCE(previsto.garantia, 0) - COALESCE(previsto.beneficios, 0),
    LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0), 0)),
    LEAST(caixa_mix.beneficios, GREATEST(COALESCE(caixa.total,0) - LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0),0)), 0)),
    COALESCE(caixa.total,0)
      - LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0), 0))
      - LEAST(caixa_mix.beneficios, GREATEST(COALESCE(caixa.total,0) - LEAST(caixa_mix.garantia, GREATEST(COALESCE(caixa.total,0),0)), 0))
  FROM comp, caixa, previsto, caixa_mix;
END;
$function$;

-- Pipeline com quebra por canal
CREATE OR REPLACE FUNCTION public.rpc_fechamento_sumario(p_ano integer, p_gran text, p_periodo integer, p_comparar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_atual jsonb;
  v_ant   jsonb;
  v_cutoff date := date_trunc('month', CURRENT_DATE)::date - 1;
  v_janela RECORD;
  v_janela_ant RECORD;
BEGIN
  SELECT * INTO v_janela FROM public._fechamento_janela(p_ano, p_gran, p_periodo);

  WITH base AS (
    SELECT g.* FROM public.vw_lavoro_gerencial g
    WHERE lower(coalesce(g.status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
  ),
  emissao AS (
    SELECT COALESCE(SUM(premio_parcela),0) AS premio_emitido,
           COALESCE(SUM(comissao_bruta),0) AS comissao_bruta,
           COUNT(DISTINCT numero_apolice)  AS apolices
    FROM base WHERE data_emissao BETWEEN v_janela.dt_ini AND v_janela.dt_fim
  ),
  caixa AS (
    SELECT COALESCE(SUM(valor_recebido_a_receber),0) AS caixa_recebido, COUNT(*) AS parcelas
    FROM base WHERE lower(status_parcela_comissao)='paga'
      AND data_pagamento BETWEEN v_janela.dt_ini AND v_janela.dt_fim
  ),
  ramo AS (
    SELECT COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
      SUM(CASE WHEN data_emissao BETWEEN v_janela.dt_ini AND v_janela.dt_fim THEN comissao_bruta ELSE 0 END) AS comissao,
      SUM(CASE WHEN lower(status_parcela_comissao)='paga' AND data_pagamento BETWEEN v_janela.dt_ini AND v_janela.dt_fim THEN valor_recebido_a_receber ELSE 0 END) AS caixa
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
  ) INTO v_atual FROM emissao, caixa;

  IF p_comparar THEN
    SELECT * INTO v_janela_ant FROM public._fechamento_janela(p_ano-1, p_gran, p_periodo);
    WITH base AS (
      SELECT g.* FROM public.vw_lavoro_gerencial g
      WHERE lower(coalesce(g.status_parcela_comissao,'')) NOT IN ('cancelado','analisar','transferência de corretagem','transferencia de corretagem')
    ),
    emissao AS (
      SELECT COALESCE(SUM(premio_parcela),0) AS premio_emitido,
             COALESCE(SUM(comissao_bruta),0) AS comissao_bruta,
             COUNT(DISTINCT numero_apolice)  AS apolices
      FROM base WHERE data_emissao BETWEEN v_janela_ant.dt_ini AND v_janela_ant.dt_fim
    ),
    caixa AS (
      SELECT COALESCE(SUM(valor_recebido_a_receber),0) AS caixa_recebido, COUNT(*) AS parcelas
      FROM base WHERE lower(status_parcela_comissao)='paga'
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
  END IF;

  RETURN jsonb_build_object(
    'janela',   jsonb_build_object('dt_ini', v_janela.dt_ini, 'dt_fim', v_janela.dt_fim),
    'atual',    v_atual,
    'anterior', CASE WHEN p_comparar THEN v_ant ELSE NULL END,
    'cutoff',   v_cutoff,
    'pipeline', (
      SELECT jsonb_build_object(
        'total',    COALESCE(SUM(valor_recebido_a_receber),0),
        'apolices', COUNT(DISTINCT numero_apolice),
        'garantia',   COALESCE(SUM(valor_recebido_a_receber) FILTER (WHERE public.lavoro_canal(tipo_de_ramo)='Garantia'),0),
        'beneficios', COALESCE(SUM(valor_recebido_a_receber) FILTER (WHERE public.lavoro_canal(tipo_de_ramo)='Benefícios'),0),
        'demais',     COALESCE(SUM(valor_recebido_a_receber) FILTER (WHERE public.lavoro_canal(tipo_de_ramo)='Demais Ramos'),0)
      )
      FROM public.vw_lavoro_gerencial
      WHERE lower(status_parcela_comissao)='a vencer' AND data_pagamento > v_cutoff
    )
  );
END; $function$;

-- A Receber: total com quebra por canal
CREATE OR REPLACE FUNCTION public.rpc_fechamento_a_receber(p_ano integer, p_gran text, p_periodo integer)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      'parcelas', COUNT(*),
      'garantia',   COALESCE(SUM(valor_recebido_a_receber) FILTER (WHERE public.lavoro_canal(tipo_de_ramo)='Garantia'),0),
      'beneficios', COALESCE(SUM(valor_recebido_a_receber) FILTER (WHERE public.lavoro_canal(tipo_de_ramo)='Benefícios'),0),
      'demais',     COALESCE(SUM(valor_recebido_a_receber) FILTER (WHERE public.lavoro_canal(tipo_de_ramo)='Demais Ramos'),0)
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
END; $function$;

GRANT EXECUTE ON FUNCTION public.lavoro_canal(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_kpis(integer, integer, text) TO authenticated, service_role;