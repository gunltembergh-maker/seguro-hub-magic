
-- Fila do comercial: leitura sem SELECT direto nas tabelas do pipeline.
create or replace function public.rpc_garantia_fila_comercial()
returns table (demanda_id uuid, numero text, legenda text, cliente_nome text, status_nome text, aguardando_desde timestamptz, o_que_falta text)
language sql stable security definer set search_path to 'public'
as $$
  select d.id, d.numero::text, d.legenda, coalesce(c.nome, c.nome_fantasia)::text, s.nome::text, h.inicio, h.observacao
    from public.garantia_demandas d
    join public.garantia_status_catalogo s on s.codigo = d.status_atual
    left join public.hub_clientes c on c.id = d.cliente_id
    left join lateral (
      select gh.inicio, gh.observacao from public.garantia_status_historico gh
       where gh.demanda_id = d.id and gh.fim is null
       order by gh.inicio desc limit 1) h on true
   where public.tem_permissao('menu_garantia_comercial')
     and s.com_quem in ('comercial','cliente_ou_comercial')
   order by h.inicio asc nulls last
$$;
revoke all on function public.rpc_garantia_fila_comercial() from public, anon;
grant execute on function public.rpc_garantia_fila_comercial() to authenticated;

-- Quem do time comercial tem acesso à aba (sem e-mail).
create or replace function public.rpc_garantia_time_comercial_acesso()
returns table (user_id uuid, nome text, tem_acesso boolean)
language sql stable security definer set search_path to 'public'
as $$
  select t.user_id, coalesce(p.full_name, 'Pessoa sem nome')::text, public.tem_permissao('menu_garantia_comercial', t.user_id)
    from public.garantia_time_comercial t
    left join public.profiles p on p.user_id = t.user_id
   where public.tem_permissao('menu_garantia_negociacao') or public.has_role(auth.uid(), 'ADMIN')
$$;
revoke all on function public.rpc_garantia_time_comercial_acesso() from public, anon;
grant execute on function public.rpc_garantia_time_comercial_acesso() to authenticated;

-- Pedido de documento: avisa só quem tem acesso à aba e nunca é bloqueado.
create or replace function public.rpc_garantia_solicitar_documento(_demanda_id uuid, _faltando text, _observacao text default null)
 returns integer language plpgsql security definer set search_path to 'public'
as $function$
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
  v_texto := btrim(_faltando) || coalesce(E'\n' || nullif(btrim(_observacao), ''), '');
  insert into public.hub_notificacoes (user_id, tipo, titulo, mensagem, link, dados, criado_por)
  select t.user_id, 'garantia_falta_documento',
         'Documento pendente: ' || coalesce(v_dem.legenda, v_dem.numero, 'demanda de Garantia'),
         v_texto,
         '/garantia/negociacao?demanda=' || v_dem.id::text,
         jsonb_build_object('demanda_id', v_dem.id, 'faltando', btrim(_faltando), 'observacao', nullif(btrim(_observacao), '')),
         auth.uid()
    from public.garantia_time_comercial t
   where t.ativo and public.tem_permissao('menu_garantia_comercial', t.user_id);
  get diagnostics v_qtd = row_count;
  if v_dem.status_atual <> 'aguard_doc_contrato' then
    update public.garantia_demandas set status_atual = 'aguard_doc_contrato' where id = _demanda_id;
  end if;
  update public.garantia_status_historico
     set observacao = 'Documento solicitado ao comercial: ' || v_texto
   where demanda_id = _demanda_id and fim is null;
  return v_qtd;
end $function$;

-- Anexo enviado pelo comercial.
alter table public.garantia_documentos drop constraint garantia_documentos_tipo_check;
alter table public.garantia_documentos add constraint garantia_documentos_tipo_check check (tipo = any (array['email_original','edital','contrato','contrato_locacao','aditivo','apostilamento','processo_judicial','dre','balanco','alteracao_contratual','carta_nomeacao','irpf','outro_cadastro','comparativo','ccg','minuta','apolice','boleto','termo_liberacao','endosso_cancelamento','notificacao_sinistro','outro','comercial']));

-- Co-corretagem: divisão da comissão entre corretoras.
create table public.garantia_cocorretagem (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete cascade,
  corretora text not null,
  cnpj text,
  percentual_comissao numeric(5,2) not null check (percentual_comissao > 0 and percentual_comissao <= 100),
  lider boolean not null default false,
  eh_lavoro boolean not null default false,
  observacao text,
  criado_por uuid,
  criado_em timestamptz not null default now()
);
create unique index garantia_cocorretagem_lider_uq on public.garantia_cocorretagem (demanda_id) where lider;
create unique index garantia_cocorretagem_corretora_uq on public.garantia_cocorretagem (demanda_id, lower(btrim(corretora)));
create index garantia_cocorretagem_demanda on public.garantia_cocorretagem (demanda_id);
grant select, insert, update, delete on public.garantia_cocorretagem to authenticated;
grant all on public.garantia_cocorretagem to service_role;
revoke all on public.garantia_cocorretagem from anon;
alter table public.garantia_cocorretagem enable row level security;
create policy cocorretagem_select on public.garantia_cocorretagem for select to authenticated using (public.pode_garantia_pipeline());
create policy cocorretagem_insert on public.garantia_cocorretagem for insert to authenticated with check (public.pode_garantia_pipeline());
create policy cocorretagem_update on public.garantia_cocorretagem for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy cocorretagem_delete on public.garantia_cocorretagem for delete to authenticated using (public.pode_garantia_pipeline());

create policy cosseguro_delete on public.garantia_cosseguro for delete to authenticated using (public.pode_garantia_pipeline());
