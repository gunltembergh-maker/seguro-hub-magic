
-- Adicionar campos de cadastro completo em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS gestor text,
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS tipo_usuario text NOT NULL DEFAULT 'interno';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles ((regexp_replace(cpf, '\D', '', 'g')))
  WHERE cpf IS NOT NULL AND length(regexp_replace(cpf, '\D', '', 'g')) = 11;

-- RPC: pré-cadastro completo (interno)
CREATE OR REPLACE FUNCTION public.rpc_admin_precadastrar_usuario_full(
  _email text,
  _full_name text,
  _perfil_id uuid,
  _cpf text DEFAULT NULL,
  _area text DEFAULT NULL,
  _gestor text DEFAULT NULL,
  _empresa text DEFAULT NULL,
  _tipo_usuario text DEFAULT 'interno'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_cpf_digits text := NULLIF(regexp_replace(coalesce(_cpf,''), '\D', '', 'g'), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta ação';
  END IF;

  IF v_cpf_digits IS NOT NULL AND length(v_cpf_digits) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  INSERT INTO public.profiles (
    user_id, email, full_name, perfil_id, cpf, area, gestor, empresa, tipo_usuario, blocked, active, primeiro_acesso
  ) VALUES (
    gen_random_uuid(), lower(trim(_email)), _full_name, _perfil_id,
    v_cpf_digits, _area, _gestor, _empresa, coalesce(_tipo_usuario, 'interno'),
    false, true, true
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- RPC: atualizar usuário completo
CREATE OR REPLACE FUNCTION public.rpc_admin_update_user_full(
  _user_id uuid,
  _full_name text,
  _perfil_id uuid,
  _blocked boolean,
  _active boolean,
  _cpf text DEFAULT NULL,
  _area text DEFAULT NULL,
  _gestor text DEFAULT NULL,
  _empresa text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
         updated_at = now()
   WHERE user_id = _user_id;
END;
$$;

-- RPC: detalhe completo do usuário (perfil + sessões + atividades agregadas)
CREATE OR REPLACE FUNCTION public.rpc_admin_detalhe_usuario(
  _user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_perfil jsonb;
  v_total_sessoes int;
  v_total_atividades int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta ação';
  END IF;

  SELECT to_jsonb(p.*) - 'created_at' - 'updated_at' ||
         jsonb_build_object(
           'perfil_nome', pa.nome,
           'created_at', p.created_at
         )
    INTO v_perfil
    FROM public.profiles p
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
   WHERE p.user_id = _user_id;

  SELECT count(*) INTO v_total_sessoes
    FROM public.user_sessions_log WHERE user_id = _user_id;

  SELECT count(*) INTO v_total_atividades
    FROM public.user_activity_log WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'perfil', v_perfil,
    'total_sessoes', v_total_sessoes,
    'total_atividades', v_total_atividades
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_precadastrar_usuario_full(text, text, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_update_user_full(uuid, text, uuid, boolean, boolean, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_detalhe_usuario(uuid) TO authenticated;
