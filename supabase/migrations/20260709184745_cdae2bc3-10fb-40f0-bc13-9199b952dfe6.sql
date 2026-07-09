
-- Lista de usuários com nome do perfil
CREATE OR REPLACE FUNCTION public.rpc_admin_list_users()
RETURNS TABLE(user_id uuid, full_name text, email text, blocked boolean, active boolean, perfil_id uuid, perfil_nome text, ultimo_acesso timestamptz, criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.email, p.blocked, p.active, p.perfil_id, pa.nome, p.ultimo_acesso, p.created_at
  FROM public.profiles p
  LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
  WHERE public.has_role(auth.uid(), 'ADMIN')
  ORDER BY p.blocked DESC, p.created_at DESC;
$$;

-- Lista de perfis (todos autenticados podem ler para popular dropdowns)
CREATE OR REPLACE FUNCTION public.rpc_admin_list_perfis()
RETURNS TABLE(id uuid, nome text, descricao text, permissoes jsonb, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, descricao, permissoes, created_at, updated_at
  FROM public.perfis_acesso
  WHERE auth.uid() IS NOT NULL
  ORDER BY nome;
$$;

-- Aprovar usuário
CREATE OR REPLACE FUNCTION public.rpc_admin_approve_user(_user_id uuid, _perfil_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  UPDATE public.profiles
     SET blocked = false, active = true, perfil_id = _perfil_id, updated_at = now()
   WHERE user_id = _user_id;
END; $$;

-- Editar usuário
CREATE OR REPLACE FUNCTION public.rpc_admin_update_user(_user_id uuid, _perfil_id uuid, _blocked boolean, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  UPDATE public.profiles
     SET perfil_id = _perfil_id, blocked = _blocked, active = _active, updated_at = now()
   WHERE user_id = _user_id;
END; $$;

-- Upsert de perfil de acesso
CREATE OR REPLACE FUNCTION public.rpc_admin_upsert_perfil(_id uuid, _nome text, _descricao text, _permissoes jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.perfis_acesso(nome, descricao, permissoes)
    VALUES (_nome, _descricao, COALESCE(_permissoes, '{}'::jsonb))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.perfis_acesso
       SET nome = _nome, descricao = _descricao, permissoes = COALESCE(_permissoes,'{}'::jsonb), updated_at = now()
     WHERE id = _id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

-- Excluir perfil (bloqueia Admin/Diretoria Geral)
CREATE OR REPLACE FUNCTION public.rpc_admin_delete_perfil(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  SELECT nome INTO v_nome FROM public.perfis_acesso WHERE id = _id;
  IF v_nome IN ('Admin','Diretoria Geral') THEN
    RAISE EXCEPTION 'perfil protegido';
  END IF;
  DELETE FROM public.perfis_acesso WHERE id = _id;
END; $$;

-- Ingestão Gerencial + De-Para (substitui tudo)
CREATE OR REPLACE FUNCTION public.rpc_admin_ingest_gerencial(_rows jsonb, _ramo_rows jsonb)
RETURNS TABLE(sync_id uuid, linhas_gerencial int, linhas_ramo int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sync uuid := gen_random_uuid(); v_ger int; v_ramo int;
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'gerencial') THEN RAISE EXCEPTION 'sem permissao'; END IF;

  DELETE FROM public.raw_lavoro_gerencial;
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
    v_sync
  FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) r;
  GET DIAGNOSTICS v_ger = ROW_COUNT;

  DELETE FROM public.raw_lavoro_depara_ramo;
  INSERT INTO public.raw_lavoro_depara_ramo(ramo, tipo_de_ramo, sync_id)
  SELECT r->>'ramo', r->>'tipo_de_ramo', v_sync
  FROM jsonb_array_elements(COALESCE(_ramo_rows,'[]'::jsonb)) r
  WHERE r->>'ramo' IS NOT NULL AND r->>'tipo_de_ramo' IS NOT NULL;
  GET DIAGNOSTICS v_ramo = ROW_COUNT;

  RETURN QUERY SELECT v_sync, v_ger, v_ramo;
END; $$;

-- Ingestão Caixa (substitui tudo)
CREATE OR REPLACE FUNCTION public.rpc_admin_ingest_caixa(_rows jsonb)
RETURNS TABLE(sync_id uuid, linhas int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sync uuid := gen_random_uuid(); v_c int;
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'caixa') THEN RAISE EXCEPTION 'sem permissao'; END IF;

  DELETE FROM public.raw_lavoro_caixa_comissao;
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
    v_sync
  FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) r;
  GET DIAGNOSTICS v_c = ROW_COUNT;

  RETURN QUERY SELECT v_sync, v_c;
END; $$;

-- Última importação de cada base
CREATE OR REPLACE FUNCTION public.rpc_admin_last_import(_tipo text)
RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ts timestamptz;
BEGIN
  IF _tipo = 'gerencial' THEN
    SELECT MAX(criado_em) INTO v_ts FROM public.raw_lavoro_gerencial;
  ELSIF _tipo = 'caixa' THEN
    SELECT MAX(criado_em) INTO v_ts FROM public.raw_lavoro_caixa_comissao;
  END IF;
  RETURN v_ts;
END; $$;
