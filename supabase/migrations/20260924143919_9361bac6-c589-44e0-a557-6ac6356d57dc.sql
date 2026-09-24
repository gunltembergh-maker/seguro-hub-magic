update public.garantia_demandas
   set status_atual = 'triagem', etapa = '1'
 where status_atual = 'analise_tecnica';

update public.garantia_status_catalogo
   set nome = 'Corretor analisando o documento'
 where codigo = 'triagem';

update public.garantia_status_catalogo
   set etapa = '1'
 where codigo = 'aguard_doc_contrato';

update public.garantia_status_catalogo
   set ativo = false
 where codigo = 'analise_tecnica';

update public.garantia_demandas set etapa = '1' where etapa = '2';