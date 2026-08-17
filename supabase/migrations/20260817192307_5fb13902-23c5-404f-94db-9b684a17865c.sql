-- 1) Campo de times de receita no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS times_receita text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_times_receita_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_times_receita_valid
  CHECK (times_receita <@ ARRAY['GARANTIA','BENEFICIOS','DEMAIS_RAMOS','TODOS']::text[]);

-- 2) Helper: canais permitidos para um usuário
CREATE OR REPLACE FUNCTION public.lavoro_canais_permitidos(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN ARRAY['Garantia','Benefícios','Demais Ramos']
    WHEN public.has_role(_user_id, 'ADMIN') THEN ARRAY['Garantia','Benefícios','Demais Ramos']
    ELSE COALESCE(
      (SELECT CASE
                WHEN p.times_receita IS NULL
                  OR cardinality(p.times_receita) = 0
                  OR 'TODOS' = ANY(p.times_receita)
                THEN ARRAY['Garantia','Benefícios','Demais Ramos']
                ELSE ARRAY(
                  SELECT DISTINCT CASE x
                           WHEN 'GARANTIA' THEN 'Garantia'
                           WHEN 'BENEFICIOS' THEN 'Benefícios'
                           ELSE 'Demais Ramos'
                         END
                    FROM unnest(p.times_receita) x
                )
              END
         FROM public.profiles p
        WHERE p.user_id = _user_id
        LIMIT 1),
      ARRAY['Garantia','Benefícios','Demais Ramos'])
  END;
$$;

-- 3) Predicado usado pela view. Usa o usuário logado ou, quando informado
--    (newsletters/cron), o destinatário setado em app.canal_user_id.
CREATE OR REPLACE FUNCTION public.lavoro_canal_visivel(p_tipo_de_ramo text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := COALESCE(NULLIF(current_setting('app.canal_user_id', true), '')::uuid, auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN true;
  END IF;
  RETURN public.lavoro_canal(p_tipo_de_ramo) = ANY (public.lavoro_canais_permitidos(v_uid));
END;
$$;

-- 4) View gerencial passa a filtrar pelos canais visíveis
CREATE OR REPLACE VIEW public.vw_lavoro_gerencial AS
SELECT g.id,
    g.grupo,
    g.tomador,
    g.segurado,
    g.documento,
    g.ramo,
    COALESCE(dp.tipo_de_ramo, 'Sem Categoria'::text) AS tipo_de_ramo,
    btrim(g.seguradora) AS seguradora,
    g.numero_apolice,
    g.data_emissao,
    g.inicio_vigencia,
    g.fim_vigencia,
    g.valor_is,
    g.premio_total,
    g.percentual_comissao,
    g.comissao_emitida,
    g.qtd_parcelas,
    g.premio_parcela,
    g.comissao_bruta,
    g.imposto_ret,
    g.valor_iss,
    g.valor_recebido_a_receber,
    g.numero_da_parcela,
    g.tipo_pagamento,
    g.empresa_faturada,
    g.data_pagamento,
    COALESCE(EXTRACT(month FROM g.data_emissao)::integer, g.mes) AS mes,
    COALESCE(EXTRACT(year FROM g.data_emissao)::integer, g.ano) AS ano,
    btrim(g.status_parcela_comissao) AS status_parcela_comissao,
    g.possui_repasse,
    g.percentual_repasse,
    g.valor_repasse_total,
    g.data_repasse,
    g.status_repasse,
    g.observacao,
    g.responsavel,
    COALESCE(g.data_emissao, g.inicio_vigencia) AS data_ajustada,
        CASE
            WHEN g.data_pagamento IS NULL THEN NULL::text
            WHEN EXTRACT(day FROM g.data_pagamento) <= 10::numeric THEN '1-10'::text
            WHEN EXTRACT(day FROM g.data_pagamento) <= 20::numeric THEN '11-20'::text
            ELSE '21-31'::text
        END AS dezena,
    g.sync_id
   FROM raw_lavoro_gerencial g
     LEFT JOIN vw_lavoro_depara_ramo dp ON btrim(lower(dp.ramo)) = btrim(lower(g.ramo))
  WHERE g.sync_id = (( SELECT lavoro_sync_log.sync_id
           FROM lavoro_sync_log
          WHERE lavoro_sync_log.base = 'gerencial'::text AND lavoro_sync_log.status = 'sucesso'::text
          ORDER BY lavoro_sync_log.criado_em DESC
         LIMIT 1))
    AND public.lavoro_canal_visivel(COALESCE(dp.tipo_de_ramo, 'Sem Categoria'::text));

-- 5) Overloads para newsletters: filtram pelo canal do destinatário
CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_kpis(p_ano integer, p_mes integer, p_periodo text, p_user_id uuid)
RETURNS TABLE(receita_competencia numeric, receita_caixa numeric, meta_periodo numeric, atingimento numeric, defasagem numeric, previsto_caixa numeric, atingimento_caixa numeric, previsto_garantia numeric, previsto_beneficios numeric, previsto_demais numeric, caixa_garantia numeric, caixa_beneficios numeric, caixa_demais numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_receita_kpis(p_ano, p_mes, p_periodo);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_receita_executivo_mensal(p_ano integer, p_user_id uuid)
RETURNS TABLE(mes integer, emitido numeric, caixa numeric, caixa_corrente numeric, saldo_vencido numeric, a_receber_futuro numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_receita_executivo_mensal(p_ano);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_receita_executivo_canais(p_ano integer, p_mes integer, p_user_id uuid)
RETURNS TABLE(canal text, caixa numeric, caixa_corrente numeric, a_receber_futuro numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_receita_executivo_canais(p_ano, p_mes);
END;
$$;

-- 6) Admin: listar e atualizar times de receita
DROP FUNCTION IF EXISTS public.rpc_admin_list_users_v2();
CREATE OR REPLACE FUNCTION public.rpc_admin_list_users_v2()
RETURNS TABLE(user_id uuid, full_name text, email text, blocked boolean, active boolean, primeiro_acesso boolean, perfil_id uuid, perfil_nome text, ultimo_acesso timestamp with time zone, criado_em timestamp with time zone, total_sessoes bigint, tipo_usuario text, roles app_role[], times_receita text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.user_id, p.full_name, p.email,
    p.blocked, p.active, p.primeiro_acesso,
    p.perfil_id, pa.nome,
    p.ultimo_acesso, p.created_at,
    (SELECT COUNT(*) FROM public.user_sessions_log s WHERE s.user_id = p.user_id),
    CASE WHEN public.is_dominio_lavoro(p.email) THEN 'interno' ELSE 'externo' END,
    COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.user_id),
             ARRAY[]::public.app_role[]),
    COALESCE(p.times_receita, ARRAY[]::text[])
  FROM public.profiles p
  LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
  WHERE public.has_role(auth.uid(), 'ADMIN')
  ORDER BY p.blocked DESC, p.created_at DESC;
$$;

DROP FUNCTION IF EXISTS public.rpc_admin_update_user_full(uuid, text, uuid, boolean, boolean, text, text, text, text);
CREATE OR REPLACE FUNCTION public.rpc_admin_update_user_full(
  _user_id uuid, _full_name text, _perfil_id uuid, _blocked boolean, _active boolean,
  _cpf text DEFAULT NULL::text, _area text DEFAULT NULL::text, _gestor text DEFAULT NULL::text,
  _empresa text DEFAULT NULL::text, _times_receita text[] DEFAULT NULL::text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf_digits text := NULLIF(regexp_replace(coalesce(_cpf,''), '\D', '', 'g'), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta ação';
  END IF;

  IF v_cpf_digits IS NOT NULL AND length(v_cpf_digits) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  UPDATE public.profiles
     SET full_name = _full_name,
         perfil_id = _perfil_id,
         blocked   = _blocked,
         active    = _active,
         cpf       = v_cpf_digits,
         area      = _area,
         gestor    = _gestor,
         empresa   = _empresa,
         times_receita = COALESCE(_times_receita, times_receita),
         updated_at = now()
   WHERE user_id = _user_id;
END;
$$;

-- 7) Carga inicial
UPDATE public.profiles SET times_receita = ARRAY['GARANTIA','DEMAIS_RAMOS']
 WHERE user_id IN ('17fb7420-f8b8-4e86-86ff-28dfdf9d8476','3aa498bc-b7d2-49ab-a90e-9eafdf17d66d');
UPDATE public.profiles SET times_receita = ARRAY['BENEFICIOS']
 WHERE user_id = '15bd601d-cdc5-4703-b796-3b14296bdb1d';
UPDATE public.profiles SET times_receita = ARRAY['TODOS']
 WHERE user_id IN ('267fb813-fbf0-46cf-8c7b-b35e6847176b','2b4a3a07-eaa1-49ee-a172-8ebd541559af');