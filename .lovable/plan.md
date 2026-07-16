# Sistema de e-mail Hub Lavoro — Plano de execução

## ✅ Fase 1 — Concluída neste turno (Partes 1, 2, 7 do prompt)
- Novo asset `logo-lavoro-branca.png` (Logo_Lavoro_Branca-2.png) subido ao CDN e apontado em `_shared.ts`.
- Subjects padronizados no formato `<Módulo> Lavoro Seguros - <Mês> de <Ano>`:
  - Receita → `Receita Lavoro Seguros - Junho de 2026`
  - Executivo → `Report Executivo Lavoro Seguros - Junho de 2026`
  - Fechamento → `Fechamento Lavoro Seguros - Junho de 2026`
- Template Receita reescrito: **somente mês corrente** (removido bloco YTD), identidade visual Lavoro (navy + azul claro + azul vivo), `tabular-nums` nos números, footer "Equipe de Dados & AI / Lavoro Seguros".
- Template Executivo atualizado (novo header, novo footer, novo subject).
- **Novo template `fechamento-lavoro`** criado e registrado (mesma identidade).
- Registry passa a expor os nomes canônicos `receita-lavoro`, `executivo-lavoro`, `fechamento-lavoro` (mantendo aliases legados).

## ⏳ Fase 2 — Infraestrutura genérica (Partes 3, 4, 5, 6) — pendente de execução

Escopo grande, requer aprovação explícita porque envolve migration + edge functions + cron:

### 2.1 Tabelas (migration única)
- `email_send_log` — histórico append-only (pending→sent→failed) por módulo.
- `email_unsubscribe_tokens` — token único por envio.
- `suppressed_emails` — descadastros confirmados.
- `email_destinatarios_automaticos (id, modulo, nome, email, ativo, created_at, updated_at)`.
- `email_disparos_automaticos (id, modulo, data_envio, status, origem, ...)` **+ índice UNIQUE parcial** só em status `('concluido','em_processamento')`.
- `email_schedules_config (modulo, ativo, frequencia, horario_brt, cron_expr, ...)` **+ trigger AFTER INSERT OR UPDATE** que faz upsert em `cron.job`.
- `feriados_nacionais` + função `is_dia_util(date)`.
- RLS: gestão só para ADMIN.

### 2.2 Edge functions (Supabase)
- `send-transactional-email` (worker genérico com verify_jwt=true).
- `process-email-queue`.
- `handle-email-unsubscribe` (verify_jwt=false, público).
- `send-receita-lavoro-automatic`, `send-executivo-lavoro-automatic`, `send-fechamento-lavoro-automatic` — cada um só chama helper compartilhado (`_shared/dispatch.ts`) com `modulo` diferente, evitando duplicação.

### 2.3 Regras críticas (bugs Hub Tailor a NÃO reintroduzir)
- Idempotência considera **só `origem='automatico'`**; manual nunca bloqueia.
- Trigger schedule↔cron: `AFTER INSERT OR UPDATE` + upsert do job.
- Tela `/admin/emails/schedules`: campo horário habilita botão Salvar; salvamento persiste E chama a função de sync do cron.
- Cron chama edge via `net.http_post` com service_role lido do **Vault** (nunca hardcoded).
- Skips explícitos: `nao_e_dia_util`, `schedule_pausado`, `ja_disparado_hoje`, `sem_destinatarios`.
- Falha parcial notifica ADMINs (notificação in-app + e-mail).
- Cron semanal de housekeeping em `cron.job_run_details` (retenção 14 dias).

### 2.4 Telas admin
- `/admin/emails/destinatarios` — abas por módulo, CRUD + toggle ativo.
- `/admin/emails/schedules` — ativar/pausar + horário por módulo.
- `/admin/emails/log` — histórico com filtros módulo/status/data (já existe `email_send_log`, ampliar).

### 2.5 Botão "Enviar Newsletter" em cada filho do Dashboard
- Componente reusável `SendNewsletterButton` no header das telas: `/dashboard/receita`, `/dashboard/receita-caixa`, `/dashboard/receita-executivo`, `/dashboard/report-fechamento`.
- Só visível para ADMIN.
- Usa o período do filtro ativo (ano/mês) → passa para o server fn.
- Modal de confirmação (módulo + período + qtd destinatários ativos).
- `origem='manual'`, `force=true` → não bloqueia por idempotência.
- Toast de resultado (enviados/total).

### 2.6 Validação obrigatória (checklist antes de encerrar Fase 2)
Executar e reportar cada item do prompt (7 validações).

---

**Próximo passo sugerido:** confirmar que posso subir a migration da Fase 2 (é grande, cria 7 tabelas + trigger + função `is_dia_util` + seed de feriados). Assim que aprovada, sigo com edge functions, telas admin e botões nos dashboards em ordem.
