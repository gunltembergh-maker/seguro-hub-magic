UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object('menu_garantia_formulario_admin', false),
    updated_at = now();

UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object('menu_garantia_formulario_admin', true),
    updated_at = now()
WHERE nome = 'Administrador';

CREATE OR REPLACE FUNCTION public.pode_ver_garantia_formulario()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND p.active = true
       AND COALESCE(p.blocked, false) = false
       AND COALESCE((pa.permissoes ->> 'menu_garantia_formulario_admin')::boolean, false) = true
  );
$function$;

GRANT SELECT ON public.garantia_judicial_solicitacoes TO authenticated;

CREATE POLICY "Leitura das demandas de garantia judicial"
ON public.garantia_judicial_solicitacoes
FOR SELECT TO authenticated
USING (public.pode_ver_garantia_formulario());