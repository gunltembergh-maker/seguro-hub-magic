import type { ComponentType } from 'react'
import { template as testeTemplate } from './teste'
import { template as receitaTemplate } from './receita-diaria'
import { template as executivoTemplate } from './resumo-executivo-semanal'
import { template as fechamentoTemplate } from './fechamento'
import { template as garantiaNovaDemandaTemplate } from './garantia-judicial-nova-demanda'
import { template as canalParceiroVencimentoTemplate } from './canal-parceiro-vencimento'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  teste: testeTemplate,
  'receita-lavoro': receitaTemplate,
  'executivo-lavoro': executivoTemplate,
  'fechamento-lavoro': fechamentoTemplate,
  // Pré-visualização apenas: o disparo real é feito por
  // src/lib/garantia/garantia-judicial-email.server.ts (precisa de anexos).
  'garantia-judicial-nova-demanda': garantiaNovaDemandaTemplate,
  // Aliases legados (compat)
  'receita-diaria': receitaTemplate,
  'resumo-executivo-semanal': executivoTemplate,
}
