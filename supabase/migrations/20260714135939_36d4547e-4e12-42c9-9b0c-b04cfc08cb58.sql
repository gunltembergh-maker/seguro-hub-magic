
-- Tornar view de receita caixa permissiva: qualquer linha na tabela cujo
-- categoria OU tipo_lancamento contenha "comiss" (case/acento-insensível).
CREATE OR REPLACE VIEW public.vw_lavoro_receita_caixa AS
SELECT id, data_pagamento, descricao, valor, referencia, mes_referencia,
  COALESCE(
    EXTRACT(YEAR FROM data_pagamento)::int,
    NULLIF(split_part(mes_referencia,'-',1),'')::int,
    NULLIF(split_part(mes_referencia,'/',2),'')::int
  ) AS ano,
  COALESCE(
    EXTRACT(MONTH FROM data_pagamento)::int,
    NULLIF(split_part(mes_referencia,'-',2),'')::int,
    NULLIF(split_part(mes_referencia,'/',1),'')::int
  ) AS mes,
  sync_id
FROM public.raw_lavoro_caixa_comissao
WHERE (
    public.normalize_categoria_financeira(categoria) LIKE '%comiss%'
 OR public.normalize_categoria_financeira(tipo_lancamento) LIKE '%comiss%'
 OR (categoria IS NULL AND tipo_lancamento IS NULL)  -- fallback: registros sem categoria mas na tabela de comissão
  )
  AND valor IS NOT NULL
  AND sync_id = (SELECT sync_id FROM public.raw_lavoro_caixa_comissao ORDER BY criado_em DESC LIMIT 1);

-- Previsto de caixa: aceita fallback quando data_pagamento é nula usando ano/mes vindos do gerencial.
CREATE OR REPLACE VIEW public.vw_lavoro_previsto_caixa AS
SELECT ramo, tipo_de_ramo,
  comissao_bruta AS valor_previsto,
  data_pagamento,
  COALESCE(EXTRACT(YEAR  FROM data_pagamento)::int, ano)  AS ano,
  COALESCE(EXTRACT(MONTH FROM data_pagamento)::int, mes)  AS mes
FROM public.vw_lavoro_gerencial
WHERE comissao_bruta IS NOT NULL
  AND (data_pagamento IS NOT NULL OR (ano IS NOT NULL AND mes IS NOT NULL));

-- rpc_comissao_vencida_por_canal: aceitar variações de status (vencid%, atras%, em aberto…)
CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(
  p_ano int, p_mes int, p_periodo text DEFAULT 'YTD'
) RETURNS TABLE(tipo_de_ramo text, comissao_vencida numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT g.tipo_de_ramo, SUM(g.comissao_bruta)
    FROM public.vw_lavoro_gerencial g
   WHERE (
        lower(g.status_parcela_comissao) LIKE '%vencid%'
     OR lower(g.status_parcela_comissao) LIKE '%atras%'
     OR lower(g.status_parcela_comissao) LIKE '%em aberto%'
     OR lower(g.status_parcela_comissao) LIKE '%pendente%'
   )
   AND g.ano = p_ano
   AND (
     (p_periodo='MTD'      AND g.mes = p_mes)
     OR (p_periodo='YTD'   AND g.mes <= p_mes)
     OR (p_periodo='SEMESTRE' AND g.mes BETWEEN (CASE WHEN p_mes<=6 THEN 1 ELSE 7 END) AND p_mes)
   )
   GROUP BY g.tipo_de_ramo
   ORDER BY 2 DESC;
$$;

GRANT SELECT ON public.vw_lavoro_receita_caixa TO authenticated, service_role;
GRANT SELECT ON public.vw_lavoro_previsto_caixa TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_comissao_vencida_por_canal(int,int,text) TO authenticated, service_role;
