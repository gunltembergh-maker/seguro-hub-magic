DROP FUNCTION IF EXISTS public.rpc_meu_perfil();

CREATE OR REPLACE FUNCTION public.rpc_meu_perfil()
RETURNS TABLE(
  user_id UUID, full_name TEXT, email TEXT,
  blocked BOOLEAN, active BOOLEAN, primeiro_acesso BOOLEAN,
  perfil_id UUID, perfil_nome TEXT, permissoes JSONB,
  roles public.app_role[], times_receita TEXT[]
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.email, p.blocked, p.active, p.primeiro_acesso,
         p.perfil_id, pa.nome, COALESCE(pa.permissoes,'{}'::jsonb),
         COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.user_id), ARRAY[]::public.app_role[]),
         COALESCE(p.times_receita, ARRAY[]::text[])
    FROM public.profiles p
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
   WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.rpc_meu_perfil() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_meu_perfil() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lavoro_times_usuario(_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN ARRAY[]::text[]
    WHEN public.has_role(_user_id, 'ADMIN') THEN ARRAY[]::text[]
    ELSE COALESCE((
      SELECT CASE
        WHEN p.times_receita IS NULL
          OR cardinality(p.times_receita) = 0
          OR 'TODOS' = ANY(p.times_receita)
        THEN ARRAY[]::text[]
        ELSE p.times_receita
      END
      FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1
    ), ARRAY[]::text[])
  END;
$$;

REVOKE ALL ON FUNCTION public.lavoro_times_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lavoro_times_usuario(uuid) TO authenticated, service_role;