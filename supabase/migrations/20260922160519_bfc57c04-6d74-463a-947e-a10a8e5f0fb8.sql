create or replace function public.rpc_garantia_registrar_aceite(_demanda_id uuid)
returns table (codigo text, legenda text)
language plpgsql volatile security definer set search_path to 'public' as $$
declare v_codigo text; v_legenda text; v_dem record;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para operar o pipeline de Garantia.';
  end if;

  select d.*, c.nome as cliente_nome, s.nome as segurado_nome
    into v_dem
    from public.garantia_demandas d
    join public.hub_clientes c on c.id = d.cliente_id
    left join public.garantia_segurados s on s.id = d.segurado_id
   where d.id = _demanda_id
   for update;

  if not found then raise exception 'Demanda não encontrada.'; end if;
  if v_dem.codigo is not null then
    -- Idempotente: aceite já registrado devolve o código que já existe em vez
    -- de gerar outro. Clique duplo não pode criar dois códigos.
    return query select v_dem.codigo, v_dem.legenda; return;
  end if;
  if v_dem.fase <> 'negociacao' then raise exception 'Só demanda em negociação pode receber aceite.'; end if;
  if not exists (select 1 from public.garantia_cotacoes q where q.demanda_id = _demanda_id and q.escolhida) then
    raise exception 'Escolha a cotação aceita antes de registrar o aceite.';
  end if;

  v_codigo  := 'GAR-' || lpad(nextval('public.garantia_demandas_codigo_seq')::text, 5, '0');
  v_legenda := concat_ws(' · ', v_codigo, v_dem.cliente_nome, v_dem.segurado_nome);

  update public.garantia_demandas
     set codigo = v_codigo, legenda = v_legenda,
         fase = 'crm', etapa = '6', status_atual = 'curadoria'
   where id = _demanda_id;

  return query select v_codigo, v_legenda;
end;
$$;

revoke execute on function public.rpc_garantia_registrar_aceite(uuid) from public;
revoke execute on function public.rpc_garantia_registrar_aceite(uuid) from anon;
grant  execute on function public.rpc_garantia_registrar_aceite(uuid) to authenticated;