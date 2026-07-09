
DROP FUNCTION IF EXISTS public.rpc_comissao_vencida_por_canal(int, int, text);
DROP VIEW IF EXISTS public.vw_lavoro_previsto_caixa;
DROP VIEW IF EXISTS public.vw_lavoro_receita_caixa;
DROP VIEW IF EXISTS public.vw_lavoro_receita_competencia;
DROP VIEW IF EXISTS public.vw_lavoro_gerencial;
DROP VIEW IF EXISTS public.vw_lavoro_depara_ramo;
DROP FUNCTION IF EXISTS public.normalize_categoria_financeira(text);

CREATE OR REPLACE VIEW public.vw_lavoro_depara_ramo
WITH (security_invoker = true) AS
SELECT DISTINCT ON (btrim(lower(ramo))) ramo, tipo_de_ramo
FROM public.raw_lavoro_depara_ramo
WHERE sync_id = (SELECT sync_id FROM public.raw_lavoro_depara_ramo ORDER BY criado_em DESC LIMIT 1)
ORDER BY btrim(lower(ramo)), id;

CREATE OR REPLACE VIEW public.vw_lavoro_gerencial
WITH (security_invoker = true) AS
SELECT
  g.id, g.grupo, g.tomador, g.segurado, g.documento, g.ramo,
  COALESCE(dp.tipo_de_ramo, 'Sem Categoria') AS tipo_de_ramo,
  btrim(g.seguradora) AS seguradora, g.numero_apolice, g.data_emissao, g.inicio_vigencia, g.fim_vigencia,
  g.valor_is, g.premio_total, g.percentual_comissao, g.comissao_emitida, g.qtd_parcelas, g.premio_parcela,
  g.comissao_bruta, g.imposto_ret, g.valor_iss, g.valor_recebido_a_receber, g.numero_da_parcela,
  g.tipo_pagamento, g.empresa_faturada, g.data_pagamento, g.mes, g.ano,
  btrim(g.status_parcela_comissao) AS status_parcela_comissao, g.possui_repasse, g.percentual_repasse,
  g.valor_repasse_total, g.data_repasse, g.status_repasse, g.observacao, g.responsavel,
  COALESCE(g.data_emissao, g.inicio_vigencia) AS data_ajustada,
  CASE WHEN g.data_pagamento IS NULL THEN NULL
    WHEN EXTRACT(DAY FROM g.data_pagamento) <= 10 THEN '1-10'
    WHEN EXTRACT(DAY FROM g.data_pagamento) <= 20 THEN '11-20'
    ELSE '21-31' END AS dezena,
  g.sync_id
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.vw_lavoro_depara_ramo dp ON btrim(lower(dp.ramo)) = btrim(lower(g.ramo))
WHERE g.sync_id = (SELECT sync_id FROM public.raw_lavoro_gerencial ORDER BY criado_em DESC LIMIT 1);

CREATE OR REPLACE VIEW public.vw_lavoro_receita_competencia
WITH (security_invoker = true) AS
SELECT tomador, segurado, documento, ramo, tipo_de_ramo, seguradora, data_emissao, comissao_bruta,
  data_pagamento, EXTRACT(YEAR FROM data_emissao)::int AS ano, EXTRACT(MONTH FROM data_emissao)::int AS mes,
  status_parcela_comissao
FROM public.vw_lavoro_gerencial
WHERE data_emissao IS NOT NULL AND comissao_bruta IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_categoria_financeira(categoria text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT lower(btrim(categoria)); $$;

CREATE OR REPLACE VIEW public.vw_lavoro_receita_caixa
WITH (security_invoker = true) AS
SELECT id, data_pagamento, descricao, valor, referencia, mes_referencia,
  EXTRACT(YEAR FROM data_pagamento)::int AS ano, EXTRACT(MONTH FROM data_pagamento)::int AS mes, sync_id
FROM public.raw_lavoro_caixa_comissao
WHERE public.normalize_categoria_financeira(categoria) = 'comissão'
  AND sync_id = (SELECT sync_id FROM public.raw_lavoro_caixa_comissao ORDER BY criado_em DESC LIMIT 1);

CREATE OR REPLACE VIEW public.vw_lavoro_previsto_caixa
WITH (security_invoker = true) AS
SELECT ramo, tipo_de_ramo, comissao_bruta AS valor_previsto, data_pagamento,
  EXTRACT(YEAR FROM data_pagamento)::int AS ano, EXTRACT(MONTH FROM data_pagamento)::int AS mes
FROM public.vw_lavoro_gerencial
WHERE data_pagamento IS NOT NULL AND comissao_bruta IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(p_ano int, p_mes int, p_periodo text DEFAULT 'YTD')
RETURNS TABLE (tipo_de_ramo text, comissao_vencida numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.tipo_de_ramo, SUM(g.comissao_bruta) FROM public.vw_lavoro_gerencial g
  WHERE g.status_parcela_comissao ILIKE '%vencid%' AND g.ano = p_ano
    AND ((p_periodo = 'MTD' AND g.mes = p_mes) OR (p_periodo = 'YTD' AND g.mes <= p_mes)
      OR (p_periodo = 'SEMESTRE' AND g.mes BETWEEN (CASE WHEN p_mes <= 6 THEN 1 ELSE 7 END) AND p_mes))
  GROUP BY g.tipo_de_ramo ORDER BY 2 DESC;
$$;
