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
  LAVORO_COLORS as L,
  LOGO_BRANCA_URL,
  MESES_PT,
  PCT,
  SITE_URL,
  nowBR,
} from './_shared'

export interface ReceitaDiariaProps {
  ano: number
  mes: number
  quandoBR?: string
  ytd: {
    receita_competencia: number
    receita_caixa: number
    meta_periodo: number
    atingimento: number
    defasagem: number
    previsto_caixa: number
    atingimento_caixa: number
  }
  mtd: {
    receita_competencia: number
    receita_caixa: number
    meta_periodo: number
    atingimento: number
    defasagem: number
    previsto_caixa: number
    atingimento_caixa: number
  }
  comissaoVencidaMes?: number
}

const empty = {
  receita_competencia: 0,
  receita_caixa: 0,
  meta_periodo: 0,
  atingimento: 0,
  defasagem: 0,
  previsto_caixa: 0,
  atingimento_caixa: 0,
}

const ReceitaDiariaEmail = ({
  ano,
  mes,
  quandoBR,
  ytd = empty,
  mtd = empty,
  comissaoVencidaMes = 0,
}: ReceitaDiariaProps) => {
  const mesLabel = `${MESES_PT[mes - 1]}/${ano}`
  const atMtd = Number(mtd?.atingimento ?? 0)
  const abaixo = atMtd < 1
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Receita — {mesLabel} · YTD {BRL(ytd?.receita_caixa)} caixa recebido</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_BRANCA_URL} width="140" alt="Lavoro Seguros" style={logo} />
            <Heading as="h1" style={h1}>
              Receita — {mesLabel}
            </Heading>
            <Text style={tag}>Newsletter diária · Hub Lavoro Seguros</Text>
          </Section>

          {/* YTD */}
          <Section style={block}>
            <Text style={sectionTitle}>
              Acumulado YTD {ano}
            </Text>
            <Row>
              <Column style={colHalf}>
                <Kpi label={`A RECEBER EM YTD ${ano}`} hint="Previsto caixa" value={BRL(ytd?.previsto_caixa)} accent={L.amber} />
              </Column>
              <Column style={colHalf}>
                <Kpi label={`RECEITA CAIXA EM YTD ${ano}`} hint="Recebido efetivamente" value={BRL(ytd?.receita_caixa)} accent={L.green} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Compact label="Receita Competência (YTD)" value={BRL(ytd?.receita_competencia)} />
              </Column>
              <Column style={colHalf}>
                <Compact label="Meta (YTD)" value={BRL(ytd?.meta_periodo)} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Compact label="Atingimento (Comp.)" value={PCT(ytd?.atingimento)} />
              </Column>
              <Column style={colHalf}>
                <Compact
                  label="Defasagem (Comp − Caixa)"
                  value={BRL(ytd?.defasagem)}
                  valueColor={Number(ytd?.defasagem ?? 0) < 0 ? L.red : L.green}
                />
              </Column>
            </Row>
          </Section>

          {/* MTD */}
          <Section style={block}>
            <Text style={sectionTitle}>No mês de {mesLabel}</Text>
            <Row>
              <Column style={colHalf}>
                <Kpi label={`A RECEBER EM ${MESES_PT[mes - 1].toUpperCase()}`} hint="Previsto caixa" value={BRL(mtd?.previsto_caixa)} accent={L.amber} />
              </Column>
              <Column style={colHalf}>
                <Kpi label={`RECEITA CAIXA EM ${MESES_PT[mes - 1].toUpperCase()}`} hint="Recebido efetivamente" value={BRL(mtd?.receita_caixa)} accent={L.green} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Compact label="Receita Competência" value={BRL(mtd?.receita_competencia)} />
              </Column>
              <Column style={colHalf}>
                <Compact label={`Meta (${MESES_PT[mes - 1]})`} value={BRL(mtd?.meta_periodo)} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Compact
                  label="Atingimento (Comp.)"
                  value={PCT(mtd?.atingimento)}
                  valueColor={abaixo ? L.red : L.green}
                />
              </Column>
              <Column style={colHalf}>
                <Compact
                  label="Defasagem"
                  value={BRL(mtd?.defasagem)}
                  valueColor={Number(mtd?.defasagem ?? 0) < 0 ? L.red : L.green}
                />
              </Column>
            </Row>
          </Section>

          {comissaoVencidaMes > 0 && (
            <Section style={alertBanner}>
              <Text style={alertText}>
                ⚠️ <strong>Comissão vencida no mês:</strong> {BRL(comissaoVencidaMes)}
              </Text>
            </Section>
          )}

          <Section style={ctaWrap}>
            <Button style={cta} href={`${SITE_URL}/dashboard/receita`}>
              Ver dashboard completo no Hub →
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Enviado em {quandoBR || nowBR()} · © {new Date().getFullYear()} Lavoro Seguros
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

function Kpi({ label, hint, value, accent }: { label: string; hint: string; value: string; accent: string }) {
  return (
    <div style={{ ...kpiCard, borderLeft: `4px solid ${accent}` }}>
      <Text style={kpiLabel}>{label}</Text>
      <Text style={{ ...kpiHint, color: accent }}>{hint}</Text>
      <Text style={kpiValue}>{value}</Text>
    </div>
  )
}

function Compact({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={compactCard}>
      <Text style={compactLabel}>{label}</Text>
      <Text style={{ ...compactValue, color: valueColor || L.textDark }}>{value}</Text>
    </div>
  )
}

export const template = {
  component: ReceitaDiariaEmail,
  subject: (data: Record<string, any>) => {
    const ano = data?.ano ?? new Date().getFullYear()
    const mes = data?.mes ?? new Date().getMonth() + 1
    return `Receita — ${MESES_PT[mes - 1]}/${ano} · Hub Lavoro`
  },
  displayName: 'Receita — Newsletter Diária',
  previewData: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    quandoBR: nowBR(),
    ytd: {
      receita_competencia: 4_280_000,
      receita_caixa: 3_910_000,
      meta_periodo: 4_500_000,
      atingimento: 0.95,
      defasagem: 370_000,
      previsto_caixa: 4_720_000,
      atingimento_caixa: 0.83,
    },
    mtd: {
      receita_competencia: 620_000,
      receita_caixa: 480_000,
      meta_periodo: 750_000,
      atingimento: 0.83,
      defasagem: 140_000,
      previsto_caixa: 690_000,
      atingimento_caixa: 0.7,
    },
    comissaoVencidaMes: 82_500,
  },
} satisfies TemplateEntry

// ─── Styles ────────────────────────────────────────────────────────────
const main = { backgroundColor: L.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", margin: 0, padding: 0 }
const container = { margin: '0 auto', padding: '24px 16px', maxWidth: '620px' }
const header = {
  background: L.navy,
  padding: '24px 24px 20px',
  borderRadius: '10px 10px 0 0',
  textAlign: 'center' as const,
}
const logo = { display: 'block', margin: '0 auto 12px' }
const h1 = { color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: '4px 0 2px', letterSpacing: '-0.3px' }
const tag = { color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0, letterSpacing: '0.5px', textTransform: 'uppercase' as const }
const block = { background: L.card, padding: '18px 20px', borderLeft: `1px solid ${L.border}`, borderRight: `1px solid ${L.border}` }
const sectionTitle = { color: L.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 10px' }
const colHalf = { paddingRight: '6px', paddingLeft: '6px', paddingBottom: '10px', verticalAlign: 'top' as const, width: '50%' }
const kpiCard = { background: '#F8FAFC', borderRadius: '8px', padding: '12px 14px' }
const kpiLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0, lineHeight: 1.3 }
const kpiHint = { fontSize: '11px', margin: '2px 0 4px' }
const kpiValue = { fontSize: '22px', fontWeight: 700, color: L.navyDark, margin: 0, letterSpacing: '-0.3px' }
const compactCard = { background: '#F8FAFC', border: `1px solid ${L.border}`, borderRadius: '6px', padding: '10px 12px' }
const compactLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0 }
const compactValue = { fontSize: '17px', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.2px' }
const alertBanner = { background: '#FEF3C7', borderLeft: `4px solid ${L.amber}`, padding: '12px 16px', margin: '0', borderRight: `1px solid ${L.border}` }
const alertText = { color: '#7C2D12', fontSize: '13px', margin: 0, lineHeight: '20px' }
const ctaWrap = { background: L.card, padding: '20px', textAlign: 'center' as const, borderRadius: '0 0 10px 10px', border: `1px solid ${L.border}`, borderTop: 'none' }
const cta = { background: L.blue, color: L.navyDark, padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: 'transparent', margin: '16px 0 4px' }
const footer = { color: '#9CA3AF', fontSize: '11px', textAlign: 'center' as const, margin: 0 }
