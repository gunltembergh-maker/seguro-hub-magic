-- Funções de gatilho: SECURITY INVOKER + revoke
alter function public.garantia_demandas_registra_status() security invoker;
alter function public.garantia_documentos_versiona() security invoker;
alter function public.garantia_documentos_marca_substituido() security invoker;
alter function public.garantia_registra_auditoria() security invoker;
alter function public.garantia_touch_atualizado_em() security invoker;
alter function public.hub_clientes_protege_responsavel() security invoker;

revoke execute on function public.garantia_demandas_registra_status() from public, anon;
revoke execute on function public.garantia_documentos_versiona() from public, anon;
revoke execute on function public.garantia_documentos_marca_substituido() from public, anon;
revoke execute on function public.garantia_registra_auditoria() from public, anon;
revoke execute on function public.garantia_touch_atualizado_em() from public, anon;
revoke execute on function public.hub_clientes_protege_responsavel() from public, anon;

-- Helpers pode_*: mantêm SECURITY DEFINER, mas só authenticated executa
revoke execute on function public.pode_entrada_demandas()        from public, anon;
revoke execute on function public.pode_entrada_cadastrar_canal() from public, anon;
revoke execute on function public.pode_garantia_pipeline()       from public, anon;
revoke execute on function public.pode_garantia_painel()         from public, anon;
grant  execute on function public.pode_entrada_demandas()        to authenticated;
grant  execute on function public.pode_entrada_cadastrar_canal() to authenticated;
grant  execute on function public.pode_garantia_pipeline()       to authenticated;
grant  execute on function public.pode_garantia_painel()         to authenticated;