-- =====================================================================
-- Refaz as 3 tabelas de e-mail no padrão Hub Tailor (user_id + join profiles)
-- =====================================================================

DROP TABLE IF EXISTS public.email_destinatarios_automaticos CASCADE;
DROP TABLE IF EXISTS public.email_disparos_automaticos CASCADE;
DROP TABLE IF EXISTS public.email_schedules_config CASCADE;

-- ---------- destinatarios ----------
CREATE TABLE public.email_destinatarios_automaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  adicionado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, modulo)
);
CREATE INDEX idx_email_dest_modulo_ativo ON public.email_destinatarios_automaticos(modulo, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_destinatarios_automaticos TO authenticated;
GRANT ALL ON public.email_destinatarios_automaticos TO service_role;
ALTER TABLE public.email_destinatarios_automaticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dest_admin_all" ON public.email_destinatarios_automaticos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));
CREATE POLICY "dest_service" ON public.email_destinatarios_automaticos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- schedules ----------
CREATE TABLE public.email_schedules_config (
  modulo text PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  hora_brt time NOT NULL DEFAULT '08:30:00',
  dias_semana int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  pausado_por uuid,
  pausado_em timestamptz,
  motivo_pausa text,
  cron_jobid bigint,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_schedules_config TO authenticated;
GRANT ALL ON public.email_schedules_config TO service_role;
ALTER TABLE public.email_schedules_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_admin_all" ON public.email_schedules_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));
CREATE POLICY "sched_service" ON public.email_schedules_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.email_schedules_config (modulo, ativo, hora_brt, dias_semana) VALUES
  ('receita_lavoro',    false, '08:30:00', '{1,2,3,4,5}'),
  ('executivo_lavoro',  false, '08:30:00', '{1}'),
  ('fechamento_lavoro', false, '08:30:00', '{1,2,3,4,5}')
ON CONFLICT (modulo) DO NOTHING;

-- ---------- disparos ----------
CREATE TABLE public.email_disparos_automaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  data_envio date NOT NULL,
  disparado_em timestamptz NOT NULL DEFAULT now(),
  total_destinatarios int NOT NULL DEFAULT 0,
  total_sucessos int NOT NULL DEFAULT 0,
  total_falhas int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_processamento',
  forcado_por uuid,
  detalhes_erro jsonb,
  finalizado_em timestamptz,
  periodo_ref text
);
CREATE INDEX idx_email_disparos_modulo_data ON public.email_disparos_automaticos(modulo, data_envio DESC);
-- Só o disparo automático tem unicidade por dia; manual pode repetir.
CREATE UNIQUE INDEX ux_email_disparos_auto_dia
  ON public.email_disparos_automaticos(modulo, data_envio)
  WHERE forcado_por IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_disparos_automaticos TO authenticated;
GRANT ALL ON public.email_disparos_automaticos TO service_role;
ALTER TABLE public.email_disparos_automaticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disp_admin_all" ON public.email_disparos_automaticos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));
CREATE POLICY "disp_service" ON public.email_disparos_automaticos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- RPCs
-- =====================================================================

-- Buscar usuários do Hub (para modal de adicionar destinatário)
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
    COALESCE(ur.role::text, '') AS role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
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
GRANT EXECUTE ON FUNCTION public.rpc_buscar_usuarios_hub(text) TO authenticated;

-- Listar destinatários por módulo
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
    COALESCE(ur.role::text,'') AS role,
    eda.ativo,
    eda.criado_em,
    COALESCE(NULLIF(pp.full_name,''), split_part(pp.email,'@',1)) AS adicionado_por_nome
  FROM public.email_destinatarios_automaticos eda
  JOIN public.profiles p ON p.user_id = eda.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  LEFT JOIN public.profiles pp ON pp.user_id = eda.adicionado_por
  WHERE eda.modulo = p_modulo
  ORDER BY eda.ativo DESC, nome ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_listar_destinatarios_automaticos(text) TO authenticated;

-- Adicionar destinatário
CREATE OR REPLACE FUNCTION public.rpc_adicionar_destinatario_automatico(p_user_id uuid, p_modulo text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Apenas ADMIN pode adicionar destinatários';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
  INSERT INTO public.email_destinatarios_automaticos AS eda (user_id, modulo, ativo, adicionado_por)
  VALUES (p_user_id, p_modulo, true, auth.uid())
  ON CONFLICT (user_id, modulo) DO UPDATE
    SET ativo = true, atualizado_em = now(), adicionado_por = EXCLUDED.adicionado_por
  RETURNING eda.id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_adicionar_destinatario_automatico(uuid, text) TO authenticated;

-- Remover destinatário
CREATE OR REPLACE FUNCTION public.rpc_remover_destinatario_automatico(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Apenas ADMIN pode remover destinatários';
  END IF;
  DELETE FROM public.email_destinatarios_automaticos WHERE id = p_id;
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_remover_destinatario_automatico(uuid) TO authenticated;

-- Toggle pause / resume
CREATE OR REPLACE FUNCTION public.rpc_toggle_schedule(p_modulo text, p_motivo text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_novo boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Apenas ADMIN pode controlar schedules';
  END IF;
  SELECT NOT esc.ativo INTO v_novo FROM public.email_schedules_config esc WHERE esc.modulo = p_modulo;
  IF v_novo IS NULL THEN RAISE EXCEPTION 'Módulo % não configurado', p_modulo; END IF;
  UPDATE public.email_schedules_config esc
    SET ativo = v_novo,
        pausado_por = CASE WHEN NOT v_novo THEN auth.uid() ELSE NULL END,
        pausado_em  = CASE WHEN NOT v_novo THEN now()     ELSE NULL END,
        motivo_pausa = CASE WHEN NOT v_novo THEN p_motivo ELSE NULL END,
        atualizado_em = now()
    WHERE esc.modulo = p_modulo;
  RETURN v_novo;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_schedule(text, text) TO authenticated;

-- Atualizar horário/dias/ativo do schedule
CREATE OR REPLACE FUNCTION public.rpc_atualizar_schedule_config(
  p_modulo text, p_hora_brt time, p_dias_semana int[], p_ativo boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação requerida'; END IF;
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Apenas ADMIN pode alterar schedules';
  END IF;
  IF array_length(p_dias_semana,1) IS NULL OR array_length(p_dias_semana,1) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um dia da semana';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_dias_semana) d WHERE d < 0 OR d > 6) THEN
    RAISE EXCEPTION 'dias_semana inválidos. Use 0=Dom até 6=Sáb';
  END IF;
  UPDATE public.email_schedules_config
    SET hora_brt = p_hora_brt,
        dias_semana = p_dias_semana,
        ativo = p_ativo,
        atualizado_em = now()
    WHERE modulo = p_modulo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Módulo não encontrado: %', p_modulo; END IF;
  RETURN jsonb_build_object('sucesso', true, 'modulo', p_modulo,
    'hora_brt', p_hora_brt::text, 'dias_semana', p_dias_semana, 'ativo', p_ativo);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_atualizar_schedule_config(text, time, int[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_atualizar_schedule_config(text, time, int[], boolean) TO authenticated;

-- Próxima execução (considera feriados nacionais)
CREATE OR REPLACE FUNCTION public.rpc_proxima_execucao_schedule(p_modulo text)
RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v RECORD; v_data date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
        v_prox timestamptz; v_i int := 0;
BEGIN
  SELECT * INTO v FROM public.email_schedules_config WHERE modulo = p_modulo;
  IF NOT FOUND OR NOT v.ativo THEN RETURN NULL; END IF;
  WHILE v_i < 30 LOOP
    IF EXTRACT(DOW FROM v_data)::int = ANY(v.dias_semana)
       AND NOT EXISTS (SELECT 1 FROM public.feriados_nacionais f WHERE f.data = v_data) THEN
      v_prox := (v_data + v.hora_brt) AT TIME ZONE 'America/Sao_Paulo';
      IF v_prox > now() THEN RETURN v_prox; END IF;
    END IF;
    v_data := v_data + 1; v_i := v_i + 1;
  END LOOP;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_proxima_execucao_schedule(text) TO authenticated;

-- Histórico de disparos
CREATE OR REPLACE FUNCTION public.rpc_historico_disparos(p_modulo text, p_limit int DEFAULT 30)
RETURNS TABLE(
  id uuid, data_envio date, disparado_em timestamptz,
  total_destinatarios int, total_sucessos int, total_falhas int,
  status text, forcado_por_nome text, finalizado_em timestamptz, detalhes_erro jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Apenas ADMIN pode ver histórico';
  END IF;
  RETURN QUERY
  SELECT
    eda.id, eda.data_envio, eda.disparado_em,
    eda.total_destinatarios, eda.total_sucessos, eda.total_falhas,
    eda.status,
    COALESCE(NULLIF(p.full_name,''), split_part(p.email,'@',1)) AS forcado_por_nome,
    eda.finalizado_em, eda.detalhes_erro
  FROM public.email_disparos_automaticos eda
  LEFT JOIN public.profiles p ON p.user_id = eda.forcado_por
  WHERE eda.modulo = p_modulo
  ORDER BY eda.disparado_em DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_historico_disparos(text, int) TO authenticated;