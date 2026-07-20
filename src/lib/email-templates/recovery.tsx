import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text,
  button, buttonWrap, infoBox, ssoLine, ssoStrong, expiryNote, divider, footer, footerStrong,
  LOGO_URL, displayName,
} from './_lavoro-shared'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  userName?: string | null
  userEmail?: string | null
}

export const RecoveryEmail = ({ confirmationUrl, userName, userEmail }: RecoveryEmailProps) => {
  const name = displayName(userName, userEmail)
  const titleName = name || 'Boas-vindas'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{titleName}, redefinição de senha do Hub Lavoro Seguros</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_URL} alt="Lavoro Seguros" style={logoImg} />
          </Section>
          <Section style={accentBar}>&nbsp;</Section>

          <Section style={card}>
            <Text style={eyebrow}>Redefinição de senha</Text>
            <Heading as="h1" style={h1}>
              {titleName}, redefinição de senha do Hub Lavoro Seguros 🔒
            </Heading>

            <Text style={text}>
              Recebemos uma solicitação para redefinir a senha da sua conta no{' '}
              <strong>Hub Lavoro Seguros</strong>.
            </Text>

            <Text style={text}>
              Lembrando que o acesso padrão é <strong>via SSO Microsoft</strong>{' '}
              com o e-mail corporativo <strong>@lavoroseguros.com.br</strong>.
              Só use o botão abaixo se realmente precisar criar uma nova senha.
            </Text>

            <div style={buttonWrap}>
              <Button style={button} href={confirmationUrl}>
                Redefinir minha senha
              </Button>
            </div>

            <Text style={ssoLine}>
              Prefere entrar direto?{' '}
              <span style={ssoStrong}>Entrar com Microsoft</span> na tela de login.
            </Text>

            <Text style={expiryNote}>
              Este link expira em <strong>1 hora</strong>.
            </Text>

            <Text style={infoBox}>
              ✓ Sua conta permanece ativa e <strong>pré-aprovada</strong> pela{' '}
              <strong>Equipe de Dados e IA</strong>.
            </Text>

            <div style={divider}>&nbsp;</div>

            <Text style={{ ...text, fontSize: '12px', color: '#6B7280', margin: 0 }}>
              Se você não solicitou esta alteração, pode ignorar este e-mail —
              sua senha atual continua válida.
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

export default RecoveryEmail
