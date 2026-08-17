-- 1) Nova semântica: vazio/NULL = nenhum canal; 'TODOS' = todos
CREATE OR REPLACE FUNCTION public.lavoro_canais_permitidos(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL THEN ARRAY['Garantia','Benefícios','Demais Ramos']
    WHEN public.has_role(_user_id, 'ADMIN') THEN ARRAY['Garantia','Benefícios','Demais Ramos']
    ELSE COALESCE(
      (SELECT CASE
                WHEN p.times_receita IS NULL OR cardinality(p.times_receita) = 0
                  THEN ARRAY[]::text[]
                WHEN 'TODOS' = ANY(p.times_receita)
                  THEN ARRAY['Garantia','Benefícios','Demais Ramos']
                ELSE ARRAY(
                  SELECT DISTINCT CASE x
                           WHEN 'GARANTIA' THEN 'Garantia'
                           WHEN 'BENEFICIOS' THEN 'Benefícios'
                           WHEN 'DEMAIS_RAMOS' THEN 'Demais Ramos'
                           ELSE NULL
                         END
                    FROM unnest(p.times_receita) x
                   WHERE x IN ('GARANTIA','BENEFICIOS','DEMAIS_RAMOS')
                )
              END
         FROM public.profiles p
        WHERE p.user_id = _user_id
        LIMIT 1),
      ARRAY[]::text[])
  END;
$function$;

-- lavoro_times_usuario: [] = sem restrição (admin/TODOS); 'NENHUM' = sem acesso
CREATE OR REPLACE FUNCTION public.lavoro_times_usuario(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL THEN ARRAY[]::text[]
    WHEN public.has_role(_user_id, 'ADMIN') THEN ARRAY[]::text[]
    ELSE COALESCE((
      SELECT CASE
        WHEN p.times_receita IS NULL OR cardinality(p.times_receita) = 0
          THEN ARRAY['NENHUM']::text[]
        WHEN 'TODOS' = ANY(p.times_receita)
          THEN ARRAY[]::text[]
        ELSE p.times_receita
      END
      FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1
    ), ARRAY['NENHUM']::text[])
  END;
$function$;

-- 2) Seed de papéis
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'ADMIN'::public.app_role
  FROM public.profiles p
 WHERE lower(p.email) = 'kauan.iury@lavoroseguros.com.br'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'COLABORADOR'::public.app_role
  FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Seed de times
UPDATE public.profiles SET times_receita = ARRAY['TODOS']::text[]
 WHERE lower(email) IN ('boyer@lavoroseguros.com.br','joice.silva@lavoroseguros.com.br');

UPDATE public.profiles SET times_receita = ARRAY[]::text[]
 WHERE lower(email) = 'andrea.massena@lavoroseguros.com.br';
