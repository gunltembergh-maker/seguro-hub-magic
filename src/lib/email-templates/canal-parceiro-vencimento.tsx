import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text, button, buttonWrap,
  divider, footer, footerStrong, LOGO_URL, NAVY_DEEP, MUTED, BORDER, LIGHT_BG,
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
  tipoAviso: string
  vencido: boolean
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
          documento prevê renovação automática por igual período, mas a renovação <strong>não
          acontece sozinha no Hub</strong>: o Jurídico precisa confirmar.
        </>
      ),
      nota: (
        <>
          Para renovar, o Jurídico deve entrar em Jurídico &gt; Contrato de Parceria e clicar em{' '}
          <strong>Renovação automática</strong> antes de {vigenciaFim}. Sem isso, o repasse deste
          parceiro trava no vencimento.
        </>
      ),
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

function textoDiario(
  vencido: boolean,
  parceiro: string,
  vigenciaFim: string,
  renovacao: boolean | null,
) {
  if (renovacao === true) {
    if (vencido) {
      return {
        paragrafo: (
          <>
            A vigência do contrato de <strong>{parceiro}</strong> terminou em{' '}
            <strong>{vigenciaFim}</strong>. O contrato tem cláusula de renovação automática, mas
            ela não foi confirmada no Hub, e o repasse está travado desde então. Este aviso se
            repete todo dia até o Jurídico confirmar.
          </>
        ),
        nota: (
          <>
            Jurídico: entre em Jurídico &gt; Contrato de Parceria e clique em{' '}
            <strong>Renovação automática</strong> para destravar o repasse.
          </>
        ),
      }
    }
    return {
      paragrafo: (
        <>
          O contrato de <strong>{parceiro}</strong> vence em <strong>{vigenciaFim}</strong> e tem
          cláusula de renovação automática, ainda não confirmada no Hub. Este lembrete é diário até
          o Jurídico confirmar.
        </>
      ),
      nota: (
        <>
          Jurídico: entre em Jurídico &gt; Contrato de Parceria e clique em{' '}
          <strong>Renovação automática</strong>.
        </>
      ),
    }
  }
  if (vencido) {
    return {
      paragrafo: (
        <>
          A vigência do contrato de <strong>{parceiro}</strong> terminou em{' '}
          <strong>{vigenciaFim}</strong> e o repasse deste parceiro está travado desde então. Este
          aviso se repete todo dia até entrar um contrato novo para o parceiro.
        </>
      ),
      nota: 'Envie o contrato novo em Jurídico > Contrato de Parceria. Se a parceria foi encerrada, suspenda o contrato por lá.',
    }
  }
  return {
    paragrafo: (
      <>
        O contrato de <strong>{parceiro}</strong> vence em <strong>{vigenciaFim}</strong>. Passando
        a data, o repasse trava automaticamente. A partir de agora este lembrete é diário até o
        contrato novo entrar no Hub.
      </>
    ),
    nota: 'Resolva em Jurídico > Contrato de Parceria antes do vencimento.',
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
  tipoAviso = 'VENCE_60',
  vencido = false,
}: Partial<CanalParceiroVencimentoProps>) => {
  const caso =
    tipoAviso === 'VENCE_DIARIO'
      ? textoDiario(vencido, parceiro, vigenciaFim, renovacaoAutomatica ?? null)
      : textoRenovacao(renovacaoAutomatica ?? null, parceiro, vigenciaFim)
  const n = Math.abs(diasParaVencer)
  const titulo = vencido ? 'Contrato de parceria vencido' : 'Contrato de parceria a vencer'
  const linhaVigencia = vencido
    ? `${vigenciaInicio} a ${vigenciaFim} · venceu há ${n} dias`
    : `${vigenciaInicio} a ${vigenciaFim} · vence em ${n} dias`
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Contrato de parceria com ${parceiro} vence em ${n} dias`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
          </Section>
          <Section style={accentBar}>&nbsp;</Section>
          <Section style={card}>
            <Text style={eyebrow}>Canal Parceiros</Text>
            <Heading as="h1" style={{ ...h1, margin: '0 0 12px' }}>
              {titulo}
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
              <Text style={valor}>{linhaVigencia}</Text>
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
    const n = Math.abs(Number(d?.diasParaVencer ?? 0))
    if (d?.tipoAviso === 'VENCE_DIARIO') {
      if (d?.vencido === true) {
        if (d?.renovacaoAutomatica === true) {
          return `Contrato de ${parceiro} venceu há ${n} dias: confirme a renovação automática para destravar o repasse`
        }
        return `Contrato de ${parceiro} venceu há ${n} dias e o repasse está travado`
      }
      if (d?.renovacaoAutomatica === true) {
        return `Contrato de ${parceiro} vence em ${n} dias: confirme a renovação automática no Hub`
      }
      return `Faltam ${n} dias para o contrato de ${parceiro} vencer`
    }
    if (d?.renovacaoAutomatica === false) {
      return `Contrato de ${parceiro} vence em ${n} dias e não tem renovação automática`
    }
    if (d?.renovacaoAutomatica === true) {
      return `Contrato de ${parceiro} vence em ${n} dias: confirme a renovação automática no Hub`
    }
    return `Contrato de ${parceiro} vence em ${n} dias`
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
    tipoAviso: 'VENCE_60',
    vencido: false,
  },
}
