CREATE OR REPLACE FUNCTION public.lavoro_pode_ver_canal_para(p_user_id uuid, p_canal text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.lavoro_canal(p_canal) = ANY (public.lavoro_canais_permitidos(p_user_id));
$$;

CREATE OR REPLACE FUNCTION public.lavoro_pode_ver_canal(p_canal text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE public.lavoro_pode_ver_canal_para(auth.uid(), p_canal)
  END;
$$;

UPDATE public.profiles
   SET times_receita = ARRAY[]::text[]
 WHERE times_receita @> ARRAY['TODOS'];