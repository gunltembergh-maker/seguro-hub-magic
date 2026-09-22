
-- =====================================================================
-- Parte 1a do pipeline de Garantia: fundação de dados.
-- Migration ADITIVA. Nenhum ALTER/DROP/policy/trigger em tabela existente.
-- garantia_judicial_solicitacoes é apenas referenciada por FK (leitura).
-- =====================================================================

create extension if not exists pg_trgm;

-- ── 2.1 Helpers de permissão ─────────────────────────────────────────
-- Mesmo formato de public.pode_beneficios(): ADMIN tem auto-grant;
-- os demais pelo perfil de acesso, exigindo conta ativa e não bloqueada.

create or replace function public.pode_entrada_demandas()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND p.active = true
       AND COALESCE(p.blocked, false) = false
       AND COALESCE((pa.permissoes ->> 'menu_entrada_demandas')::boolean, false) = true
  );
$function$;

create or replace function public.pode_garantia_pipeline()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND p.active = true
       AND COALESCE(p.blocked, false) = false
       AND (
            COALESCE((pa.permissoes ->> 'menu_garantia_negociacao')::boolean, false) = true
         OR COALESCE((pa.permissoes ->> 'menu_garantia_crm')::boolean, false) = true
         OR COALESCE((pa.permissoes ->> 'menu_garantia_painel')::boolean, false) = true
       )
  );
$function$;

-- Corta os indicadores de tempo e gargalo: corretor comum não vê horas.
create or replace function public.pode_garantia_painel()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND p.active = true
       AND COALESCE(p.blocked, false) = false
       AND COALESCE((pa.permissoes ->> 'menu_garantia_painel')::boolean, false) = true
  );
$function$;

create or replace function public.pode_entrada_cadastrar_canal()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND p.active = true
       AND COALESCE(p.blocked, false) = false
       AND COALESCE((pa.permissoes ->> 'entrada_cadastrar_canal')::boolean, false) = true
  );
$function$;

create or replace function public.pode_definir_responsavel_cliente()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN'::app_role
  ) OR EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso pa ON pa.id = p.perfil_id
     WHERE p.user_id = auth.uid()
       AND p.active = true
       AND COALESCE(p.blocked, false) = false
       AND COALESCE((pa.permissoes ->> 'entrada_definir_responsavel')::boolean, false) = true
  );
$function$;

create or replace function public.garantia_touch_atualizado_em()
returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  new.atualizado_em = now();
  return new;
end;
$function$;

-- ── 2.2 hub_clientes ─────────────────────────────────────────────────
create table public.hub_clientes (
  id uuid primary key default gen_random_uuid(),
  tipo_pessoa text not null check (tipo_pessoa in ('PF','PJ')),
  cpf_cnpj text not null unique,               -- só dígitos, sem máscara
  nome text not null,                          -- razão social ou nome
  nome_fantasia text,
  email text,
  telefone text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  municipio text,
  uf text,
  cnae text,
  cnae_descricao text,
  porte text,
  capital_social numeric(18,2),
  situacao_cadastral text,
  data_abertura date,
  natureza_juridica text,
  dados_cartao_cnpj jsonb,                     -- payload normalizado do cartão CNPJ
  cartao_atualizado_em timestamptz,
  cartao_fonte text,                           -- ex.: 'rfb', 'manual'
  responsavel_id uuid references auth.users(id) on delete set null,
  ab_empresa_id uuid references public.ab_empresa(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null, -- reserva para consolidação futura, sem uso agora
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
comment on table public.hub_clientes is 'Cadastro de cliente compartilhado pelo Hub (tomador no seguro garantia, locatário na fiança locatícia). Tabela própria: public.clientes é governada pela RLS de Benefícios.';

create index hub_clientes_cpf_cnpj_idx on public.hub_clientes (cpf_cnpj);
create index hub_clientes_nome_lower_idx on public.hub_clientes (lower(nome));
create index hub_clientes_nome_trgm_idx on public.hub_clientes using gin (nome gin_trgm_ops);

grant select, insert, update, delete on public.hub_clientes to authenticated;
grant all on public.hub_clientes to service_role;
alter table public.hub_clientes enable row level security;

create policy "hub_clientes_select" on public.hub_clientes for select to authenticated
  using (public.pode_entrada_demandas() or public.pode_garantia_pipeline());
create policy "hub_clientes_insert" on public.hub_clientes for insert to authenticated
  with check (public.pode_entrada_demandas() or public.pode_garantia_pipeline());
create policy "hub_clientes_update" on public.hub_clientes for update to authenticated
  using (public.pode_entrada_demandas() or public.pode_garantia_pipeline())
  with check (public.pode_entrada_demandas() or public.pode_garantia_pipeline());
create policy "hub_clientes_delete_admin" on public.hub_clientes for delete to authenticated
  using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Responsável pelo cliente só quem tem a permissão: controle real, não de interface.
create or replace function public.hub_clientes_protege_responsavel()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.responsavel_id is not null and public.pode_definir_responsavel_cliente() = false then
      raise exception 'Sem permissão para definir o responsável pelo cliente.';
    end if;
  else
    if new.responsavel_id is distinct from old.responsavel_id
       and public.pode_definir_responsavel_cliente() = false then
      raise exception 'Sem permissão para definir o responsável pelo cliente.';
    end if;
  end if;
  return new;
end;
$function$;

create trigger hub_clientes_protege_responsavel
  before insert or update on public.hub_clientes
  for each row execute function public.hub_clientes_protege_responsavel();

create trigger hub_clientes_touch
  before update on public.hub_clientes
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 2.3 hub_entradas ─────────────────────────────────────────────────
create sequence public.hub_entradas_protocolo_seq;

create table public.hub_entradas (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique default ('ENT-' || lpad(nextval('public.hub_entradas_protocolo_seq')::text, 6, '0')),
  ramo text not null check (ramo in ('garantia','beneficios','demais_ramos','credito','outro')),
  produto text check (produto in ('seguro_garantia','fianca_locaticia')),
  chegada_em timestamptz not null,             -- quando o contato chegou; início do relógio
  origem text not null default 'email' check (origem in ('email','telefone','whatsapp','formulario_judicial','indicacao','presencial','outro')),
  canal_id uuid references public.canais(id),
  cliente_id uuid references public.hub_clientes(id) on delete restrict,
  assunto text,
  observacao text,
  destino text not null default 'retida' check (destino in ('roteada','retida','descartada')),
  motivo_retencao text,
  demanda_id uuid,                             -- FK para garantia_demandas adicionada no fim desta migration
  registrado_por uuid references auth.users(id) on delete set null,
  registrado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint hub_entradas_garantia_tem_produto check (ramo <> 'garantia' or produto is not null)
);
comment on table public.hub_entradas is 'Porta única de registro de demandas de todos os ramos. Só Garantia tem pipeline hoje; os demais ficam registrados e retidos.';

create index hub_entradas_ramo_idx on public.hub_entradas (ramo, registrado_em desc);
create index hub_entradas_cliente_idx on public.hub_entradas (cliente_id);
create index hub_entradas_destino_idx on public.hub_entradas (destino);

grant select, insert, update, delete on public.hub_entradas to authenticated;
grant all on public.hub_entradas to service_role;
alter table public.hub_entradas enable row level security;

create policy "hub_entradas_select" on public.hub_entradas for select to authenticated
  using (public.pode_entrada_demandas() or public.pode_garantia_pipeline());
create policy "hub_entradas_insert" on public.hub_entradas for insert to authenticated
  with check (public.pode_entrada_demandas() or public.pode_garantia_pipeline());
create policy "hub_entradas_update" on public.hub_entradas for update to authenticated
  using (public.pode_entrada_demandas() or public.pode_garantia_pipeline())
  with check (public.pode_entrada_demandas() or public.pode_garantia_pipeline());
create policy "hub_entradas_delete_admin" on public.hub_entradas for delete to authenticated
  using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger hub_entradas_touch
  before update on public.hub_entradas
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 2.4 garantia_status_catalogo ─────────────────────────────────────
-- Status vive em catálogo, não em CHECK: status novo é INSERT, não migration.
create table public.garantia_status_catalogo (
  codigo text primary key,
  nome text not null,
  etapa text not null,
  fase text not null check (fase in ('negociacao','crm','carteira','encerramento')),
  relogio text not null check (relogio in ('interno','externo','sem_relogio')),
  com_quem text check (com_quem in ('corretora','cliente','comercial','cliente_ou_comercial','cliente_e_socios','seguradora','segurado','financeiro')),
  sla_horas int,
  ordem int not null,
  ativo boolean not null default true
);

grant select on public.garantia_status_catalogo to authenticated;
grant all on public.garantia_status_catalogo to service_role;
alter table public.garantia_status_catalogo enable row level security;

create policy "garantia_status_catalogo_select" on public.garantia_status_catalogo for select to authenticated using (true);
create policy "garantia_status_catalogo_admin_ins" on public.garantia_status_catalogo for insert to authenticated with check (public.has_role(auth.uid(), 'ADMIN'::app_role));
create policy "garantia_status_catalogo_admin_upd" on public.garantia_status_catalogo for update to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role)) with check (public.has_role(auth.uid(), 'ADMIN'::app_role));
create policy "garantia_status_catalogo_admin_del" on public.garantia_status_catalogo for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

insert into public.garantia_status_catalogo (codigo, nome, etapa, fase, relogio, com_quem, sla_horas, ordem) values
  ('triagem','Em triagem','1','negociacao','interno','corretora',null,1),
  ('analise_tecnica','Em análise técnica','2','negociacao','interno','corretora',null,2),
  ('aguard_doc_contrato','Aguardando documentação do contrato','2','negociacao','externo','cliente_ou_comercial',null,3),
  ('aguard_comercial','Aguardando retorno do comercial','qualquer','negociacao','externo','comercial',null,4),
  ('consultando_mercado','Consultando mercado','3','negociacao','interno','corretora',null,5),
  ('solicitando_cadastro','Solicitando documentos de cadastro','3b','negociacao','interno','corretora',null,6),
  ('aguard_doc_cadastro','Aguardando documentos de cadastro','3b','negociacao','externo','cliente',null,7),
  ('enviando_cadastro','Enviando cadastro às seguradoras','3b','negociacao','interno','corretora',null,8),
  ('aguard_analise_cadastro','Aguardando análise do cadastro','3b','negociacao','externo','seguradora',null,9),
  ('em_cotacao','Em cotação','4','negociacao','interno','corretora',null,10),
  ('aguard_cotacao','Aguardando retorno da cotação','4','negociacao','externo','seguradora',null,11),
  ('montando_proposta','Montando proposta','5','negociacao','interno','corretora',null,12),
  ('aguard_aceite_cliente','Aguardando aceite do cliente','5','negociacao','externo','cliente',null,13),
  ('curadoria','Em curadoria','6','crm','interno','corretora',null,14),
  ('aguard_ccg','Aguardando assinatura do CCG','6','crm','externo','cliente_e_socios',null,15),
  ('aguard_minuta','Aguardando minuta','7','crm','externo','seguradora',null,16),
  ('conferencia_minuta','Conferência da minuta','7','crm','interno','corretora',null,17),
  ('aguard_aprov_minuta','Aguardando aprovação da minuta','7','crm','externo','cliente',null,18),
  ('aguard_aceite_texto','Aguardando aceite do texto','7','crm','externo','segurado',null,19),
  ('ajuste_minuta','Ajuste da minuta','7','crm','externo','seguradora',null,20),
  ('aguard_emissao','Aguardando emissão','8','crm','externo','seguradora',null,21),
  ('conferencia_apolice','Conferência e lançamento da apólice','8','crm','interno','corretora',null,22),
  ('lancamento_financeiro','Lançamento financeiro','9','crm','sem_relogio','financeiro',null,23),
  ('aguard_pgto_premio','Aguardando pagamento do prêmio','9','crm','sem_relogio','financeiro',null,24),
  ('aguard_pgto_comissao','Aguardando pagamento da comissão','9','crm','sem_relogio','financeiro',null,25),
  ('apolice_vigente','Apólice vigente','10','carteira','sem_relogio',null,null,26),
  ('sinistro_regulacao','Em sinistro: regulação','sinistro','carteira','externo','seguradora',null,27),
  ('sinistro_acompanhamento','Em sinistro: acompanhamento','sinistro','carteira','interno','corretora',null,28),
  ('aguard_termo_liberacao','Aguardando termo de liberação','11','encerramento','externo','segurado',null,29),
  ('aguard_endosso_cancel','Aguardando endosso de cancelamento','11','encerramento','externo','seguradora',null,30),
  ('lancamento_baixa','Lançamento da baixa','11','encerramento','interno','corretora',null,31)
on conflict (codigo) do nothing;

-- ── 2.5 garantia_segurados ───────────────────────────────────────────
create table public.garantia_segurados (
  id uuid primary key default gen_random_uuid(),
  tipo_pessoa text not null check (tipo_pessoa in ('PF','PJ')),
  cpf_cnpj text not null unique,
  nome text not null,
  publico_privado text check (publico_privado in ('publico','privado')),
  dados_cartao_cnpj jsonb,
  cartao_atualizado_em timestamptz,
  exige_texto_proprio boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
comment on table public.garantia_segurados is 'Contraparte: segurado no seguro garantia, locador na fiança locatícia.';

grant select, insert, update, delete on public.garantia_segurados to authenticated;
grant all on public.garantia_segurados to service_role;
alter table public.garantia_segurados enable row level security;

create policy "garantia_segurados_select" on public.garantia_segurados for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_segurados_insert" on public.garantia_segurados for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_segurados_update" on public.garantia_segurados for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_segurados_delete_admin" on public.garantia_segurados for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger garantia_segurados_touch
  before update on public.garantia_segurados
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 2.6 garantia_seguradoras_config ──────────────────────────────────
create table public.garantia_seguradoras_config (
  id uuid primary key default gen_random_uuid(),
  chave_mercado text not null unique,
  rotulo text not null,
  identificador_api text,   -- identificador textual do motor de consulta. NÃO é credencial: credenciais só em variáveis de ambiente do servidor.
  tem_portal boolean not null default false,
  seguradora_id uuid references public.seguradoras(id) on delete set null,
  ativa_garantia boolean not null default true,
  observacao text,
  atualizado_em timestamptz not null default now()
);
comment on table public.garantia_seguradoras_config is 'Espelho de MKT_SEGURADORAS em src/lib/garantia/garantia-judicial-normalizar.ts. Divergência faz o comparativo de mercado descartar seguradora em silêncio.';

grant select on public.garantia_seguradoras_config to authenticated;
grant all on public.garantia_seguradoras_config to service_role;
alter table public.garantia_seguradoras_config enable row level security;

create policy "garantia_seguradoras_config_select" on public.garantia_seguradoras_config for select to authenticated using (true);
create policy "garantia_seguradoras_config_admin_ins" on public.garantia_seguradoras_config for insert to authenticated with check (public.has_role(auth.uid(), 'ADMIN'::app_role));
create policy "garantia_seguradoras_config_admin_upd" on public.garantia_seguradoras_config for update to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role)) with check (public.has_role(auth.uid(), 'ADMIN'::app_role));
create policy "garantia_seguradoras_config_admin_del" on public.garantia_seguradoras_config for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

insert into public.garantia_seguradoras_config (chave_mercado, rotulo, identificador_api, tem_portal, observacao) values
  ('akad','AKAD',null,true,null),
  ('allianz','ALLIANZ',null,false,null),
  ('alm','ALM',null,true,null),
  ('austral','AUSTRAL',null,false,null),
  ('avla','AVLA','avla',true,null),
  ('axa','AXA','axa',true,null),
  ('berkley','BERKLEY',null,true,null),
  ('btg','BTG',null,false,null),
  ('cesce','CESCE',null,false,null),
  ('chubb','CHUBB',null,false,null),
  ('darwin','DARWIN',null,false,null),
  ('daycoval','DAYCOVAL',null,true,null),
  ('essor','ESSOR','essor',true,null),
  ('ezze','EZZE',null,true,null),
  ('fairfax','FAIRFAX',null,true,null),
  ('fairway','FAIRWAY',null,false,null),
  ('fator','FATOR','fator',true,'Devolve página de bloqueio desde 17/09/2026; aparece como não consultada. Pendência de tratativa com a seguradora.'),
  ('finanguard','FINANGUARD',null,false,null),
  ('hdi','HDI',null,false,null),
  ('jns','JNS','jns',true,null),
  ('junto','JUNTO','junto',true,null),
  ('kovr','KOVR',null,false,null),
  ('liberty','LIBERTY',null,false,null),
  ('mapfre','MAPFRE',null,false,null),
  ('mitsui','MITISUI','mitsui',true,null),
  ('newe','NEWE','newe',true,null),
  ('now','NOW SEGUROS','now',true,null),
  ('pottencial','POTTENCIAL',null,true,null),
  ('sombrero','SOMBRERO','sombrero',true,null),
  ('sompo','SOMPO',null,false,null),
  ('sudaseg','SUDASEG',null,false,null),
  ('swissre','SWISS RE',null,false,null),
  ('thinkseg','THINKSEG',null,false,null),
  ('tokio','TOKIO',null,true,null),
  ('zurich','ZURICH',null,false,null)
on conflict (chave_mercado) do nothing;

create trigger garantia_seguradoras_config_touch
  before update on public.garantia_seguradoras_config
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 2.7 garantia_demandas ────────────────────────────────────────────
create sequence public.garantia_demandas_codigo_seq;

create table public.garantia_demandas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                          -- 'GAR-00123', gerado só no aceite
  legenda text,                                -- código · cliente · segurado
  produto text not null check (produto in ('seguro_garantia','fianca_locaticia')),
  entrada_id uuid references public.hub_entradas(id) on delete set null,
  solicitacao_id uuid unique references public.garantia_judicial_solicitacoes(id) on delete set null,
  fase text not null default 'negociacao' check (fase in ('negociacao','crm','perdida','encerrada')),
  etapa text not null default '1',
  status_atual text not null references public.garantia_status_catalogo(codigo),
  triagem_completa boolean not null default false,
  chegada_em timestamptz not null,
  cadastrado_em timestamptz not null default now(),
  cadastrado_por uuid references auth.users(id) on delete set null,
  cliente_id uuid not null references public.hub_clientes(id) on delete restrict,   -- tomador, ou locatário na fiança
  segurado_id uuid references public.garantia_segurados(id) on delete set null,     -- segurado, ou locador na fiança
  modalidade text check (modalidade in ('licitante','executante','judicial','adiantamento','aduaneiro','locaticia','outras')),
  publico_privado text check (publico_privado in ('publico','privado')),
  tipo_movimento text check (tipo_movimento in ('novo','renovacao','endosso')),
  tipo_alteracao text check (tipo_alteracao in ('aumento_is','prorrogacao_prazo','outro')),
  apolice_anterior_id uuid,
  importancia_segurada numeric(18,2),
  percentual_garantia numeric(7,4),
  objeto text,
  vigencia_exigida text,
  data_limite date,
  canal_id uuid references public.canais(id),
  responsavel_cliente_id uuid references auth.users(id) on delete set null,
  responsavel_tecnico_id uuid references auth.users(id) on delete set null,
  premio_estimado numeric(18,2),
  comissao_estimada numeric(18,2),
  natureza_rotulo text,                        -- texto livre, como no formulário; não é enum
  numero_processo text,
  justificativa_excecao text,
  observacao text,
  -- Etapa 3b
  exige_cadastro boolean not null default false,        -- true só quando a consulta a mercado não achou limite nenhum
  balancos_assinados boolean,                           -- balanços assinados pelo representante legal e pelo contador?
  dre_assinados boolean,                                -- DRE assinados pelo representante legal e pelo contador?
  precisa_nomeacao boolean not null default false,
  precisa_ccg boolean not null default false,
  ia_analise_solicitada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint garantia_demandas_fianca_modalidade check (produto <> 'fianca_locaticia' or modalidade = 'locaticia' or modalidade is null)
);
comment on table public.garantia_demandas is 'Demanda de Garantia, atravessa negociação e CRM. Regra de negócio: DRE, balanços, carta de nomeação e CCG NÃO são obrigatórios por padrão. DRE e balanços só passam a ser obrigatórios quando exige_cadastro = true, sem número mínimo de exercícios — o corretor anexa o que conseguir. Nomeação e CCG só quando precisa_nomeacao / precisa_ccg forem marcados manualmente.';

create index garantia_demandas_fase_etapa_idx on public.garantia_demandas (fase, etapa);
create index garantia_demandas_status_idx on public.garantia_demandas (status_atual);
create index garantia_demandas_cliente_idx on public.garantia_demandas (cliente_id);
create index garantia_demandas_canal_idx on public.garantia_demandas (canal_id);
create index garantia_demandas_resp_tecnico_idx on public.garantia_demandas (responsavel_tecnico_id);
create index garantia_demandas_codigo_idx on public.garantia_demandas (codigo);

grant select, insert, update, delete on public.garantia_demandas to authenticated;
grant all on public.garantia_demandas to service_role;
alter table public.garantia_demandas enable row level security;

create policy "garantia_demandas_select" on public.garantia_demandas for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_demandas_insert" on public.garantia_demandas for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_demandas_update" on public.garantia_demandas for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_demandas_delete_admin" on public.garantia_demandas for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger garantia_demandas_touch
  before update on public.garantia_demandas
  for each row execute function public.garantia_touch_atualizado_em();

alter table public.hub_entradas
  add constraint hub_entradas_demanda_fk foreign key (demanda_id) references public.garantia_demandas(id) on delete set null;

-- ── 2.8 garantia_status_historico ────────────────────────────────────
create table public.garantia_status_historico (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.garantia_demandas(id) on delete cascade,
  status_codigo text not null references public.garantia_status_catalogo(codigo),
  relogio text not null,   -- copiado do catálogo no momento da troca
  com_quem text,           -- copiado do catálogo no momento da troca
  inicio timestamptz not null default now(),
  fim timestamptz,
  duracao_segundos int generated always as (case when fim is null then null else extract(epoch from (fim - inicio))::int end) stored,
  usuario_id uuid references auth.users(id) on delete set null,
  observacao text
);
comment on table public.garantia_status_historico is 'Relógio por status. relogio e com_quem são copiados do catálogo de propósito: reclassificar um status amanhã não pode reescrever o histórico do que já aconteceu.';

create index garantia_status_historico_demanda_idx on public.garantia_status_historico (demanda_id, inicio);
create unique index garantia_status_historico_aberto_uq on public.garantia_status_historico (demanda_id) where fim is null;

grant select, insert, update, delete on public.garantia_status_historico to authenticated;
grant all on public.garantia_status_historico to service_role;
alter table public.garantia_status_historico enable row level security;

create policy "garantia_status_historico_select" on public.garantia_status_historico for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_status_historico_insert" on public.garantia_status_historico for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_status_historico_update" on public.garantia_status_historico for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_status_historico_delete_admin" on public.garantia_status_historico for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create or replace function public.garantia_demandas_registra_status()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_relogio text;
  v_com_quem text;
begin
  select c.relogio, c.com_quem into v_relogio, v_com_quem
    from public.garantia_status_catalogo c
   where c.codigo = new.status_atual;

  update public.garantia_status_historico
     set fim = now()
   where demanda_id = new.id and fim is null;

  insert into public.garantia_status_historico (demanda_id, status_codigo, relogio, com_quem, usuario_id)
  values (new.id, new.status_atual, coalesce(v_relogio, 'sem_relogio'), v_com_quem, auth.uid());

  return null;
end;
$function$;

create trigger garantia_demandas_registra_status
  after insert or update of status_atual on public.garantia_demandas
  for each row execute function public.garantia_demandas_registra_status();

-- ── 2.9 garantia_consultas_mercado ───────────────────────────────────
create table public.garantia_consultas_mercado (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.hub_clientes(id) on delete cascade,
  consultada_em timestamptz not null default now(),
  valida_ate timestamptz not null default (now() + interval '12 months'),
  origem text not null check (origem in ('api','manual','misto','formulario_judicial')),
  solicitacao_id uuid references public.garantia_judicial_solicitacoes(id) on delete set null,
  demanda_id uuid references public.garantia_demandas(id) on delete set null,
  resultado_bruto jsonb,                       -- payload cru do motor, sem reparsear
  total_com_limite int not null default 0,
  total_sem_limite int not null default 0,
  total_nao_consultado int not null default 0,
  capacidade_total numeric(18,2) not null default 0,
  completa boolean not null default false,
  substituida_por_id uuid references public.garantia_consultas_mercado(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null
);
comment on table public.garantia_consultas_mercado is '`nao_consultado` é falha técnica, nunca recusa comercial. Nenhum relatório pode contar `nao_consultado` como negativa.';
comment on column public.garantia_consultas_mercado.completa is 'true quando todas as seguradoras com `tem_portal = true` (18) têm resposta registrada. As 17 sem portal são opcionais — podem ser preenchidas, mas não travam a consulta.';

create index garantia_consultas_mercado_cliente_idx on public.garantia_consultas_mercado (cliente_id, consultada_em desc);

grant select, insert, update, delete on public.garantia_consultas_mercado to authenticated;
grant all on public.garantia_consultas_mercado to service_role;
alter table public.garantia_consultas_mercado enable row level security;

create policy "garantia_consultas_mercado_select" on public.garantia_consultas_mercado for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_consultas_mercado_insert" on public.garantia_consultas_mercado for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_consultas_mercado_update" on public.garantia_consultas_mercado for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_consultas_mercado_delete_admin" on public.garantia_consultas_mercado for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ── 2.10 garantia_limites_tomador ────────────────────────────────────
create table public.garantia_limites_tomador (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.garantia_consultas_mercado(id) on delete cascade,
  cliente_id uuid not null references public.hub_clientes(id) on delete cascade,
  chave_mercado text not null references public.garantia_seguradoras_config(chave_mercado),
  status_mercado text,
  grupo_mercado text check (grupo_mercado in ('com_limite','sem_limite','nao_consultado')),
  limite_total numeric(18,2),
  limite_utilizado numeric(18,2) not null default 0,
  limite_disponivel numeric(18,2) generated always as (coalesce(limite_total,0) - coalesce(limite_utilizado,0)) stored,
  taxa numeric(9,6),
  modalidades jsonb,
  data_ultimo_cadastro date,
  nomeacao text check (nomeacao in ('livre','nomeado_outro')),
  mensagem text,
  origem text not null check (origem in ('api','manual')),
  registrado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (consulta_id, chave_mercado)
);
comment on table public.garantia_limites_tomador is '`status_mercado` e `grupo_mercado` usam o vocabulário que já existe em src/lib/garantia/garantia-judicial-normalizar.ts. Não crie vocabulário novo e não reimplemente a normalização — o resumo tem que sair de `resumirResultadoMercado`, senão tela, planilha, e-mail e pipeline divergem.';

grant select, insert, update, delete on public.garantia_limites_tomador to authenticated;
grant all on public.garantia_limites_tomador to service_role;
alter table public.garantia_limites_tomador enable row level security;

create policy "garantia_limites_tomador_select" on public.garantia_limites_tomador for select to authenticated using (public.pode_garantia_pipeline());
create policy "garantia_limites_tomador_insert" on public.garantia_limites_tomador for insert to authenticated with check (public.pode_garantia_pipeline());
create policy "garantia_limites_tomador_update" on public.garantia_limites_tomador for update to authenticated using (public.pode_garantia_pipeline()) with check (public.pode_garantia_pipeline());
create policy "garantia_limites_tomador_delete_admin" on public.garantia_limites_tomador for delete to authenticated using (public.has_role(auth.uid(), 'ADMIN'::app_role));

create trigger garantia_limites_tomador_touch
  before update on public.garantia_limites_tomador
  for each row execute function public.garantia_touch_atualizado_em();

-- ── 2.11 RPC para criar canal ────────────────────────────────────────
-- Único caminho de criação de canal pela interface. Nenhuma policy de canais é tocada.
create or replace function public.rpc_entrada_criar_canal(_nome text)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_nome text := btrim(coalesce(_nome, ''));
  v_id uuid;
begin
  if public.pode_entrada_cadastrar_canal() = false then
    raise exception 'Sem permissão para cadastrar canal.';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome do canal.';
  end if;

  select c.id into v_id from public.canais c where lower(btrim(c.nome)) = lower(v_nome) limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.canais (nome) values (v_nome) returning id into v_id;
  return v_id;
end;
$function$;

revoke execute on function public.rpc_entrada_criar_canal(text) from anon;
grant execute on function public.rpc_entrada_criar_canal(text) to authenticated;
