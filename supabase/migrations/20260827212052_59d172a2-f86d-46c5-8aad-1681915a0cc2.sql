DROP FUNCTION IF EXISTS public.rpc_admin_list_users_v2();
CREATE OR REPLACE FUNCTION public.rpc_admin_list_users_v2()
RETURNS TABLE(user_id uuid, full_name text, email text, blocked boolean, active boolean, primeiro_acesso boolean, perfil_id uuid, perfil_nome text, ultimo_acesso timestamp with time zone, criado_em timestamp with time zone, total_sessoes bigint, tipo_usuario text, roles app_role[], times_receita text[], cpf text, area text, gestor text, empresa text, convite_enviado_em timestamp with time zone, convite_tipo text, convite_aceito_em timestamp with time zone)
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
    COALESCE(p.times_receita, ARRAY[]::text[]),
    p.cpf, p.area, p.gestor, p.empresa,
    (SELECT max(l.created_at) FROM public.user_activity_log l
      WHERE l.user_id = p.user_id AND l.acao = 'admin_convite'),
    (SELECT l.detalhes->>'tipo' FROM public.user_activity_log l
      WHERE l.user_id = p.user_id AND l.acao = 'admin_convite'
      ORDER BY l.created_at DESC LIMIT 1),
    (SELECT min(s.iniciado_em) FROM public.user_sessions_log s WHERE s.user_id = p.user_id)
  FROM public.profiles p
  LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
  WHERE public.has_role(auth.uid(), 'ADMIN')
  ORDER BY p.blocked DESC, p.created_at DESC;
$$;

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
         cpf       = COALESCE(v_cpf_digits, cpf),
         area      = COALESCE(_area, area),
         gestor    = COALESCE(_gestor, gestor),
         empresa   = COALESCE(_empresa, empresa),
         times_receita = COALESCE(_times_receita, times_receita),
         updated_at = now()
   WHERE user_id = _user_id;
END;
$$;