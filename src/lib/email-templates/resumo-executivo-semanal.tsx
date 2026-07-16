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
import { BRL, LAVORO_COLORS as L, LOGO_BRANCA_URL, MESES_PT, PCT, SITE_URL, nowBR } from './_shared'

export interface ResumoExecutivoProps {
  ano: number
  mes: number
  semanaAno?: number
  quandoBR?: string
  ytd: {
    emitido: number
    caixa: number
    caixaCorrente: number
    aReceberFuturo: number
    pctCaixa: number
  }
  posicaoTotalVencida: number
  vencidosAnteriores: number
}

const emptyYtd = { emitido: 0, caixa: 0, caixaCorrente: 0, aReceberFuturo: 0, pctCaixa: 0 }

const ResumoExecutivoEmail = ({
  ano,
  mes,
  semanaAno,
  quandoBR,
  ytd = emptyYtd,
  posicaoTotalVencida = 0,
  vencidosAnteriores = 0,
}: ResumoExecutivoProps) => {
  const mesLabel = `${MESES_PT[mes - 1]}/${ano}`
  const semanaLabel = semanaAno ? `Semana ${semanaAno}` : mesLabel
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        Resumo Executivo — {semanaLabel} · Caixa YTD {BRL(ytd?.caixa)}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_BRANCA_URL} width="140" alt="Lavoro Seguros" style={logo} />
            <Heading as="h1" style={h1}>
              Resumo Executivo — {mesLabel}
            </Heading>
            <Text style={tag}>Newsletter semanal · {semanaLabel}</Text>
          </Section>

          <Section style={block}>
            <Text style={sectionTitle}>Acumulado YTD {ano}</Text>
            <Row>
              <Column style={colHalf}>
                <Kpi label="EMITIDO YTD" value={BRL(ytd?.emitido)} accent={L.navy} />
              </Column>
              <Column style={colHalf}>
                <Kpi label="CAIXA RECEBIDO YTD" value={BRL(ytd?.caixa)} accent={L.green} hint={PCT(ytd?.pctCaixa)} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Kpi label="A RECEBER FUTURO" value={BRL(ytd?.aReceberFuturo)} accent={L.amber} />
              </Column>
              <Column style={colHalf}>
                <Kpi label="CAIXA CORRENTE (PAGO)" value={BRL(ytd?.caixaCorrente)} accent={L.blue} />
              </Column>
            </Row>
          </Section>

          {posicaoTotalVencida > 0 && (
            <Section style={alertBanner}>
              <Text style={alertTitle}>⚠️ Comissão Vencida</Text>
              <Text style={alertBig}>{BRL(posicaoTotalVencida)}</Text>
              {vencidosAnteriores > 0 && (
                <Text style={alertSmall}>
                  Sendo <strong>{BRL(vencidosAnteriores)}</strong> em vencidos anteriores a {ano}
                </Text>
              )}
            </Section>
          )}

          <Section style={ctaWrap}>
            <Text style={ctaHint}>
              Ver detalhamento mensal, ramos e canais completos no Hub:
            </Text>
            <Button style={cta} href={`${SITE_URL}/dashboard/receita-executivo`}>
              Ver Dashboard Executivo →
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

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div style={{ ...kpiCard, borderLeft: `4px solid ${accent}` }}>
      <Text style={kpiLabel}>{label}</Text>
      <Text style={kpiValue}>{value}</Text>
      {hint && <Text style={{ ...kpiHint, color: accent }}>{hint}</Text>}
    </div>
  )
}

export const template = {
  component: ResumoExecutivoEmail,
  subject: (data: Record<string, any>) => {
    const ano = data?.ano ?? new Date().getFullYear()
    const mes = data?.mes ?? new Date().getMonth() + 1
    return `Resumo Executivo — ${MESES_PT[mes - 1]}/${ano} · Hub Lavoro`
  },
  displayName: 'Resumo Executivo — Newsletter Semanal',
  previewData: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    semanaAno: 29,
    quandoBR: nowBR(),
    ytd: {
      emitido: 12_400_000,
      caixa: 8_720_000,
      caixaCorrente: 8_400_000,
      aReceberFuturo: 3_680_000,
      pctCaixa: 0.703,
    },
    posicaoTotalVencida: 320_000,
    vencidosAnteriores: 95_000,
  },
} satisfies TemplateEntry

// ─── Styles ────────────────────────────────────────────────────────────
const main = { backgroundColor: L.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", margin: 0, padding: 0 }
const container = { margin: '0 auto', padding: '24px 16px', maxWidth: '620px' }
const header = { background: L.navy, padding: '24px 24px 20px', borderRadius: '10px 10px 0 0', textAlign: 'center' as const }
const logo = { display: 'block', margin: '0 auto 12px' }
const h1 = { color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: '4px 0 2px', letterSpacing: '-0.3px' }
const tag = { color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0, letterSpacing: '0.5px', textTransform: 'uppercase' as const }
const block = { background: L.card, padding: '20px', borderLeft: `1px solid ${L.border}`, borderRight: `1px solid ${L.border}` }
const sectionTitle = { color: L.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px' }
const colHalf = { paddingRight: '6px', paddingLeft: '6px', paddingBottom: '10px', verticalAlign: 'top' as const, width: '50%' }
const kpiCard = { background: '#F8FAFC', borderRadius: '8px', padding: '14px 16px' }
const kpiLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0, lineHeight: 1.3 }
const kpiValue = { fontSize: '24px', fontWeight: 700, color: L.navyDark, margin: '6px 0 0', letterSpacing: '-0.3px' }
const kpiHint = { fontSize: '11px', margin: '2px 0 0', fontWeight: 600 }
const alertBanner = { background: '#FEF3C7', borderLeft: `4px solid ${L.amber}`, padding: '16px 20px', borderRight: `1px solid ${L.border}` }
const alertTitle = { color: '#7C2D12', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0 }
const alertBig = { color: '#7C2D12', fontSize: '26px', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.3px' }
const alertSmall = { color: '#92400E', fontSize: '12px', margin: '6px 0 0' }
const ctaWrap = { background: L.card, padding: '20px', textAlign: 'center' as const, borderRadius: '0 0 10px 10px', border: `1px solid ${L.border}`, borderTop: 'none' }
const ctaHint = { color: L.textMuted, fontSize: '12px', margin: '0 0 12px' }
const cta = { background: L.blue, color: L.navyDark, padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: 'transparent', margin: '16px 0 4px' }
const footer = { color: '#9CA3AF', fontSize: '11px', textAlign: 'center' as const, margin: 0 }
