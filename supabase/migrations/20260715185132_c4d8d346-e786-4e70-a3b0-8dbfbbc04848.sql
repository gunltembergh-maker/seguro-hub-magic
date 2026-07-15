
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
WHERE sync_id = (SELECT sync_id FROM public.raw_lavoro_gerencial ORDER BY criado_em DESC LIMIT 1);

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
    SELECT EXTRACT(MONTH FROM data_emissao)::int AS mes, SUM(valor) AS total
    FROM public.vw_lavoro_receita_executivo
    WHERE grupo_status <> 'Excluir' AND EXTRACT(YEAR FROM data_emissao) = p_ano
    GROUP BY 1
  ),
  caixa_calc AS (
    SELECT EXTRACT(MONTH FROM data_pagamento)::int AS mes, SUM(valor) AS total
    FROM public.vw_lavoro_receita_executivo
    WHERE grupo_status <> 'Excluir' AND EXTRACT(YEAR FROM data_pagamento) = p_ano
    GROUP BY 1
  ),
  caixa_corrente_calc AS (
    SELECT EXTRACT(MONTH FROM data_pagamento)::int AS mes, SUM(valor) AS total
    FROM public.vw_lavoro_receita_executivo
    WHERE grupo_status = 'Paga' AND EXTRACT(YEAR FROM data_pagamento) = p_ano
    GROUP BY 1
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

CREATE OR REPLACE FUNCTION public.rpc_receita_executivo_complementares(p_ano int)
RETURNS TABLE (
  emissoes_ate_2025_a_receber numeric,
  vencidos_anteriores_2026 numeric,
  posicao_total_vencida numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COALESCE(SUM(valor),0) FROM public.vw_lavoro_receita_executivo
     WHERE grupo_status = 'Pendente' AND data_emissao < make_date(p_ano, 1, 1)),
    (SELECT COALESCE(SUM(valor),0) FROM public.vw_lavoro_receita_executivo
     WHERE lower(status_parcela) = 'vencida' AND data_pagamento < make_date(p_ano, 1, 1)),
    (SELECT COALESCE(SUM(valor),0) FROM public.vw_lavoro_receita_executivo WHERE lower(status_parcela) = 'vencida');
$$;

GRANT SELECT ON public.vw_lavoro_receita_executivo TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_mensal(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_executivo_complementares(int) TO authenticated;
