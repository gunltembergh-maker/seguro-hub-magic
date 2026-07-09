
-- Batched import RPCs to avoid statement timeout on large uploads

CREATE OR REPLACE FUNCTION public.rpc_admin_gerencial_reset()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sync uuid := gen_random_uuid();
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'gerencial') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  DELETE FROM public.raw_lavoro_gerencial;
  DELETE FROM public.raw_lavoro_depara_ramo;
  RETURN v_sync;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_gerencial_append(_rows jsonb, _sync_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'gerencial') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  INSERT INTO public.raw_lavoro_gerencial(
    grupo, tomador, segurado, documento, ramo, seguradora, numero_apolice,
    data_emissao, inicio_vigencia, fim_vigencia, periodo_atualizacao,
    valor_is, premio_total, percentual_comissao, comissao_emitida, qtd_parcelas,
    premio_parcela, comissao_bruta, imposto_ret, valor_iss, valor_recebido_a_receber,
    numero_da_parcela, tipo_pagamento, empresa_faturada, data_pagamento, mes, ano,
    fat_competencia, status_parcela_comissao, analise, possui_repasse, percentual_repasse,
    parcelas, percentual_imposto, valor_repasse_total, data_repasse, status_repasse,
    observacao, card_id, responsavel, data_card_finalizado, sync_id
  )
  SELECT
    r->>'grupo', r->>'tomador', r->>'segurado', r->>'documento', r->>'ramo',
    r->>'seguradora', r->>'numero_apolice',
    NULLIF(r->>'data_emissao','')::date, NULLIF(r->>'inicio_vigencia','')::date, NULLIF(r->>'fim_vigencia','')::date,
    r->>'periodo_atualizacao',
    NULLIF(r->>'valor_is','')::numeric, NULLIF(r->>'premio_total','')::numeric,
    NULLIF(r->>'percentual_comissao','')::numeric, NULLIF(r->>'comissao_emitida','')::numeric,
    NULLIF(r->>'qtd_parcelas','')::int,
    NULLIF(r->>'premio_parcela','')::numeric, NULLIF(r->>'comissao_bruta','')::numeric,
    NULLIF(r->>'imposto_ret','')::numeric, NULLIF(r->>'valor_iss','')::numeric,
    NULLIF(r->>'valor_recebido_a_receber','')::numeric,
    NULLIF(r->>'numero_da_parcela','')::int, r->>'tipo_pagamento', r->>'empresa_faturada',
    NULLIF(r->>'data_pagamento','')::date, NULLIF(r->>'mes','')::int, NULLIF(r->>'ano','')::int,
    r->>'fat_competencia', r->>'status_parcela_comissao', r->>'analise', r->>'possui_repasse',
    NULLIF(r->>'percentual_repasse','')::numeric, r->>'parcelas',
    NULLIF(r->>'percentual_imposto','')::numeric, NULLIF(r->>'valor_repasse_total','')::numeric,
    NULLIF(r->>'data_repasse','')::date, r->>'status_repasse',
    r->>'observacao', r->>'card_id', r->>'responsavel', NULLIF(r->>'data_card_finalizado','')::date,
    _sync_id
  FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) r;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_ramo_append(_rows jsonb, _sync_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'gerencial') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  INSERT INTO public.raw_lavoro_depara_ramo(ramo, tipo_de_ramo, sync_id)
  SELECT r->>'ramo', r->>'tipo_de_ramo', _sync_id
  FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) r
  WHERE r->>'ramo' IS NOT NULL AND r->>'tipo_de_ramo' IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_caixa_reset()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sync uuid := gen_random_uuid();
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'caixa') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  DELETE FROM public.raw_lavoro_caixa_comissao;
  RETURN v_sync;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_caixa_append(_rows jsonb, _sync_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'caixa') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  INSERT INTO public.raw_lavoro_caixa_comissao(
    tipo_lancamento, mes_referencia, data_pagamento, descricao, valor, categoria,
    sub_categoria, referencia, observacoes, data_emissao_nota_fiscal, sync_id
  )
  SELECT
    r->>'tipo_lancamento', r->>'mes_referencia',
    NULLIF(r->>'data_pagamento','')::date,
    r->>'descricao', NULLIF(r->>'valor','')::numeric,
    r->>'categoria', r->>'sub_categoria', r->>'referencia',
    r->>'observacoes', NULLIF(r->>'data_emissao_nota_fiscal','')::date,
    _sync_id
  FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) r;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;
