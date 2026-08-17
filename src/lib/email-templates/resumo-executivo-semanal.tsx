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
import { BRL, FOOTER_ASSINATURA, LAVORO_COLORS as L, LOGO_BRANCA_URL, MESES_PT_LONGO, PCT, SITE_URL, nowBR, periodoRefLongo } from './_shared'

export interface ResumoExecutivoProps {
  ano: number
  mes: number
  quandoBR?: string
  ytd: {
    emitido: number
    caixaEsperado: number
    caixaRecebido: number
    aReceberFuturo: number
    pctCaixa: number
  }
  canais?: Array<{
    canal: string
    caixa_corrente: number
    a_receber_futuro: number
  }> | null
  mesDetalhe?: {
    emitido: number
    caixa: number
    caixaCorrente: number
    saldoVencido: number
    aReceberFuturo: number
  } | null
}

const emptyYtd = { emitido: 0, caixaEsperado: 0, caixaRecebido: 0, aReceberFuturo: 0, pctCaixa: 0 }
const CANAIS_ORDEM = ['Garantia', 'Benefícios', 'Demais Ramos']

const quebra = (
  canais: ResumoExecutivoProps['canais'],
  campo: 'caixa_corrente' | 'a_receber_futuro',
  total: number,
) => {
  const linhas = canais ?? []
  if (!linhas.length) return undefined
  const valores = CANAIS_ORDEM.map((c) => Number(linhas.find((l) => l.canal === c)?.[campo] ?? 0))
  const soma = valores.reduce((a, b) => a + b, 0)
  const fator = soma > 0 ? Number(total || 0) / soma : 0
  return CANAIS_ORDEM.map((c, i) => ({ label: c, value: BRL(valores[i] * fator) }))
}

const ResumoExecutivoEmail = ({
  ano,
  mes,
  quandoBR,
  ytd = emptyYtd,
  canais = null,
  mesDetalhe = null,
}: ResumoExecutivoProps) => {
  const mesLongo = MESES_PT_LONGO[mes - 1]
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Report Executivo Lavoro Seguros — ${mesLongo} de ${ano}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header — somente logo + mês corrente */}
          <Section style={header}>
            <Img src={LOGO_BRANCA_URL} width="200" alt="Lavoro Seguros" style={logo} />
            <Heading as="h1" style={h1}>{`${mesLongo}/${ano}`}</Heading>
          </Section>

          {/* Subtítulo abaixo do header */}
          <Section style={subHeader}>
            <Text style={subHeaderText}>NEWSLETTER · REPORT EXECUTIVO</Text>
          </Section>

          {/* KPIs YTD */}
          <EscopoNote times={escopoTimes} />

          <Section style={block}>
            <Text style={sectionTitle}>{`Acumulado YTD ${ano}`}</Text>
            <Row>
              <Column style={colHalf}>
                <Kpi label={`EMITIDO YTD ${ano}`} value={BRL(ytd?.emitido)} accent={L.blueLight} />
              </Column>
              <Column style={colHalf}>
                <Kpi label={`CAIXA ESPERADO YTD ${ano}`} value={BRL(ytd?.caixaEsperado)} accent={L.navy} />
              </Column>
            </Row>
            <Row>
              <Column style={colHalf}>
                <Kpi
                  label={`CAIXA RECEBIDO YTD ${ano}`}
                  value={BRL(ytd?.caixaRecebido)}
                  accent={L.green}
                  hint={`${PCT(ytd?.pctCaixa)} do esperado`}
                  breakdown={quebra(canais, 'caixa_corrente', Number(ytd?.caixaRecebido ?? 0))}
                />
              </Column>
              <Column style={colHalf}>
                <Kpi
                  label={`A RECEBER FUTURO YTD ${ano}`}
                  value={BRL(ytd?.aReceberFuturo)}
                  accent={L.blue}
                  breakdown={quebra(canais, 'a_receber_futuro', Number(ytd?.aReceberFuturo ?? 0))}
                />
              </Column>
            </Row>
          </Section>

          {/* Detalhamento do mês atual */}
          {mesDetalhe && (
            <Section style={detalheBlock}>
              <Text style={sectionTitle}>{`Detalhamento — ${mesLongo}/${ano}`}</Text>
              <table style={detTable} cellPadding={0} cellSpacing={0}>
                <thead>
                  <tr>
                    <th style={thStyle}>Emitido</th>
                    <th style={thStyle}>Caixa</th>
                    <th style={thStyle}>Caixa Corrente</th>
                    <th style={thStyle}>Saldo Vencido</th>
                    <th style={thStyle}>A Receber Futuro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}>{BRL(mesDetalhe.emitido)}</td>
                    <td style={tdStyle}>{BRL(mesDetalhe.caixa)}</td>
                    <td style={{ ...tdStyle, color: L.green, fontWeight: 600 }}>{BRL(mesDetalhe.caixaCorrente)}</td>
                    <td style={{ ...tdStyle, color: L.amber, fontWeight: 600 }}>{BRL(mesDetalhe.saldoVencido)}</td>
                    <td style={tdStyle}>{BRL(mesDetalhe.aReceberFuturo)}</td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

          {/* CTA Hub */}
          <Section style={ctaWrap}>
            <Text style={ctaHint}>
              Ver detalhamento completo (mensal, ramos, canais e gráficos) no Hub:
            </Text>
            <Button style={cta} href={`${SITE_URL}/dashboard/receita-executivo`}>
              Acessar Hub Lavoro →
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

function Kpi({ label, value, hint, accent, breakdown }: {
  label: string; value: string; hint?: string; accent: string
  breakdown?: Array<{ label: string; value: string }>
}) {
  return (
    <div style={{ ...kpiCard, borderLeft: `4px solid ${accent}` }}>
      <Text style={kpiLabel}>{label}</Text>
      <Text style={kpiValue}>{value}</Text>
      {hint && <Text style={{ ...kpiHint, color: accent }}>{hint}</Text>}
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

const breakdownTable = { width: '100%', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '6px' }
const breakdownLabel = { fontVariantNumeric: 'tabular-nums' as const, color: '#64748B', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '2px 0' }
const breakdownValue = { fontVariantNumeric: 'tabular-nums' as const, color: '#0F2A3D', fontSize: '12px', fontWeight: 600, textAlign: 'right' as const, padding: '2px 0' }

export const template = {
  component: ResumoExecutivoEmail,
  subject: (data: Record<string, any>) => {
    const ano = data?.ano ?? new Date().getFullYear()
    const mes = data?.mes ?? new Date().getMonth() + 1
    return `Report Executivo Lavoro Seguros - ${periodoRefLongo(ano, mes)}`
  },
  displayName: 'Report Executivo — Newsletter',
  previewData: {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    quandoBR: nowBR(),
    ytd: {
      emitido: 12_400_000,
      caixaEsperado: 10_100_000,
      caixaRecebido: 8_720_000,
      aReceberFuturo: 3_680_000,
      pctCaixa: 0.863,
    },
    mesDetalhe: {
      emitido: 1_820_000,
      caixa: 1_540_000,
      caixaCorrente: 1_410_000,
      saldoVencido: 130_000,
      aReceberFuturo: 3_680_000,
    },
  },
} satisfies TemplateEntry

// ─── Styles ────────────────────────────────────────────────────────────
const tabular = { fontVariantNumeric: 'tabular-nums' as const }
const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Arial, sans-serif", margin: 0, padding: 0 }
const container = { margin: '0 auto', padding: '24px 16px', maxWidth: '640px' }
const header = { background: L.blueLight, padding: '32px 24px 26px', borderRadius: '10px 10px 0 0', textAlign: 'center' as const }
const logo = { display: 'block', margin: '0 auto 16px' }
const h1 = { color: L.navyDark, fontSize: '30px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }
const subHeader = { background: L.navy, padding: '10px 24px', textAlign: 'center' as const }
const subHeaderText = { color: '#FFFFFF', fontSize: '11px', margin: 0, letterSpacing: '0.16em', textTransform: 'uppercase' as const, fontWeight: 700 }
const block = { background: L.card, padding: '20px', borderLeft: `1px solid ${L.border}`, borderRight: `1px solid ${L.border}` }
const sectionTitle = { color: L.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px' }
const colHalf = { paddingRight: '6px', paddingLeft: '6px', paddingBottom: '10px', verticalAlign: 'top' as const, width: '50%' }
const kpiCard = { background: '#F8FAFC', borderRadius: '8px', padding: '14px 16px' }
const kpiLabel = { color: L.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0, lineHeight: 1.3 }
const kpiValue = { ...tabular, fontSize: '22px', fontWeight: 700, color: L.navyDark, margin: '6px 0 0', letterSpacing: '-0.3px' }
const kpiHint = { fontSize: '11px', margin: '2px 0 0', fontWeight: 600 }
const detalheBlock = { background: L.card, padding: '18px 20px', borderLeft: `1px solid ${L.border}`, borderRight: `1px solid ${L.border}`, borderTop: `1px solid ${L.border}` }
const detTable = { width: '100%', borderCollapse: 'collapse' as const, ...tabular }
const thStyle = { textAlign: 'center' as const, fontSize: '10px', fontWeight: 700, color: L.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '8px 6px', borderBottom: `1px solid ${L.border}` }
const tdStyle = { textAlign: 'center' as const, fontSize: '13px', color: L.navyDark, padding: '10px 6px', fontWeight: 500 }
const ctaWrap = { background: L.card, padding: '22px', textAlign: 'center' as const, borderRadius: '0 0 10px 10px', border: `1px solid ${L.border}`, borderTop: 'none' }
const ctaHint = { color: L.textMuted, fontSize: '12px', margin: '0 0 12px' }
const cta = { background: L.navy, color: '#FFFFFF', padding: '12px 26px', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: 'transparent', margin: '16px 0 4px' }
const footerWrap = { textAlign: 'center' as const, padding: '4px 0 0' }
const footerAssinatura = { color: L.textDark, fontSize: '13px', fontWeight: 600, margin: 0 }
const footerEmpresa = { color: L.textMuted, fontSize: '12px', margin: '2px 0 8px' }
const footerMeta = { color: '#9CA3AF', fontSize: '11px', margin: 0 }
