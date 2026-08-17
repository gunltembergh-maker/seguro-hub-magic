import React from 'react'
import { Section, Text } from '@react-email/components'
import { LAVORO_COLORS as L } from './_shared'
import { escopoFrase } from '@/lib/receita-escopo'

/**
 * Aviso de escopo de receita — renderizado apenas quando o destinatário
 * tem restrição de time(s) (Garantia / Benefícios / Demais Ramos).
 */
export function EscopoNote({ times }: { times?: string[] | null }) {
  const frase = escopoFrase(times)
  if (!frase) return null
  return (
    <Section style={wrap}>
      <Text style={txt}>{frase}</Text>
    </Section>
  )
}

const wrap = {
  background: '#EEF4F8',
  borderLeft: `4px solid ${L.blue}`,
  borderRight: `1px solid ${L.border}`,
  padding: '10px 16px',
}
const txt = { color: L.textMuted, fontSize: '12px', margin: 0, lineHeight: '18px' }
