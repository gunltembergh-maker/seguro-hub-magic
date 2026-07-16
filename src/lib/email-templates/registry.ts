import type { ComponentType } from 'react'
import { template as testeTemplate } from './teste'
import { template as receitaDiariaTemplate } from './receita-diaria'
import { template as resumoExecutivoTemplate } from './resumo-executivo-semanal'

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
  'receita-diaria': receitaDiariaTemplate,
  'resumo-executivo-semanal': resumoExecutivoTemplate,
}
