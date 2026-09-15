CREATE TABLE IF NOT EXISTS public.garantia_judicial_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  status text not null default 'recebida'
    check (status in ('recebida','consultando_mercado','mercado_consultado','email_enviado','erro')),
  cnpj_tomador text not null,
  nome_tomador text,
  numero_processo text,
  dados_formulario jsonb not null,
  pdf_path text,
  xlsx_path text,
  resultado_mercado jsonb,
  email_enviado_em timestamptz,
  erro_mensagem text
);

GRANT ALL ON public.garantia_judicial_solicitacoes TO service_role;

ALTER TABLE public.garantia_judicial_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gjs_cnpj ON public.garantia_judicial_solicitacoes (cnpj_tomador);
CREATE INDEX IF NOT EXISTS idx_gjs_status ON public.garantia_judicial_solicitacoes (status);
CREATE INDEX IF NOT EXISTS idx_gjs_criado_em ON public.garantia_judicial_solicitacoes (criado_em desc);

CREATE OR REPLACE FUNCTION public.update_garantia_judicial_solicitacoes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_gjs_atualizado_em ON public.garantia_judicial_solicitacoes;
CREATE TRIGGER tr_gjs_atualizado_em
BEFORE UPDATE ON public.garantia_judicial_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.update_garantia_judicial_solicitacoes_updated_at();

CREATE POLICY "service_role_gerencia_anexos_garantia_judicial"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'garantia-judicial-anexos')
WITH CHECK (bucket_id = 'garantia-judicial-anexos');