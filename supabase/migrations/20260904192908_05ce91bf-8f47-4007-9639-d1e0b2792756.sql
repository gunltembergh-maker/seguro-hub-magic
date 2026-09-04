REVOKE ALL ON FUNCTION public.rpc_lavoro_repasse_por_canal(int,int,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_lavoro_repasse_filtros() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_lavoro_repasse_rodape() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_lavoro_repasse_previsao_longa(int,int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_lavoro_repasse_idade(int,int,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_lavoro_repasse_detalhe(int,int,text,text,text,int,int) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_por_canal(int,int,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_filtros() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_rodape() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_previsao_longa(int,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_idade(int,int,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lavoro_repasse_detalhe(int,int,text,text,text,int,int) TO authenticated;