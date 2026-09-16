import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text,
  divider, footer, footerStrong, LOGO_URL, NAVY, NAVY_DEEP, CYAN, MUTED, BORDER, LIGHT_BG,
} from './_lavoro-shared'

export interface CapacidadeResumo {
  seguradora: string
  capacidade: string
}

export interface AnexoLink {
  nome: string
  url?: string
}

export interface SolicitanteInfo {
  empresa: string
  nome: string
  email: string
  telefone: string
}

export interface NovaDemandaProps {
  /** Quem preencheu o formulário; campos faltantes viram "não informado". */
  solicitante: SolicitanteInfo
  tomador: string
  cnpj: string
  protocolo: string
  numeroProcesso: string
  natureza: string
  importanciaSegurada: string
  advogado: string
  /** Data/hora limite já formatada em horário de Brasília. */
  prazoLimite: string
  comLimite: number
  semLimite: number
  naoConsultado: number
  /** Só as maiores capacidades — o detalhamento fica na planilha. */
  topCapacidades: CapacidadeResumo[]
  /** Caso A: houve resposta do mercado, mas ninguém liberou capacidade. */
  nenhumComLimite: boolean
  /** Caso B: nenhuma seguradora respondeu (todas em falha técnica). */
  nenhumaResposta: boolean
  anexos: AnexoLink[]
  anexosComoLink: boolean
}

const label: React.CSSProperties = {
  fontSize: '11px',
  color: MUTED,
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  margin: '0 0 2px',
  fontWeight: 700,
}

const valor: React.CSSProperties = {
  fontSize: '14px',
  color: NAVY_DEEP,
  margin: '0 0 12px',
  fontWeight: 600,
}

const prazoBox: React.CSSProperties = {
  border: `2px solid ${CYAN}`,
  backgroundColor: LIGHT_BG,
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '22px 0',
}

const alertaBox = (fundo: string, borda: string): React.CSSProperties => ({
  backgroundColor: fundo,
  border: `2px solid ${borda}`,
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '18px 0',
})

const NAO_INFORMADO = 'não informado'

const solicitanteBox: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  backgroundColor: LIGHT_BG,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 22px',
}

const preencher = (v?: string) => (v && v.trim() ? v.trim() : NAO_INFORMADO)
const somenteDigitos = (v?: string) => (v ?? '').replace(/\D/g, '')

export const GarantiaJudicialNovaDemandaEmail = ({
  solicitante = { empresa: '', nome: '', email: '', telefone: '' },
  tomador = '—', cnpj = '—', protocolo = '—', numeroProcesso = '—', natureza = '—',
  importanciaSegurada = '—', advogado = '—', prazoLimite = '—',
  comLimite = 0, semLimite = 0, naoConsultado = 0,
  topCapacidades = [], nenhumComLimite = false, nenhumaResposta = false,
  anexos = [], anexosComoLink = false,
}: Partial<NovaDemandaProps>) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Nova demanda de Garantia Judicial · ${tomador} · tratar em até 48 horas`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
        </Section>
        <Section style={accentBar}>&nbsp;</Section>
        <Section style={card}>
          <Text style={eyebrow}>Nova demanda</Text>
          <Heading as="h1" style={{ ...h1, margin: '0 0 12px' }}>Garantia Judicial</Heading>
          <Text style={text}>
            Uma nova solicitação chegou pelo formulário de Garantia e já foi processada automaticamente.
          </Text>

          <Section style={prazoBox}>
            <Text style={{ ...label, color: NAVY, margin: '0 0 6px' }}>Prazo de atendimento</Text>
            <Text style={{ fontSize: '20px', fontWeight: 700, color: NAVY_DEEP, margin: '0 0 6px', lineHeight: '28px' }}>
              Tratar em até 48 horas — até {prazoLimite}
            </Text>
            <Text style={{ fontSize: '13px', color: NAVY, margin: 0, lineHeight: '20px' }}>
              Esse prazo foi informado ao cliente ao finalizar o preenchimento do formulário.
            </Text>
          </Section>

          <Section style={solicitanteBox}>
            <Text style={{ ...eyebrow, color: NAVY, margin: '0 0 10px' }}>Solicitante</Text>
            <Text style={label}>Empresa</Text>
            <Text style={valor}>{preencher(solicitante?.empresa)}</Text>
            <Text style={label}>Nome</Text>
            <Text style={valor}>{preencher(solicitante?.nome)}</Text>
            <Text style={label}>E-mail</Text>
            <Text style={valor}>
              {solicitante?.email && solicitante.email.trim() ? (
                <Link href={`mailto:${solicitante.email.trim()}`} style={{ color: NAVY, textDecoration: 'underline' }}>
                  {solicitante.email.trim()}
                </Link>
              ) : (
                NAO_INFORMADO
              )}
            </Text>
            <Text style={label}>Telefone</Text>
            <Text style={{ ...valor, margin: 0 }}>
              {somenteDigitos(solicitante?.telefone) ? (
                <Link
                  href={`tel:${somenteDigitos(solicitante?.telefone)}`}
                  style={{ color: NAVY, textDecoration: 'underline' }}
                >
                  {solicitante!.telefone!.trim()}
                </Link>
              ) : (
                NAO_INFORMADO
              )}
            </Text>
          </Section>

          <Section style={{ margin: '4px 0 0' }}>
            <Text style={label}>Tomador</Text>
            <Text style={valor}>{tomador}</Text>
            <Text style={label}>CNPJ</Text>
            <Text style={valor}>{cnpj}</Text>
            <Text style={label}>Protocolo</Text>
            <Text style={valor}>{protocolo}</Text>
            <Text style={label}>Nº do processo</Text>
            <Text style={valor}>{numeroProcesso}</Text>
            <Text style={label}>Natureza</Text>
            <Text style={valor}>{natureza}</Text>
            <Text style={label}>Importância segurada</Text>
            <Text style={valor}>{importanciaSegurada}</Text>
            <Text style={label}>Advogado</Text>
            <Text style={valor}>{advogado}</Text>
          </Section>

          <Section style={divider}>&nbsp;</Section>

          <Text style={{ ...eyebrow, color: NAVY }}>Consulta de mercado</Text>
          <Text style={text}>
            <strong>{comLimite}</strong> com limite · <strong>{semLimite}</strong> sem limite ·{' '}
            <strong>{naoConsultado}</strong> não consultada(s).
          </Text>

          {nenhumaResposta ? (
            <Section style={alertaBox('#EDE9FE', '#7C3AED')}>
              <Text style={{ fontSize: '16px', fontWeight: 700, color: '#5B21B6', margin: '0 0 6px' }}>
                Não foi possível consultar o mercado automaticamente
              </Text>
              <Text style={{ fontSize: '14px', color: '#4C1D95', margin: 0, lineHeight: '21px' }}>
                Nenhuma seguradora respondeu à consulta. O resultado é <strong>desconhecido</strong>,
                não negativo: nenhuma recusa foi registrada. É necessário consultar o mercado manualmente.
              </Text>
            </Section>
          ) : nenhumComLimite ? (
            <Section style={alertaBox('#FEE2E2', '#DC2626')}>
              <Text style={{ fontSize: '16px', fontWeight: 700, color: '#991B1B', margin: '0 0 6px' }}>
                Nenhuma seguradora liberou capacidade para este tomador
              </Text>
              <Text style={{ fontSize: '14px', color: '#7F1D1D', margin: 0, lineHeight: '21px' }}>
                As seguradoras responderam à consulta e nenhuma delas apresentou limite disponível.
                Não se trata de falha do sistema.
              </Text>
            </Section>
          ) : (
            <>
              <Text style={{ ...text, margin: '0 0 8px' }}>Maiores capacidades:</Text>
              {topCapacidades.map((c) => (
                <Text
                  key={c.seguradora}
                  style={{ fontSize: '14px', color: NAVY_DEEP, margin: '0 0 6px', lineHeight: '20px' }}
                >
                  <strong>{c.seguradora}</strong> · {c.capacidade}
                </Text>
              ))}
              <Text style={{ fontSize: '13px', color: MUTED, margin: '10px 0 0', lineHeight: '20px' }}>
                O detalhamento completo, com todas as seguradoras, modalidades e taxas, está na planilha.
              </Text>
            </>
          )}

          <Text style={{ fontSize: '13px', color: MUTED, margin: '14px 0 0', lineHeight: '20px' }}>
            "Não consultada" significa falha técnica na consulta automática àquela seguradora,
            e não recusa da seguradora.
          </Text>

          <Section style={divider}>&nbsp;</Section>

          <Text style={{ ...eyebrow, color: NAVY }}>
            {anexosComoLink ? 'Documentos' : 'Anexos'}
          </Text>
          {anexos.map((a) => (
            <Text key={a.nome} style={{ fontSize: '14px', color: NAVY_DEEP, margin: '0 0 6px' }}>
              {a.url ? (
                <Link href={a.url} style={{ color: NAVY, textDecoration: 'underline' }}>{a.nome}</Link>
              ) : (
                a.nome
              )}
            </Text>
          ))}
          <Text style={{ fontSize: '12px', color: MUTED, margin: '8px 0 0', lineHeight: '18px' }}>
            {anexosComoLink
              ? 'Os arquivos estão disponíveis pelos links acima por 7 dias.'
              : 'O formulário preenchido pelo cliente e a planilha da consulta de mercado seguem anexos.'}
          </Text>
        </Section>
        <Section style={{ ...divider, margin: 0, borderTop: `1px solid ${BORDER}` }}>&nbsp;</Section>
        <Section style={footer}>
          <Text style={{ margin: 0 }}>
            <span style={footerStrong}>Hub Lavoro Seguros</span> · mensagem automática do fluxo de Garantia Judicial
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GarantiaJudicialNovaDemandaEmail,
  subject: (d: Record<string, any>) =>
    `Nova Demanda · Garantia Judicial · ${d?.tomador ?? '—'} (${d?.cnpj ?? '—'})`,
  displayName: 'Garantia Judicial · Nova Demanda',
  previewData: {
    tomador: 'GRUPO HOSPITALAR DO RIO DE JANEIRO LTDA',
    cnpj: '31.925.548/0001-76',
    protocolo: 'LV-260915-1234',
    numeroProcesso: '0000000-00.0000.0.00.0001',
    natureza: 'Cível',
    importanciaSegurada: 'R$ 1.250.000,00',
    advogado: 'Maria Silva · OAB 123456/SP',
    prazoLimite: '17/09/2026 às 19:14 (horário de Brasília)',
    comLimite: 7,
    semLimite: 2,
    naoConsultado: 1,
    topCapacidades: [
      { seguradora: 'AXA', capacidade: 'R$ 10.000.000,00' },
      { seguradora: 'SOMBRERO', capacidade: 'R$ 10.000.000,00' },
      { seguradora: 'ESSOR', capacidade: 'R$ 5.000.000,00' },
    ],
    nenhumComLimite: false,
    nenhumaResposta: false,
    anexos: [
      { nome: 'Formulario_LV-260915-1234.pdf' },
      { nome: 'Consulta_Mercado_LV-260915-1234.xlsx' },
    ],
    anexosComoLink: false,
  },
}
