-- RPC: recebimento por dezena, filtrado pelas 3 empresas (L Farias, Taicons, ZIN)
-- Retorna janela de 4 meses (mês âncora + 3), agregando "a receber" e "pago" (valor bruto da parcela) por dezena/empresa.
CREATE OR REPLACE FUNCTION public.rpc_lavoro_recebimento_dezenas_empresas(
  p_ano int,
  p_mes int
)
RETURNS TABLE (
  ano int,
  mes int,
  dezena text,
  empresa text,
  valor numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH janela AS (
    SELECT
      (EXTRACT(YEAR  FROM d)::int) AS ano,
      (EXTRACT(MONTH FROM d)::int) AS mes
    FROM generate_series(
      make_date(p_ano, p_mes, 1),
      make_date(p_ano, p_mes, 1) + INTERVAL '3 months',
      INTERVAL '1 month'
    ) AS d
  ),
  empresas(chave, nome, padrao) AS (
    VALUES
      ('l_farias', 'L Farias', '%farias%'),
      ('taicons',  'Taicons',  '%taicon%'),
      ('zin',      'ZIN',      '%zin%')
  ),
  base AS (
    SELECT
      g.ano,
      g.mes,
      g.dezena,
      e.nome AS empresa,
      COALESCE(SUM(g.valor_recebido_a_receber), 0) AS valor
    FROM public.vw_lavoro_gerencial g
    JOIN empresas e
      ON g.empresa_faturada ILIKE e.padrao
    WHERE g.data_pagamento IS NOT NULL
      AND g.dezena IS NOT NULL
    GROUP BY g.ano, g.mes, g.dezena, e.nome
  ),
  dezenas(dezena) AS (VALUES ('1-10'), ('11-20'), ('21-31'))
  SELECT
    j.ano,
    j.mes,
    d.dezena,
    e.nome AS empresa,
    COALESCE(b.valor, 0) AS valor
  FROM janela j
  CROSS JOIN dezenas d
  CROSS JOIN empresas e
  LEFT JOIN base b
    ON b.ano = j.ano AND b.mes = j.mes AND b.dezena = d.dezena AND b.empresa = e.nome
  ORDER BY j.ano, j.mes, d.dezena, e.nome;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_recebimento_dezenas_empresas(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_recebimento_dezenas_empresas(int, int) TO service_role;