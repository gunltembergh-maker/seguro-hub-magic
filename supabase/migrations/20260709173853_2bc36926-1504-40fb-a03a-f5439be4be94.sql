
-- =========================================================
-- HUB LAVORO — FASE 1: base completa
-- =========================================================

-- ---------- ENUM ----------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('ADMIN','DIRETORIA_GERAL','COLABORADOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- helpers genéricos ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.divide_safe(num numeric, den numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN den IS NULL OR den = 0 THEN 0 ELSE num/den END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_categoria_financeira(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(TRIM(COALESCE(txt,'')));
$$;

-- ==========================================================
-- 1) dominio_empresa
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.dominio_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dominio_empresa TO authenticated;
GRANT ALL ON public.dominio_empresa TO service_role;
ALTER TABLE public.dominio_empresa ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 2) perfis_acesso
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.perfis_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  permissoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.perfis_acesso TO authenticated;
GRANT ALL ON public.perfis_acesso TO service_role;
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 3) profiles
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT false,
  primeiro_acesso BOOLEAN NOT NULL DEFAULT true,
  perfil_id UUID REFERENCES public.perfis_acesso(id) ON DELETE SET NULL,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 4) user_roles
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- Funções de autorização (SECURITY DEFINER)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_diretoria(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ADMIN','DIRETORIA_GERAL')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_configuracoes(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'ADMIN')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
        WHERE p.user_id = _user_id
          AND COALESCE((pa.permissoes->>'menu_admin_configuracoes')::bool,false) = true
      );
$$;

CREATE OR REPLACE FUNCTION public.pode_importar(_user_id UUID, _tipo TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'ADMIN')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
        WHERE p.user_id = _user_id
          AND COALESCE((pa.permissoes->>('menu_importar_'||_tipo))::bool,false) = true
      );
$$;

CREATE OR REPLACE FUNCTION public.is_dominio_lavoro(_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dominio_empresa
    WHERE ativo = true
      AND LOWER(dominio) = LOWER(split_part(_email,'@',2))
  );
$$;

-- ==========================================================
-- Policies (agora que as funções existem)
-- ==========================================================

-- dominio_empresa: qualquer autenticado lê; só admin escreve
CREATE POLICY "domenip_read" ON public.dominio_empresa
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "domenip_admin_write" ON public.dominio_empresa
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- perfis_acesso: leitura autenticada; escrita admin
CREATE POLICY "perfis_read" ON public.perfis_acesso
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfis_admin_write" ON public.perfis_acesso
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- profiles
CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND blocked = false); -- não permite auto-desbloqueio
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- user_roles
CREATE POLICY "roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "roles_admin_read" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "roles_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- ==========================================================
-- 5) hub_admin_settings
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.hub_admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.hub_admin_settings TO authenticated;
GRANT ALL ON public.hub_admin_settings TO service_role;
ALTER TABLE public.hub_admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read" ON public.hub_admin_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write" ON public.hub_admin_settings
  FOR ALL TO authenticated
  USING (public.pode_gerenciar_configuracoes(auth.uid()))
  WITH CHECK (public.pode_gerenciar_configuracoes(auth.uid()));

-- ==========================================================
-- 6) notificacoes_admin
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.notificacoes_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notificacoes_admin TO authenticated;
GRANT ALL ON public.notificacoes_admin TO service_role;
ALTER TABLE public.notificacoes_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_admin_read" ON public.notificacoes_admin
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "notif_admin_update" ON public.notificacoes_admin
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_diretoria(auth.uid()))
  WITH CHECK (public.is_admin_or_diretoria(auth.uid()));

-- ==========================================================
-- 7) user_activity_log & user_sessions_log
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_admin_read" ON public.user_activity_log
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "activity_self_read" ON public.user_activity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_sessions_log TO authenticated;
GRANT ALL ON public.user_sessions_log TO service_role;
ALTER TABLE public.user_sessions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_admin_read" ON public.user_sessions_log
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "sessions_self_read" ON public.user_sessions_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ==========================================================
-- 8) RAW tables (schema plausível — ajustar com headers reais)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.raw_lavoro_gerencial (
  id BIGSERIAL PRIMARY KEY,
  apolice TEXT,
  endosso TEXT,
  ramo TEXT,
  tipo_de_ramo TEXT,
  segurado TEXT,
  cliente TEXT,
  cpf_cnpj TEXT,
  seguradora TEXT,
  canal TEXT,
  produtor TEXT,
  filial TEXT,
  unidade TEXT,
  centro_custo TEXT,
  moeda TEXT,
  premio_liquido NUMERIC(18,2),
  premio_bruto NUMERIC(18,2),
  iof NUMERIC(18,2),
  comissao_bruta NUMERIC(18,2),
  comissao_liquida NUMERIC(18,2),
  percentual_comissao NUMERIC(10,4),
  parcela_num INTEGER,
  parcela_total INTEGER,
  status_parcela_comissao TEXT,
  status_apolice TEXT,
  data_emissao DATE,
  data_inicio_vigencia DATE,
  data_fim_vigencia DATE,
  data_competencia DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  mes_competencia INTEGER,
  ano_competencia INTEGER,
  tipo_movimento TEXT,
  observacoes TEXT,
  origem TEXT,
  subramo TEXT,
  modalidade TEXT,
  produto TEXT,
  gerente TEXT,
  supervisor TEXT,
  regional TEXT,
  praca TEXT,
  meta_atrelada NUMERIC(18,2),
  arquivo_origem TEXT,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, DELETE ON public.raw_lavoro_gerencial TO authenticated;
GRANT ALL ON public.raw_lavoro_gerencial TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.raw_lavoro_gerencial_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.raw_lavoro_gerencial_id_seq TO service_role;
ALTER TABLE public.raw_lavoro_gerencial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gerencial_read" ON public.raw_lavoro_gerencial
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "gerencial_import" ON public.raw_lavoro_gerencial
  FOR INSERT TO authenticated WITH CHECK (public.pode_importar(auth.uid(),'gerencial'));
CREATE POLICY "gerencial_delete" ON public.raw_lavoro_gerencial
  FOR DELETE TO authenticated USING (public.pode_importar(auth.uid(),'gerencial'));

CREATE TABLE IF NOT EXISTS public.raw_lavoro_caixa_comissao (
  id BIGSERIAL PRIMARY KEY,
  apolice TEXT,
  endosso TEXT,
  ramo TEXT,
  seguradora TEXT,
  canal TEXT,
  segurado TEXT,
  parcela_num INTEGER,
  data_recebimento DATE,
  data_competencia DATE,
  data_previsto DATE,
  valor_recebido NUMERIC(18,2),
  valor_previsto NUMERIC(18,2),
  status TEXT,
  observacoes TEXT,
  arquivo_origem TEXT,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, DELETE ON public.raw_lavoro_caixa_comissao TO authenticated;
GRANT ALL ON public.raw_lavoro_caixa_comissao TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.raw_lavoro_caixa_comissao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.raw_lavoro_caixa_comissao_id_seq TO service_role;
ALTER TABLE public.raw_lavoro_caixa_comissao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caixa_read" ON public.raw_lavoro_caixa_comissao
  FOR SELECT TO authenticated USING (public.is_admin_or_diretoria(auth.uid()));
CREATE POLICY "caixa_import" ON public.raw_lavoro_caixa_comissao
  FOR INSERT TO authenticated WITH CHECK (public.pode_importar(auth.uid(),'caixa'));
CREATE POLICY "caixa_delete" ON public.raw_lavoro_caixa_comissao
  FOR DELETE TO authenticated USING (public.pode_importar(auth.uid(),'caixa'));

CREATE TABLE IF NOT EXISTS public.raw_lavoro_depara_ramo (
  id BIGSERIAL PRIMARY KEY,
  ramo_origem TEXT NOT NULL,
  ramo_normalizado TEXT NOT NULL,
  tipo_de_ramo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ramo_origem)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_lavoro_depara_ramo TO authenticated;
GRANT ALL ON public.raw_lavoro_depara_ramo TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.raw_lavoro_depara_ramo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.raw_lavoro_depara_ramo_id_seq TO service_role;
ALTER TABLE public.raw_lavoro_depara_ramo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depara_read" ON public.raw_lavoro_depara_ramo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "depara_write" ON public.raw_lavoro_depara_ramo
  FOR ALL TO authenticated
  USING (public.pode_importar(auth.uid(),'gerencial'))
  WITH CHECK (public.pode_importar(auth.uid(),'gerencial'));

-- ==========================================================
-- Triggers de updated_at
-- ==========================================================
CREATE TRIGGER trg_dominio_upd BEFORE UPDATE ON public.dominio_empresa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_perfis_upd BEFORE UPDATE ON public.perfis_acesso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================================
-- Trigger em auth.users: cria profile + bane fora do domínio
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dominio_ok boolean;
BEGIN
  v_dominio_ok := public.is_dominio_lavoro(NEW.email);

  IF NOT v_dominio_ok THEN
    -- bane e cria notificação
    UPDATE auth.users
       SET banned_until = 'infinity'::timestamptz
     WHERE id = NEW.id;

    INSERT INTO public.notificacoes_admin(tipo, titulo, mensagem, dados)
    VALUES (
      'acesso_negado_dominio',
      'Tentativa de acesso de domínio não autorizado',
      'Usuário com e-mail '||NEW.email||' tentou acessar e foi bloqueado.',
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles(user_id, full_name, email, blocked, active, primeiro_acesso)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    true, false, true
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.notificacoes_admin(tipo, titulo, mensagem, dados)
  VALUES (
    'solicitacao_acesso',
    'Nova solicitação de acesso',
    'Novo colaborador aguardando aprovação: '||NEW.email,
    jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
  );

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_lavoro ON auth.users;
CREATE TRIGGER on_auth_user_created_lavoro
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- concede COLABORADOR quando email verificado e domínio bate
CREATE OR REPLACE FUNCTION public.grant_role_for_verified_domain()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND public.is_dominio_lavoro(NEW.email) THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'COLABORADOR')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_lavoro ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_lavoro
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_role_for_verified_domain();

-- ==========================================================
-- RPCs de sessão / perfil
-- ==========================================================
CREATE OR REPLACE FUNCTION public.rpc_registrar_acesso()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
     SET ultimo_acesso = now(),
         primeiro_acesso = false
   WHERE user_id = auth.uid();
  INSERT INTO public.user_sessions_log(user_id) VALUES (auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_meu_perfil()
RETURNS TABLE(
  user_id UUID, full_name TEXT, email TEXT,
  blocked BOOLEAN, active BOOLEAN, primeiro_acesso BOOLEAN,
  perfil_id UUID, perfil_nome TEXT, permissoes JSONB,
  roles public.app_role[]
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.email, p.blocked, p.active, p.primeiro_acesso,
         p.perfil_id, pa.nome, COALESCE(pa.permissoes,'{}'::jsonb),
         COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.user_id), ARRAY[]::public.app_role[])
    FROM public.profiles p
    LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
   WHERE p.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.rpc_permitir_login_senha()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false)
    FROM public.hub_admin_settings WHERE key = 'permitir_login_senha';
$$;

-- ==========================================================
-- VIEWS de BI
-- ==========================================================
CREATE OR REPLACE VIEW public.vw_lavoro_receita_competencia AS
SELECT
  COALESCE(g.ano_competencia, EXTRACT(YEAR FROM g.data_competencia)::int) AS ano,
  COALESCE(g.mes_competencia, EXTRACT(MONTH FROM g.data_competencia)::int) AS mes,
  g.canal, g.tipo_de_ramo,
  COALESCE(dr.ramo_normalizado, g.ramo) AS ramo,
  g.seguradora, g.status_parcela_comissao,
  SUM(g.comissao_bruta) AS comissao_bruta,
  SUM(g.comissao_liquida) AS comissao_liquida,
  SUM(g.premio_liquido) AS premio_liquido
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.raw_lavoro_depara_ramo dr ON dr.ramo_origem = g.ramo
GROUP BY 1,2,3,4,5,6,7;

CREATE OR REPLACE VIEW public.vw_lavoro_receita_caixa AS
SELECT
  EXTRACT(YEAR  FROM c.data_recebimento)::int AS ano,
  EXTRACT(MONTH FROM c.data_recebimento)::int AS mes,
  c.canal, c.seguradora,
  COALESCE(dr.ramo_normalizado, c.ramo) AS ramo,
  SUM(c.valor_recebido) AS valor_recebido
FROM public.raw_lavoro_caixa_comissao c
LEFT JOIN public.raw_lavoro_depara_ramo dr ON dr.ramo_origem = c.ramo
WHERE c.data_recebimento IS NOT NULL
GROUP BY 1,2,3,4,5;

CREATE OR REPLACE VIEW public.vw_lavoro_previsto_caixa AS
SELECT
  EXTRACT(YEAR  FROM c.data_previsto)::int AS ano,
  EXTRACT(MONTH FROM c.data_previsto)::int AS mes,
  c.canal, c.seguradora,
  COALESCE(dr.ramo_normalizado, c.ramo) AS ramo,
  SUM(c.valor_previsto) AS valor_previsto
FROM public.raw_lavoro_caixa_comissao c
LEFT JOIN public.raw_lavoro_depara_ramo dr ON dr.ramo_origem = c.ramo
WHERE c.data_previsto IS NOT NULL
GROUP BY 1,2,3,4,5;

GRANT SELECT ON public.vw_lavoro_receita_competencia TO authenticated;
GRANT SELECT ON public.vw_lavoro_receita_caixa TO authenticated;
GRANT SELECT ON public.vw_lavoro_previsto_caixa TO authenticated;

-- ==========================================================
-- RPCs de BI
-- ==========================================================
CREATE OR REPLACE FUNCTION public.rpc_get_meta_anual(_ano INT)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value->>_ano::text)::numeric, 0)
    FROM public.hub_admin_settings WHERE key = 'meta_anual';
$$;

CREATE OR REPLACE FUNCTION public.rpc_set_meta_anual(_ano INT, _valor NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pode_gerenciar_configuracoes(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;
  INSERT INTO public.hub_admin_settings(key, value, atualizado_por)
  VALUES ('meta_anual', jsonb_build_object(_ano::text, _valor), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = COALESCE(public.hub_admin_settings.value,'{}'::jsonb) || jsonb_build_object(_ano::text, _valor),
        atualizado_em = now(),
        atualizado_por = auth.uid();
END; $$;

-- KPIs de receita
CREATE OR REPLACE FUNCTION public.rpc_receita_kpis(_ano INT, _mes INT, _periodo TEXT DEFAULT 'MTD')
RETURNS TABLE(
  competencia NUMERIC, caixa NUMERIC, meta NUMERIC,
  atingimento NUMERIC, defasagem NUMERIC,
  previsto NUMERIC, atingimento_caixa NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mes_inicio INT;
  v_mes_fim INT := _mes;
  v_meta NUMERIC := public.rpc_get_meta_anual(_ano);
  v_meta_periodo NUMERIC;
BEGIN
  v_mes_inicio := CASE
    WHEN _periodo = 'YTD' THEN 1
    WHEN _periodo = 'SEMESTRE' THEN CASE WHEN _mes <= 6 THEN 1 ELSE 7 END
    ELSE _mes
  END;
  v_mes_fim := CASE WHEN _periodo = 'SEMESTRE' THEN CASE WHEN _mes <= 6 THEN 6 ELSE 12 END ELSE _mes END;

  v_meta_periodo := v_meta * (v_mes_fim - v_mes_inicio + 1) / 12.0;

  RETURN QUERY
  WITH comp AS (
    SELECT COALESCE(SUM(comissao_liquida),0) AS v
      FROM public.vw_lavoro_receita_competencia
     WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  ), cx AS (
    SELECT COALESCE(SUM(valor_recebido),0) AS v
      FROM public.vw_lavoro_receita_caixa
     WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  ), pv AS (
    SELECT COALESCE(SUM(valor_previsto),0) AS v
      FROM public.vw_lavoro_previsto_caixa
     WHERE ano = _ano AND mes BETWEEN v_mes_inicio AND v_mes_fim
  )
  SELECT
    comp.v, cx.v, v_meta_periodo,
    public.divide_safe(comp.v, v_meta_periodo) * 100,
    v_meta_periodo - comp.v,
    pv.v,
    public.divide_safe(cx.v, v_meta_periodo) * 100
  FROM comp, cx, pv;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_receita_serie_mensal(_ano INT)
RETURNS TABLE(mes INT, competencia NUMERIC, caixa NUMERIC, meta NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_meta NUMERIC := public.rpc_get_meta_anual(_ano);
BEGIN
  RETURN QUERY
  WITH meses AS (SELECT generate_series(1,12) AS mes)
  SELECT m.mes,
    COALESCE((SELECT SUM(comissao_liquida) FROM public.vw_lavoro_receita_competencia
              WHERE ano=_ano AND mes=m.mes),0),
    COALESCE((SELECT SUM(valor_recebido) FROM public.vw_lavoro_receita_caixa
              WHERE ano=_ano AND mes=m.mes),0),
    v_meta/12.0
  FROM meses m ORDER BY m.mes;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_receita_comparativo_anual(_anos INT[])
RETURNS TABLE(ano INT, mes INT, competencia NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ano, mes, COALESCE(SUM(comissao_liquida),0)
    FROM public.vw_lavoro_receita_competencia
   WHERE ano = ANY(_anos)
   GROUP BY ano, mes ORDER BY ano, mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_receita_caixa_comparativo_anual(_anos INT[])
RETURNS TABLE(ano INT, mes INT, caixa NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ano, mes, COALESCE(SUM(valor_recebido),0)
    FROM public.vw_lavoro_receita_caixa
   WHERE ano = ANY(_anos)
   GROUP BY ano, mes ORDER BY ano, mes;
$$;

CREATE OR REPLACE FUNCTION public.rpc_receita_por_canal(_ano INT, _mes INT, _periodo TEXT DEFAULT 'MTD')
RETURNS TABLE(canal TEXT, valor NUMERIC) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ini INT; v_fim INT;
BEGIN
  v_ini := CASE _periodo WHEN 'YTD' THEN 1 WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 1 ELSE 7 END ELSE _mes END;
  v_fim := CASE _periodo WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 6 ELSE 12 END ELSE _mes END;
  RETURN QUERY
    SELECT COALESCE(v.canal,'(sem canal)'), COALESCE(SUM(v.comissao_liquida),0)
      FROM public.vw_lavoro_receita_competencia v
     WHERE v.ano=_ano AND v.mes BETWEEN v_ini AND v_fim
     GROUP BY 1 ORDER BY 2 DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_receita_por_ramo(_ano INT, _mes INT, _periodo TEXT DEFAULT 'MTD')
RETURNS TABLE(ramo TEXT, valor NUMERIC) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ini INT; v_fim INT;
BEGIN
  v_ini := CASE _periodo WHEN 'YTD' THEN 1 WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 1 ELSE 7 END ELSE _mes END;
  v_fim := CASE _periodo WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 6 ELSE 12 END ELSE _mes END;
  RETURN QUERY
    SELECT COALESCE(v.ramo,'(sem ramo)'), COALESCE(SUM(v.comissao_liquida),0)
      FROM public.vw_lavoro_receita_competencia v
     WHERE v.ano=_ano AND v.mes BETWEEN v_ini AND v_fim
     GROUP BY 1 ORDER BY 2 DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_receita_variacoes(_ano INT, _mes INT)
RETURNS TABLE(atual NUMERIC, mes_anterior NUMERIC, ano_anterior NUMERIC,
              var_mes NUMERIC, var_ano NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_atual NUMERIC; v_ma NUMERIC; v_aa NUMERIC;
        v_ma_ano INT; v_ma_mes INT;
BEGIN
  SELECT COALESCE(SUM(comissao_liquida),0) INTO v_atual
    FROM public.vw_lavoro_receita_competencia WHERE ano=_ano AND mes=_mes;

  v_ma_ano := CASE WHEN _mes=1 THEN _ano-1 ELSE _ano END;
  v_ma_mes := CASE WHEN _mes=1 THEN 12 ELSE _mes-1 END;

  SELECT COALESCE(SUM(comissao_liquida),0) INTO v_ma
    FROM public.vw_lavoro_receita_competencia WHERE ano=v_ma_ano AND mes=v_ma_mes;

  SELECT COALESCE(SUM(comissao_liquida),0) INTO v_aa
    FROM public.vw_lavoro_receita_competencia WHERE ano=_ano-1 AND mes=_mes;

  RETURN QUERY SELECT v_atual, v_ma, v_aa,
    public.divide_safe(v_atual - v_ma, v_ma) * 100,
    public.divide_safe(v_atual - v_aa, v_aa) * 100;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(_ano INT, _mes INT, _periodo TEXT DEFAULT 'MTD')
RETURNS TABLE(canal TEXT, valor NUMERIC) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ini INT; v_fim INT;
BEGIN
  v_ini := CASE _periodo WHEN 'YTD' THEN 1 WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 1 ELSE 7 END ELSE _mes END;
  v_fim := CASE _periodo WHEN 'SEMESTRE' THEN CASE WHEN _mes<=6 THEN 6 ELSE 12 END ELSE _mes END;
  RETURN QUERY
    SELECT COALESCE(g.canal,'(sem canal)'), COALESCE(SUM(g.comissao_liquida),0)
      FROM public.raw_lavoro_gerencial g
     WHERE COALESCE(g.ano_competencia, EXTRACT(YEAR FROM g.data_competencia)::int) = _ano
       AND COALESCE(g.mes_competencia, EXTRACT(MONTH FROM g.data_competencia)::int) BETWEEN v_ini AND v_fim
       AND UPPER(COALESCE(g.status_parcela_comissao,'')) IN ('VENCIDO','VENCIDA','EM ATRASO','ATRASADO')
     GROUP BY 1 ORDER BY 2 DESC;
END; $$;

-- ==========================================================
-- SEEDS
-- ==========================================================
INSERT INTO public.dominio_empresa(dominio) VALUES ('lavoroseguros.com.br')
ON CONFLICT (dominio) DO NOTHING;

INSERT INTO public.perfis_acesso(nome, descricao, permissoes) VALUES
 ('Administrador','Acesso total ao hub',
    '{"menu_admin_configuracoes":true,"menu_admin_usuarios":true,"menu_admin_perfis":true,"menu_importar_gerencial":true,"menu_importar_caixa":true,"menu_dashboard":true}'::jsonb),
 ('Diretoria','Visão executiva de BI',
    '{"menu_dashboard":true,"menu_admin_usuarios":false,"menu_importar_gerencial":false,"menu_importar_caixa":false}'::jsonb),
 ('Colaborador','Acesso padrão de colaborador',
    '{"menu_dashboard":true}'::jsonb)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.hub_admin_settings(key, value, descricao) VALUES
 ('permitir_login_senha','{"enabled":false}'::jsonb,'Permite login por senha além do SSO'),
 ('meta_anual','{}'::jsonb,'Meta anual de comissão liquida por ano')
ON CONFLICT (key) DO NOTHING;
