
-- =====================================================================
-- Parte 1b do pipeline de Garantia. Migration ADITIVA.
-- Nada é alterado em garantia_judicial_solicitacoes, canais, clientes,
-- seguradoras, buckets existentes ou jobs de pg_cron.
-- =====================================================================

-- ── 0. Correção pendente da Parte 1a: defesa em profundidade ─────────
revoke execute on function public.rpc_entrada_criar_canal(text) from public;
revoke execute on function public.rpc_entrada_criar_canal(text) from anon;
grant  execute on function public.rpc_entrada_criar_canal(text) to authenticated;

-- ── 1. Storage: policies do bucket garantia-pipeline-anexos ──────────
-- Bucket privado criado à parte. Convenção de caminho:
--   ${demanda_id}/${tipo}/${versao}-${nome_arquivo}
-- Filtradas por bucket_id para não afetar nenhum bucket existente.
create policy "garantia_pipeline_anexos_select" on storage.objects for select to authenticated
  using (bucket_id = 'garantia-pipeline-anexos' and public.pode_garantia_pipeline());
create policy "garantia_pipeline_anexos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'garantia-pipeline-anexos' and public.pode_garantia_pipeline());
create policy "garantia_pipeline_anexos_update" on storage.objects for update to authenticated
  using (bucket_id = 'garantia-pipeline-anexos' and public.pode_garantia_pipeline())
  with check (bucket_id = 'garantia-pipeline-anexos' and public.pode_garantia_pipeline());
create policy "garantia_pipeline_anexos_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'garantia-pipeline-anexos' and public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 2. garantia_documentos ───────────────────────────────────────────
create table public.garantia_documentos (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid references public.garantia_demandas(id) on delete cascade,
  apolice_id uuid,                                  -- FK adicionada após criar garantia_apolices
  tipo text not null check (tipo in (
    'email_original','edital','contrato','contrato_locacao','aditivo','apostilamento',
    'processo_judicial','dre','balanco','alteracao_contratual','carta_nomeacao','irpf',
    'outro_cadastro','comparativo','ccg','minuta','apolice','boleto','termo_liberacao',
    'endosso_cancelamento','notificacao_sinistro','outro')),
  caminho text,                                     -- no bucket garantia-pipeline-anexos
  nome_arquivo text not null,
  tamanho_bytes bigint,
  mime_type text,
  versao int not null default 1,
  substituido_por_id uuid references public.garantia_documentos(id) on delete set null,
  externo boolean not null default false,           -- true quando o arquivo vive em outro bucket
  solicitacao_id uuid references public.garantia_judicial_solicitacoes(id) on delete set null,
  caminho_externo text,
  observacao text,
  enviado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint garantia_documentos_tem_dono check (demanda_id is not null or apolice_id is not null),
  constraint garantia_documentos_externo_completo check (externo = false or (caminho_externo is not null and solicitacao_id is not null))
);
comment on table public.garantia_documentos is 'Anexo que já vive no fluxo judicial (o PDF do formulário, a planilha da consulta) não é copiado para cá. Registra-se externo = true com solicitacao_id e caminho_externo, e o download sai por URL assinada no bucket original. Copiar duplicaria o arquivo e criaria duas verdades.';
comment on column public.garantia_documentos.tipo is 'DRE, balanços, carta de nomeação e CCG não são obrigatórios por padrão. DRE e balanço só passam a ser exigidos quando garantia_demandas.exige_cadastro = true (cliente sem limite nenhum na consulta a mercado), e não há número mínimo de exercícios. Nomeação e CCG só quando precisa_nomeacao / precisa_ccg estiverem marcados.';

create index garantia_documentos_demanda_idx on public.garantia_documentos (demanda_id, tipo, versao desc);
create index garantia_documentos_apolice_idx on public.garantia_documentos (apolice_id);

grant select, insert, update, delete on public.garantia_documentos to authenticated;
grant all on public.garantia_documentos to service_role;
alter table public.garantia_documentos enable row level security;

create policy "garantia_documentos_select" on public.garantia_documentos for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_documentos_insert" on public.garantia_documentos for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_documentos_update" on public.garantia_documentos for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_documentos_delete_admin" on public.garantia_documentos for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Versionamento: nunca sobrescreve, nunca apaga a versão anterior.
create or replace function public.garantia_documentos_versiona()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_max int;
begin
  select max(d.versao) into v_max
    from public.garantia_documentos d
   where d.tipo = new.tipo
     and ((new.demanda_id is not null and d.demanda_id = new.demanda_id)
       or (new.apolice_id is not null and d.apolice_id = new.apolice_id));
  if v_max is not null then
    new.versao := v_max + 1;
  end if;
  return new;
end;
$function$;

create trigger garantia_documentos_versiona
  before insert on public.garantia_documentos
  for each row execute function public.garantia_documentos_versiona();

create or replace function public.garantia_documentos_marca_substituido()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  update public.garantia_documentos d
     set substituido_por_id = new.id
   where d.id <> new.id
     and d.tipo = new.tipo
     and d.versao = new.versao - 1
     and ((new.demanda_id is not null and d.demanda_id = new.demanda_id)
       or (new.apolice_id is not null and d.apolice_id = new.apolice_id));
  return null;
end;
$function$;

create trigger garantia_documentos_marca_substituido
  after insert on public.garantia_documentos
  for each row execute function public.garantia_documentos_marca_substituido();

-- ── 3. garantia_analises_ia ──────────────────────────────────────────
create table public.garantia_analises_ia (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid references public.garantia_demandas(id) on delete cascade,
  apolice_id uuid,
  documento_id uuid references public.garantia_documentos(id) on delete set null,
  fluxo text not null check (fluxo in ('seguro_garantia','fianca_locaticia','apolice','financeiro','minuta')),
  job_id text,
  situacao text not null default 'solicitada' check (situacao in ('solicitada','processando','concluida','erro','cancelada')),
  resumo text,
  resultado jsonb,
  campos_sugeridos jsonb,
  aplicada boolean not null default false,
  aplicada_por uuid references auth.users(id) on delete set null,
  aplicada_em timestamptz,
  erro_mensagem text,
  solicitada_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.garantia_analises_ia is 'A IA sugere, a pessoa confere e aplica. Nada aqui altera campo de demanda ou apólice automaticamente: campos_sugeridos só vira dado real quando alguém aplica, e isso fica registrado em aplicada_por / aplicada_em.';
comment on column public.garantia_analises_ia.job_id is 'Identificador do job no motor de análise. Não é credencial — as credenciais do motor ficam apenas em variáveis de ambiente do servidor.';

grant select, insert, update, delete on public.garantia_analises_ia to authenticated;
grant all on public.garantia_analises_ia to service_role;
alter table public.garantia_analises_ia enable row level security;

create policy "garantia_analises_ia_select" on public.garantia_analises_ia for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_analises_ia_insert" on public.garantia_analises_ia for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_analises_ia_update" on public.garantia_analises_ia for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_analises_ia_delete_admin" on public.garantia_analises_ia for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger garantia_analises_ia_touch before update on public.garantia_analises_ia
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 4. garantia_cotacoes ─────────────────────────────────────────────
create table public.garantia_cotacoes (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete cascade,
  chave_mercado text references public.garantia_seguradoras_config(chave_mercado),
  seguradora_livre text,                         -- seguradora fora do catálogo
  taxa numeric(9,6),
  premio numeric(18,2),
  comissao_pct numeric(7,4),
  comissao_valor numeric(18,2) generated always as (round(coalesce(premio,0) * coalesce(comissao_pct,0) / 100, 2)) stored,
  cosseguro boolean not null default false,
  escolhida boolean not null default false,
  observacao text,
  recebida_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  constraint garantia_cotacoes_tem_seguradora check (chave_mercado is not null or seguradora_livre is not null)
);

create unique index garantia_cotacoes_escolhida_uq on public.garantia_cotacoes (demanda_id) where escolhida;

grant select, insert, update, delete on public.garantia_cotacoes to authenticated;
grant all on public.garantia_cotacoes to service_role;
alter table public.garantia_cotacoes enable row level security;

create policy "garantia_cotacoes_select" on public.garantia_cotacoes for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_cotacoes_insert" on public.garantia_cotacoes for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_cotacoes_update" on public.garantia_cotacoes for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_cotacoes_delete_admin" on public.garantia_cotacoes for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 5. garantia_perdas ───────────────────────────────────────────────
create table public.garantia_perdas (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null unique references public.garantia_demandas(id) on delete cascade,
  motivo text not null check (motivo in (
    'preco_taxa','seguradoras_recusaram','documentacao_nao_veio','cliente_perdeu_licitacao',
    'fechou_outro_corretor','nomeado_outro_corretor','prazo_nao_atendido','sem_retorno_cliente','desistiu_apos_aceite')),
  etapa_perdida text not null,
  status_perdido text,
  premio_estimado numeric(18,2),
  comissao_estimada numeric(18,2),
  concorrente text,
  data_retomar date,
  observacao text,
  reaberta_em timestamptz,
  reaberta_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);
comment on table public.garantia_perdas is 'seguradoras_recusaram exige recusa de verdade (grupo sem_limite), nunca nao_consultado — falha técnica na consulta não é recusa comercial. Nada é apagado: perdido é estado, e a demanda pode ser reaberta.';

grant select, insert, update, delete on public.garantia_perdas to authenticated;
grant all on public.garantia_perdas to service_role;
alter table public.garantia_perdas enable row level security;

create policy "garantia_perdas_select" on public.garantia_perdas for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_perdas_insert" on public.garantia_perdas for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_perdas_update" on public.garantia_perdas for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_perdas_delete_admin" on public.garantia_perdas for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 6. garantia_aprovacoes_minuta ────────────────────────────────────
create table public.garantia_aprovacoes_minuta (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete cascade,
  quem text not null check (quem in ('cliente','segurado')),
  data timestamptz not null default now(),
  forma text,
  documento_id uuid references public.garantia_documentos(id) on delete set null,
  observacao text,
  registrado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (demanda_id, quem)
);

grant select, insert, update, delete on public.garantia_aprovacoes_minuta to authenticated;
grant all on public.garantia_aprovacoes_minuta to service_role;
alter table public.garantia_aprovacoes_minuta enable row level security;

create policy "garantia_aprovacoes_minuta_select" on public.garantia_aprovacoes_minuta for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_aprovacoes_minuta_insert" on public.garantia_aprovacoes_minuta for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_aprovacoes_minuta_update" on public.garantia_aprovacoes_minuta for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_aprovacoes_minuta_delete_admin" on public.garantia_aprovacoes_minuta for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 7. garantia_apolices ─────────────────────────────────────────────
create table public.garantia_apolices (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete restrict,
  apolice_mae_id uuid references public.garantia_apolices(id) on delete set null,
  produto text not null check (produto in ('seguro_garantia','fianca_locaticia')),
  chave_mercado text references public.garantia_seguradoras_config(chave_mercado),
  seguradora_livre text,
  numero_apolice text not null,
  numero_endosso int not null default 0,
  data_emissao date,
  vigencia_inicio date,
  vigencia_fim date,
  objeto text,
  importancia_segurada numeric(18,2),
  premio numeric(18,2),
  comissao_pct numeric(7,4),
  comissao_valor numeric(18,2) generated always as (round(coalesce(premio,0) * coalesce(comissao_pct,0) / 100, 2)) stored,
  tomador_id uuid references public.hub_clientes(id) on delete restrict,
  segurado_id uuid references public.garantia_segurados(id) on delete set null,
  locador_id uuid references public.garantia_segurados(id) on delete set null,
  locatario_id uuid references public.hub_clientes(id) on delete set null,
  situacao text not null default 'vigente' check (situacao in ('vigente','em_sinistro','encerrada')),
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (chave_mercado, numero_apolice, numero_endosso),
  constraint garantia_apolices_partes_obrigatorias check (
    (produto = 'seguro_garantia'   and tomador_id is not null and segurado_id is not null)
    or
    (produto = 'fianca_locaticia' and locador_id is not null and locatario_id is not null)
  )
);
comment on table public.garantia_apolices is 'Não confundir com contratos (Benefícios) nem com raw_lavoro_gerencial.numero_apolice (base de receita importada do SharePoint). São três universos diferentes; este é o único que o pipeline escreve.';

grant select, insert, update, delete on public.garantia_apolices to authenticated;
grant all on public.garantia_apolices to service_role;
alter table public.garantia_apolices enable row level security;

create policy "garantia_apolices_select" on public.garantia_apolices for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_apolices_insert" on public.garantia_apolices for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_apolices_update" on public.garantia_apolices for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_apolices_delete_admin" on public.garantia_apolices for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger garantia_apolices_touch before update on public.garantia_apolices
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 8. garantia_financeiro ───────────────────────────────────────────
create table public.garantia_financeiro (
  id uuid primary key default gen_random_uuid(),
  apolice_id uuid not null unique references public.garantia_apolices(id) on delete cascade,
  vencimento_boleto date,
  status_premio text not null default 'em_aberto' check (status_premio in ('pago','em_aberto','atrasado')),
  data_pagamento_premio date,
  comissao_prevista numeric(18,2),
  comissao_recebida numeric(18,2),
  data_recebimento date,
  repasse_para text,
  repasse_valor numeric(18,2),
  enviado_financeiro_em timestamptz,
  observacao text,
  atualizado_em timestamptz not null default now()
);
comment on table public.garantia_financeiro is 'O financeiro não conta tempo. O relógio da demanda termina quando a apólice é conferida, lançada e enviada ao financeiro. Prêmio não pago não cancela apólice — o financeiro cobra.';

grant select, insert, update, delete on public.garantia_financeiro to authenticated;
grant all on public.garantia_financeiro to service_role;
alter table public.garantia_financeiro enable row level security;

create policy "garantia_financeiro_select" on public.garantia_financeiro for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_financeiro_insert" on public.garantia_financeiro for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_financeiro_update" on public.garantia_financeiro for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_financeiro_delete_admin" on public.garantia_financeiro for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger garantia_financeiro_touch before update on public.garantia_financeiro
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 9. garantia_sinistros ────────────────────────────────────────────
create table public.garantia_sinistros (
  id uuid primary key default gen_random_uuid(),
  apolice_id uuid not null references public.garantia_apolices(id) on delete cascade,
  tipo text not null check (tipo in ('expectativa','aviso')),
  data date not null,
  prazos text,
  situacao_regulacao text,
  documento_id uuid references public.garantia_documentos(id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

grant select, insert, update, delete on public.garantia_sinistros to authenticated;
grant all on public.garantia_sinistros to service_role;
alter table public.garantia_sinistros enable row level security;

create policy "garantia_sinistros_select" on public.garantia_sinistros for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_sinistros_insert" on public.garantia_sinistros for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_sinistros_update" on public.garantia_sinistros for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_sinistros_delete_admin" on public.garantia_sinistros for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 10. garantia_encerramentos ───────────────────────────────────────
create table public.garantia_encerramentos (
  id uuid primary key default gen_random_uuid(),
  apolice_id uuid not null unique references public.garantia_apolices(id) on delete cascade,
  tipo text not null check (tipo in ('baixa_obrigacao_cumprida','cancelada_pedido','substituida','decisao_judicial','vencida_sem_renovacao')),
  data date not null,
  documento_id uuid references public.garantia_documentos(id) on delete set null,
  premio_devolver numeric(18,2),
  estorno_comissao numeric(18,2),
  aprovado_por uuid references auth.users(id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

grant select, insert, update, delete on public.garantia_encerramentos to authenticated;
grant all on public.garantia_encerramentos to service_role;
alter table public.garantia_encerramentos enable row level security;

create policy "garantia_encerramentos_select" on public.garantia_encerramentos for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_encerramentos_insert" on public.garantia_encerramentos for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_encerramentos_update" on public.garantia_encerramentos for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_encerramentos_delete_admin" on public.garantia_encerramentos for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 11. garantia_avisos_renovacao (sem cron nesta parte) ─────────────
create table public.garantia_avisos_renovacao (
  id uuid primary key default gen_random_uuid(),
  apolice_id uuid not null references public.garantia_apolices(id) on delete cascade,
  dias_antes int not null check (dias_antes in (120,90,60,30)),
  data_aviso date not null,
  enviado boolean not null default false,
  enviado_em timestamptz,
  demanda_renovacao_id uuid references public.garantia_demandas(id) on delete set null,
  unique (apolice_id, dias_antes)
);

grant select, insert, update, delete on public.garantia_avisos_renovacao to authenticated;
grant all on public.garantia_avisos_renovacao to service_role;
alter table public.garantia_avisos_renovacao enable row level security;

create policy "garantia_avisos_renovacao_select" on public.garantia_avisos_renovacao for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_avisos_renovacao_insert" on public.garantia_avisos_renovacao for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_avisos_renovacao_update" on public.garantia_avisos_renovacao for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_avisos_renovacao_delete_admin" on public.garantia_avisos_renovacao for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 12. garantia_auditoria ───────────────────────────────────────────
create table public.garantia_auditoria (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  usuario_id uuid references auth.users(id) on delete set null,
  data timestamptz not null default now()
);
comment on table public.garantia_auditoria is 'Trilha de auditoria: não se edita nem se apaga. UPDATE e DELETE apenas para ADMIN.';

create index garantia_auditoria_registro_idx on public.garantia_auditoria (tabela, registro_id, data desc);

grant select, insert on public.garantia_auditoria to authenticated;
grant all on public.garantia_auditoria to service_role;
alter table public.garantia_auditoria enable row level security;

create policy "garantia_auditoria_select" on public.garantia_auditoria for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_auditoria_insert" on public.garantia_auditoria for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_auditoria_update_admin" on public.garantia_auditoria for update to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role)) with check (public.has_role(auth.uid(), 'ADMIN'::app_role));
create policy "garantia_auditoria_delete_admin" on public.garantia_auditoria for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Trigger genérica: uma linha por campo alterado, ignorando ruído.
create or replace function public.garantia_registra_auditoria()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  k text;
begin
  for k in select jsonb_object_keys(v_new) loop
    if k in ('atualizado_em') then
      continue;
    end if;
    if v_old -> k is distinct from v_new -> k then
      insert into public.garantia_auditoria (tabela, registro_id, campo, valor_anterior, valor_novo, usuario_id)
      values (tg_table_name, new.id, k, v_old ->> k, v_new ->> k, auth.uid());
    end if;
  end loop;
  return null;
end;
$function$;

create trigger garantia_demandas_auditoria   after update on public.garantia_demandas   for each row execute function public.garantia_registra_auditoria();
create trigger garantia_apolices_auditoria   after update on public.garantia_apolices   for each row execute function public.garantia_registra_auditoria();
create trigger garantia_financeiro_auditoria after update on public.garantia_financeiro for each row execute function public.garantia_registra_auditoria();

-- ── 13. FKs pendentes ────────────────────────────────────────────────
alter table public.garantia_documentos   add constraint garantia_documentos_apolice_fk   foreign key (apolice_id) references public.garantia_apolices(id) on delete cascade;
alter table public.garantia_analises_ia  add constraint garantia_analises_ia_apolice_fk  foreign key (apolice_id) references public.garantia_apolices(id) on delete cascade;
alter table public.garantia_demandas     add constraint garantia_demandas_apolice_anterior_fk foreign key (apolice_anterior_id) references public.garantia_apolices(id) on delete set null;
