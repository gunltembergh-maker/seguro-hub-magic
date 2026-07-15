import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  nome?: string
  disparadoPor?: string
  quandoBR?: string
}

const TesteEmail = ({ nome, disparadoPor, quandoBR }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Teste de entrega — Hub Lavoro Seguros</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Hub Lavoro Seguros</Heading>
          <Text style={tag}>Teste de infraestrutura de emails</Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>
            Olá {nome || 'time'} 👋
          </Heading>
          <Text style={p}>
            Este é um email de <strong>teste</strong> enviado do Hub para validar a entrega
            pelo domínio <strong>notify.hub.lavoroseguros.com.br</strong>.
          </Text>
          <Text style={p}>
            Se você recebeu esta mensagem, a configuração de envio está funcionando corretamente
            e os reports automáticos poderão ser disparados.
          </Text>

          <Hr style={hr} />

          <Text style={meta}>
            <strong>Disparado por:</strong> {disparadoPor || '—'}
            <br />
            <strong>Data/hora:</strong> {quandoBR || '—'}
          </Text>
        </Section>

        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TesteEmail,
  subject: '✅ Teste de entrega — Hub Lavoro Seguros',
  displayName: 'Teste de entrega',
  previewData: {
    nome: 'Admin',
    disparadoPor: 'admin@lavoroseguros.com.br',
    quandoBR: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { margin: '0 auto', padding: '32px 20px', maxWidth: '560px' }
const header = { textAlign: 'center' as const, padding: '8px 0 24px' }
const h1 = { color: '#14405C', fontSize: '22px', fontWeight: 700, margin: 0 }
const tag = { color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '24px',
  backgroundColor: '#fafafa',
}
const h2 = { color: '#14405C', fontSize: '18px', margin: '0 0 12px' }
const p = { color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '0 0 12px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const meta = { color: '#4b5563', fontSize: '13px', lineHeight: '20px', margin: 0 }
const footer = {
  color: '#9ca3af',
  fontSize: '11px',
  textAlign: 'center' as const,
  marginTop: '20px',
}
