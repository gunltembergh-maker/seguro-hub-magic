import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  codigo?: string
}

const SenhaAprovacaoCodigoEmail = ({ codigo }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Código para criar nova senha de aprovação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Hub Lavoro Seguros</Heading>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h2}>Nova senha de aprovação</Heading>
          <Text style={p}>
            Use o código abaixo para criar uma nova senha de aprovação no Hub. Ele vale por 15 minutos.
          </Text>
          <Text style={code}>{codigo || '000000'}</Text>
          <Text style={nota}>Se você não pediu, ignore este e-mail. Sua senha atual continua valendo.</Text>
        </Section>
        <Text style={footer}>aviso automático do Hub Lavoro</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SenhaAprovacaoCodigoEmail,
  subject: 'Código para criar nova senha de aprovação',
  displayName: 'Senha de aprovação: código',
  previewData: { codigo: '123456' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { margin: '0 auto', padding: '32px 20px', maxWidth: '560px' }
const header = { textAlign: 'center' as const, padding: '8px 0 24px' }
const h1 = { color: '#14405C', fontSize: '22px', fontWeight: 700, margin: 0 }
const h2 = { color: '#14405C', fontSize: '18px', fontWeight: 700, margin: '0 0 12px' }
const card = { border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', backgroundColor: '#f4f7fa' }
const p = { color: '#1f2937', fontSize: '14px', lineHeight: '22px', margin: '0 0 16px' }
const code = {
  color: '#14405C', fontSize: '34px', fontWeight: 700, letterSpacing: '8px',
  textAlign: 'center' as const, margin: '8px 0 20px', fontFamily: 'Courier New, monospace',
}
const nota = { color: '#6b7280', fontSize: '13px', lineHeight: '20px', margin: 0 }
const footer = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const, marginTop: '24px' }
