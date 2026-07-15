
-- 1) update_user_v2 (permite editar nome)
CREATE OR REPLACE FUNCTION public.rpc_admin_update_user_v2(
  _user_id uuid, _full_name text, _perfil_id uuid, _blocked boolean, _active boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  SELECT full_name, perfil_id, blocked, active INTO v_old FROM public.profiles WHERE user_id = _user_id;

  UPDATE public.profiles
     SET full_name = COALESCE(NULLIF(btrim(_full_name),''), full_name),
         perfil_id = _perfil_id,
         blocked = _blocked,
         active = _active,
         updated_at = now()
   WHERE user_id = _user_id;

  -- espelha bloqueio no auth.users (mesma lógica do rpc_admin_toggle_bloqueio)
  IF v_old.blocked IS DISTINCT FROM _blocked THEN
    UPDATE auth.users
       SET banned_until = CASE WHEN _blocked THEN 'infinity'::timestamptz ELSE NULL END
     WHERE id = _user_id;
  END IF;

  -- log de auditoria
  INSERT INTO public.user_activity_log(user_id, acao, detalhes)
  VALUES (_user_id, 'admin_edit', jsonb_build_object(
    'por', auth.uid(),
    'antes', to_jsonb(v_old),
    'depois', jsonb_build_object('full_name', _full_name, 'perfil_id', _perfil_id, 'blocked', _blocked, 'active', _active)
  ));
END; $$;

-- 2) pré-cadastro de interno (usa a tabela de convites; trigger handle_new_user já aproveita)
CREATE OR REPLACE FUNCTION public.rpc_admin_precadastrar_usuario(
  _email text, _full_name text, _perfil_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_clean text := lower(btrim(_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF v_clean IS NULL OR v_clean = '' THEN RAISE EXCEPTION 'email obrigatorio'; END IF;
  IF _perfil_id IS NULL THEN RAISE EXCEPTION 'perfil obrigatorio'; END IF;

  INSERT INTO public.usuarios_convite_externo(email, perfil_id, criado_por)
  VALUES (v_clean, _perfil_id, auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET perfil_id = EXCLUDED.perfil_id,
        criado_por = auth.uid(),
        criado_em = now(),
        aceito_em = NULL
  RETURNING id INTO v_id;

  -- se o usuário já existe (foi bloqueado por não ter convite), liberar agora
  UPDATE public.profiles
     SET blocked = false, active = true, perfil_id = _perfil_id,
         full_name = COALESCE(NULLIF(btrim(_full_name),''), full_name),
         updated_at = now()
   WHERE lower(email) = v_clean;

  UPDATE auth.users SET banned_until = NULL WHERE lower(email) = v_clean;

  RETURN v_id;
END; $$;

-- 3) log de convite enviado (invite / magiclink / recovery)
CREATE OR REPLACE FUNCTION public.rpc_admin_log_convite(
  _user_id uuid, _tipo text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  INSERT INTO public.user_activity_log(user_id, acao, detalhes)
  VALUES (_user_id, 'admin_convite',
          jsonb_build_object('por', auth.uid(), 'tipo', _tipo, 'em', now()));
END; $$;
