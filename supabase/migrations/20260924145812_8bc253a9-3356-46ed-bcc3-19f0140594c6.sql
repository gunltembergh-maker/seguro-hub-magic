alter table public.garantia_analises_ia
  add column if not exists documentos_ids uuid[] not null default '{}';

comment on column public.garantia_analises_ia.documentos_ids is
  'Documentos que entraram nesta análise. O corretor escolhe quais ler, porque o comercial costuma mandar contrato, DRE e balanço juntos e cada família usa um prompt diferente.';

update public.garantia_analises_ia
   set documentos_ids = array[documento_id]
 where documento_id is not null and documentos_ids = '{}';