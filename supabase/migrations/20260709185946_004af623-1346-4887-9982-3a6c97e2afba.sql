UPDATE public.perfis_acesso
SET permissoes = COALESCE(permissoes,'{}'::jsonb) || jsonb_build_object('menu_dashboards', true)
WHERE nome IN ('Admin', 'Diretoria Geral');