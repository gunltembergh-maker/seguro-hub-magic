
-- ================================
-- FASE 3: Comunicados / Popup
-- ================================

-- admin_rotas: catálogo de páginas
CREATE TABLE IF NOT EXISTS public.admin_rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota text NOT NULL UNIQUE,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.admin_rotas TO authenticated;
GRANT ALL ON public.admin_rotas TO service_role;
ALTER TABLE public.admin_rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem admin_rotas" ON public.admin_rotas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia admin_rotas" ON public.admin_rotas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

INSERT INTO public.admin_rotas(rota, nome) VALUES
  ('/hub', 'Início'),
  ('/dashboards/receita', 'Dashboard Receita'),
  ('/dashboards/caixa', 'Dashboard Caixa'),
  ('/dashboards/executivo', 'Dashboard Executivo'),
  ('/dashboards/fechamento', 'Dashboard Fechamento'),
  ('/admin/usuarios', 'Gestão de Usuários'),
  ('/admin/perfis', 'Perfis de Acesso'),
  ('/admin/importar-bases', 'Importar Bases'),
  ('/admin/comunicados', 'Comunicados'),
  ('/admin/emails', 'Emails')
ON CONFLICT (rota) DO NOTHING;

-- admin_popups
CREATE TABLE IF NOT EXISTS public.admin_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  perfis text[],
  destinatarios text[],
  paginas text[],
  cor_fundo text DEFAULT '#14405C',
  cor_texto text DEFAULT '#FFFFFF',
  botao_label text DEFAULT 'Entendido!',
  logo_url text,
  mostrar_nome_hub boolean DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_popups TO authenticated;
GRANT ALL ON public.admin_popups TO service_role;
ALTER TABLE public.admin_popups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem admin_popups" ON public.admin_popups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia admin_popups" ON public.admin_popups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- admin_popup_dismissals
CREATE TABLE IF NOT EXISTS public.admin_popup_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id uuid NOT NULL REFERENCES public.admin_popups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(popup_id, user_id)
);

GRANT SELECT, INSERT ON public.admin_popup_dismissals TO authenticated;
GRANT ALL ON public.admin_popup_dismissals TO service_role;
ALTER TABLE public.admin_popup_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas dispensas" ON public.admin_popup_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Usuário cria suas dispensas" ON public.admin_popup_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin vê todas dispensas" ON public.admin_popup_dismissals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ================================
-- RPCs Comunicados
-- ================================

CREATE OR REPLACE FUNCTION public.rpc_admin_listar_rotas()
RETURNS TABLE(rota text, nome text, ativo boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.rota, r.nome, r.ativo FROM admin_rotas r WHERE r.ativo = true ORDER BY r.nome;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_listar_rotas() TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_get_popups_ativos(p_pagina text DEFAULT NULL)
RETURNS TABLE(
  id uuid, titulo text, mensagem text, paginas text[],
  cor_fundo text, cor_texto text, botao_label text,
  data_fim timestamptz, logo_url text, mostrar_nome_hub boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.titulo, p.mensagem, p.paginas,
    p.cor_fundo, p.cor_texto, p.botao_label, p.data_fim,
    p.logo_url, p.mostrar_nome_hub
  FROM public.admin_popups p
  WHERE p.ativo = true
    AND p.data_inicio <= now()
    AND (p.data_fim IS NULL OR p.data_fim >= now())
    AND (p.paginas IS NULL OR array_length(p.paginas,1) IS NULL OR p_pagina = ANY(p.paginas))
    AND (
      p.destinatarios IS NULL OR array_length(p.destinatarios,1) IS NULL OR
      (SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) = ANY(p.destinatarios)
    )
    AND (
      p.perfis IS NULL OR array_length(p.perfis,1) IS NULL OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role::text = ANY(p.perfis)
      )
    )
    AND p.id NOT IN (
      SELECT popup_id FROM public.admin_popup_dismissals WHERE user_id = auth.uid()
    )
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_popups_ativos(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_dispensar_popup(p_popup_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_popup_dismissals(popup_id, user_id)
  VALUES (p_popup_id, auth.uid())
  ON CONFLICT (popup_id, user_id) DO NOTHING;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_dispensar_popup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_listar_popups()
RETURNS TABLE(
  id uuid, titulo text, mensagem text, ativo boolean,
  data_inicio timestamptz, data_fim timestamptz,
  perfis text[], destinatarios text[], paginas text[],
  cor_fundo text, cor_texto text, botao_label text,
  logo_url text, mostrar_nome_hub boolean,
  created_at timestamptz, total_dismiss bigint, total_views bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT p.id, p.titulo, p.mensagem, p.ativo,
    p.data_inicio, p.data_fim, p.perfis, p.destinatarios, p.paginas,
    p.cor_fundo, p.cor_texto, p.botao_label,
    p.logo_url, COALESCE(p.mostrar_nome_hub, true), p.created_at,
    (SELECT COUNT(*) FROM public.admin_popup_dismissals d WHERE d.popup_id = p.id)::bigint AS total_dismiss,
    0::bigint AS total_views
  FROM public.admin_popups p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_listar_popups() TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_salvar_popup(
  p_id uuid DEFAULT NULL,
  p_titulo text DEFAULT '',
  p_mensagem text DEFAULT '',
  p_ativo boolean DEFAULT true,
  p_data_inicio timestamptz DEFAULT now(),
  p_data_fim timestamptz DEFAULT NULL,
  p_perfis text[] DEFAULT NULL,
  p_destinatarios text[] DEFAULT NULL,
  p_paginas text[] DEFAULT NULL,
  p_cor_fundo text DEFAULT '#14405C',
  p_botao_label text DEFAULT 'Entendido!',
  p_logo_url text DEFAULT NULL,
  p_mostrar_nome_hub boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.admin_popups SET
      titulo = p_titulo, mensagem = p_mensagem, ativo = p_ativo,
      data_inicio = p_data_inicio, data_fim = p_data_fim,
      perfis = p_perfis, destinatarios = p_destinatarios, paginas = p_paginas,
      cor_fundo = p_cor_fundo, botao_label = p_botao_label,
      logo_url = p_logo_url, mostrar_nome_hub = p_mostrar_nome_hub,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.admin_popups(
      titulo, mensagem, ativo, data_inicio, data_fim,
      perfis, destinatarios, paginas, cor_fundo, botao_label,
      logo_url, mostrar_nome_hub, criado_por
    ) VALUES (
      p_titulo, p_mensagem, p_ativo, p_data_inicio, p_data_fim,
      p_perfis, p_destinatarios, p_paginas, p_cor_fundo, p_botao_label,
      p_logo_url, p_mostrar_nome_hub, auth.uid()
    ) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_salvar_popup(uuid, text, text, boolean, timestamptz, timestamptz, text[], text[], text[], text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_excluir_popup(p_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.admin_popups WHERE id = p_id;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_excluir_popup(uuid) TO authenticated;

-- ================================
-- FASE 4: Log de Emails
-- ================================

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sent','suppressed','failed','bounced','complained','dlq','rate_limited')),
  error_message text,
  metadata jsonb,
  disparado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê email_send_log" ON public.email_send_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Service role gerencia email_send_log" ON public.email_send_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_log_template ON public.email_send_log(template_name);

NOTIFY pgrst, 'reload schema';
