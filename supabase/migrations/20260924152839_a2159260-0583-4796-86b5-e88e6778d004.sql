-- Cosseguro: várias seguradoras dividindo o mesmo risco quando nenhuma cobre sozinha.
create table public.garantia_cosseguro (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete cascade,
  chave_mercado text references public.garantia_seguradoras_config(chave_mercado),
  seguradora_livre text,
  importancia_segurada numeric(18,2) not null check (importancia_segurada > 0),
  lider boolean not null default false,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  check (chave_mercado is not null or seguradora_livre is not null)
);
create unique index garantia_cosseguro_lider_uq on public.garantia_cosseguro (demanda_id) where lider;
create unique index garantia_cosseguro_seg_uq on public.garantia_cosseguro (demanda_id, chave_mercado) where chave_mercado is not null;
create index garantia_cosseguro_demanda on public.garantia_cosseguro (demanda_id);

grant select, insert, update, delete on public.garantia_cosseguro to authenticated;
grant all on public.garantia_cosseguro to service_role;
revoke all on public.garantia_cosseguro from anon;

alter table public.garantia_cosseguro enable row level security;
create policy cosseguro_select on public.garantia_cosseguro for select to authenticated using (public.pode_garantia_pipeline());
create policy cosseguro_insert on public.garantia_cosseguro for insert to authenticated
  with check (public.pode_garantia_pipeline() and (criado_por is null or criado_por = auth.uid()));
create policy cosseguro_update on public.garantia_cosseguro for update to authenticated
  using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy cosseguro_delete_admin on public.garantia_cosseguro for delete to authenticated
  using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Dispensa dos documentos de cadastro, com motivo e autor. É histórico: não se apaga.
alter table public.garantia_demandas
  add column if not exists cadastro_dispensado_motivo text,
  add column if not exists cadastro_dispensado_por uuid references auth.users(id) on delete set null,
  add column if not exists cadastro_dispensado_em timestamptz;

-- Situações da etapa de Cadastro.
update public.garantia_status_catalogo set com_quem = 'cliente_ou_comercial' where codigo = 'aguard_doc_cadastro';
insert into public.garantia_status_catalogo (codigo, nome, etapa, fase, relogio, com_quem, ordem, ativo)
values ('analisando_cadastro', 'Corretor analisando os documentos', '3b', 'negociacao', 'interno', 'corretora', 7, true)
on conflict (codigo) do nothing;

-- Ordem legível da 3b: solicitando → aguardando → analisando → enviando → aguardando análise.
-- A ordem é inteira e só havia 4 posições livres; as etapas 4 e 5 andam uma casa.
update public.garantia_status_catalogo set ordem = 14 where codigo = 'aguard_aceite_cliente';
update public.garantia_status_catalogo set ordem = 13 where codigo = 'montando_proposta';
update public.garantia_status_catalogo set ordem = 12 where codigo = 'aguard_cotacao';
update public.garantia_status_catalogo set ordem = 11 where codigo = 'em_cotacao';
update public.garantia_status_catalogo set ordem = 10 where codigo = 'aguard_analise_cadastro';
update public.garantia_status_catalogo set ordem = 9  where codigo = 'enviando_cadastro';
update public.garantia_status_catalogo set ordem = 8  where codigo = 'analisando_cadastro';
update public.garantia_status_catalogo set ordem = 7  where codigo = 'aguard_doc_cadastro';
update public.garantia_status_catalogo set ordem = 6  where codigo = 'solicitando_cadastro';

-- Aviso só é criado por quem opera o Hub.
drop policy if exists hub_notif_insert on public.hub_notificacoes;
create policy hub_notif_insert on public.hub_notificacoes for insert to authenticated
  with check (
    (criado_por is null or criado_por = auth.uid())
    and (public.pode_garantia_pipeline() or public.pode_entrada_demandas())
  );