create table public.hub_notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link text,
  dados jsonb,
  lida boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);
create index hub_notificacoes_destino on public.hub_notificacoes (user_id, lida, criado_em desc);
revoke all on public.hub_notificacoes from anon;
grant select, insert, update, delete on public.hub_notificacoes to authenticated;
grant all on public.hub_notificacoes to service_role;
alter table public.hub_notificacoes enable row level security;
create policy "hub_notif_select_dono" on public.hub_notificacoes for select to authenticated
  using (user_id = auth.uid());
create policy "hub_notif_update_dono" on public.hub_notificacoes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "hub_notif_insert" on public.hub_notificacoes for insert to authenticated
  with check (criado_por is null or criado_por = auth.uid());
create policy "hub_notif_delete_admin" on public.hub_notificacoes for delete to authenticated
  using (public.has_role(auth.uid(),'ADMIN'::app_role));

create table public.garantia_time_comercial (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);
revoke all on public.garantia_time_comercial from anon;
grant select, insert, update, delete on public.garantia_time_comercial to authenticated;
grant all on public.garantia_time_comercial to service_role;
alter table public.garantia_time_comercial enable row level security;
create policy "time_comercial_select" on public.garantia_time_comercial for select to authenticated
  using (public.pode_garantia_pipeline());
create policy "time_comercial_insert_admin" on public.garantia_time_comercial for insert to authenticated
  with check (public.has_role(auth.uid(),'ADMIN'::app_role));
create policy "time_comercial_update_admin" on public.garantia_time_comercial for update to authenticated
  using (public.has_role(auth.uid(),'ADMIN'::app_role)) with check (public.has_role(auth.uid(),'ADMIN'::app_role));
create policy "time_comercial_delete_admin" on public.garantia_time_comercial for delete to authenticated
  using (public.has_role(auth.uid(),'ADMIN'::app_role));

insert into public.garantia_time_comercial (user_id)
select p.user_id from public.profiles p
 where lower(p.email) = 'rodrigo.montanari@lavoroseguros.com.br'
on conflict (user_id) do nothing;

-- Pede documento ao time comercial: um aviso por pessoa ativa, situação vai
-- para aguard_doc_contrato e o pedido fica na observação do histórico.
create or replace function public.rpc_garantia_solicitar_documento(
  _demanda_id uuid, _faltando text, _observacao text default null)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_dem record; v_qtd int; v_texto text;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para operar o pipeline de Garantia.';
  end if;
  if coalesce(btrim(_faltando), '') = '' then
    raise exception 'Informe quais documentos estão faltando.';
  end if;
  select * into v_dem from public.garantia_demandas where id = _demanda_id for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if v_dem.fase <> 'negociacao' or v_dem.etapa not in ('1','2') then
    raise exception 'O pedido de documento é feito na Análise da demanda.';
  end if;
  if not exists (select 1 from public.garantia_time_comercial where ativo) then
    raise exception 'Ninguém está cadastrado como comercial. Um administrador precisa preencher o Time comercial.';
  end if;
  v_texto := btrim(_faltando) || coalesce(E'\n' || nullif(btrim(_observacao), ''), '');
  insert into public.hub_notificacoes (user_id, tipo, titulo, mensagem, link, dados, criado_por)
  select t.user_id, 'garantia_falta_documento',
         'Documento pendente: ' || coalesce(v_dem.legenda, v_dem.numero, 'demanda de Garantia'),
         v_texto,
         '/garantia/negociacao?demanda=' || v_dem.id::text,
         jsonb_build_object('demanda_id', v_dem.id, 'faltando', btrim(_faltando), 'observacao', nullif(btrim(_observacao), '')),
         auth.uid()
    from public.garantia_time_comercial t where t.ativo;
  get diagnostics v_qtd = row_count;
  if v_dem.status_atual <> 'aguard_doc_contrato' then
    update public.garantia_demandas set status_atual = 'aguard_doc_contrato' where id = _demanda_id;
  end if;
  update public.garantia_status_historico
     set observacao = 'Documento solicitado ao comercial: ' || v_texto
   where demanda_id = _demanda_id and fim is null;
  return v_qtd;
end $$;
revoke execute on function public.rpc_garantia_solicitar_documento(uuid, text, text) from public, anon;
grant  execute on function public.rpc_garantia_solicitar_documento(uuid, text, text) to authenticated;

-- Demandas aguardando documento que receberam anexo depois do pedido.
create or replace function public.rpc_garantia_docs_apos_pedido()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select d.id from public.garantia_demandas d
    join public.garantia_status_historico h on h.demanda_id = d.id and h.fim is null
   where public.pode_garantia_pipeline()
     and d.status_atual = 'aguard_doc_contrato'
     and exists (select 1 from public.garantia_documentos g where g.demanda_id = d.id and g.criado_em > h.inicio)
$$;
revoke execute on function public.rpc_garantia_docs_apos_pedido() from public, anon;
grant  execute on function public.rpc_garantia_docs_apos_pedido() to authenticated;