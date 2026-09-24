create table public.garantia_parametros (
  chave text primary key,
  valor numeric not null,
  descricao text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
grant select, insert, update on public.garantia_parametros to authenticated;
grant all on public.garantia_parametros to service_role;
alter table public.garantia_parametros enable row level security;
create policy garantia_parametros_select on public.garantia_parametros
  for select to authenticated using (public.pode_garantia_pipeline());
create policy garantia_parametros_insert on public.garantia_parametros
  for insert to authenticated with check (public.has_role(auth.uid(), 'ADMIN'));
create policy garantia_parametros_update on public.garantia_parametros
  for update to authenticated using (public.has_role(auth.uid(), 'ADMIN'))
  with check (public.has_role(auth.uid(), 'ADMIN'));

create or replace function public.garantia_parametros_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
revoke all on function public.garantia_parametros_carimbo() from public, anon, authenticated;
create trigger garantia_parametros_carimbo before insert or update on public.garantia_parametros
  for each row execute function public.garantia_parametros_carimbo();

insert into public.garantia_parametros (chave, valor, descricao) values
 ('taxa_referencia_anual_pct', 1.00, 'Taxa anual de referência para estimar prêmio quando não há cotação nem histórico. Mercado costuma praticar entre ~0,2% e 3% a.a., conforme modalidade, prazo e perfil do tomador.'),
 ('comissao_referencia_pct', 15.00, 'Comissão média usada para estimar a comissão de negócios perdidos.')
on conflict (chave) do nothing;

create or replace function public.garantia_perdas_exige_premio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.premio_estimado is distinct from old.premio_estimado then
    if new.premio_estimado is null or new.premio_estimado <= 0 then
      raise exception 'Informe o prêmio estimado (maior que zero) para registrar a perda.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.garantia_perdas_exige_premio() from public, anon, authenticated;
create trigger garantia_perdas_exige_premio before insert or update on public.garantia_perdas
  for each row execute function public.garantia_perdas_exige_premio();

create or replace function public.rpc_garantia_taxa_media_modalidade(_modalidade text)
returns table (media numeric, amostras int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pode_garantia_pipeline() then
    return;
  end if;
  return query
    select avg(c.taxa)::numeric, count(*)::int
    from public.garantia_cotacoes c
    join public.garantia_demandas d on d.id = c.demanda_id
    where d.modalidade = _modalidade
      and c.taxa is not null and c.taxa > 0
      and coalesce(c.recebida_em, c.criado_em) >= now() - interval '12 months';
end $$;
revoke all on function public.rpc_garantia_taxa_media_modalidade(text) from public, anon;
grant execute on function public.rpc_garantia_taxa_media_modalidade(text) to authenticated;