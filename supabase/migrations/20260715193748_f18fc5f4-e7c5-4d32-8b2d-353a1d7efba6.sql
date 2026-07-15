
-- Fix rpc_fechamento_sumario: v_atual/v_ant must be jsonb, not RECORD
CREATE OR REPLACE FUNCTION public.rpc_fechamento_sumario(
  p_ano int, p_gran text, p_periodo int, p_comparar bool DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual jsonb;
  v_ant   jsonb;
  v_cutoff date := date_trunc('month', CURRENT_DATE)::date - 1;
  v_janela RECORD;
  v_janela_ant RECORD;
BEGIN
  SELECT * INTO v_janela FROM public._fechamento_janela(p_ano, p_gran, p_periodo);

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
    WHERE lower(status_parcela_comissao)='paga'
      AND data_pagamento BETWEEN v_janela.dt_ini AND v_janela.dt_fim
  ),
  ramo AS (
    SELECT
      COALESCE(tipo_de_ramo,'Sem Categoria') AS canal,
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
  END IF;

  RETURN jsonb_build_object(
    'janela',   jsonb_build_object('dt_ini', v_janela.dt_ini, 'dt_fim', v_janela.dt_fim),
    'atual',    v_atual,
    'anterior', CASE WHEN p_comparar THEN v_ant ELSE NULL END,
    'cutoff',   v_cutoff,
    'pipeline', (
      SELECT jsonb_build_object(
        'total',    COALESCE(SUM(valor_recebido_a_receber),0),
        'apolices', COUNT(DISTINCT numero_apolice)
      )
      FROM public.vw_lavoro_gerencial
      WHERE lower(status_parcela_comissao)='a vencer' AND data_pagamento > v_cutoff
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_fechamento_sumario(int,text,int,bool) TO authenticated, service_role;
