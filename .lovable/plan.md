
## Objetivo

Trazer para o **Hub Lavoro Seguros** tudo que existe no Hub Tailor sob o guarda-chuva "Lavoro" (dashboard, relatório de apólices, RPCs, views, meta anual, onboarding), **mantendo o processo de importação manual que já existe hoje em `Admin > Importar Bases`**. Nada de SharePoint, edge de sync, e-mails automáticos ou refresh via schedule — a fonte de dados continua sendo o upload manual de planilhas.

## O que vem do Hub Tailor

**Páginas (viram rotas TanStack):**
- `dashboard/DashboardReceitaLavoro.tsx` (935 linhas) → `/_authenticated/dashboard/receita` (substitui a tela atual)
- `dashboard/ReceitaCaixa.tsx` → `/_authenticated/dashboard/receita-caixa` (nova)
- `relatorios/RelatorioGerencialApolices.tsx` → `/_authenticated/relatorios/gerencial-apolices` (nova)

**Componentes auxiliares:**
- `DashboardReceitaLavoroOnboardingModal.tsx` (tour de primeira visita)
- `MetricCard`, `ChartSkeleton`, `DashboardLoadingScreen`, `PbiCard`, `BigStatCard`, `VarCard`

**Banco (via migration única):**
- Views: recriar/alinhar `vw_lavoro_receita_competencia`, `vw_lavoro_receita_caixa`, `vw_lavoro_previsto_caixa`, `vw_lavoro_depara_ramo` com o padrão do Tailor
- RPCs: `rpc_lavoro_get_meta_anual`, `rpc_lavoro_set_meta_anual`, `rpc_lavoro_receita_kpis`, `rpc_lavoro_receita_serie_mensal`, `rpc_lavoro_receita_variacoes`, `rpc_lavoro_receita_comparativo_anual`, `rpc_lavoro_receita_por_canal`, `rpc_lavoro_receita_por_ramo`, `rpc_lavoro_ultima_atualizacao`, e todo o bloco de apólices (`rpc_lavoro_apolices_kpis`, `_filtros`, `_por_seguradora`, `_previsao_dezena`, `_lista`)
- Manter os RPCs atuais (`rpc_receita_*`) coexistindo — só desativamos depois de validar

## O que NÃO vem (por design)

- Edge functions `sync-lavoro-bases`, `manual-import-refresh`, `ingest-sharepoint-file`, `sync-sharepoint`, `send-receita-lavoro-automatic`, `send-receita-caixa-automatic`
- Botão "Sincronizar SharePoint" e badge "última sincronização automática"
- Envio automático por e-mail (o dashboard do Tailor tem um botão "disparar e-mail" — não vem)
- Onboarding modal opcional (fica na fase 3, se quiser)

## Escopo por fase

**Fase 1 — Banco (migration única, aprovação do usuário)**
Cria/substitui views + RPCs `rpc_lavoro_*` no schema `public`. Grants para `authenticated` e `service_role`. Configuração da meta anual migra de `hub_admin_settings.key = 'meta_anual'` (atual) para o formato que os RPCs do Tailor esperam.

**Fase 2 — Dashboard Receita Lavoro (substitui a tela atual)**
Porta `DashboardReceitaLavoro.tsx` para `src/routes/_authenticated/dashboard/receita.tsx`. Adapta:
- `AppLayout`/`TailorFrame` → remove (o `_authenticated/route.tsx` já provê layout)
- `useAuth` do Tailor → `useMeuPerfil` (já existe aqui)
- `sonner` `toast` → verificar se já está no projeto; se não, adicionar
- Botão "disparar e-mail" → remover
- Onboarding modal → remover nesta fase
- Chamadas `supabase.rpc("rpc_lavoro_*")` funcionam direto após Fase 1

**Fase 3 — Nova rota `/dashboard/receita-caixa`**
Porta `ReceitaCaixa.tsx`. Adiciona item no sidebar (`app-sidebar.tsx`).

**Fase 4 — Nova rota `/relatorios/gerencial-apolices`**
Porta `RelatorioGerencialApolices.tsx`. Adiciona item no sidebar. Cria seção "Relatórios" se não existir.

**Fase 5 — Permissões**
Adicionar chaves em `perfis_acesso.permissoes`: `menu_dashboards_lavoro_receita_caixa`, `menu_relatorios`, `menu_relatorios_gerencial_apolices`. Ajustar `app-sidebar.tsx` para respeitá-las.

## Detalhes técnicos

- **Stack difference**: Tailor usa React Router + `src/pages/`, Lavoro usa TanStack Start + `src/routes/`. Cada página vira um `createFileRoute` seguindo padrão dot-separated já em uso.
- **Import manual continua idêntico**: `admin/importar-bases.tsx` não sofre mudança estrutural nesta migração. Os RPCs novos leem das mesmas tabelas `raw_lavoro_gerencial`, `raw_lavoro_caixa_comissao`, `raw_lavoro_depara_ramo`.
- **Coexistência de RPCs**: durante a Fase 2, a tela nova já chama `rpc_lavoro_*` e a antiga `rpc_receita_*` fica órfã. Vou removê-la ao final da Fase 2.
- **Meta anual**: os RPCs do Tailor leem uma linha por ano de uma tabela `lavoro_meta_anual` (a confirmar na leitura da migration). Se for diferente do `hub_admin_settings` atual, incluo o data-move na migration.
- **Types Supabase**: `src/integrations/supabase/types.ts` é regerado após cada migration aprovada.

## Pontos que preciso confirmar antes de começar

1. **Meta anual atual** = R$ 10 Mi (2026), armazenada em `hub_admin_settings`. Confirma que essa meta deve ser preservada na estrutura nova?
2. **Onboarding modal**: quer trazer também ou pular?
3. **Permissões**: crio as chaves novas com valor `true` para perfis Admin/Diretoria por padrão?

Se quiser, respondo essas 3 e sigo direto — ou já aprovo o plano e implemento com defaults sensatos (preservar meta, sem onboarding, permissões abertas para Admin/Diretoria).
