alter table public.garantia_judicial_solicitacoes
  add column if not exists protocolo text,
  add column if not exists gerado_em timestamptz;

create index if not exists idx_garantia_judicial_solicitacoes_protocolo
  on public.garantia_judicial_solicitacoes (protocolo);