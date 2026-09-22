import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text,
  divider, footer, footerStrong, LOGO_URL, NAVY, NAVY_DEEP, MUTED, BORDER, LIGHT_BG,
} from './_lavoro-shared'

export interface CanalParceiroVencimentoProps {
  parceiro: string
  cnpj: string
  vigenciaInicio: string
  vigenciaFim: string
  diasParaVencer: number
  arquivoNome: string
  repasseAcumulado: string
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

const avisoBox: React.CSSProperties = {
  backgroundColor: '#FEF3C7',
  border: '2px solid #D97706',
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '18px 0',
}

const dadosBox: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  backgroundColor: LIGHT_BG,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '18px 0 0',
}

export const CanalParceiroVencimentoEmail = ({
  parceiro = '—',
  cnpj = 'CNPJ não cadastrado',
  vigenciaInicio = '—',
  vigenciaFim = '—',
  diasParaVencer = 0,
  arquivoNome = '—',
  repasseAcumulado = 'R$ 0,00',
}: Partial<CanalParceiroVencimentoProps>) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Contrato de parceria com ${parceiro} vence em ${diasParaVencer} dias`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
        </Section>
        <Section style={accentBar}>&nbsp;</Section>
        <Section style={card}>
          <Text style={eyebrow}>Canal Parceiros</Text>
          <Heading as="h1" style={{ ...h1, margin: '0 0 12px' }}>
            Contrato de parceria a vencer
          </Heading>

          <Text style={{ fontSize: '13px', color: MUTED, margin: '0 0 16px', lineHeight: '20px' }}>
            Mensagem automática do Hub Lavoro. Não é necessário responder.
          </Text>

          <Text style={text}>
            O contrato de parceria com <strong>{parceiro}</strong> (CNPJ {cnpj}) vence em{' '}
            <strong>{vigenciaFim}</strong>, daqui a <strong>{diasParaVencer} dias</strong>.
          </Text>

          <Section style={dadosBox}>
            <Text style={label}>Vigência atual</Text>
            <Text style={valor}>{vigenciaInicio} a {vigenciaFim}</Text>
            <Text style={label}>Documento no Hub</Text>
            <Text style={valor}>{arquivoNome}</Text>
            <Text style={label}>Repasse acumulado com este parceiro</Text>
            <Text style={{ ...valor, margin: 0 }}>{repasseAcumulado}</Text>
          </Section>

          <Section style={avisoBox}>
            <Text style={{ fontSize: '14px', color: '#92400E', margin: 0, lineHeight: '21px' }}>
              Se não houver renovação ou aditivo anexado no Hub até o vencimento, a exportação de
              repasse deste parceiro será travada automaticamente.
            </Text>
          </Section>

          <Section style={divider}>&nbsp;</Section>

          <Text style={{ fontSize: '14px', color: NAVY, margin: 0, lineHeight: '21px' }}>
            Alessandro Oliveira, Equipe de Dados &amp; AI
          </Text>
        </Section>
        <Section style={{ ...divider, margin: 0, borderTop: `1px solid ${BORDER}` }}>&nbsp;</Section>
        <Section style={footer}>
          <Text style={{ margin: 0 }}>
            <span style={footerStrong}>Hub Lavoro Seguros</span> · alerta automático de vigência do Canal Parceiros
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CanalParceiroVencimentoEmail,
  subject: (d: Record<string, any>) =>
    `Alerta: contrato de parceria vence em ${d?.diasParaVencer ?? 0} dias, ${d?.parceiro ?? '—'}`,
  displayName: 'Canal Parceiros · Vencimento de contrato',
  previewData: {
    parceiro: 'PARCEIRO EXEMPLO CORRETORA',
    cnpj: '12.345.678/0001-90',
    vigenciaInicio: '01/11/2025',
    vigenciaFim: '31/10/2026',
    diasParaVencer: 60,
    arquivoNome: 'Contrato_Parceria_Exemplo.pdf',
    repasseAcumulado: 'R$ 184.320,55',
  },
}
