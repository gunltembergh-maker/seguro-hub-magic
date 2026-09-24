create sequence if not exists public.garantia_demandas_numero_seq;

alter table public.garantia_demandas
  add column if not exists numero text,
  add column if not exists legenda_manual boolean not null default false,
  add column if not exists numero_contrato text;

comment on column public.garantia_demandas.numero is
  'Identificador da demanda desde o cadastro (DEM-00001). Não confundir com codigo (GAR-), que só nasce no aceite e é o que marca negócio ganho no painel.';
comment on column public.garantia_demandas.legenda_manual is
  'true depois que alguém edita a legenda à mão. A partir daí o gatilho para de regerar, senão a edição sumiria quando o segurado fosse preenchido.';

create or replace function public.garantia_demandas_monta_legenda()
returns trigger language plpgsql set search_path = public as $$
declare v_cliente text; v_padrao text;
begin
  if tg_op = 'INSERT' and new.numero is null then
    new.numero := 'DEM-' || lpad(nextval('public.garantia_demandas_numero_seq')::text, 5, '0');
  end if;
  select c.nome into v_cliente from public.hub_clientes c where c.id = new.cliente_id;
  v_padrao := concat_ws(' · ', new.numero, v_cliente);

  if tg_op = 'UPDATE' then
    if old.legenda_manual and not new.legenda_manual then
      null; -- "Restaurar padrão": volta a regerar
    elsif new.legenda is distinct from old.legenda and new.legenda is distinct from v_padrao then
      new.legenda_manual := true;
    end if;
  elsif new.legenda is not null and new.legenda <> v_padrao then
    new.legenda_manual := true;
  end if;

  if not new.legenda_manual then
    new.legenda := v_padrao;
  end if;
  return new;
end $$;

drop trigger if exists garantia_demandas_monta_legenda on public.garantia_demandas;
create trigger garantia_demandas_monta_legenda
before insert or update on public.garantia_demandas
for each row execute function public.garantia_demandas_monta_legenda();

with ordenadas as (
  select id, row_number() over (order by cadastrado_em, id) as n
  from public.garantia_demandas where numero is null
)
update public.garantia_demandas d
   set numero = 'DEM-' || lpad(nextval('public.garantia_demandas_numero_seq')::text, 5, '0')
  from (select id from ordenadas order by n) o where o.id = d.id;

alter table public.garantia_demandas alter column numero set not null;
create unique index if not exists garantia_demandas_numero_uq on public.garantia_demandas (numero);

create or replace function public.rpc_garantia_registrar_aceite(_demanda_id uuid)
 returns table(codigo text, legenda text)
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_codigo text; v_legenda text; v_dem record;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para operar o pipeline de Garantia.';
  end if;

  select d.* into v_dem from public.garantia_demandas d
   where d.id = _demanda_id for update;

  if not found then raise exception 'Demanda não encontrada.'; end if;
  if v_dem.codigo is not null then
    return query select v_dem.codigo, v_dem.legenda; return;
  end if;
  if v_dem.fase <> 'negociacao' then raise exception 'Só demanda em negociação pode receber aceite.'; end if;
  if not exists (select 1 from public.garantia_cotacoes q where q.demanda_id = _demanda_id and q.escolhida) then
    raise exception 'Escolha a cotação aceita antes de registrar o aceite.';
  end if;

  v_codigo := 'GAR-' || lpad(nextval('public.garantia_demandas_codigo_seq')::text, 5, '0');

  -- Legenda não é tocada aqui: com legenda_manual = false o gatilho mantém o
  -- padrão (numero · cliente); com legenda editada à mão, ela fica intacta.
  update public.garantia_demandas d
     set codigo = v_codigo, fase = 'crm', etapa = '6', status_atual = 'curadoria'
   where d.id = _demanda_id
  returning d.legenda into v_legenda;

  return query select v_codigo, v_legenda;
end;
$function$;