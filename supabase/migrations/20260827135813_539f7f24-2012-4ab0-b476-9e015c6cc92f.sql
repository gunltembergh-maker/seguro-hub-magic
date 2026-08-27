DROP FUNCTION IF EXISTS public.rpc_admin_perfil_by_user_id(uuid);

CREATE OR REPLACE FUNCTION public.rpc_admin_perfil_by_user_id(_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, perfil_id uuid, perfil_nome text,
              permissoes jsonb, roles app_role[], times_receita text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.email, p.perfil_id, pa.nome,
         COALESCE(pa.permissoes, '{}'::jsonb),
         COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.user_id),
                  ARRAY[]::public.app_role[]),
         COALESCE(p.times_receita, ARRAY[]::text[])
    FROM public.profiles p
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
   WHERE p.user_id = _user_id
     AND public.has_role(auth.uid(), 'ADMIN');
$$;