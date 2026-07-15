
-- Drop função existente para permitir troca de assinatura
DROP FUNCTION IF EXISTS public.rpc_admin_perfil_by_user_id(uuid);

-- ============ Tabela de convite externo ============
CREATE TABLE IF NOT EXISTS public.usuarios_convite_externo (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  perfil_id uuid references public.perfis_acesso(id) on delete set null,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios_convite_externo TO authenticated;
GRANT ALL ON public.usuarios_convite_externo TO service_role;

ALTER TABLE public.usuarios_convite_externo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gerencia convites externo" ON public.usuarios_convite_externo;
CREATE POLICY "admin gerencia convites externo"
  ON public.usuarios_convite_externo
  FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- ============ Regra de e-mail permitido ============
CREATE OR REPLACE FUNCTION public.is_email_permitido(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_dominio_lavoro(_email)
      OR EXISTS (SELECT 1 FROM public.usuarios_convite_externo
                 WHERE lower(email) = lower(_email));
$$;

-- ============ handle_new_user atualizado ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permitido boolean;
  v_convite_perfil uuid;
BEGIN
  v_permitido := public.is_email_permitido(NEW.email);

  IF NOT v_permitido THEN
    UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = NEW.id;
    INSERT INTO public.notificacoes_admin(tipo, titulo, mensagem, dados)
    VALUES ('acesso_negado_dominio',
            'Tentativa de acesso de domínio não autorizado',
            'Usuário com e-mail '||NEW.email||' tentou acessar e foi bloqueado.',
            jsonb_build_object('user_id', NEW.id, 'email', NEW.email));
    RETURN NEW;
  END IF;

  SELECT perfil_id INTO v_convite_perfil
    FROM public.usuarios_convite_externo
   WHERE lower(email) = lower(NEW.email);

  INSERT INTO public.profiles(user_id, full_name, email, blocked, active, primeiro_acesso, perfil_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    CASE WHEN v_convite_perfil IS NOT NULL THEN false ELSE true END,
    CASE WHEN v_convite_perfil IS NOT NULL THEN true  ELSE false END,
    true,
    v_convite_perfil
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF v_convite_perfil IS NOT NULL THEN
    UPDATE public.usuarios_convite_externo
       SET aceito_em = now()
     WHERE lower(email) = lower(NEW.email);
  END IF;

  INSERT INTO public.notificacoes_admin(tipo, titulo, mensagem, dados)
  VALUES (
    CASE WHEN v_convite_perfil IS NOT NULL THEN 'convite_externo_aceito' ELSE 'solicitacao_acesso' END,
    CASE WHEN v_convite_perfil IS NOT NULL THEN 'Convite externo aceito' ELSE 'Nova solicitação de acesso' END,
    CASE WHEN v_convite_perfil IS NOT NULL
         THEN 'Usuário externo '||NEW.email||' entrou pela primeira vez.'
         ELSE 'Novo colaborador aguardando aprovação: '||NEW.email END,
    jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
  );

  RETURN NEW;
END; $$;

-- ============ Listagem estendida ============
CREATE OR REPLACE FUNCTION public.rpc_admin_list_users_v2()
RETURNS TABLE(
  user_id uuid, full_name text, email text,
  blocked boolean, active boolean, primeiro_acesso boolean,
  perfil_id uuid, perfil_nome text,
  ultimo_acesso timestamptz, criado_em timestamptz,
  total_sessoes bigint,
  tipo_usuario text,
  roles app_role[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id, p.full_name, p.email,
    p.blocked, p.active, p.primeiro_acesso,
    p.perfil_id, pa.nome,
    p.ultimo_acesso, p.created_at,
    (SELECT COUNT(*) FROM public.user_sessions_log s WHERE s.user_id = p.user_id),
    CASE WHEN public.is_dominio_lavoro(p.email) THEN 'interno' ELSE 'externo' END,
    COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.user_id),
             ARRAY[]::public.app_role[])
  FROM public.profiles p
  LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
  WHERE public.has_role(auth.uid(), 'ADMIN')
  ORDER BY p.blocked DESC, p.created_at DESC;
$$;

-- ============ Bloquear/desbloquear ============
CREATE OR REPLACE FUNCTION public.rpc_admin_toggle_bloqueio(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  UPDATE public.profiles
     SET blocked = _blocked,
         active  = CASE WHEN _blocked THEN false ELSE true END,
         updated_at = now()
   WHERE user_id = _user_id;
  IF _blocked THEN
    UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = _user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = _user_id;
  END IF;
END; $$;

-- ============ Excluir usuário ============
CREATE OR REPLACE FUNCTION public.rpc_admin_excluir_usuario(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'nao pode excluir o proprio usuario'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.user_sessions_log WHERE user_id = _user_id;
  DELETE FROM public.user_activity_log WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;
  UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = _user_id;
END; $$;

-- ============ Convidar externo ============
CREATE OR REPLACE FUNCTION public.rpc_admin_convidar_externo(_email text, _perfil_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  INSERT INTO public.usuarios_convite_externo(email, perfil_id, criado_por)
  VALUES (lower(btrim(_email)), _perfil_id, auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET perfil_id = EXCLUDED.perfil_id,
        criado_por = auth.uid(),
        criado_em = now(),
        aceito_em = NULL
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ============ Listar convites externos ============
CREATE OR REPLACE FUNCTION public.rpc_admin_list_convites_externo()
RETURNS TABLE(id uuid, email text, perfil_id uuid, perfil_nome text,
              criado_em timestamptz, aceito_em timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.email, c.perfil_id, pa.nome, c.criado_em, c.aceito_em
    FROM public.usuarios_convite_externo c
    LEFT JOIN public.perfis_acesso pa ON pa.id = c.perfil_id
   WHERE public.has_role(auth.uid(), 'ADMIN')
   ORDER BY c.criado_em DESC;
$$;

-- ============ Remover convite externo ============
CREATE OR REPLACE FUNCTION public.rpc_admin_remover_convite_externo(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  DELETE FROM public.usuarios_convite_externo WHERE id = _id;
END; $$;

-- ============ Atividade do usuário ============
CREATE OR REPLACE FUNCTION public.rpc_admin_atividade_usuario(_user_id uuid, _limit integer DEFAULT 50)
RETURNS TABLE(tipo text, momento timestamptz, detalhes jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  RETURN QUERY
    WITH x AS (
      SELECT 'sessao'::text AS tipo, iniciado_em AS momento,
             jsonb_build_object('ip', ip, 'user_agent', user_agent) AS detalhes
        FROM public.user_sessions_log WHERE user_id = _user_id
      UNION ALL
      SELECT acao::text, created_at, detalhes
        FROM public.user_activity_log WHERE user_id = _user_id
    )
    SELECT x.tipo, x.momento, x.detalhes
      FROM x
     ORDER BY x.momento DESC
     LIMIT _limit;
END; $$;

-- ============ Perfil por user_id ============
CREATE OR REPLACE FUNCTION public.rpc_admin_perfil_by_user_id(_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, perfil_id uuid, perfil_nome text,
              permissoes jsonb, roles app_role[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.email, p.perfil_id, pa.nome,
         COALESCE(pa.permissoes, '{}'::jsonb),
         COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.user_id),
                  ARRAY[]::public.app_role[])
    FROM public.profiles p
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
   WHERE p.user_id = _user_id
     AND public.has_role(auth.uid(), 'ADMIN');
$$;
