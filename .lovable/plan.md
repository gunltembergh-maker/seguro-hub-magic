# Hub Lavoro — plano de implementação

O escopo pedido é um sistema completo (BI + admin + importação + SAML SSO). Vou fazer em fases para você conseguir revisar e testar cada etapa, e preciso resolver dois bloqueios antes de partes específicas.

## ⚠️ Bloqueios que preciso destravar com você

1. **SAML SSO** — O provisionamento SAML no Supabase é feito via API de gerenciamento / dashboard (não há tool automatizada aqui). Preciso do **metadata URL do IdP** (Okta / Entra ID / Google Workspace) para você colar na tela do Supabase. No frontend, `/auth` já vai chamar `supabase.auth.signInWithSSO({ domain: "lavoroseguros.com.br" })` — só funciona depois que o SSO estiver ativo no projeto Supabase.
2. **Colunas exatas das planilhas** — Você mencionou "44 colunas do gerencial". Preciso do **header exato** (nomes de coluna) do `raw_lavoro_gerencial` e do `raw_lavoro_caixa_comissao` para escrever o schema e o importador certos. Sem isso vou criar um schema plausível que provavelmente precisará ser ajustado.

Sigo assumindo colunas plausíveis para não travar, mas marco isso para revisão.

## Fase 1 — Base SQL (migração única, aprovação sua)

Uma migração completa contendo:

- **Enum & roles**: `app_role` = ADMIN | DIRETORIA_GERAL | COLABORADOR
- **Tabelas de identidade & controle**:
  `dominio_empresa`, `perfis_acesso`, `profiles`, `user_roles`,
  `hub_admin_settings`, `notificacoes_admin`,
  `user_activity_log`, `user_sessions_log`
- **Tabelas raw** (schema plausível — ajustar depois com headers reais):
  `raw_lavoro_gerencial`, `raw_lavoro_caixa_comissao`, `raw_lavoro_depara_ramo`
- **Funções SECURITY DEFINER**:
  `has_role`, `is_admin_or_diretoria`, `pode_gerenciar_configuracoes`,
  `pode_importar`, `is_dominio_lavoro`, `divide_safe`,
  `normalize_categoria_financeira`, `ban_unauthorized_user`,
  `handle_new_user`, `grant_role_for_verified_domain`,
  `rpc_registrar_acesso`, `rpc_meu_perfil`, `rpc_permitir_login_senha`
- **Triggers em `auth.users`**: cria profile bloqueado; bane domínios fora de `lavoroseguros.com.br`; concede role só após verificação
- **RLS + GRANT** em todas as tabelas (nunca `anon` para tabelas de negócio)
- **Views**: `vw_lavoro_receita_competencia`, `vw_lavoro_receita_caixa`, `vw_lavoro_previsto_caixa`
- **RPCs de BI**: `rpc_get_meta_anual`, `rpc_set_meta_anual`, `rpc_receita_kpis`, `rpc_receita_serie_mensal`, `rpc_receita_comparativo_anual`, `rpc_receita_caixa_comparativo_anual`, `rpc_receita_por_canal`, `rpc_receita_por_ramo`, `rpc_receita_variacoes`, `rpc_comissao_vencida_por_canal`
- **Seeds**: `dominio_empresa = lavoroseguros.com.br`; perfis padrão (Admin, Diretoria, Colaborador com `permissoes` jsonb)
- **Storage**: bucket privado `lavoro` (criado via tool separada) + policies em `storage.objects`

## Fase 2 — Auth SSO + gate

- Substituir `/auth` atual por tela com **único** botão "Entrar com SSO Lavoro" chamando `signInWithSSO({ domain })`
- Remover botão Microsoft/OAuth e qualquer resquício de senha
- `_authenticated/` já existe → adicionar checagem extra: se `profile.blocked === true` ou `active === false`, renderizar tela "Solicitação em análise" (sem redirect infinito)
- Após login, chamar `rpc_registrar_acesso` uma vez
- Hook `useMeuPerfil()` que busca `rpc_meu_perfil` e expõe `role` + `permissoes`

## Fase 3 — Dashboard de Receita (`/`)

- Filtros: ano, mês, período (MTD / YTD / SEMESTRE)
- KPIs (via `rpc_receita_kpis`): Competência, Caixa, Meta, Atingimento %, Defasagem, Previsto, Atingimento caixa %
- Gráficos (Recharts): série mensal, comparativo anual, receita por canal, receita por ramo, comissão vencida por canal
- Card de variações (mês anterior / ano anterior)

## Fase 4 — Admin

- `/admin/usuarios` — lista solicitações e usuários; aprovar / bloquear / atribuir role & perfil
- `/admin/perfis` — CRUD de `perfis_acesso` (jsonb de permissões)
- `/admin/configuracoes` — meta anual, permitir login por senha (toggle), domínios permitidos
- `/admin/notificacoes` — inbox de `notificacoes_admin` com marcar como lida
- Sidebar filtra itens pelas `permissoes` (`menu_admin_configuracoes`, etc.) + `role`

## Fase 5 — Importadores

- `/importar/gerencial` e `/importar/caixa`
- Upload da planilha (`.xlsx`/`.csv`) para bucket privado `lavoro`
- Server function faz parse (usando `xlsx`) + `INSERT` em raw table dentro de transação
- Página mostra histórico de importações e erros por linha

## Fase 6 — Limpezas

- Remover páginas placeholder criadas antes (financeiro/juridico/etc.) ou reconvertê-las para "em breve" caso queira manter na sidebar
- Ajustar sidebar para o novo mapa de rotas (Dashboard, Importar, Admin)
- Atualizar meta tags para "Hub Lavoro — BI e Gestão"

## Decisões técnicas

- Continuo em **TanStack Start** + Supabase externo + shadcn + Tailwind (mesma stack atual)
- Toda leitura/escrita sensível vai por `createServerFn` + `requireSupabaseAuth`; RLS aplica em cima
- `xlsx` para parse de planilhas no servidor (worker-compat)
- Recharts para os gráficos
- Estado dos filtros de dashboard via search params da rota

## Ordem de execução proposta

1. **Rodar migração Fase 1** (você aprova a SQL)
2. **Aguardar seu OK dos 2 bloqueios** (metadata SAML + headers das planilhas)
3. Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6

Posso começar pela **Fase 1** já e, em paralelo, você me passa (a) o metadata URL do IdP para você colar no Supabase e (b) o header das duas planilhas. Confirma?
