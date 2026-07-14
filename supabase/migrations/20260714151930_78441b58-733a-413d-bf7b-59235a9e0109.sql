-- Alinha vw_lavoro_receita_caixa com a versão validada no Hub Tailor (Dashboard Lavoro):
--   1) latest sync_id POR ANO (não perde anos anteriores quando um único ano é re-sincronizado)
--   2) filtro aceita categoria OU tipo_lancamento = 'comissao' (após normalize sem acento)
CREATE OR REPLACE VIEW public.vw_lavoro_receita_caixa AS
WITH latest_por_ano AS (
  SELECT DISTINCT ON (EXTRACT(year FROM data_pagamento)::int)
         EXTRACT(year FROM data_pagamento)::int AS ano,
         sync_id
  FROM public.raw_lavoro_caixa_comissao
  WHERE data_pagamento IS NOT NULL
  ORDER BY EXTRACT(year FROM data_pagamento)::int, criado_em DESC
)
SELECT r.id,
       r.data_pagamento,
       r.descricao,
       r.valor,
       r.referencia,
       r.mes_referencia,
       EXTRACT(year  FROM r.data_pagamento)::int AS ano,
       EXTRACT(month FROM r.data_pagamento)::int AS mes,
       r.sync_id
FROM public.raw_lavoro_caixa_comissao r
JOIN latest_por_ano lp
  ON lp.ano = EXTRACT(year FROM r.data_pagamento)::int
 AND lp.sync_id = r.sync_id
WHERE public.normalize_categoria_financeira(r.categoria)       = 'comissao'
   OR public.normalize_categoria_financeira(r.tipo_lancamento) = 'comissao';

GRANT SELECT ON public.vw_lavoro_receita_caixa TO authenticated, service_role;