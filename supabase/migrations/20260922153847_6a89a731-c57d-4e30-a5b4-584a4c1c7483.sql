drop policy if exists "garantia_status_historico_select" on public.garantia_status_historico;
create policy "garantia_status_historico_select" on public.garantia_status_historico
  for select to authenticated using (public.pode_garantia_painel());

create or replace function public.rpc_garantia_historico_demanda(_demanda_id uuid)
returns table (
  id uuid, status_codigo text, status_nome text, relogio text, com_quem text,
  inicio timestamptz, fim timestamptz, duracao_segundos int, observacao text
)
language sql stable security definer set search_path to 'public' as $$
  select h.id, h.status_codigo, c.nome, h.relogio, h.com_quem,
         h.inicio, h.fim,
         -- Duração só para a gerência. Sem menu_garantia_painel, a sequência
         -- de status aparece, a contagem de tempo não.
         case when public.pode_garantia_painel() then h.duracao_segundos else null end,
         h.observacao
    from public.garantia_status_historico h
    join public.garantia_status_catalogo c on c.codigo = h.status_codigo
   where h.demanda_id = _demanda_id
     and public.pode_garantia_pipeline()
   order by h.inicio;
$$;

revoke execute on function public.rpc_garantia_historico_demanda(uuid) from public;
revoke execute on function public.rpc_garantia_historico_demanda(uuid) from anon;
grant  execute on function public.rpc_garantia_historico_demanda(uuid) to authenticated;

create or replace function public.rpc_garantia_status_abertos()
returns table (demanda_id uuid, inicio timestamptz)
language sql stable security definer set search_path to 'public' as $$
  -- Leitura em lote dos status abertos é o que permite montar ranking de
  -- lentidão: só a gerência recebe linhas.
  select h.demanda_id, h.inicio
    from public.garantia_status_historico h
   where h.fim is null
     and public.pode_garantia_painel();
$$;

revoke execute on function public.rpc_garantia_status_abertos() from public;
revoke execute on function public.rpc_garantia_status_abertos() from anon;
grant  execute on function public.rpc_garantia_status_abertos() to authenticated;