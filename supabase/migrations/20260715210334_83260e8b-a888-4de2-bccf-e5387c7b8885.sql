
-- =========================================================
-- F1: RPCs para o novo Hub (Início Lavoro)
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_inicio_lavoro_resumo()
RETURNS TABLE (
  receita_competencia_mes numeric,
  receita_caixa_mes numeric,
  receita_caixa_recebida_mes numeric,
  atingimento_caixa_mes numeric,
  total_vencido_mes numeric,
  ultima_atualizacao timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano int := extract(year from now() at time zone 'America/Sao_Paulo')::int;
  v_mes int := extract(month from now() at time zone 'America/Sao_Paulo')::int;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      g.ano,
      g.mes,
      COALESCE(g.comissao_emitida, 0)::numeric AS emitido,
      COALESCE(g.valor_recebido_a_receber, 0)::numeric AS caixa_previsto,
      CASE
        WHEN g.status_parcela_comissao ILIKE '%pago%'
          OR g.status_parcela_comissao ILIKE '%receb%'
          OR g.data_pagamento IS NOT NULL
        THEN COALESCE(g.valor_recebido_a_receber, 0)::numeric
        ELSE 0::numeric
      END AS caixa_recebido,
      CASE
        WHEN g.data_pagamento IS NULL
          AND g.data_repasse IS NOT NULL
          AND g.data_repasse::date < (now() at time zone 'America/Sao_Paulo')::date
        THEN COALESCE(g.valor_recebido_a_receber, 0)::numeric
        ELSE 0::numeric
      END AS vencido
    FROM public.raw_lavoro_gerencial g
    WHERE g.ano = v_ano AND g.mes = v_mes
  ),
  agg AS (
    SELECT
      SUM(emitido)         AS receita_competencia_mes,
      SUM(caixa_previsto)  AS receita_caixa_mes,
      SUM(caixa_recebido)  AS receita_caixa_recebida_mes,
      SUM(vencido)         AS total_vencido_mes
    FROM base
  ),
  ts AS (
    SELECT MAX(criado_em) AS ultima_atualizacao FROM public.raw_lavoro_gerencial
  )
  SELECT
    COALESCE(a.receita_competencia_mes, 0),
    COALESCE(a.receita_caixa_mes, 0),
    COALESCE(a.receita_caixa_recebida_mes, 0),
    CASE WHEN COALESCE(a.receita_caixa_mes, 0) > 0
         THEN COALESCE(a.receita_caixa_recebida_mes, 0) / a.receita_caixa_mes
         ELSE 0
    END,
    COALESCE(a.total_vencido_mes, 0),
    ts.ultima_atualizacao
  FROM agg a CROSS JOIN ts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inicio_lavoro_resumo() TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_inicio_timestamps()
RETURNS TABLE (
  fonte text,
  ultima_atualizacao timestamptz,
  total_linhas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'Base Gerencial'::text, MAX(criado_em), COUNT(*)::bigint
  FROM public.raw_lavoro_gerencial
  UNION ALL
  SELECT 'Caixa Bradesco'::text, MAX(criado_em), COUNT(*)::bigint
  FROM public.raw_lavoro_caixa_comissao;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inicio_timestamps() TO authenticated;

-- =========================================================
-- F2: RPC para Minha Visão (impersonation ADMIN)
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_perfil_by_user_id(_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  blocked boolean,
  active boolean,
  primeiro_acesso boolean,
  perfil_id uuid,
  perfil_nome text,
  permissoes jsonb,
  roles text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::public.app_role) THEN
    RAISE EXCEPTION 'Somente ADMIN pode usar Minha Visão';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.blocked,
    p.active,
    p.primeiro_acesso,
    p.perfil_id,
    pa.nome AS perfil_nome,
    COALESCE(pa.permissoes, '{}'::jsonb) AS permissoes,
    COALESCE(ARRAY(
      SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id
    ), ARRAY[]::text[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
  WHERE p.user_id = _user_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_perfil_by_user_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_list_users_simples()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  perfil_nome text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::public.app_role) THEN
    RAISE EXCEPTION 'Somente ADMIN';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    pa.nome,
    (
      SELECT ur.role::text FROM public.user_roles ur
      WHERE ur.user_id = p.user_id
      ORDER BY CASE ur.role::text
        WHEN 'ADMIN' THEN 1
        WHEN 'DIRETORIA_GERAL' THEN 2
        ELSE 3 END
      LIMIT 1
    )
  FROM public.profiles p
  LEFT JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
  WHERE p.active = true AND p.blocked = false
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_list_users_simples() TO authenticated;
