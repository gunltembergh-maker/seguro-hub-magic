
CREATE TYPE public.report_tipo AS ENUM ('receita_diaria','executivo_semanal','fechamento_manual');

CREATE TABLE public.report_destinatarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.report_tipo NOT NULL,
  email TEXT NOT NULL,
  nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_destinatarios TO authenticated;
GRANT ALL ON public.report_destinatarios TO service_role;

ALTER TABLE public.report_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN gerencia destinatarios"
  ON public.report_destinatarios
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

CREATE TRIGGER trg_report_destinatarios_updated_at
  BEFORE UPDATE ON public.report_destinatarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.report_disparos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.report_tipo NOT NULL,
  disparado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  disparado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ok',
  total_destinatarios INT NOT NULL DEFAULT 0,
  erro TEXT,
  payload JSONB,
  periodo_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.report_disparos TO authenticated;
GRANT ALL ON public.report_disparos TO service_role;

ALTER TABLE public.report_disparos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN visualiza disparos"
  ON public.report_disparos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'));

CREATE INDEX idx_report_disparos_tipo_data ON public.report_disparos (tipo, disparado_em DESC);
CREATE INDEX idx_report_destinatarios_tipo_ativo ON public.report_destinatarios (tipo, ativo);
