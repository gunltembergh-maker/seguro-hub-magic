-- 1) Filtros disponíveis para a tela de Gerencial de Apólices
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_filtros()
 RETURNS TABLE(status_parcela_comissao text[], seguradoras text[], tipos_ramo text[], tomadores text[], apolices text[], grupos text[], ramos text[], status_repasse text[], anos integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ARRAY(SELECT DISTINCT status_parcela_comissao FROM public.vw_lavoro_gerencial WHERE status_parcela_comissao IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT seguradora FROM public.vw_lavoro_gerencial WHERE seguradora IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT tipo_de_ramo FROM public.vw_lavoro_gerencial WHERE tipo_de_ramo IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT tomador FROM public.vw_lavoro_gerencial WHERE tomador IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT numero_apolice FROM public.vw_lavoro_gerencial WHERE numero_apolice IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT grupo FROM public.vw_lavoro_gerencial WHERE grupo IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT ramo FROM public.vw_lavoro_gerencial WHERE ramo IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT status_repasse FROM public.vw_lavoro_gerencial WHERE status_repasse IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1),
    ARRAY(SELECT DISTINCT ano FROM public.vw_lavoro_gerencial WHERE ano IS NOT NULL AND public.lavoro_canal_visivel(tipo_de_ramo) ORDER BY 1);
$function$;

-- 2) KPIs de Apólices
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_kpis(p_status text DEFAULT NULL::text, p_seguradora text DEFAULT NULL::text, p_tipo_ramo text DEFAULT NULL::text, p_tomador text DEFAULT NULL::text, p_apolice text DEFAULT NULL::text, p_grupo text DEFAULT NULL::text, p_ramo text DEFAULT NULL::text, p_possui_repasse text DEFAULT NULL::text, p_ano integer DEFAULT NULL::integer)
 RETURNS TABLE(premio_total numeric, comissao_emitida numeric, comissao_gerada numeric, repasse_parceiro numeric, comissao_menos_repasse numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT SUM(g.premio_parcela), SUM(g.comissao_emitida), SUM(g.comissao_bruta),
    SUM(g.valor_repasse_total),
    COALESCE(SUM(g.valor_recebido_a_receber),0) - COALESCE(SUM(g.valor_repasse_total),0)
  FROM public.vw_lavoro_gerencial g
  WHERE (p_status IS NULL OR g.status_parcela_comissao = p_status)
    AND (p_seguradora IS NULL OR g.seguradora = p_seguradora)
    AND (p_tipo_ramo IS NULL OR g.tipo_de_ramo = p_tipo_ramo)
    AND (p_tomador IS NULL OR g.tomador = p_tomador)
    AND (p_apolice IS NULL OR g.numero_apolice = p_apolice)
    AND (p_grupo IS NULL OR g.grupo = p_grupo)
    AND (p_ramo IS NULL OR g.ramo = p_ramo)
    AND (p_possui_repasse IS NULL OR g.possui_repasse = p_possui_repasse)
    AND (p_ano IS NULL OR g.ano = p_ano)
    AND public.lavoro_canal_visivel(g.tipo_de_ramo);
$function$;

-- 3) Lista de Apólices
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_lista(p_filtros jsonb DEFAULT '{}'::jsonb, p_pagina integer DEFAULT 1, p_tamanho_pagina integer DEFAULT 100)
 RETURNS TABLE(tomador text, segurado text, documento text, numero_apolice text, seguradora text, ramo text, tipo_de_ramo text, comissao_bruta numeric, status_parcela_comissao text, data_emissao date, total_linhas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.tomador, g.segurado, g.documento, g.numero_apolice, g.seguradora,
    g.ramo, g.tipo_de_ramo, g.comissao_bruta, g.status_parcela_comissao, g.data_emissao,
    COUNT(*) OVER() AS total_linhas
  FROM public.vw_lavoro_gerencial g
  WHERE (p_filtros->>'status' IS NULL OR g.status_parcela_comissao = p_filtros->>'status')
    AND (p_filtros->>'seguradora' IS NULL OR g.seguradora = p_filtros->>'seguradora')
    AND (p_filtros->>'tipo_ramo' IS NULL OR g.tipo_de_ramo = p_filtros->>'tipo_ramo')
    AND public.lavoro_canal_visivel(g.tipo_de_ramo)
  ORDER BY g.data_emissao DESC NULLS LAST
  LIMIT p_tamanho_pagina OFFSET (p_pagina - 1) * p_tamanho_pagina;
$function$;

-- 4) Apólices por seguradora
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_por_seguradora(p_filtros jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(seguradora text, comissao_bruta numeric, premio_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.seguradora, SUM(g.comissao_bruta), SUM(g.premio_parcela)
  FROM public.vw_lavoro_gerencial g
  WHERE (p_filtros->>'status' IS NULL OR g.status_parcela_comissao = p_filtros->>'status')
    AND (p_filtros->>'tipo_ramo' IS NULL OR g.tipo_de_ramo = p_filtros->>'tipo_ramo')
    AND public.lavoro_canal_visivel(g.tipo_de_ramo)
  GROUP BY g.seguradora ORDER BY 2 DESC;
$function$;

-- 5) Previsão por dezena
CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_previsao_dezena(p_ano integer DEFAULT NULL::integer, p_mes integer DEFAULT NULL::integer)
 RETURNS TABLE(ano integer, mes integer, dezena text, empresa_faturada text, valor_a_receber numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int := COALESCE(p_ano, EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_mes int := COALESCE(p_mes, EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_inicio date := make_date(v_ano, v_mes, 1);
  v_fim date := (v_inicio + interval '4 months' - interval '1 day')::date;
BEGIN
  RETURN QUERY
  SELECT g.ano, g.mes, g.dezena, g.empresa_faturada, SUM(g.valor_recebido_a_receber)
  FROM public.vw_lavoro_gerencial g
  WHERE g.data_pagamento BETWEEN v_inicio AND v_fim
    AND public.lavoro_canal_visivel(g.tipo_de_ramo)
  GROUP BY g.ano, g.mes, g.dezena, g.empresa_faturada
  ORDER BY g.ano, g.mes, g.dezena;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_filtros() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_kpis(text, text, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_lista(jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_por_seguradora(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_previsao_dezena(integer, integer) TO authenticated;