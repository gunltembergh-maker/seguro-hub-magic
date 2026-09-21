CREATE OR REPLACE FUNCTION public.rpc_lavoro_dezenas_detalhe(
  p_data_ini date,
  p_data_fim date,
  p_dezena text DEFAULT NULL,
  p_empresa text DEFAULT NULL,
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  data_pagamento date, empresa_faturada text, dezena text,
  valor_recebido_a_receber numeric,
  tomador text, segurado text, documento text,
  seguradora text, ramo text, tipo_de_ramo text, numero_apolice text,
  data_emissao date, inicio_vigencia date, fim_vigencia date,
  numero_da_parcela integer, qtd_parcelas integer, status_parcela_comissao text,
  premio_total numeric, premio_parcela numeric, percentual_comissao numeric,
  comissao_bruta numeric, imposto_ret numeric, valor_iss numeric,
  possui_repasse text, percentual_repasse numeric, valor_repasse_total numeric,
  status_repasse text, observacao text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH empresas(nome, padrao) AS (
    VALUES ('L Farias','%farias%'), ('Taicons','%taicon%'), ('ZIN','%zin%')
  ),
  d AS (
    SELECT g.*, v.dezena AS dz, v.tipo_de_ramo AS tpr, e.nome AS emp,
           regexp_replace(coalesce(g.documento,''),'\D','','g') AS dig
    FROM public.raw_lavoro_gerencial g
    JOIN public.vw_lavoro_gerencial v ON v.id = g.id
    JOIN empresas e ON g.empresa_faturada ILIKE e.padrao
    WHERE v.dezena IS NOT NULL
      AND g.data_pagamento BETWEEN p_data_ini AND p_data_fim
      AND (p_dezena  IS NULL OR v.dezena = p_dezena)
      AND (p_empresa IS NULL OR e.nome   = p_empresa)
  )
  SELECT d.data_pagamento, d.emp::text, d.dz::text,
         d.valor_recebido_a_receber,
         d.tomador, d.segurado,
         (CASE
            WHEN public.has_role(auth.uid(),'ADMIN'::app_role) THEN d.documento
            WHEN length(d.dig) = 11 THEN '***.'||substr(d.dig,4,3)||'.'||substr(d.dig,7,3)||'-**'
            WHEN length(d.dig) = 14 THEN substr(d.dig,1,2)||'.***.***/****-**'
            ELSE NULL
          END)::text,
         d.seguradora, d.ramo, d.tpr::text, d.numero_apolice,
         d.data_emissao, d.inicio_vigencia, d.fim_vigencia,
         d.numero_da_parcela, d.qtd_parcelas, d.status_parcela_comissao,
         d.premio_total, d.premio_parcela, d.percentual_comissao,
         d.comissao_bruta, d.imposto_ret, d.valor_iss,
         d.possui_repasse, d.percentual_repasse, d.valor_repasse_total,
         d.status_repasse, d.observacao
  FROM d
  ORDER BY d.data_pagamento, d.valor_recebido_a_receber DESC NULLS LAST, d.id
  LIMIT GREATEST(COALESCE(p_limit,500),1)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.rpc_lavoro_dezenas_detalhe(date,date,text,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_dezenas_detalhe(date,date,text,text,int,int) TO authenticated;
