
-- Fix: as views ignoravam o status do sync e podiam apontar para uma carga incompleta.
-- Passa a usar o último sync_id com status='sucesso' registrado em lavoro_sync_log.

CREATE OR REPLACE VIEW public.vw_lavoro_depara_ramo AS
SELECT DISTINCT ON (btrim(lower(ramo))) ramo, tipo_de_ramo
FROM public.raw_lavoro_depara_ramo
WHERE sync_id = (
  SELECT sync_id FROM public.lavoro_sync_log
  WHERE base = 'gerencial' AND status = 'sucesso'
  ORDER BY criado_em DESC LIMIT 1
)
ORDER BY btrim(lower(ramo)), id;

CREATE OR REPLACE VIEW public.vw_lavoro_gerencial AS
SELECT
  g.id, g.grupo, g.tomador, g.segurado, g.documento, g.ramo,
  COALESCE(dp.tipo_de_ramo, 'Sem Categoria') AS tipo_de_ramo,
  btrim(g.seguradora) AS seguradora, g.numero_apolice, g.data_emissao,
  g.inicio_vigencia, g.fim_vigencia, g.valor_is, g.premio_total,
  g.percentual_comissao, g.comissao_emitida, g.qtd_parcelas, g.premio_parcela,
  g.comissao_bruta, g.imposto_ret, g.valor_iss, g.valor_recebido_a_receber,
  g.numero_da_parcela, g.tipo_pagamento, g.empresa_faturada, g.data_pagamento,
  COALESCE(EXTRACT(MONTH FROM g.data_emissao)::int, g.mes)::int AS mes,
  COALESCE(EXTRACT(YEAR FROM g.data_emissao)::int, g.ano)::int AS ano,
  btrim(g.status_parcela_comissao) AS status_parcela_comissao,
  g.possui_repasse, g.percentual_repasse, g.valor_repasse_total, g.data_repasse,
  g.status_repasse, g.observacao, g.responsavel,
  COALESCE(g.data_emissao, g.inicio_vigencia) AS data_ajustada,
  CASE
    WHEN g.data_pagamento IS NULL THEN NULL
    WHEN EXTRACT(DAY FROM g.data_pagamento) <= 10 THEN '1-10'
    WHEN EXTRACT(DAY FROM g.data_pagamento) <= 20 THEN '11-20'
    ELSE '21-31'
  END AS dezena,
  g.sync_id
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.vw_lavoro_depara_ramo dp ON btrim(lower(dp.ramo)) = btrim(lower(g.ramo))
WHERE g.sync_id = (
  SELECT sync_id FROM public.lavoro_sync_log
  WHERE base = 'gerencial' AND status = 'sucesso'
  ORDER BY criado_em DESC LIMIT 1
);

CREATE OR REPLACE VIEW public.vw_lavoro_receita_executivo AS
SELECT
  id,
  data_emissao,
  valor_recebido_a_receber AS valor,
  data_pagamento,
  btrim(status_parcela_comissao) AS status_parcela,
  CASE
    WHEN lower(btrim(status_parcela_comissao)) = 'paga' THEN 'Paga'
    WHEN lower(btrim(status_parcela_comissao)) IN ('a vencer', 'vencida') THEN 'Pendente'
    ELSE 'Excluir'
  END AS grupo_status
FROM public.raw_lavoro_gerencial
WHERE sync_id = (
  SELECT sync_id FROM public.lavoro_sync_log
  WHERE base = 'gerencial' AND status = 'sucesso'
  ORDER BY criado_em DESC LIMIT 1
);

CREATE OR REPLACE VIEW public.vw_lavoro_receita_caixa AS
SELECT id, data_pagamento, descricao, valor, referencia, mes_referencia,
  EXTRACT(YEAR FROM data_pagamento)::int AS ano,
  EXTRACT(MONTH FROM data_pagamento)::int AS mes,
  sync_id
FROM public.raw_lavoro_caixa_comissao
WHERE (public.normalize_categoria_financeira(categoria) = 'comissao'
    OR public.normalize_categoria_financeira(tipo_lancamento) = 'comissao')
  AND sync_id = (
    SELECT sync_id FROM public.lavoro_sync_log
    WHERE base = 'caixa' AND status = 'sucesso'
    ORDER BY criado_em DESC LIMIT 1
  );
