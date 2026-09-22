-- ===================================================================
-- Painel da Gerência — Garantia.
-- Regras estruturais destas rotinas:
--  1. Toda função começa checando public.pode_garantia_painel(): sem a
--     permissão, devolve ZERO linhas. O corte é no banco, não na tela.
--  2. Nenhuma devolve linha crua de demanda ou de histórico: tudo agregado
--     em SQL. O PostgREST corta em 1000 linhas e .range() não resolve.
--  3. Média de tempo NUNCA inclui relogio = 'sem_relogio' (o financeiro):
--     o relógio da demanda termina quando a apólice vai ao financeiro.
--  4. nao_consultado é falha técnica de consulta, não recusa comercial, e
--     jamais é somado com sem_limite.
-- ===================================================================

-- 1) Em jogo -------------------------------------------------------
create or replace function public.rpc_garantia_painel_em_jogo(
  _de date default null,
  _ate date default null,
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  agrupamento text, chave text, rotulo text,
  quantidade bigint, premio numeric, comissao numeric
)
language sql stable security definer set search_path to 'public' as $$
  with base as (
    select d.etapa, d.status_atual, d.premio_estimado, d.comissao_estimada
      from public.garantia_demandas d
     where public.pode_garantia_painel()
       and d.fase in ('negociacao', 'crm')
       and (_de is null or d.chegada_em >= _de::timestamptz)
       and (_ate is null or d.chegada_em < (_ate + 1)::timestamptz)
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
  )
  select 'etapa', b.etapa, b.etapa, count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b group by b.etapa
  union all
  select 'status', b.status_atual, coalesce(c.nome, b.status_atual), count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b
    left join public.garantia_status_catalogo c on c.codigo = b.status_atual
   group by b.status_atual, c.nome;
$$;

revoke execute on function public.rpc_garantia_painel_em_jogo(date, date, text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_em_jogo(date, date, text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_em_jogo(date, date, text, text, uuid, uuid) to authenticated;

-- 2) Deixado na mesa -----------------------------------------------
create or replace function public.rpc_garantia_painel_perdas(
  _de date default null,
  _ate date default null,
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  agrupamento text, chave text, rotulo text,
  quantidade bigint, premio numeric, comissao numeric
)
language sql stable security definer set search_path to 'public' as $$
  with base as (
    select p.motivo, p.etapa_perdida, p.premio_estimado, p.comissao_estimada,
           d.modalidade, d.responsavel_tecnico_id,
           coalesce(sc.rotulo, cot.seguradora_livre) as seguradora,
           pf.full_name as responsavel_nome
      from public.garantia_perdas p
      join public.garantia_demandas d on d.id = p.demanda_id
      left join public.garantia_cotacoes cot
             on cot.demanda_id = d.id and cot.escolhida
      left join public.garantia_seguradoras_config sc
             on sc.chave_mercado = cot.chave_mercado
      left join public.profiles pf on pf.user_id = d.responsavel_tecnico_id
     where public.pode_garantia_painel()
       and p.reaberta_em is null
       and (_de is null or p.criado_em >= _de::timestamptz)
       and (_ate is null or p.criado_em < (_ate + 1)::timestamptz)
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
  ),
  devolvido as (
    select coalesce(sum(e.premio_devolver), 0) as premio, count(*) as qtd
      from public.garantia_encerramentos e
      join public.garantia_apolices a on a.id = e.apolice_id
      join public.garantia_demandas d on d.id = a.demanda_id
     where public.pode_garantia_painel()
       and e.tipo in ('cancelada_pedido', 'substituida')
       and e.premio_devolver is not null
       and (_de is null or e.data >= _de)
       and (_ate is null or e.data <= _ate)
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
  )
  select 'motivo', b.motivo, b.motivo, count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b group by b.motivo
  union all
  select 'responsavel', coalesce(b.responsavel_tecnico_id::text, 'sem_responsavel'),
         coalesce(b.responsavel_nome, 'Sem responsável'), count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b group by b.responsavel_tecnico_id, b.responsavel_nome
  union all
  select 'seguradora', coalesce(b.seguradora, 'sem_seguradora'),
         coalesce(b.seguradora, 'Sem cotação escolhida'), count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b group by b.seguradora
  union all
  select 'modalidade', coalesce(b.modalidade, 'sem_modalidade'),
         coalesce(b.modalidade, 'Sem modalidade'), count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b group by b.modalidade
  union all
  select 'etapa', coalesce(b.etapa_perdida, 'sem_etapa'),
         coalesce(b.etapa_perdida, 'Sem etapa'), count(*),
         coalesce(sum(b.premio_estimado), 0), coalesce(sum(b.comissao_estimada), 0)
    from base b group by b.etapa_perdida
  union all
  select 'devolucao', 'premio_devolvido', 'Prêmio devolvido em cancelamentos',
         dv.qtd, dv.premio, 0
    from devolvido dv where dv.qtd > 0;
$$;

revoke execute on function public.rpc_garantia_painel_perdas(date, date, text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_perdas(date, date, text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_perdas(date, date, text, text, uuid, uuid) to authenticated;

-- 3) Virou resultado -----------------------------------------------
create or replace function public.rpc_garantia_painel_resultado(
  _de date default null,
  _ate date default null,
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  mes date, apolices bigint,
  premio_emitido numeric, comissao_prevista numeric, comissao_recebida numeric
)
language sql stable security definer set search_path to 'public' as $$
  select date_trunc('month', coalesce(a.data_emissao, a.criado_em::date))::date as mes,
         count(*),
         coalesce(sum(a.premio), 0),
         coalesce(sum(f.comissao_prevista), 0),
         coalesce(sum(f.comissao_recebida), 0)
    from public.garantia_apolices a
    join public.garantia_demandas d on d.id = a.demanda_id
    left join public.garantia_financeiro f on f.apolice_id = a.id
   where public.pode_garantia_painel()
     and (_de is null or coalesce(a.data_emissao, a.criado_em::date) >= _de)
     and (_ate is null or coalesce(a.data_emissao, a.criado_em::date) <= _ate)
     and (_produto is null or d.produto = _produto)
     and (_modalidade is null or d.modalidade = _modalidade)
     and (_canal is null or d.canal_id = _canal)
     and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
   group by 1
   order by 1;
$$;

revoke execute on function public.rpc_garantia_painel_resultado(date, date, text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_resultado(date, date, text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_resultado(date, date, text, text, uuid, uuid) to authenticated;

-- 4) Velocidade ----------------------------------------------------
-- Só histórico FECHADO e com relógio: 'sem_relogio' (o financeiro) fica de
-- fora de toda média.
create or replace function public.rpc_garantia_painel_velocidade(
  _de date default null,
  _ate date default null,
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  agrupamento text, chave text, rotulo text, relogio text,
  amostras bigint, horas_media numeric
)
language sql stable security definer set search_path to 'public' as $$
  with dem as (
    select d.*
      from public.garantia_demandas d
     where public.pode_garantia_painel()
       and (_de is null or d.chegada_em >= _de::timestamptz)
       and (_ate is null or d.chegada_em < (_ate + 1)::timestamptz)
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
  ),
  hist as (
    select h.status_codigo, h.relogio, h.duracao_segundos,
           c.etapa, c.nome as status_nome,
           d.responsavel_tecnico_id, pf.full_name as responsavel_nome
      from public.garantia_status_historico h
      join dem d on d.id = h.demanda_id
      left join public.garantia_status_catalogo c on c.codigo = h.status_codigo
      left join public.profiles pf on pf.user_id = d.responsavel_tecnico_id
     where h.fim is not null
       and h.duracao_segundos is not null
       and coalesce(h.relogio, c.relogio) in ('interno', 'externo')
       and coalesce(c.relogio, 'interno') <> 'sem_relogio'
  )
  select 'etapa', coalesce(h.etapa, 'sem_etapa'), coalesce(h.etapa, 'Sem etapa'),
         coalesce(h.relogio, 'interno'), count(*),
         round(avg(h.duracao_segundos) / 3600.0, 2)
    from hist h group by h.etapa, h.relogio
  union all
  select 'status', h.status_codigo, coalesce(h.status_nome, h.status_codigo),
         coalesce(h.relogio, 'interno'), count(*),
         round(avg(h.duracao_segundos) / 3600.0, 2)
    from hist h group by h.status_codigo, h.status_nome, h.relogio
  union all
  select 'responsavel', coalesce(h.responsavel_tecnico_id::text, 'sem_responsavel'),
         coalesce(h.responsavel_nome, 'Sem responsável'),
         coalesce(h.relogio, 'interno'), count(*),
         round(avg(h.duracao_segundos) / 3600.0, 2)
    from hist h group by h.responsavel_tecnico_id, h.responsavel_nome, h.relogio
  union all
  -- Tempo até cadastrar: da chegada ao cadastro da demanda.
  select 'marco', 'tempo_cadastro', 'Tempo até cadastrar', 'interno', count(*),
         round(avg(extract(epoch from (d.cadastrado_em - d.chegada_em))) / 3600.0, 2)
    from dem d
   where d.cadastrado_em is not null and d.cadastrado_em >= d.chegada_em
  union all
  -- Chegada → emissão: da chegada à data de emissão da apólice.
  select 'marco', 'chegada_emissao', 'Chegada até a emissão', 'interno', count(*),
         round(avg(extract(epoch from (a.data_emissao::timestamptz - d.chegada_em))) / 3600.0, 2)
    from dem d
    join public.garantia_apolices a on a.demanda_id = d.id
   where a.data_emissao is not null;
$$;

revoke execute on function public.rpc_garantia_painel_velocidade(date, date, text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_velocidade(date, date, text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_velocidade(date, date, text, text, uuid, uuid) to authenticated;

-- 5) Conversão ------------------------------------------------------
create or replace function public.rpc_garantia_painel_conversao(
  _de date default null,
  _ate date default null,
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  agrupamento text, chave text, rotulo text,
  ganhos bigint, perdidos bigint, abertas bigint, pct_ganho numeric
)
language sql stable security definer set search_path to 'public' as $$
  with base as (
    select d.id, d.modalidade, d.canal_id, d.responsavel_tecnico_id,
           (d.codigo is not null) as ganhou,
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
$$;

revoke execute on function public.rpc_garantia_painel_conversao(date, date, text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_conversao(date, date, text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_conversao(date, date, text, text, uuid, uuid) to authenticated;

-- 6) Carteira -------------------------------------------------------
create or replace function public.rpc_garantia_painel_carteira(
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  agrupamento text, chave text, rotulo text,
  quantidade bigint, valor numeric
)
language sql stable security definer set search_path to 'public' as $$
  with limites as (
    select lt.cliente_id, hc.nome as cliente_nome,
           sum(coalesce(lt.limite_utilizado, 0)) as utilizado
      from public.garantia_limites_tomador lt
      join public.garantia_consultas_mercado cm on cm.id = lt.consulta_id
      left join public.hub_clientes hc on hc.id = lt.cliente_id
     where public.pode_garantia_painel()
       and cm.substituida_por_id is null
       and cm.valida_ate > now()
     group by lt.cliente_id, hc.nome
     having sum(coalesce(lt.limite_utilizado, 0)) > 0
  ),
  renovacoes as (
    select (a.vigencia_fim - current_date) / 30 as bucket,
           count(*) as qtd, coalesce(sum(a.importancia_segurada), 0) as valor
      from public.garantia_apolices a
      join public.garantia_demandas d on d.id = a.demanda_id
     where public.pode_garantia_painel()
       and a.situacao in ('vigente', 'em_sinistro')
       and a.vigencia_fim is not null
       and a.vigencia_fim between current_date and current_date + 120
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
     group by 1
  )
  select 'limite_cliente', l.cliente_id::text,
         coalesce(l.cliente_nome, 'Cliente sem nome'), 1::bigint, l.utilizado
    from limites l
  union all
  select 'renovacao_120', r.bucket::text,
         case r.bucket when 0 then 'Até 30 dias'
                       when 1 then '31 a 60 dias'
                       when 2 then '61 a 90 dias'
                       else '91 a 120 dias' end,
         r.qtd, r.valor
    from renovacoes r;
$$;

revoke execute on function public.rpc_garantia_painel_carteira(text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_carteira(text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_carteira(text, text, uuid, uuid) to authenticated;

-- 7) Comportamento das seguradoras ----------------------------------
-- Mesmo agrupamento do painel do Formulário Admin, agora no pipeline inteiro,
-- agrupado pelo RÓTULO da seguradora. nao_consultado é falha técnica: nunca
-- somado com sem_limite.
create or replace function public.rpc_garantia_painel_seguradoras(
  _de date default null,
  _ate date default null,
  _produto text default null,
  _modalidade text default null,
  _canal uuid default null,
  _responsavel uuid default null
) returns table (
  seguradora text, com_limite bigint, sem_limite bigint, nao_consultado bigint
)
language sql stable security definer set search_path to 'public' as $$
  with linhas as (
    select coalesce(sc.rotulo, lt.chave_mercado) as seguradora,
           coalesce(
             lt.grupo_mercado,
             case
               when lt.status_mercado = 'aprovado' then 'com_limite'
               when lt.status_mercado in ('sem_limite', 'bloqueado', 'nomeado', 'filial')
                 then 'sem_limite'
               else 'nao_consultado'
             end
           ) as grupo
      from public.garantia_limites_tomador lt
      join public.garantia_consultas_mercado cm on cm.id = lt.consulta_id
      left join public.garantia_seguradoras_config sc
             on sc.chave_mercado = lt.chave_mercado
      left join public.garantia_demandas d on d.id = cm.demanda_id
     where public.pode_garantia_painel()
       and (_de is null or cm.consultada_em >= _de::timestamptz)
       and (_ate is null or cm.consultada_em < (_ate + 1)::timestamptz)
       and (_produto is null or d.produto = _produto)
       and (_modalidade is null or d.modalidade = _modalidade)
       and (_canal is null or d.canal_id = _canal)
       and (_responsavel is null or d.responsavel_tecnico_id = _responsavel)
  )
  select l.seguradora,
         count(*) filter (where l.grupo = 'com_limite'),
         count(*) filter (where l.grupo = 'sem_limite'),
         count(*) filter (where l.grupo = 'nao_consultado')
    from linhas l
   group by l.seguradora
   order by l.seguradora;
$$;

revoke execute on function public.rpc_garantia_painel_seguradoras(date, date, text, text, uuid, uuid) from public;
revoke execute on function public.rpc_garantia_painel_seguradoras(date, date, text, text, uuid, uuid) from anon;
grant  execute on function public.rpc_garantia_painel_seguradoras(date, date, text, text, uuid, uuid) to authenticated;