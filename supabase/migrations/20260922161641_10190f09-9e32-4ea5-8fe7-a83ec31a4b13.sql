-- Ajuste do limite usado do cliente. A MESMA função é usada na emissão (delta
-- positivo) e na baixa (delta negativo), para as duas regras não divergirem.
-- Se não houver linha daquela seguradora na consulta vigente, NÃO cria uma do
-- nada: limite sem consulta não é dado confiável.
create or replace function public.garantia_ajustar_limite_utilizado(
  _cliente_id uuid,
  _chave_mercado text,
  _delta numeric
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_linha uuid;
begin
  if _cliente_id is null or _chave_mercado is null or coalesce(_delta, 0) = 0 then
    return false;
  end if;

  select lt.id into v_linha
    from public.garantia_limites_tomador lt
    join public.garantia_consultas_mercado cm on cm.id = lt.consulta_id
   where lt.cliente_id = _cliente_id
     and lt.chave_mercado = _chave_mercado
     and cm.substituida_por_id is null
     and cm.valida_ate > now()
   order by cm.consultada_em desc
   limit 1;

  if v_linha is null then
    return false;
  end if;

  update public.garantia_limites_tomador
     set limite_utilizado = greatest(0, coalesce(limite_utilizado, 0) + _delta),
         atualizado_em = now()
   where id = v_linha;

  return true;
end $$;

revoke all on function public.garantia_ajustar_limite_utilizado(uuid, text, numeric) from public, anon;
grant execute on function public.garantia_ajustar_limite_utilizado(uuid, text, numeric) to authenticated;

-- Lançamento da apólice: uma operação só, para nunca existir meia apólice.
create or replace function public.rpc_garantia_lancar_apolice(
  _demanda_id uuid,
  _numero_apolice text,
  _numero_endosso integer,
  _data_emissao date,
  _vigencia_inicio date,
  _vigencia_fim date,
  _objeto text,
  _importancia_segurada numeric,
  _premio numeric,
  _comissao_pct numeric,
  _vencimento_boleto date
) returns table (apolice_id uuid, limite_atualizado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d record;
  v_cot record;
  v_apolice uuid;
  v_limite boolean := false;
  v_dias integer;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para lançar apólice.';
  end if;

  select * into v_d from public.garantia_demandas where id = _demanda_id for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if v_d.fase <> 'crm' then
    raise exception 'A apólice só é lançada depois do aceite, com a demanda no CRM.';
  end if;

  if exists (select 1 from public.garantia_apolices
              where demanda_id = _demanda_id
                and numero_apolice = _numero_apolice
                and numero_endosso = coalesce(_numero_endosso, 0)) then
    raise exception 'Esta apólice já foi lançada nesta demanda.';
  end if;

  -- Anexos obrigatórios: a mesma regra que a tela mostra antes de deixar lançar.
  if not exists (select 1 from public.garantia_documentos
                  where demanda_id = _demanda_id and tipo = 'apolice'
                    and substituido_por_id is null) then
    raise exception 'Anexe a apólice antes de lançar.';
  end if;
  if not exists (select 1 from public.garantia_documentos
                  where demanda_id = _demanda_id and tipo = 'boleto'
                    and substituido_por_id is null) then
    raise exception 'Anexe o boleto antes de lançar.';
  end if;

  -- Seguradora vem da cotação escolhida: não se redigita.
  select chave_mercado, seguradora_livre into v_cot
    from public.garantia_cotacoes
   where demanda_id = _demanda_id and escolhida
   limit 1;
  if not found then
    raise exception 'Marque a cotação escolhida antes de lançar a apólice.';
  end if;

  -- Partes obrigatórias conforme o produto. Na fiança, o cliente da demanda é
  -- o LOCATÁRIO e o segurado é o LOCADOR.
  if v_d.produto = 'seguro_garantia' then
    if v_d.cliente_id is null or v_d.segurado_id is null then
      raise exception 'Seguro garantia exige tomador e segurado preenchidos na demanda.';
    end if;
  else
    if v_d.cliente_id is null or v_d.segurado_id is null then
      raise exception 'Fiança locatícia exige locatário e locador preenchidos na demanda.';
    end if;
  end if;

  insert into public.garantia_apolices (
    demanda_id, produto, chave_mercado, seguradora_livre, numero_apolice, numero_endosso,
    data_emissao, vigencia_inicio, vigencia_fim, objeto, importancia_segurada, premio,
    comissao_pct, tomador_id, segurado_id, locatario_id, locador_id, situacao, criado_por
  ) values (
    _demanda_id, v_d.produto, v_cot.chave_mercado, v_cot.seguradora_livre,
    _numero_apolice, coalesce(_numero_endosso, 0),
    _data_emissao, _vigencia_inicio, _vigencia_fim, _objeto, _importancia_segurada, _premio,
    _comissao_pct,
    case when v_d.produto = 'seguro_garantia' then v_d.cliente_id end,
    case when v_d.produto = 'seguro_garantia' then v_d.segurado_id end,
    case when v_d.produto = 'fianca_locaticia' then v_d.cliente_id end,
    case when v_d.produto = 'fianca_locaticia' then v_d.segurado_id end,
    'vigente', auth.uid()
  ) returning id into v_apolice;

  -- Os anexos que sustentam o lançamento passam a pertencer à apólice.
  update public.garantia_documentos
     set apolice_id = v_apolice
   where demanda_id = _demanda_id
     and tipo in ('apolice', 'boleto')
     and apolice_id is null;

  insert into public.garantia_financeiro (
    apolice_id, vencimento_boleto, status_premio, comissao_prevista
  )
  select v_apolice, _vencimento_boleto, 'em_aberto', a.comissao_valor
    from public.garantia_apolices a where a.id = v_apolice;

  -- Avisos de renovação. Sem job de pg_cron: só as linhas, com enviado = false.
  if _vigencia_fim is not null then
    foreach v_dias in array array[120, 90, 60, 30] loop
      if (_vigencia_fim - v_dias) >= current_date then
        insert into public.garantia_avisos_renovacao (apolice_id, dias_antes, data_aviso, enviado)
        values (v_apolice, v_dias, _vigencia_fim - v_dias, false)
        on conflict (apolice_id, dias_antes) do nothing;
      end if;
    end loop;
  end if;

  v_limite := public.garantia_ajustar_limite_utilizado(
    v_d.cliente_id, v_cot.chave_mercado, coalesce(_importancia_segurada, 0)
  );

  update public.garantia_demandas
     set etapa = '9', status_atual = 'lancamento_financeiro'
   where id = _demanda_id;

  return query select v_apolice, v_limite;
end $$;

revoke all on function public.rpc_garantia_lancar_apolice(uuid, text, integer, date, date, date, text, numeric, numeric, numeric, date) from public, anon;
grant execute on function public.rpc_garantia_lancar_apolice(uuid, text, integer, date, date, date, text, numeric, numeric, numeric, date) to authenticated;

-- Baixa da apólice: encerra, e DEVOLVE o limite usando a mesma função da emissão.
create or replace function public.rpc_garantia_dar_baixa_apolice(
  _apolice_id uuid,
  _tipo text,
  _data date,
  _documento_id uuid,
  _premio_devolver numeric,
  _estorno_comissao numeric,
  _observacao text
) returns table (encerramento_id uuid, limite_devolvido boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a record;
  v_d record;
  v_doc record;
  v_enc uuid;
  v_limite boolean := false;
  v_condicional boolean;
begin
  if not public.pode_garantia_pipeline() then
    raise exception 'Sem permissão para dar baixa em apólice.';
  end if;

  select * into v_a from public.garantia_apolices where id = _apolice_id for update;
  if not found then raise exception 'Apólice não encontrada.'; end if;
  if v_a.situacao = 'encerrada' then
    raise exception 'Esta apólice já está encerrada.';
  end if;
  if _data is null then raise exception 'Informe a data da baixa.'; end if;

  if _documento_id is null then
    raise exception 'Anexe o termo de liberação ou o endosso de cancelamento antes de concluir.';
  end if;
  select id, tipo into v_doc from public.garantia_documentos where id = _documento_id;
  if not found or v_doc.tipo not in ('termo_liberacao', 'endosso_cancelamento') then
    raise exception 'O documento da baixa precisa ser o termo de liberação ou o endosso de cancelamento.';
  end if;

  -- Prêmio a devolver e estorno só existem em cancelamento a pedido e substituição.
  v_condicional := _tipo in ('cancelada_pedido', 'substituida');

  insert into public.garantia_encerramentos (
    apolice_id, tipo, data, documento_id, premio_devolver, estorno_comissao,
    aprovado_por, observacao, criado_por
  ) values (
    _apolice_id, _tipo, _data, _documento_id,
    case when v_condicional then _premio_devolver end,
    case when v_condicional then _estorno_comissao end,
    auth.uid(), _observacao, auth.uid()
  )
  on conflict (apolice_id) do update
     set tipo = excluded.tipo,
         data = excluded.data,
         documento_id = excluded.documento_id,
         premio_devolver = excluded.premio_devolver,
         estorno_comissao = excluded.estorno_comissao,
         aprovado_por = excluded.aprovado_por,
         observacao = excluded.observacao
  returning id into v_enc;

  update public.garantia_apolices
     set situacao = 'encerrada', atualizado_em = now()
   where id = _apolice_id;

  select * into v_d from public.garantia_demandas where id = v_a.demanda_id for update;
  if found then
    update public.garantia_demandas
       set fase = 'encerrada', etapa = '11', status_atual = 'lancamento_baixa'
     where id = v_a.demanda_id;
  end if;

  -- Devolução do limite: mesma linha somada na emissão, nunca abaixo de zero.
  v_limite := public.garantia_ajustar_limite_utilizado(
    coalesce(v_a.tomador_id, v_a.locatario_id),
    v_a.chave_mercado,
    -1 * coalesce(v_a.importancia_segurada, 0)
  );

  return query select v_enc, v_limite;
end $$;

revoke all on function public.rpc_garantia_dar_baixa_apolice(uuid, text, date, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.rpc_garantia_dar_baixa_apolice(uuid, text, date, uuid, numeric, numeric, text) to authenticated;