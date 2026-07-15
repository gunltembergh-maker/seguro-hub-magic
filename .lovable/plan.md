# Report Fechamento — Fase 1 + Newsletters (3 reports)

## Escopo desta entrega

Antes de voltar às newsletters, entregar o **Report Fechamento (Fase 1)** — módulo novo dentro do Hub, reaproveitando `raw_lavoro_gerencial` (mesma base do `/dashboard/receita-executivo`, sem novo importador). Depois, plugar os 3 reports no mesmo esquema de destinatários / disparos / admin.

Fases 2 (Área/Finder/Vidas) e 3 (projeção/cenários/alertas) **ficam fora** desta entrega — só Fase 1, conforme o prompt.

---

## Parte A — Report Fechamento (Dashboard)

### A1. Backend (uma migration)

Nova página `/dashboard/report-fechamento`, com filtro global: **granularidade** (Mensal / Trimestral / Semestral / Anual), **ano**, **período** dependente, e toggle **comparar com período equivalente do ano anterior** (default ON).

Regras de dados (aplicadas dentro de cada RPC, uma vez):
- Ler só `raw_lavoro_gerencial`.
- Normalizar `status_parcela_comissao` (trim + title case).
- Excluir `Cancelado`, `Analisar`, `Transferência De Corretagem`.
- Cutoff = último dia do último mês fechado.
- Ordem canais fixa: Benefícios → Demais Ramos → Garantia (mapa via `raw_lavoro_depara_ramo`).
- Apólices = `count(distinct numero_apolice)`; Parcelas = `count(*)`.
- Tomador vazio/'-': mantém em totais, remove de rankings; em Vencidos/A Receber usa `segurado (s/ Tomador)`.

RPCs (todas recebem `p_ano int, p_gran text, p_periodo int, p_comparar bool`):

1. `rpc_fechamento_sumario` — cards Emissão (prêmio, comissão, apólices) + Caixa (recebido, parcelas, ticket) + tabela por ramo (atual vs anterior, Δ R$/%) + bloco pipeline resumido.
2. `rpc_fechamento_caixa_ramo` — mix por ramo, evolução mensal por ramo, top 15 tomadores período atual + período anterior.
3. `rpc_fechamento_evolucao_mensal` — 3 blocos (comissão, caixa, apólices) mês×ramo ano atual vs ano anterior, com totais e Δ%.
4. `rpc_fechamento_vencidos` (snapshot, ignora filtro de período) — por ano de vencimento × canal, aging por faixa × canal, matriz ano × faixa, top 10 inadimplentes.
5. `rpc_fechamento_a_receber` (snapshot) — por ano de pagamento previsto, detalhamento próximo semestre, safra por ano de emissão, top 10 tomadores a receber.
6. `rpc_fechamento_top_tomadores` — top 20 comissão emitida período atual + top 20 período anterior.
7. `rpc_fechamento_base` — drill-down paginado com filtros aplicados (server-side pagination).

Todas `security definer`, `grant execute to authenticated`, gated por permissão nova `menu_dashboard_fechamento` (ou `ADMIN`).

### A2. Frontend

Rota: `src/routes/_authenticated/dashboard.report-fechamento.tsx` com 7 abas (`Tabs` do shadcn), filtro global no topo persistido em `sessionStorage`, callout amarelo (#FFF4D6 / borda #B89968) descrevendo período ativo em cada aba, badge "Última atualização" (max `updated_at` de `raw_lavoro_gerencial`), alerta se sync > 24h.

Componentes reutilizados: `MetricCard`, tabelas `<Table>` shadcn, `recharts` (bar / line / pie) — mesma paleta do `/dashboard/receita-executivo`. Formatação BR (R$, %, DD/MM/AAAA), Δ com ▲ verde / ▼ vermelho.

**Botão "Exportar Excel"** no topo: usa `xlsx` (já usado no importador) gerando as 7 abas com mesma estrutura das telas. Sem gráficos embutidos no Excel v1 — cabeçalho navy + callout amarelo replicados via styles do sheetjs pro.

Sidebar: adicionar "Report Fechamento" abaixo de "Resumo Executivo", gated pela mesma permissão.

### A3. Aceite Fase 1

- Sumário bate 100% com Caixa por Ramo, Evolução Mensal e Top Tomadores no mesmo período.
- YTD sempre compara mesma janela (Jan-Jun 2026 vs Jan-Jun 2025).
- Vencidos + A Receber + Recebido são mutuamente exclusivos.
- Filtro global aplica em todas as abas exceto Vencidos/A Receber (snapshots).
- Export Excel com 7 abas.

---

## Parte B — Newsletters (3 reports unificados)

Depois do Fechamento validado, criar o esquema **único** de reports:

### B1. Migration (segunda migration)

```
report_tipo enum: 'receita_diaria' | 'executivo_semanal' | 'fechamento_manual'

report_destinatarios(id, tipo report_tipo, email, nome, ativo, created_at)
report_disparos(id, tipo report_tipo, disparado_por uuid, disparado_em, status,
                total_destinatarios, erro, payload jsonb, periodo_ref text)
```

RLS: ADMIN gerencia; edge function usa service_role.

### B2. Templates React Email (`src/emails/`)

1. **`ReceitaDiariaEmail.tsx`** — formato Hub Tailor: KPIs do dia (Emitido, Caixa, Apólices), vs meta, top 5 ramos, top 5 canais, CTA "Ver no Hub" → `/dashboard/receita`.
2. **`ExecutivoSemanalEmail.tsx`** — enxuto: 4 KPIs YTD (Emitido, Caixa Esperado, Caixa Recebido %, A Receber Futuro) + banner **Comissão Vencida** destacado + CTA "Ver detalhamento mensal no Hub" → `/dashboard/receita-executivo`. Sem tabela mensal, sem gráficos.
3. **`FechamentoManualEmail.tsx`** — resumo executivo do período selecionado pelo ADM (KPIs Emissão + Caixa + Δ vs anterior + top 5 tomadores + link para o Hub). Anexa o Excel gerado pelo botão de export.

Preview em `/lovable/email/transactional/preview` funciona sem domínio.

### B3. Edge Functions (uma por tipo, ou uma com `?tipo=`)

- `send-report-receita-diaria` — reusa RPCs de `/dashboard/receita`.
- `send-report-executivo-semanal` — reusa `rpc_receita_executivo_mensal` + `rpc_receita_executivo_complementares`.
- `send-report-fechamento-manual` — recebe filtros do ADM, gera Excel, envia.

Todas gravam em `report_disparos`. Envio real fica bloqueado até domínio liberado — deixamos configurado com fallback para preview.

### B4. Cron

- Diária Receita: `0 8 * * 1-5` BRT
- Semanal Executivo: `0 8 * * 2` BRT
- Fechamento: **sem cron**, disparo manual pelo ADM.

### B5. Admin `/admin/reports`

Uma tela, 3 abas (uma por tipo):
- Lista de destinatários (CRUD)
- Histórico de disparos
- Botão "Disparar agora" (Fechamento: abre modal com filtros de período antes de disparar)

Gated por ADMIN, link no sidebar.

---

## Ordem de execução

1. Migration A1 (7 RPCs + permissão) → validar números.
2. Página `/dashboard/report-fechamento` + sidebar + export Excel → validar aceite Fase 1.
3. Migration B1 + templates + admin screen + preview.
4. Quando domínio for liberado: ligar edge functions + crons.

Confirmar antes de começar A1 (é a maior parte do trabalho — ~7 RPCs e 7 abas de UI).
