-- ============ 1. PAGE VIEWS ============
CREATE TABLE IF NOT EXISTS public.user_page_view (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rota text NOT NULL,
  titulo text,
  entrou_em timestamptz NOT NULL DEFAULT now(),
  ultimo_ping_em timestamptz NOT NULL DEFAULT now(),
  duracao_seg integer NOT NULL DEFAULT 0,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_page_view TO authenticated;
GRANT ALL ON public.user_page_view TO service_role;

ALTER TABLE public.user_page_view ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_pageview_insert" ON public.user_page_view;
CREATE POLICY "own_pageview_insert" ON public.user_page_view
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_pageview_update" ON public.user_page_view;
CREATE POLICY "own_pageview_update" ON public.user_page_view
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pageview_select" ON public.user_page_view;
CREATE POLICY "pageview_select" ON public.user_page_view
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

CREATE INDEX IF NOT EXISTS idx_upv_user_data ON public.user_page_view (user_id, entrou_em DESC);
CREATE INDEX IF NOT EXISTS idx_upv_data ON public.user_page_view (entrou_em DESC);

CREATE OR REPLACE FUNCTION public.rpc_registrar_pageview(_rota text, _titulo text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.user_page_view (user_id, rota, titulo, user_agent)
  VALUES (auth.uid(), left(coalesce(_rota,'/'),300), left(_titulo,300), left(_user_agent,400))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_pageview_ping(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_page_view
     SET ultimo_ping_em = now(),
         duracao_seg = LEAST(GREATEST(EXTRACT(EPOCH FROM (now() - entrou_em))::int, 0), 4*3600)
   WHERE id = _id AND user_id = auth.uid();
$$;

-- ============ 2. RELATÓRIOS DE USO ============
CREATE OR REPLACE FUNCTION public.rpc_admin_uso_resumo(_de date, _ate date)
RETURNS TABLE (
  user_id uuid, full_name text, email text, perfil_nome text,
  dias_ativos int, total_paginas int, tempo_total_min numeric,
  primeiro_acesso timestamptz, ultimo_acesso timestamptz,
  dias_sem_acessar int, sessoes int, top_rota text
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
  WITH pv AS (
    SELECT v.user_id, v.rota, v.entrou_em, v.duracao_seg
      FROM public.user_page_view v
     WHERE v.entrou_em::date BETWEEN _de AND _ate
  ), agg AS (
    SELECT pv.user_id,
           count(DISTINCT pv.entrou_em::date)::int AS dias_ativos,
           count(*)::int AS total_paginas,
           round((sum(pv.duracao_seg)::numeric)/60, 1) AS tempo_total_min,
           min(pv.entrou_em) AS primeiro_acesso,
           max(pv.entrou_em) AS ultimo_acesso
      FROM pv GROUP BY pv.user_id
  ), top AS (
    SELECT DISTINCT ON (pv.user_id) pv.user_id, pv.rota, count(*) AS c
      FROM pv GROUP BY pv.user_id, pv.rota ORDER BY pv.user_id, c DESC
  ), ses AS (
    SELECT s.user_id, count(*)::int AS sessoes
      FROM public.user_sessions_log s
     WHERE s.iniciado_em::date BETWEEN _de AND _ate
     GROUP BY s.user_id
  )
  SELECT p.user_id, p.full_name, p.email, pa.nome,
         coalesce(a.dias_ativos,0), coalesce(a.total_paginas,0), coalesce(a.tempo_total_min,0),
         a.primeiro_acesso, coalesce(a.ultimo_acesso, p.ultimo_acesso),
         CASE WHEN coalesce(a.ultimo_acesso, p.ultimo_acesso) IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (now() - coalesce(a.ultimo_acesso, p.ultimo_acesso)))::int END,
         coalesce(sn.sessoes,0), t.rota
    FROM public.profiles p
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
    LEFT JOIN agg a ON a.user_id = p.user_id
    LEFT JOIN top t ON t.user_id = p.user_id
    LEFT JOIN ses sn ON sn.user_id = p.user_id
   ORDER BY coalesce(a.total_paginas,0) DESC, p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_uso_paginas(_de date, _ate date, _user_id uuid DEFAULT NULL)
RETURNS TABLE (user_id uuid, full_name text, email text, rota text, titulo text, acessos int, tempo_min numeric, ultimo_em timestamptz)
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
         count(*)::int, round(sum(v.duracao_seg)::numeric/60,1), max(v.entrou_em)
    FROM public.user_page_view v
    JOIN public.profiles p ON p.user_id = v.user_id
   WHERE v.entrou_em::date BETWEEN _de AND _ate
     AND (_user_id IS NULL OR v.user_id = _user_id)
   GROUP BY v.user_id, p.full_name, p.email, v.rota
   ORDER BY count(*) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_uso_diario(_de date, _ate date, _user_id uuid DEFAULT NULL)
RETURNS TABLE (dia date, user_id uuid, full_name text, email text, paginas int, tempo_min numeric, primeiro_em timestamptz, ultimo_em timestamptz, rotas text[])
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
  SELECT v.entrou_em::date, v.user_id, p.full_name, p.email,
         count(*)::int, round(sum(v.duracao_seg)::numeric/60,1),
         min(v.entrou_em), max(v.entrou_em),
         array_agg(DISTINCT v.rota)
    FROM public.user_page_view v
    JOIN public.profiles p ON p.user_id = v.user_id
   WHERE v.entrou_em::date BETWEEN _de AND _ate
     AND (_user_id IS NULL OR v.user_id = _user_id)
   GROUP BY 1,2,3,4
   ORDER BY 1 DESC, 5 DESC;
END;
$$;

-- ============ 3. AUDITORIA ADMINISTRATIVA ============
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id uuid,
  ator_email text,
  ator_nome text,
  acao text NOT NULL,
  entidade text NOT NULL,
  alvo_id uuid,
  alvo_descricao text,
  antes jsonb,
  depois jsonb,
  mudancas jsonb,
  notificado_em timestamptz,
  notificacao_erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON public.admin_audit_log;
CREATE POLICY "audit_select_admin" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_pendente ON public.admin_audit_log (notificado_em) WHERE notificado_em IS NULL;

CREATE OR REPLACE FUNCTION public.notificar_admin_audit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log WHERE notificado_em IS NULL) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://hub.lavoroseguros.com.br/api/public/hooks/admin-audit-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByaW1teWNka2tpeml5aHFra2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzQ0MDAsImV4cCI6MjA5OTExMDQwMH0._htjVkyhWr21gLcztb873HWu9O2BL0HELTLu1jGrPiQ'
    ),
    body := jsonb_build_object('trigger', 'audit')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_admin_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_mudancas jsonb := '{}'::jsonb;
  v_alvo uuid;
  v_desc text;
  v_ator uuid := auth.uid();
  v_ator_email text;
  v_ator_nome text;
  k text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_antes := to_jsonb(OLD); ELSE v_depois := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN v_antes := to_jsonb(OLD); END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_depois) LOOP
      IF k NOT IN ('updated_at','ultimo_acesso') AND (v_antes -> k) IS DISTINCT FROM (v_depois -> k) THEN
        v_mudancas := v_mudancas || jsonb_build_object(k, jsonb_build_object('antes', v_antes -> k, 'depois', v_depois -> k));
      END IF;
    END LOOP;
    IF v_mudancas = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    v_alvo := coalesce((v_depois->>'user_id')::uuid, (v_antes->>'user_id')::uuid);
    v_desc := coalesce(v_depois->>'email', v_antes->>'email');
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    v_alvo := coalesce((v_depois->>'user_id')::uuid, (v_antes->>'user_id')::uuid);
    SELECT p.email INTO v_desc FROM public.profiles p WHERE p.user_id = v_alvo;
    v_desc := coalesce(v_desc, v_alvo::text) || ' — papel ' || coalesce(v_depois->>'role', v_antes->>'role');
  ELSE
    v_alvo := coalesce((v_depois->>'id')::uuid, (v_antes->>'id')::uuid);
    v_desc := coalesce(v_depois->>'nome', v_antes->>'nome');
  END IF;

  SELECT p.email, p.full_name INTO v_ator_email, v_ator_nome FROM public.profiles p WHERE p.user_id = v_ator;

  INSERT INTO public.admin_audit_log (ator_id, ator_email, ator_nome, acao, entidade, alvo_id, alvo_descricao, antes, depois, mudancas)
  VALUES (v_ator, v_ator_email, v_ator_nome, TG_OP, TG_TABLE_NAME, v_alvo, v_desc, v_antes, v_depois,
          CASE WHEN TG_OP = 'UPDATE' THEN v_mudancas ELSE NULL END);

  PERFORM public.notificar_admin_audit();

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_audit();

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_audit();

DROP TRIGGER IF EXISTS trg_audit_perfis ON public.perfis_acesso;
CREATE TRIGGER trg_audit_perfis
AFTER INSERT OR UPDATE OR DELETE ON public.perfis_acesso
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_audit();

CREATE OR REPLACE FUNCTION public.rpc_admin_audit_listar(_de date, _ate date, _limit int DEFAULT 300)
RETURNS SETOF public.admin_audit_log
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
  SELECT * FROM public.admin_audit_log
   WHERE created_at::date BETWEEN _de AND _ate
   ORDER BY created_at DESC
   LIMIT greatest(1, least(_limit, 2000));
END;
$$;

SELECT cron.unschedule('admin-audit-notify') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-audit-notify');
SELECT cron.schedule('admin-audit-notify', '*/5 * * * *', $$ SELECT public.notificar_admin_audit(); $$);