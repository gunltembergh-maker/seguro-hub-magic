CREATE OR REPLACE VIEW public.vw_lavoro_receita_competencia AS
SELECT
  g.tomador, g.segurado, g.documento, g.ramo,
  COALESCE(dp.tipo_de_ramo, 'Sem Categoria') AS tipo_de_ramo,
  g.seguradora, g.data_emissao, g.comissao_bruta, g.data_pagamento,
  EXTRACT(YEAR FROM g.data_emissao)::int AS ano,
  EXTRACT(MONTH FROM g.data_emissao)::int AS mes,
  g.status_parcela_comissao
FROM public.raw_lavoro_gerencial g
LEFT JOIN public.vw_lavoro_depara_ramo dp ON lower(btrim(dp.ramo)) = lower(btrim(g.ramo))
WHERE g.sync_id = (
  SELECT sync_id FROM public.lavoro_sync_log
  WHERE base = 'gerencial' AND status = 'sucesso'
  ORDER BY criado_em DESC LIMIT 1
)
  AND g.data_emissao IS NOT NULL
  AND g.comissao_bruta IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_receita_executivo_mensal(p_ano int)
RETURNS TABLE (
  mes int,
  emitido numeric,
  caixa numeric,
  caixa_corrente numeric,
  saldo_vencido numeric,
  a_receber_futuro numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mes_atual int := EXTRACT(MONTH FROM CURRENT_DATE)::int;
  v_ano_atual int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  RETURN QUERY
  WITH meses AS (SELECT generate_series(1, 12) AS m),
  emitido_calc AS (
    SELECT c.mes, SUM(c.comissao_bruta) AS total
    FROM public.vw_lavoro_receita_competencia c
    WHERE c.ano = p_ano
    GROUP BY c.mes
  ),
  caixa_calc AS (
    SELECT EXTRACT(MONTH FROM data_pagamento)::int AS mes, SUM(valor) AS total
    FROM public.vw_lavoro_receita_executivo
    WHERE grupo_status <> 'Excluir' AND EXTRACT(YEAR FROM data_pagamento) = p_ano
    GROUP BY 1
  ),
  caixa_corrente_calc AS (
    SELECT cx.mes, SUM(cx.valor) AS total
    FROM public.vw_lavoro_receita_caixa cx
    WHERE cx.ano = p_ano
    GROUP BY cx.mes
  ),
  saldo_vencido_calc AS (
    SELECT EXTRACT(MONTH FROM data_pagamento)::int AS mes, SUM(valor) AS total
    FROM public.vw_lavoro_receita_executivo
    WHERE lower(status_parcela) = 'vencida' AND EXTRACT(YEAR FROM data_pagamento) = p_ano
    GROUP BY 1
  ),
  a_receber_futuro_calc AS (
    SELECT
      m.m AS mes,
      (SELECT SUM(valor) FROM public.vw_lavoro_receita_executivo v
       WHERE v.grupo_status = 'Pendente'
         AND v.data_emissao <= (make_date(p_ano, m.m, 1) + INTERVAL '1 month' - INTERVAL '1 day')
         AND v.data_pagamento > (make_date(p_ano, m.m, 1) + INTERVAL '1 month' - INTERVAL '1 day')
      ) AS total
    FROM meses m
  )
  SELECT
    meses.m,
    COALESCE(emitido_calc.total, 0),
    COALESCE(caixa_calc.total, 0),
    COALESCE(caixa_corrente_calc.total, 0),
    CASE WHEN meses.m = v_mes_atual AND p_ano = v_ano_atual THEN 0
         ELSE COALESCE(saldo_vencido_calc.total, 0) END,
    a_receber_futuro_calc.total
  FROM meses
  LEFT JOIN emitido_calc ON emitido_calc.mes = meses.m
  LEFT JOIN caixa_calc ON caixa_calc.mes = meses.m
  LEFT JOIN caixa_corrente_calc ON caixa_corrente_calc.mes = meses.m
  LEFT JOIN saldo_vencido_calc ON saldo_vencido_calc.mes = meses.m
  LEFT JOIN a_receber_futuro_calc ON a_receber_futuro_calc.mes = meses.m
  ORDER BY meses.m;
END;
$$;

GRANT SELECT ON public.vw_lavoro_receita_competencia TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_mensal(int) TO authenticated, service_role;