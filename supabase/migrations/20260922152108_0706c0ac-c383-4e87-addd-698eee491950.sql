create or replace function public.rpc_hub_listar_pessoas()
returns table (user_id uuid, nome text)
language sql
stable
security definer
set search_path to 'public'
as $$
  -- Devolve SOMENTE user_id e nome de exibição. E-mail não sai daqui de
  -- propósito: para escolher e mostrar um responsavel o nome basta, e expor
  -- e-mail de todo mundo do Hub seria exposição sem finalidade.
  -- A checagem de permissão dentro do WHERE é intencional: mesmo sendo
  -- security definer, quem não opera a Entrada nem o pipeline recebe vazio.
  select p.user_id, coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1))
    from public.profiles p
   where p.active = true
     and coalesce(p.blocked, false) = false
     and p.user_id is not null
     and (public.pode_entrada_demandas() or public.pode_garantia_pipeline())
   order by 2;
$$;

revoke execute on function public.rpc_hub_listar_pessoas() from public;
revoke execute on function public.rpc_hub_listar_pessoas() from anon;
grant execute on function public.rpc_hub_listar_pessoas() to authenticated;