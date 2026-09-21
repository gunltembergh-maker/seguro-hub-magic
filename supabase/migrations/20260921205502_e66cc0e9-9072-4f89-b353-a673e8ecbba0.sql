CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_canal(p_ano integer, p_mes integer, p_periodo text, p_user_id uuid)
 RETURNS TABLE(tipo_de_ramo text, receita numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_receita_por_canal(p_ano, p_mes, p_periodo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_por_ramo(p_ano integer, p_mes integer, p_periodo text, p_user_id uuid)
 RETURNS TABLE(ramo text, receita numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_receita_por_ramo(p_ano, p_mes, p_periodo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_comparativo_anual(p_anos integer[], p_user_id uuid)
 RETURNS TABLE(ano integer, mes integer, receita_competencia numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_receita_comparativo_anual(p_anos);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_receita_serie_mensal(p_ano integer, p_user_id uuid)
 RETURNS TABLE(mes integer, receita_competencia numeric, receita_caixa numeric, meta_mensal numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_receita_serie_mensal(p_ano);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_comissao_vencida_por_canal(p_ano integer, p_mes integer, p_periodo text, p_user_id uuid)
 RETURNS TABLE(tipo_de_ramo text, comissao_vencida numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_comissao_vencida_por_canal(p_ano, p_mes, p_periodo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_comissao_vencida_export_resumo(p_data_ini date, p_user_id uuid)
 RETURNS TABLE(tipo_de_ramo text, seguradora text, faixa_aging text, qtd_itens bigint, comissao_bruta numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_comissao_vencida_export_resumo(p_data_ini);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_comissao_vencida_export_detalhe(p_data_ini date, p_tipo_de_ramo text, p_seguradora text, p_limit integer, p_offset integer, p_user_id uuid)
 RETURNS TABLE(tomador text, segurado text, documento text, tipo_de_ramo text, ramo text, seguradora text, numero_apolice text, data_emissao date, data_pagamento date, dias_atraso integer, faixa_aging text, numero_da_parcela integer, comissao_bruta numeric, status_parcela_comissao text, responsavel text, observacao text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_comissao_vencida_export_detalhe(p_data_ini, p_tipo_de_ramo, p_seguradora, p_limit, p_offset);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_filtros(p_user_id uuid)
 RETURNS TABLE(status_parcela_comissao text[], seguradoras text[], tipos_ramo text[], tomadores text[], apolices text[], grupos text[], ramos text[], status_repasse text[], anos integer[])
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_apolices_filtros();
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_kpis(p_status text, p_seguradora text, p_tipo_ramo text, p_tomador text, p_apolice text, p_grupo text, p_ramo text, p_possui_repasse text, p_ano integer, p_user_id uuid)
 RETURNS TABLE(premio_total numeric, comissao_emitida numeric, comissao_gerada numeric, repasse_parceiro numeric, comissao_menos_repasse numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_apolices_kpis(p_status, p_seguradora, p_tipo_ramo, p_tomador, p_apolice, p_grupo, p_ramo, p_possui_repasse, p_ano);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_lista(p_filtros jsonb, p_pagina integer, p_tamanho_pagina integer, p_user_id uuid)
 RETURNS TABLE(tomador text, segurado text, documento text, numero_apolice text, seguradora text, ramo text, tipo_de_ramo text, comissao_bruta numeric, status_parcela_comissao text, data_emissao date, total_linhas bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_apolices_lista(p_filtros, p_pagina, p_tamanho_pagina);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_por_seguradora(p_filtros jsonb, p_user_id uuid)
 RETURNS TABLE(seguradora text, comissao_bruta numeric, premio_total numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_apolices_por_seguradora(p_filtros);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lavoro_apolices_previsao_dezena(p_ano integer, p_mes integer, p_user_id uuid)
 RETURNS TABLE(ano integer, mes integer, dezena text, empresa_faturada text, valor_a_receber numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.canal_user_id', COALESCE(p_user_id::text, ''), true);
  RETURN QUERY SELECT * FROM public.rpc_lavoro_apolices_previsao_dezena(p_ano, p_mes);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_por_canal(integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_por_ramo(integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_comparativo_anual(integer[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_receita_serie_mensal(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_comissao_vencida_por_canal(integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_comissao_vencida_export_resumo(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_comissao_vencida_export_detalhe(date, text, text, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_filtros(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_kpis(text, text, text, text, text, text, text, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_lista(jsonb, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_por_seguradora(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_apolices_previsao_dezena(integer, integer, uuid) TO authenticated;