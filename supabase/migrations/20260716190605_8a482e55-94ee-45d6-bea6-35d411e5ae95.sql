
CREATE OR REPLACE FUNCTION public.rpc_buscar_usuarios_hub(p_busca text DEFAULT NULL)
RETURNS TABLE(user_id uuid, nome text, email text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    COALESCE(NULLIF(p.full_name, ''), split_part(p.email,'@',1)) AS nome,
    p.email,
    COALESCE((
      SELECT string_agg(ur.role::text, ', ' ORDER BY ur.role::text)
      FROM public.user_roles ur WHERE ur.user_id = p.user_id
    ), '') AS role
  FROM public.profiles p
  WHERE COALESCE(p.blocked, false) = false
    AND p.email IS NOT NULL AND p.email <> ''
    AND (
      p_busca IS NULL OR p_busca = ''
      OR LOWER(COALESCE(p.full_name,'')) LIKE LOWER('%'||p_busca||'%')
      OR LOWER(p.email) LIKE LOWER('%'||p_busca||'%')
    )
  ORDER BY nome ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_listar_destinatarios_automaticos(p_modulo text)
RETURNS TABLE(
  id uuid, user_id uuid, nome text, email text, role text,
  ativo boolean, criado_em timestamptz, adicionado_por_nome text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Apenas ADMIN pode listar destinatários';
  END IF;
  RETURN QUERY
  SELECT
    eda.id,
    eda.user_id,
    COALESCE(NULLIF(p.full_name,''), split_part(p.email,'@',1)) AS nome,
    p.email,
    COALESCE((
      SELECT string_agg(ur.role::text, ', ' ORDER BY ur.role::text)
      FROM public.user_roles ur WHERE ur.user_id = p.user_id
    ), '') AS role,
    eda.ativo,
    eda.criado_em,
    COALESCE(NULLIF(pp.full_name,''), split_part(pp.email,'@',1)) AS adicionado_por_nome
  FROM public.email_destinatarios_automaticos eda
  JOIN public.profiles p ON p.user_id = eda.user_id
  LEFT JOIN public.profiles pp ON pp.user_id = eda.adicionado_por
  WHERE eda.modulo = p_modulo
  ORDER BY eda.ativo DESC, nome ASC;
END;
$$;
