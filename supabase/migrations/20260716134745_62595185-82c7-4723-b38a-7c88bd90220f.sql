
-- Feriados
CREATE TABLE IF NOT EXISTS public.feriados_nacionais (
  data DATE PRIMARY KEY,
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feriados_nacionais TO authenticated;
GRANT ALL ON public.feriados_nacionais TO service_role;
ALTER TABLE public.feriados_nacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feriados_select_authenticated"
  ON public.feriados_nacionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "feriados_admin_manage"
  ON public.feriados_nacionais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE OR REPLACE FUNCTION public.is_dia_util(_data DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(ISODOW FROM _data) < 6
     AND NOT EXISTS (SELECT 1 FROM public.feriados_nacionais WHERE data = _data);
$$;

INSERT INTO public.feriados_nacionais (data, descricao) VALUES
  ('2026-01-01','Confraternização Universal'),
  ('2026-02-16','Carnaval'),('2026-02-17','Carnaval'),
  ('2026-04-03','Sexta-feira Santa'),('2026-04-21','Tiradentes'),
  ('2026-05-01','Dia do Trabalho'),('2026-06-04','Corpus Christi'),
  ('2026-09-07','Independência do Brasil'),('2026-10-12','Nossa Senhora Aparecida'),
  ('2026-11-02','Finados'),('2026-11-15','Proclamação da República'),
  ('2026-12-25','Natal')
ON CONFLICT (data) DO NOTHING;

-- Destinatários automáticos
CREATE TABLE public.email_destinatarios_automaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo TEXT NOT NULL CHECK (modulo IN ('receita_lavoro','executivo_lavoro','fechamento_lavoro')),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modulo, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_destinatarios_automaticos TO authenticated;
GRANT ALL ON public.email_destinatarios_automaticos TO service_role;
ALTER TABLE public.email_destinatarios_automaticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_dest_admin_all"
  ON public.email_destinatarios_automaticos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER trg_email_dest_updated_at
  BEFORE UPDATE ON public.email_destinatarios_automaticos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Disparos
CREATE TABLE public.email_disparos_automaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo TEXT NOT NULL CHECK (modulo IN ('receita_lavoro','executivo_lavoro','fechamento_lavoro')),
  data_referencia DATE NOT NULL,
  periodo_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('em_processamento','concluido','falha','falha_parcial','pulado')),
  origem TEXT NOT NULL DEFAULT 'automatico' CHECK (origem IN ('automatico','manual')),
  motivo_skip TEXT,
  total_destinatarios INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  total_falhas INT NOT NULL DEFAULT 0,
  detalhes JSONB,
  disparado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.email_disparos_automaticos TO authenticated;
GRANT ALL ON public.email_disparos_automaticos TO service_role;
CREATE UNIQUE INDEX ux_email_disp_automatico_unico
  ON public.email_disparos_automaticos (modulo, data_referencia)
  WHERE origem = 'automatico' AND status IN ('em_processamento','concluido');
CREATE INDEX ix_email_disp_modulo_data ON public.email_disparos_automaticos (modulo, data_referencia DESC);
ALTER TABLE public.email_disparos_automaticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_disp_admin_all"
  ON public.email_disparos_automaticos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Schedules
CREATE TABLE public.email_schedules_config (
  modulo TEXT PRIMARY KEY CHECK (modulo IN ('receita_lavoro','executivo_lavoro','fechamento_lavoro')),
  ativo BOOLEAN NOT NULL DEFAULT false,
  frequencia TEXT NOT NULL DEFAULT 'diario' CHECK (frequencia IN ('diario','semanal','mensal')),
  horario_brt TIME NOT NULL DEFAULT '08:00',
  dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6),
  dia_mes INT CHECK (dia_mes BETWEEN 1 AND 31),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_schedules_config TO authenticated;
GRANT ALL ON public.email_schedules_config TO service_role;
ALTER TABLE public.email_schedules_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_sched_admin_all"
  ON public.email_schedules_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER trg_email_sched_updated_at
  BEFORE UPDATE ON public.email_schedules_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.email_schedules_config (modulo, ativo, frequencia, horario_brt) VALUES
  ('receita_lavoro', false, 'diario', '08:00'),
  ('executivo_lavoro', false, 'semanal', '08:00'),
  ('fechamento_lavoro', false, 'mensal', '08:00')
ON CONFLICT (modulo) DO NOTHING;
