DROP FUNCTION IF EXISTS public.rpc_admin_uso_paginas(date, date, uuid);

CREATE OR REPLACE FUNCTION public.rpc_admin_uso_paginas(_de date, _ate date, _user_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid, full_name text, email text, rota text, titulo text,
  acessos int, tempo_min numeric, ultimo_em timestamptz,
  primeiro_em timestamptz, tempo_min_seg int, tempo_max_seg int, tempo_medio_seg int, dias int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  RETURN QUERY
  SELECT v.user_id, p.full_name, p.email, v.rota, max(v.titulo),
         count(*)::int,
         round(sum(coalesce(v.duracao_seg,0))::numeric/60,1),
         max(v.entrou_em),
         min(v.entrou_em),
         min(coalesce(v.duracao_seg,0))::int,
         max(coalesce(v.duracao_seg,0))::int,
         round(avg(coalesce(v.duracao_seg,0)))::int,
         count(DISTINCT v.entrou_em::date)::int
    FROM public.user_page_view v
    JOIN public.profiles p ON p.user_id = v.user_id
   WHERE v.entrou_em::date BETWEEN _de AND _ate
     AND (_user_id IS NULL OR v.user_id = _user_id)
   GROUP BY v.user_id, p.full_name, p.email, v.rota
   ORDER BY count(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_uso_paginas(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_uso_paginas(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_uso_detalhado(_de date, _ate date, _user_id uuid DEFAULT NULL, _limit int DEFAULT 20000)
RETURNS TABLE (
  user_id uuid, full_name text, email text, perfil_nome text,
  dia date, rota text, area text, subpagina text, titulo text,
  entrou_em timestamptz, ultimo_ping_em timestamptz, duracao_seg int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  RETURN QUERY
  SELECT v.user_id, p.full_name, p.email, pa.nome,
         v.entrou_em::date,
         v.rota,
         coalesce(nullif(split_part(trim(both '/' from v.rota), '/', 1), ''), 'inicio') AS area,
         nullif(
           trim(both '/' from substring(trim(both '/' from v.rota)
             from length(coalesce(nullif(split_part(trim(both '/' from v.rota), '/', 1), ''), '')) + 1)),
           '') AS subpagina,
         v.titulo,
         v.entrou_em,
         v.ultimo_ping_em,
         coalesce(v.duracao_seg, 0)::int
    FROM public.user_page_view v
    JOIN public.profiles p ON p.user_id = v.user_id
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
   WHERE v.entrou_em::date BETWEEN _de AND _ate
     AND (_user_id IS NULL OR v.user_id = _user_id)
   ORDER BY v.entrou_em DESC
   LIMIT _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_uso_detalhado(date, date, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_uso_detalhado(date, date, uuid, int) TO authenticated;