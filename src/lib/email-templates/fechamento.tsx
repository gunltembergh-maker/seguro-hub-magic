import React from 'react'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  BRL,
  FOOTER_ASSINATURA,
  LAVORO_COLORS as L,
  LOGO_BRANCA_URL,
  MESES_PT_LONGO,
  PCT,
  SITE_URL,
  nowBR,
  periodoRefLongo,
} from './_shared'

export interface FechamentoProps {
  ano: number
  mes: number
  quandoBR?: string
  mes_metricas?: {
    emitido: number
    caixa: number
    meta: number
    atingimento: number
  }
}

const emptyMes = { emitido: 0, caixa: 0, meta: 0, atingimento: 0 }

const FechamentoEmail = ({
  ano,
  mes,
  quandoBR,
  mes_metricas = emptyMes,
}: FechamentoProps) => {
  const mesLongo = MESES_PT_LONGO[mes - 1]
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Fechamento Lavoro Seguros — ${mesLongo} de ${ano}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_BRANCA_URL} width="180" alt="Lavoro Seguros" style={logo} />
            <Text style={tag}>NEWSLETTER · FECHAMENTO</Text>
            <Heading as="h1" style={h1}>
              {mesLongo}/{ano}
            </Heading>
          </Section>

          <Section style={block}>
            <Text style={sectionTitle}>Fechamento de {mesLongo}/{ano}</Text>
            <Row>
              <Column style={colHalf}>
                <Kpi label="EMITIDO NO MÊS" value={BRL(mes_metricas.emitido)} accent={L.navy} />
              </Column>
              <Column style={colHalf}>
                <Kpi label="CAIXA RECEBIDO NO MÊS" value={BRL(mes_metricas.caixa)} accent={L.green} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Kpi label="META DO MÊS" value={BRL(mes_metricas.meta)} accent={L.blueLight} />
              </Column>
              <Column style={colHalf}>
                <Kpi
                  label="ATINGIMENTO"
                  value={PCT(mes_metricas.atingimento)}
                  accent={Number(mes_metricas.atingimento) >= 1 ? L.green : L.amber}
                />
              </Column>
            </Row>
          </Section>

          <Section style={ctaWrap}>
            <Button style={cta} href={`${SITE_URL}/dashboard/report-fechamento`}>
              Ver Report de Fechamento no Hub →
            </Button>
          </Section>

          <Hr style={hr} />
          <Section style={footerWrap}>
            <Text style={footerAssinatura}>{FOOTER_ASSINATURA.time}</Text>
            <Text style={footerEmpresa}>{FOOTER_ASSINATURA.empresa}</Text>
            <Text style={footerMeta}>Enviado em {quandoBR || nowBR()}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ ...kpiCard, borderLeft: `4px solid ${accent}` }}>
      <Text style={kpiLabel}>{label}</Text>
      <Text style={kpiValue}>{value}</Text>
    </div>
  )
}

export const template = {
  component: FechamentoEmail,
  subject: (data: Record<string, any>) => {
    const ano = data?.ano ?? new Date().getFullYear()
    const mes = data?.mes ?? new Date().getMonth() + 1
    return `Fechamento Lavoro Seguros - ${periodoRefLongo(ano, mes)}`
  },
  displayName: 'Fechamento — Newsletter Mensal',
  previewData: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    quandoBR: nowBR(),
    mes_metricas: {
      emitido: 1_240_000,
      caixa: 872_000,
      meta: 1_100_000,
      atingimento: 1.12,
    },
  },
} satisfies TemplateEntry

const tabular = { fontVariantNumeric: 'tabular-nums' as const }
const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Arial, sans-serif", margin: 0, padding: 0 }
const container = { margin: '0 auto', padding: '24px 16px', maxWidth: '620px' }
const header = { background: L.navy, padding: '28px 24px 22px', borderRadius: '10px 10px 0 0', textAlign: 'center' as const }
const logo = { display: 'block', margin: '0 auto 14px' }
const tag = { color: L.blueLight, fontSize: '11px', margin: '0 0 6px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, fontWeight: 700 }
const h1 = { color: '#FFFFFF', fontSize: '26px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }
const block = { background: L.card, padding: '18px 20px', borderLeft: `1px solid ${L.border}`, borderRight: `1px solid ${L.border}` }
const sectionTitle = { color: L.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 10px' }
const colHalf = { paddingRight: '6px', paddingLeft: '6px', paddingBottom: '10px', verticalAlign: 'top' as const, width: '50%' }
const kpiCard = { background: '#F8FAFC', borderRadius: '8px', padding: '14px 16px' }
const kpiLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0, lineHeight: 1.3 }
const kpiValue = { ...tabular, fontSize: '24px', fontWeight: 700, color: L.navyDark, margin: '6px 0 0', letterSpacing: '-0.3px' }
const ctaWrap = { background: L.card, padding: '20px', textAlign: 'center' as const, borderRadius: '0 0 10px 10px', border: `1px solid ${L.border}`, borderTop: 'none' }
const cta = { background: L.blue, color: L.navyDark, padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: 'transparent', margin: '16px 0 4px' }
const footerWrap = { textAlign: 'center' as const, padding: '4px 0 0' }
const footerAssinatura = { color: L.textDark, fontSize: '13px', fontWeight: 600, margin: 0 }
const footerEmpresa = { color: L.textMuted, fontSize: '12px', margin: '2px 0 8px' }
const footerMeta = { color: '#9CA3AF', fontSize: '11px', margin: 0 }
