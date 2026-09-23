import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text, button, buttonWrap,
  divider, footer, footerStrong, LOGO_URL, NAVY, NAVY_DEEP, MUTED, BORDER, LIGHT_BG,
} from './_lavoro-shared'

export interface CanalParceiroVencimentoProps {
  parceiro: string
  razaoSocial: string
  cnpj: string
  vigenciaInicio: string
  vigenciaFim: string
  diasParaVencer: number
  arquivoNome: string
  repasseAcumulado: string
  percentuais: string
  renovacaoAutomatica: boolean | null
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

const dadosBox: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  backgroundColor: LIGHT_BG,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '18px 0 0',
}

const notaBox: React.CSSProperties = {
  backgroundColor: '#FEF3C7',
  border: '2px solid #D97706',
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '18px 0',
}

const HUB_CONTRATOS = 'https://hub.lavoroseguros.com.br/juridico/contrato-parceria'

function textoRenovacao(renovacao: boolean | null, parceiro: string, vigenciaFim: string) {
  if (renovacao === false) {
    return {
      paragrafo: (
        <>
          O contrato de <strong>{parceiro}</strong> vence em <strong>{vigenciaFim}</strong> e o
          documento não prevê renovação automática. Sem um contrato novo assinado, o repasse deste
          parceiro trava no vencimento.
        </>
      ),
      nota: 'Para renovar, envie o contrato novo em Jurídico > Contrato de Parceria. Se a parceria foi encerrada, suspenda o contrato por lá.',
    }
  }
  if (renovacao === true) {
    return {
      paragrafo: (
        <>
          O contrato de <strong>{parceiro}</strong> vence em <strong>{vigenciaFim}</strong>. O
          documento prevê renovação por igual período, então basta confirmar a renovação no Hub
          para a vigência seguir sem travar o repasse.
        </>
      ),
      nota: 'Confirme em Jurídico > Contrato de Parceria, no botão Renovar.',
    }
  }
  return {
    paragrafo: (
      <>
        O contrato de <strong>{parceiro}</strong> vence em <strong>{vigenciaFim}</strong>. Não
        consegui identificar no documento se existe cláusula de renovação automática.
      </>
    ),
    nota: 'Abra o contrato em Jurídico > Contrato de Parceria e confira a cláusula antes do vencimento.',
  }
}

export const CanalParceiroVencimentoEmail = ({
  parceiro = '—',
  razaoSocial = '—',
  cnpj = 'CNPJ não cadastrado',
  vigenciaInicio = '—',
  vigenciaFim = '—',
  diasParaVencer = 0,
  arquivoNome = '—',
  repasseAcumulado = 'R$ 0,00',
  percentuais = '—',
  renovacaoAutomatica = null,
}: Partial<CanalParceiroVencimentoProps>) => {
  const caso = textoRenovacao(renovacaoAutomatica ?? null, parceiro, vigenciaFim)
  return (
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

            <Text style={text}>{caso.paragrafo}</Text>

            <Section style={dadosBox}>
              <Text style={label}>Parceiro</Text>
              <Text style={valor}>{parceiro} ({cnpj})</Text>
              <Text style={label}>Razão social</Text>
              <Text style={valor}>{razaoSocial}</Text>
              <Text style={label}>Vigência atual</Text>
              <Text style={valor}>{vigenciaInicio} a {vigenciaFim} · vence em {diasParaVencer} dias</Text>
              <Text style={label}>Percentuais de repasse</Text>
              <Text style={valor}>{percentuais}</Text>
              <Text style={label}>Documento no Hub</Text>
              <Text style={valor}>{arquivoNome}</Text>
              <Text style={label}>Repasse acumulado com este parceiro</Text>
              <Text style={{ ...valor, margin: 0 }}>{repasseAcumulado}</Text>
            </Section>

            <Section style={buttonWrap}>
              <Button style={button} href={HUB_CONTRATOS}>
                Ver contrato
              </Button>
            </Section>

            <Section style={notaBox}>
              <Text style={{ fontSize: '14px', color: '#92400E', margin: 0, lineHeight: '21px' }}>
                {caso.nota}
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
}

export const template = {
  component: CanalParceiroVencimentoEmail,
  subject: (d: Record<string, any>) => {
    const parceiro = d?.parceiro ?? '—'
    const dias = d?.diasParaVencer ?? 0
    if (d?.renovacaoAutomatica === false) {
      return `Contrato de ${parceiro} vence em ${dias} dias e não tem renovação automática`
    }
    if (d?.renovacaoAutomatica === true) {
      return `Contrato de ${parceiro} vence em ${dias} dias, com renovação automática`
    }
    return `Contrato de ${parceiro} vence em ${dias} dias`
  },
  displayName: 'Canal Parceiros · Vencimento de contrato',
  previewData: {
    parceiro: 'PARCEIRO EXEMPLO CORRETORA',
    razaoSocial: 'Parceiro Exemplo Corretora de Seguros Ltda',
    cnpj: '12.345.678/0001-90',
    vigenciaInicio: '01/11/2025',
    vigenciaFim: '31/10/2026',
    diasParaVencer: 60,
    arquivoNome: 'Contrato_Parceria_Exemplo.pdf',
    repasseAcumulado: 'R$ 184.320,55',
    percentuais: 'Benefícios 30% · Garantia 30% · Demais 30%',
    renovacaoAutomatica: false,
  },
}
