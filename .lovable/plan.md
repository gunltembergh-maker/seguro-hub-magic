# Portar features do Hub Tailor para o Hub Lavoro

Vou trazer 6 features do Hub Tailor, adaptadas ao padrão Lavoro (navy `#14405C`, azul `#00BAF2`, sem elementos Tailor como chevrons/bege `#DFDBBE`). Trabalho grande — recomendo aprovar por fases (proposta: F1+F2 juntas, F3+F4 juntas, F5+F6 juntas).

---

## Fase 1 — Início (Hub) reformulado

Reescrever `/hub` (`src/routes/_authenticated/hub.tsx`) para reaproveitar a estrutura do `Inicio` do Tailor, **apenas com dados Lavoro**:

- **HeaderSaudacao** — "Olá, {primeiro nome}", horário BRT, botão refresh, "Última atualização".
- **Bloco Lavoro Seguros** (mesmo `BlocoLavoroInicio`): Receita Competência do mês, Receita Caixa do mês, barra de atingimento, banner âmbar de comissões vencidas, link para `/dashboard/receita-executivo`.
- **Últimas Notícias** — 8 comunicados mais recentes de `comunicados` (já existe no projeto), com badge por categoria.
- **Acesso Rápido** — grid de atalhos filtrado por permissões (Dashboards Receita/Caixa/Executivo/Fechamento, Áreas, Ramos, Admin).
- **Últimas Atualizações** — timestamps de `raw_lavoro_gerencial` e `raw_lavoro_caixa_comissao`.

Nova RPC: `rpc_inicio_lavoro_resumo` — devolve `receita_competencia_mes`, `receita_caixa_mes`, `atingimento_caixa_mes`, `total_vencido_mes`, `ultima_atualizacao` a partir de `raw_lavoro_gerencial`.

---

## Fase 2 — Minha Visão (impersonation)

Contexto React `ViewAsProvider` com API `useViewAs()` e `useEffectiveUserId()` — igual ao Tailor. **ADMIN** escolhe um usuário e o app inteiro passa a enxergar como aquele perfil (permissões + role efetivas).

- `ViewAsContext.tsx` — persiste em `sessionStorage`, expõe `effectiveRole`, `effectivePermissoes`, `effectiveUserId`.
- Novo hook `useMeuPerfilEfetivo()` que envolve `useMeuPerfil` e sobrepõe com `viewAs`.
- Substituir `useMeuPerfil()` por `useMeuPerfilEfetivo()` no sidebar, no Hub e nos guards de permissão em dashboards/admin.
- **Seletor** no header/sidebar (só visível para ADMIN): `Select` de usuários ativos.
- **Banner amarelo topo** + **`MinhaVisaoIndicator`** (pill flutuante bottom-right) enquanto ativo — "Visualizando como {nome}" · "Sair".
- Nova RPC `rpc_view_as_perfil(user_id)` que devolve o perfil efetivo (protegida — só ADMIN pode chamar).

---

## Fase 3 — Popup de Comunicado

- Tabela `comunicados_popup` (id, titulo, mensagem, ativo, paginas text[], cor_fundo, cor_texto, botao_label, criado_em, criado_por).
- Tabela `comunicados_popup_dispensados` (popup_id, user_id, dispensado_em) — para "não mostrar novamente".
- RPCs: `rpc_get_popups_ativos(p_pagina)`, `rpc_dispensar_popup(p_popup_id)`.
- Componente `PopupComunicado` (adaptado — visual Lavoro navy, sem chevrons Tailor) montado no `_authenticated/route.tsx`.
- Admin `/admin/comunicados-popup` (CRUD ADMIN-only): título, mensagem, páginas alvo (multi-select), preview ao vivo, toggle ativo.

---

## Fase 4 — Log de Emails

Reaproveita 100% o `email_domain--list_email_logs` que já usamos para depurar.

- Nova página `/admin/emails/log` (ADMIN-only):
  - Cards: Total / Sent / Rejected+Bounced / Suppressed.
  - Filtros: período (24h / 7d / 30d), tipo (`sent`/`bounced`/`suppressed`/…), busca por destinatário.
  - Tabela: Quando (BRT), Destinatário, Evento, Status, Message ID.
  - Botão "Atualizar" (invalida query).
- Server function `listEmailEvents` (createServerFn + `requireSupabaseAuth` + check ADMIN) que chama a API do Lovable (`listEmailLogs` do `@lovable.dev/email-js`) — nunca expõe `LOVABLE_API_KEY` ao browser.
- Renomear a atual `/admin/emails` para `/admin/emails/enviar-teste` (ou virar sub-aba) e criar layout com abas: **Enviar teste** | **Log** | **Agendamentos**.

---

## Fase 5 — Botão "Enviar por email agora" em cada dashboard

Em cada rota filha de Dashboards adicionar botão no topo (visível para ADMIN):

- `/dashboard/receita` → `send-report-receita`
- `/dashboard/receita-caixa` → `send-report-receita-caixa`
- `/dashboard/receita-executivo` → `send-report-executivo`
- `/dashboard/report-fechamento` → `send-report-fechamento` (já mapeado no plano B)

Cada botão abre modal `EnviarEmailReport` com:
- Lista de destinatários cadastrados no tipo (checkbox pré-marcados).
- Campo para adicionar destinatários extras (comma-separated).
- Preview do assunto.
- Botão "Enviar agora" → server fn dedicada por tipo que renderiza template React Email + `sendTemplateEmail`.

Templates React Email (padrão Lavoro navy):
- `ReceitaReportEmail.tsx`
- `ReceitaCaixaReportEmail.tsx`
- `ExecutivoReportEmail.tsx`
- `FechamentoReportEmail.tsx`

---

## Fase 6 — Agendamentos por tipo de Dashboard

Nova página `/admin/emails/agendamentos` (abas por tipo, igual Tailor):

- Tabela `email_schedules_config` (modulo enum, hora_brt, dias_semana int[], ativo, motivo_pausa, atualizado_por, atualizado_em).
- Tabela `email_schedules_disparos` (id, modulo, disparado_em, disparado_por, total_destinatarios, sucessos, falhas, status, payload jsonb, erro).
- RPCs: `rpc_atualizar_schedule_config`, `rpc_toggle_schedule`, `rpc_proxima_execucao_schedule`, `rpc_historico_disparos`, `rpc_listar_destinatarios_automaticos`, `rpc_adicionar_destinatario`, `rpc_remover_destinatario`.
- UI por módulo: horário BRT, checkbox dias, switch ativo, próxima execução calculada server-side, últimos 30 disparos, botão "Disparar agora" (usa mesma server fn da Fase 5), CRUD de destinatários.
- Server routes públicas `/api/public/hooks/scheduled-report-{modulo}` com verificação de `apikey` (anon) — chamadas por `pg_cron` no horário configurado, respeitando dias e feriados.
- `pg_cron` job unificado que roda a cada 5 min e decide se dispara conforme config (via `rpc_proxima_execucao_schedule`).

---

## Notas técnicas

- Stack: TanStack Start → `createServerFn` para lógica autenticada, server routes `/api/public/*` só para `pg_cron`.
- Adaptação visual: substituir `#DFDBBE` → `#F5F7FA`, `#082537` → `#14405C`, remover `/tailor-chevrons.svg`, trocar "Tailor Partners" por "Lavoro Seguros".
- Reaproveitar 100% das RPCs existentes do Lavoro (`raw_lavoro_gerencial`, `rpc_receita_executivo_*`, etc.).
- `sendTemplateEmail` já está pronto; templates novos só precisam ser registrados em `registry.ts`.
- Migrations: uma por fase (3, 4 não têm migration; 5 opcional se cadastrar destinatários; 6 tem 2 tabelas + RPCs).
- Nenhum secret novo — usa `LOVABLE_API_KEY` já provisionado.

Confirma se pode seguir e por qual fase começar (sugestão: **Fase 1 + Fase 2 juntas** — são as que mais mudam a experiência do dia-a-dia).
