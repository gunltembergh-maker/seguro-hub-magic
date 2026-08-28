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
import { EscopoNote } from './_escopo'
import { filtrarBreakdown } from '@/lib/receita-escopo'
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

export interface ReceitaLavoroProps {
  ano: number
  mes: number
  quandoBR?: string
  mtd: {
    receita_competencia: number
    receita_caixa: number
    meta_periodo: number
    atingimento: number
    defasagem: number
    previsto_caixa: number
    atingimento_caixa: number
    previsto_garantia?: number
    previsto_beneficios?: number
    previsto_demais?: number
    caixa_garantia?: number
    caixa_beneficios?: number
    caixa_demais?: number
    competencia_garantia?: number
    competencia_beneficios?: number
    competencia_demais?: number
  }
  comissaoVencidaMes?: number
  escopoTimes?: string[]
  /** Abertura de Benefícios por tipo de pagamento (competência) — só no e-mail */
  beneficiosTipoPagamento?: Array<{ tipo_pagamento: string; competencia: number }>
}

const empty = {
  receita_competencia: 0,
  receita_caixa: 0,
  meta_periodo: 0,
  atingimento: 0,
  defasagem: 0,
  previsto_caixa: 0,
  atingimento_caixa: 0,
  previsto_garantia: 0,
  previsto_beneficios: 0,
  previsto_demais: 0,
  caixa_garantia: 0,
  caixa_beneficios: 0,
  caixa_demais: 0,
  competencia_garantia: 0,
  competencia_beneficios: 0,
  competencia_demais: 0,
}

const ReceitaLavoroEmail = ({
  ano,
  mes,
  quandoBR,
  mtd = empty,
  comissaoVencidaMes = 0,
  escopoTimes,
  beneficiosTipoPagamento = [],
}: ReceitaLavoroProps) => {
  const mesLongo = MESES_PT_LONGO[mes - 1]
  const mesUp = mesLongo.toUpperCase()
  const atMtd = Number(mtd?.atingimento ?? 0)
  const abaixo = atMtd < 1
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Receita Lavoro Seguros — ${mesLongo} de ${ano}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_BRANCA_URL} width="180" alt="Lavoro Seguros" style={logo} />
            <Text style={tag}>NEWSLETTER · RECEITA</Text>
            <Heading as="h1" style={h1}>
              {mesLongo}/{ano}
            </Heading>
          </Section>

          <EscopoNote times={escopoTimes} />

          <Section style={block}>
            <Text style={sectionTitle}>Resultados de {mesLongo}/{ano}</Text>
            <Row>
              <Column style={colHalf}>
                <Kpi
                  label={`A RECEBER EM ${mesUp}`}
                  hint="Previsto caixa"
                  value={BRL(mtd?.previsto_caixa)}
                  accent={L.amber}
                  breakdown={filtrarBreakdown([
                    { label: 'Garantia', value: BRL(mtd?.previsto_garantia) },
                    { label: 'Benefícios', value: BRL(mtd?.previsto_beneficios) },
                    { label: 'Demais Ramos', value: BRL(mtd?.previsto_demais) },
                  ], escopoTimes)}
                />
              </Column>
              <Column style={colHalf}>
                <Kpi
                  label={`RECEITA CAIXA EM ${mesUp}`}
                  hint="Recebido efetivamente"
                  value={BRL(mtd?.receita_caixa)}
                  accent={L.green}
                  breakdown={filtrarBreakdown([
                    { label: 'Garantia', value: BRL(mtd?.caixa_garantia) },
                    { label: 'Benefícios', value: BRL(mtd?.caixa_beneficios) },
                    { label: 'Demais Ramos', value: BRL(mtd?.caixa_demais) },
                  ], escopoTimes)}
                />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Compact
                  label="Receita Competência"
                  value={BRL(mtd?.receita_competencia)}
                  breakdown={filtrarBreakdown([
                    { label: 'Garantia', value: BRL(mtd?.competencia_garantia) },
                    { label: 'Benefícios', value: BRL(mtd?.competencia_beneficios) },
                    { label: 'Demais Ramos', value: BRL(mtd?.competencia_demais) },
                  ], escopoTimes)}
                />
              </Column>
              <Column style={colHalf}>
                <Compact label={`Meta (${mesLongo})`} value={BRL(mtd?.meta_periodo)} />
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

          {beneficiosTipoPagamento.length > 0 && (
            <Section style={block}>
              <Text style={sectionTitle}>
                Benefícios por tipo de pagamento ({mesLongo}/{ano})
              </Text>
              <table style={tpTable} cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={tpHead}>Tipo de pagamento</td>
                    <td style={{ ...tpHead, textAlign: 'right' as const }}>Emitido</td>
                    <td style={{ ...tpHead, textAlign: 'right' as const }}>Caixa previsto</td>
                    <td style={{ ...tpHead, textAlign: 'right' as const }}>Caixa recebido</td>
                  </tr>
                  {beneficiosTipoPagamento.map((r) => (
                    <tr key={r.tipo_pagamento}>
                      <td style={tpLabel}>{r.tipo_pagamento}</td>
                      <td style={tpValue}>{BRL(r.competencia)}</td>
                      <td style={tpValue}>{BRL(r.previsto)}</td>
                      <td style={tpValue}>{BRL(r.recebido)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...tpLabel, ...tpTotal }}>Total Benefícios</td>
                    <td style={{ ...tpValue, ...tpTotal }}>
                      {BRL(beneficiosTipoPagamento.reduce((a, r) => a + Number(r.competencia || 0), 0))}
                    </td>
                    <td style={{ ...tpValue, ...tpTotal }}>
                      {BRL(beneficiosTipoPagamento.reduce((a, r) => a + Number(r.previsto || 0), 0))}
                    </td>
                    <td style={{ ...tpValue, ...tpTotal }}>
                      {BRL(beneficiosTipoPagamento.reduce((a, r) => a + Number(r.recebido || 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

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

function Kpi({ label, hint, value, accent, breakdown }: {
  label: string; hint: string; value: string; accent: string
  breakdown?: Array<{ label: string; value: string }>
}) {
  return (
    <div style={{ ...kpiCard, borderLeft: `4px solid ${accent}` }}>
      <Text style={kpiLabel}>{label}</Text>
      <Text style={{ ...kpiHint, color: accent }}>{hint}</Text>
      <Text style={kpiValue}>{value}</Text>
      {breakdown && (
        <table style={breakdownTable} cellPadding={0} cellSpacing={0}>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.label}>
                <td style={breakdownLabel}>{b.label}</td>
                <td style={breakdownValue}>{b.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Compact({ label, value, valueColor, breakdown }: {
  label: string; value: string; valueColor?: string
  breakdown?: Array<{ label: string; value: string }>
}) {
  return (
    <div style={compactCard}>
      <Text style={compactLabel}>{label}</Text>
      <Text style={{ ...compactValue, color: valueColor || L.textDark }}>{value}</Text>
      {breakdown && breakdown.length > 0 && (
        <table style={breakdownTable} cellPadding={0} cellSpacing={0}>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.label}>
                <td style={breakdownLabel}>{b.label}</td>
                <td style={breakdownValue}>{b.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export const template = {
  component: ReceitaLavoroEmail,
  subject: (data: Record<string, any>) => {
    const ano = data?.ano ?? new Date().getFullYear()
    const mes = data?.mes ?? new Date().getMonth() + 1
    return `Receita Lavoro Seguros - ${periodoRefLongo(ano, mes)}`
  },
  displayName: 'Receita — Newsletter Mensal',
  previewData: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    quandoBR: nowBR(),
    mtd: {
      receita_competencia: 620_000,
      receita_caixa: 480_000,
      meta_periodo: 750_000,
      atingimento: 0.83,
      defasagem: 140_000,
      previsto_caixa: 690_000,
      atingimento_caixa: 0.7,
      previsto_garantia: 350_000,
      previsto_beneficios: 280_000,
      previsto_demais: 60_000,
      caixa_garantia: 240_000,
      caixa_beneficios: 200_000,
      caixa_demais: 40_000,
      competencia_garantia: 300_000,
      competencia_beneficios: 260_000,
      competencia_demais: 60_000,
    },
    comissaoVencidaMes: 82_500,
  },
} satisfies TemplateEntry

const breakdownTable = { width: '100%', marginTop: '8px', borderTop: `1px solid ${L.border}`, paddingTop: '6px' }
const breakdownLabel = { fontVariantNumeric: 'tabular-nums' as const, color: L.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '2px 0' }
const breakdownValue = { fontVariantNumeric: 'tabular-nums' as const, color: L.navyDark, fontSize: '12px', fontWeight: 600, textAlign: 'right' as const, padding: '2px 0' }

// ─── Styles ────────────────────────────────────────────────────────────
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
const kpiCard = { background: '#F8FAFC', borderRadius: '8px', padding: '12px 14px' }
const kpiLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0, lineHeight: 1.3 }
const kpiHint = { fontSize: '11px', margin: '2px 0 4px' }
const kpiValue = { ...tabular, fontSize: '22px', fontWeight: 700, color: L.navyDark, margin: 0, letterSpacing: '-0.3px' }
const compactCard = { background: '#F8FAFC', border: `1px solid ${L.border}`, borderRadius: '6px', padding: '10px 12px' }
const compactLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0 }
const compactValue = { ...tabular, fontSize: '17px', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.2px' }
const alertBanner = { background: '#FEF3C7', borderLeft: `4px solid ${L.amber}`, padding: '12px 16px', margin: '0', borderRight: `1px solid ${L.border}` }
const alertText = { color: '#7C2D12', fontSize: '13px', margin: 0, lineHeight: '20px' }
const ctaWrap = { background: L.card, padding: '20px', textAlign: 'center' as const, borderRadius: '0 0 10px 10px', border: `1px solid ${L.border}`, borderTop: 'none' }
const cta = { background: L.blue, color: L.navyDark, padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: 'transparent', margin: '16px 0 4px' }
const footerWrap = { textAlign: 'center' as const, padding: '4px 0 0' }
const footerAssinatura = { color: L.textDark, fontSize: '13px', fontWeight: 600, margin: 0 }
const footerEmpresa = { color: L.textMuted, fontSize: '12px', margin: '2px 0 8px' }
const footerMeta = { color: '#9CA3AF', fontSize: '11px', margin: 0 }
