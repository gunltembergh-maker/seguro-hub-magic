-- Helper de permissão da área Benefícios
CREATE OR REPLACE FUNCTION public.pode_beneficios()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND COALESCE((pa.permissoes ->> 'menu_ramo_beneficios')::boolean, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.beneficios_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ cadastros de referência ============
CREATE TABLE public.seguradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguradoras TO authenticated;
GRANT ALL ON public.seguradoras TO service_role;
ALTER TABLE public.seguradoras ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canais TO authenticated;
GRANT ALL ON public.canais TO service_role;
ALTER TABLE public.canais ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coberturas TO authenticated;
GRANT ALL ON public.coberturas TO service_role;
ALTER TABLE public.coberturas ENABLE ROW LEVEL SECURITY;

-- ============ clientes ============
CREATE SEQUENCE public.clientes_numero_seq;

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cliente text NOT NULL UNIQUE,
  tipo_pessoa text NOT NULL DEFAULT 'PJ',
  nome_razao_social text NOT NULL,
  cpf_cnpj text NOT NULL UNIQUE,
  porte_empresa text,
  cidade text,
  estado text,
  telefone text,
  email text,
  email_copia text,
  contato_principal text,
  canal_id uuid NOT NULL REFERENCES public.canais(id),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes
  ALTER COLUMN numero_cliente SET DEFAULT lpad(nextval('public.clientes_numero_seq')::text, 6, '0');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.clientes_numero_seq TO authenticated, service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clientes_canal ON public.clientes(canal_id);

CREATE OR REPLACE FUNCTION public.clientes_valida_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_pessoa NOT IN ('PJ','PF') THEN
    RAISE EXCEPTION 'tipo_pessoa deve ser PJ ou PF';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_clientes_valida_tipo BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_valida_tipo();

-- ============ contratos ============
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  seguradora_id uuid NOT NULL REFERENCES public.seguradoras(id),
  canal_id uuid NOT NULL REFERENCES public.canais(id),
  migrou_outra_corretora boolean NOT NULL DEFAULT false,
  numero_apolice text,
  quantidade_vidas integer,
  premio_atual numeric(14,2),
  percentual_agenciamento numeric(5,2),
  percentual_vitalicio numeric(5,2),
  data_inicio_vigencia date NOT NULL,
  data_fim_vigencia date NOT NULL,
  status text NOT NULL DEFAULT 'vigente',
  responsavel_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contratos_cliente ON public.contratos(cliente_id);
CREATE INDEX idx_contratos_fim ON public.contratos(data_fim_vigencia);

CREATE OR REPLACE FUNCTION public.contratos_valida_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('vigente','cancelado') THEN
    RAISE EXCEPTION 'status deve ser vigente ou cancelado';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_contratos_valida_status BEFORE INSERT OR UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.contratos_valida_status();

CREATE TABLE public.contrato_coberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cobertura_id uuid NOT NULL REFERENCES public.coberturas(id),
  ativa_desde date NOT NULL,
  ativa_ate date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_coberturas TO authenticated;
GRANT ALL ON public.contrato_coberturas TO service_role;
ALTER TABLE public.contrato_coberturas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contrato_coberturas_contrato ON public.contrato_coberturas(contrato_id);

-- ============ triggers updated_at ============
CREATE TRIGGER trg_seguradoras_updated BEFORE UPDATE ON public.seguradoras FOR EACH ROW EXECUTE FUNCTION public.beneficios_touch_updated_at();
CREATE TRIGGER trg_canais_updated BEFORE UPDATE ON public.canais FOR EACH ROW EXECUTE FUNCTION public.beneficios_touch_updated_at();
CREATE TRIGGER trg_coberturas_updated BEFORE UPDATE ON public.coberturas FOR EACH ROW EXECUTE FUNCTION public.beneficios_touch_updated_at();
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.beneficios_touch_updated_at();
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.beneficios_touch_updated_at();
CREATE TRIGGER trg_contrato_coberturas_updated BEFORE UPDATE ON public.contrato_coberturas FOR EACH ROW EXECUTE FUNCTION public.beneficios_touch_updated_at();

-- ============ RLS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['seguradoras','canais','coberturas','clientes','contratos','contrato_coberturas'] LOOP
    EXECUTE format('CREATE POLICY "beneficios_select" ON public.%I FOR SELECT TO authenticated USING (public.pode_beneficios())', t);
    EXECUTE format('CREATE POLICY "beneficios_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.pode_beneficios())', t);
    EXECUTE format('CREATE POLICY "beneficios_update" ON public.%I FOR UPDATE TO authenticated USING (public.pode_beneficios()) WITH CHECK (public.pode_beneficios())', t);
    EXECUTE format('CREATE POLICY "beneficios_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''ADMIN''::app_role))', t);
  END LOOP;
END $$;

-- ============ seeds dos cadastros de referência ============
INSERT INTO public.canais (nome) VALUES ('Lavoro'), ('Tailor Partners'), ('Outro')
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.coberturas (nome) VALUES
  ('Saúde'), ('Dental'), ('Vida em Grupo'), ('Vida Individual'), ('Viagem')
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.seguradoras (nome) VALUES
  ('SulAmérica'), ('Amil'), ('Bradesco'), ('Omint'), ('Hapvida (GNDI)'),
  ('Porto Seguro'), ('Prudential'), ('Golden Cross'), ('Unimed'), ('Allianz'),
  ('MetLife'), ('Icatu'), ('Care Plus'), ('Notre Dame Intermédica'), ('Assim Saúde')
  ON CONFLICT (nome) DO NOTHING;