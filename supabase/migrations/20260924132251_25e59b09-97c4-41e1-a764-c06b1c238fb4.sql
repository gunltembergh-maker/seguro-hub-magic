create or replace function public.rpc_garantia_voltar_etapa(
  _demanda_id uuid, _status_destino text, _motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_dem record; v_destino record;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para operar o pipeline de Garantia.';
  end if;
  if coalesce(btrim(_motivo), '') = '' then
    raise exception 'Informe o motivo do retorno.';
  end if;
  select * into v_dem from public.garantia_demandas where id = _demanda_id for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  select * into v_destino from public.garantia_status_catalogo where codigo = _status_destino and ativo;
  if not found then raise exception 'Status de destino inválido.'; end if;
  if v_destino.fase <> v_dem.fase then
    raise exception 'Este retorno muda de fase e tem caminho próprio.';
  end if;
  if v_dem.produto = 'fianca_locaticia' and v_destino.etapa = '3' then
    raise exception 'Fiança locatícia não passa pela consulta a mercado.';
  end if;
  update public.garantia_demandas
     set status_atual = v_destino.codigo,
         etapa = case when v_destino.etapa = 'qualquer' then v_dem.etapa else v_destino.etapa end
   where id = _demanda_id;
  update public.garantia_status_historico
     set observacao = btrim(_motivo)
   where demanda_id = _demanda_id and fim is null;
end $$;
revoke execute on function public.rpc_garantia_voltar_etapa(uuid, text, text) from public, anon;
grant  execute on function public.rpc_garantia_voltar_etapa(uuid, text, text) to authenticated;

create table public.garantia_retorno_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete cascade,
  motivo text not null,
  situacao text not null default 'pendente' check (situacao in ('pendente','aprovada','recusada')),
  solicitado_por uuid references auth.users(id) on delete set null,
  solicitado_em timestamptz not null default now(),
  decidido_por uuid references auth.users(id) on delete set null,
  decidido_em timestamptz,
  resposta text
);
create unique index garantia_retorno_pendente_uq
  on public.garantia_retorno_solicitacoes (demanda_id) where situacao = 'pendente';
grant select, insert, update, delete on public.garantia_retorno_solicitacoes to authenticated;
grant all on public.garantia_retorno_solicitacoes to service_role;
alter table public.garantia_retorno_solicitacoes enable row level security;
create policy "retorno_select" on public.garantia_retorno_solicitacoes for select to authenticated
  using (public.pode_garantia_pipeline());
create policy "retorno_insert" on public.garantia_retorno_solicitacoes for insert to authenticated
  with check (public.pode_garantia_pipeline());
create policy "retorno_update_admin" on public.garantia_retorno_solicitacoes for update to authenticated
  using (public.has_role(auth.uid(),'ADMIN'::app_role)) with check (public.has_role(auth.uid(),'ADMIN'::app_role));
create policy "retorno_delete_admin" on public.garantia_retorno_solicitacoes for delete to authenticated
  using (public.has_role(auth.uid(),'ADMIN'::app_role));

create or replace function public.rpc_garantia_solicitar_retorno(_demanda_id uuid, _motivo text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_dem record; v_id uuid;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para operar o pipeline de Garantia.';
  end if;
  if coalesce(btrim(_motivo), '') = '' then raise exception 'Informe o motivo do pedido de volta.'; end if;
  select * into v_dem from public.garantia_demandas where id = _demanda_id for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if v_dem.fase <> 'crm' then raise exception 'Só demanda no CRM pode pedir volta para a negociação.'; end if;
  if exists (select 1 from public.garantia_retorno_solicitacoes where demanda_id = _demanda_id and situacao = 'pendente') then
    raise exception 'Já existe um pedido de volta aguardando análise do admin.';
  end if;
  insert into public.garantia_retorno_solicitacoes (demanda_id, motivo, solicitado_por)
  values (_demanda_id, btrim(_motivo), auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.rpc_garantia_solicitar_retorno(uuid, text) from public, anon;
grant  execute on function public.rpc_garantia_solicitar_retorno(uuid, text) to authenticated;

create or replace function public.rpc_garantia_decidir_retorno(_solicitacao_id uuid, _aprovar boolean, _resposta text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_sol record; v_dem record;
begin
  if not public.has_role(auth.uid(), 'ADMIN'::app_role) then
    raise exception 'Só um administrador pode decidir o pedido de volta.';
  end if;
  select * into v_sol from public.garantia_retorno_solicitacoes where id = _solicitacao_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_sol.situacao <> 'pendente' then raise exception 'Este pedido já foi decidido.'; end if;

  if _aprovar then
    select * into v_dem from public.garantia_demandas where id = v_sol.demanda_id for update;
    if v_dem.fase <> 'crm' then raise exception 'A demanda não está mais no CRM.'; end if;
    -- O codigo GAR NUNCA é apagado nem renumerado: é histórico, já usado com cliente e seguradora.
    update public.garantia_demandas
       set fase = 'negociacao', etapa = '5', status_atual = 'aguard_aceite_cliente'
     where id = v_sol.demanda_id;
    update public.garantia_status_historico
       set observacao = 'Retorno do CRM aprovado: ' || v_sol.motivo
     where demanda_id = v_sol.demanda_id and fim is null;
  end if;

  update public.garantia_retorno_solicitacoes
     set situacao = case when _aprovar then 'aprovada' else 'recusada' end,
         decidido_por = auth.uid(), decidido_em = now(),
         resposta = nullif(btrim(coalesce(_resposta, '')), '')
   where id = _solicitacao_id;
end $$;
revoke execute on function public.rpc_garantia_decidir_retorno(uuid, boolean, text) from public, anon;
grant  execute on function public.rpc_garantia_decidir_retorno(uuid, boolean, text) to authenticated;

-- Aceite: demanda que voltou do CRM já tem codigo; o novo aceite reaproveita o mesmo GAR.
create or replace function public.rpc_garantia_registrar_aceite(_demanda_id uuid)
 returns table(codigo text, legenda text)
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_codigo text; v_legenda text; v_dem record;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para operar o pipeline de Garantia.';
  end if;
  select d.* into v_dem from public.garantia_demandas d where d.id = _demanda_id for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if v_dem.fase in ('crm', 'encerrada') then
    return query select v_dem.codigo, v_dem.legenda; return;
  end if;
  if v_dem.fase <> 'negociacao' then raise exception 'Só demanda em negociação pode receber aceite.'; end if;
  if not exists (select 1 from public.garantia_cotacoes q where q.demanda_id = _demanda_id and q.escolhida) then
    raise exception 'Escolha a cotação aceita antes de registrar o aceite.';
  end if;
  v_codigo := coalesce(v_dem.codigo, 'GAR-' || lpad(nextval('public.garantia_demandas_codigo_seq')::text, 5, '0'));
  update public.garantia_demandas d
     set codigo = v_codigo, fase = 'crm', etapa = '6', status_atual = 'curadoria'
   where d.id = _demanda_id
  returning d.legenda into v_legenda;
  return query select v_codigo, v_legenda;
end;
$function$;

create or replace function public.rpc_garantia_painel_conversao(_de date DEFAULT NULL::date, _ate date DEFAULT NULL::date, _produto text DEFAULT NULL::text, _modalidade text DEFAULT NULL::text, _canal uuid DEFAULT NULL::uuid, _responsavel uuid DEFAULT NULL::uuid)
 RETURNS TABLE(agrupamento text, chave text, rotulo text, ganhos bigint, perdidos bigint, abertas bigint, pct_ganho numeric)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'America/Sao_Paulo'
AS $function$
  -- GANHO = fase in ('crm','encerrada'). NUNCA "codigo is not null": o aceite
  -- pode ser desfeito e o GAR fica na demanda que voltou (é histórico, não troféu).
  with base as (
    select d.id, d.modalidade, d.canal_id, d.responsavel_tecnico_id,
           (d.fase in ('crm', 'encerrada')) as ganhou,
           (d.fase = 'perdida') as perdeu,
           cn.nome as canal_nome, pf.full_name as responsavel_nome
      from public.garantia_demandas d
      left join public.canais cn on cn.id = d.canal_id
      left join public.profiles pf on pf.user_id = d.responsavel_tecnico_id
     where public.pode_garantia_painel()
       and (_de is null or d.chegada_em >= _de::timestamptz)
       and (_ate is null or d.chegada_em < (_ate + 1)::timestamptz)
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
  ),
  agregado as (
    select 'modalidade' as agrupamento,
           coalesce(b.modalidade, 'sem_modalidade') as chave,
           coalesce(b.modalidade, 'Sem modalidade') as rotulo,
           count(*) filter (where b.ganhou) as ganhos,
           count(*) filter (where b.perdeu) as perdidos,
           count(*) filter (where not b.ganhou and not b.perdeu) as abertas
      from base b group by b.modalidade
    union all
    select 'canal', coalesce(b.canal_id::text, 'sem_canal'),
           coalesce(b.canal_nome, 'Sem canal'),
           count(*) filter (where b.ganhou),
           count(*) filter (where b.perdeu),
           count(*) filter (where not b.ganhou and not b.perdeu)
      from base b group by b.canal_id, b.canal_nome
    union all
    select 'responsavel', coalesce(b.responsavel_tecnico_id::text, 'sem_responsavel'),
           coalesce(b.responsavel_nome, 'Sem responsável'),
           count(*) filter (where b.ganhou),
           count(*) filter (where b.perdeu),
           count(*) filter (where not b.ganhou and not b.perdeu)
      from base b group by b.responsavel_tecnico_id, b.responsavel_nome
  )
  select a.agrupamento, a.chave, a.rotulo, a.ganhos, a.perdidos, a.abertas,
         case when (a.ganhos + a.perdidos) = 0 then null
              else round(100.0 * a.ganhos / (a.ganhos + a.perdidos), 1) end
    from agregado a;
$function$;