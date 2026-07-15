
CREATE OR REPLACE VIEW public.vw_lavoro_previsto_caixa AS
SELECT
  ramo,
  tipo_de_ramo,
  valor_recebido_a_receber AS valor_previsto,
  data_pagamento,
  EXTRACT(YEAR  FROM data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM data_pagamento)::int AS mes,
  status_parcela_comissao
FROM public.vw_lavoro_gerencial
WHERE data_pagamento IS NOT NULL
  AND valor_recebido_a_receber IS NOT NULL
  AND lower(btrim(coalesce(status_parcela_comissao,''))) IN ('paga','a vencer','vencida');

GRANT SELECT ON public.vw_lavoro_previsto_caixa TO authenticated, service_role;
