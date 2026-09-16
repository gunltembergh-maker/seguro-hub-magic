ALTER TABLE public.garantia_judicial_solicitacoes ADD COLUMN IF NOT EXISTS payload_bruto jsonb;

COMMENT ON COLUMN public.garantia_judicial_solicitacoes.payload_bruto IS 'Payload JSON cru recebido pelo endpoint, antes de qualquer validação ou transformação. Preservado para auditoria e como fonte de verdade.';

-- Grant já existia na criação da tabela; garantimos que authenticated/service_role continuem enxergando.
GRANT SELECT, INSERT, UPDATE ON public.garantia_judicial_solicitacoes TO authenticated;
GRANT ALL ON public.garantia_judicial_solicitacoes TO service_role;