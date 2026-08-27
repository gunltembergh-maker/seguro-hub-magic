import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text,
  button, buttonWrap, infoBox, ssoLine, ssoStrong, expiryNote, divider, footer, footerStrong,
  LOGO_URL, displayName,
} from './_lavoro-shared'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  userName?: string | null
  userEmail?: string | null
}

export const MagicLinkEmail = ({ confirmationUrl, userName, userEmail }: MagicLinkEmailProps) => {
  const name = displayName(userName, userEmail)
  const titleName = name || 'Boas-vindas'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{titleName}, seu acesso ao Hub Lavoro Seguros está pronto</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
          </Section>
          <Section style={accentBar}>&nbsp;</Section>

          <Section style={card}>
            <Text style={eyebrow}>Link de acesso</Text>
            <Heading as="h1" style={h1}>
              {titleName}, seu acesso ao Hub Lavoro Seguros está pronto 🎯
            </Heading>

            <Text style={text}>
              Recebemos uma solicitação de acesso ao <strong>Hub Lavoro Seguros</strong>,
              sua plataforma interna corporativa.
            </Text>

            <Text style={text}>
              O acesso é <strong>exclusivo via SSO Microsoft</strong>, com o seu
              e-mail corporativo <strong>@lavoroseguros.com.br</strong>.
            </Text>

            <div style={buttonWrap}>
              <Button style={button} href={confirmationUrl}>
                Entrar no Hub
              </Button>
            </div>

            <Text style={ssoLine}>
              Ao clicar, você será direcionado para autenticar com{' '}
              <span style={ssoStrong}>Entrar com Microsoft</span>.
            </Text>

            <Text style={expiryNote}>
              Este link expira em <strong>1 hora</strong>.
            </Text>

            <Text style={infoBox}>
              ✓ Seu perfil já está <strong>pré-aprovado</strong> pela{' '}
              <strong>Equipe de Dados e IA</strong>.
            </Text>

            <div style={divider}>&nbsp;</div>

            <Text style={{ ...text, fontSize: '12px', color: '#6B7280', margin: 0 }}>
              Se você não solicitou este acesso, pode ignorar este e-mail com
              segurança.
            </Text>
          </Section>

          <Section style={footer}>
            © {new Date().getFullYear()} Lavoro Seguros — Todos os direitos reservados.<br />
            Mensagem automática, por favor não responda este e-mail.<br />
            <span style={footerStrong}>Equipe de Dados e IA</span>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail
