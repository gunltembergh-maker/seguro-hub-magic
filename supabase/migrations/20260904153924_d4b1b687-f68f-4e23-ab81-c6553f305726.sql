UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
      'menu_financeiro_fluxo_diario',
      COALESCE((permissoes->>'menu_area_financeiro')::boolean, false)
    ),
    updated_at = now();