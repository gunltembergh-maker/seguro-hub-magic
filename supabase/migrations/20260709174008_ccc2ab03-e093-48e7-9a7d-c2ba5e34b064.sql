
-- Views: rodar como invoker
ALTER VIEW public.vw_lavoro_receita_competencia SET (security_invoker = true);
ALTER VIEW public.vw_lavoro_receita_caixa       SET (security_invoker = true);
ALTER VIEW public.vw_lavoro_previsto_caixa      SET (security_invoker = true);

-- Search path em funções utilitárias
ALTER FUNCTION public.divide_safe(numeric, numeric) SET search_path = public;
ALTER FUNCTION public.normalize_categoria_financeira(text) SET search_path = public;

-- Revogar EXECUTE de PUBLIC/anon em todas as funções sensíveis
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'has_role','is_admin_or_diretoria','pode_gerenciar_configuracoes',
         'pode_importar','is_dominio_lavoro','handle_new_user',
         'grant_role_for_verified_domain','rpc_registrar_acesso',
         'rpc_meu_perfil','rpc_permitir_login_senha','rpc_get_meta_anual',
         'rpc_set_meta_anual','rpc_receita_kpis','rpc_receita_serie_mensal',
         'rpc_receita_comparativo_anual','rpc_receita_caixa_comparativo_anual',
         'rpc_receita_por_canal','rpc_receita_por_ramo','rpc_receita_variacoes',
         'rpc_comissao_vencida_por_canal','set_updated_at')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
