alter table public.garantia_judicial_solicitacoes
  add column if not exists consulta_iniciada_em timestamptz,
  add column if not exists consulta_tentativas integer not null default 0;

create index if not exists idx_gjs_status_criado_em
  on public.garantia_judicial_solicitacoes (status, criado_em);