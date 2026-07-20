import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, subHeader, subHeaderText, card, h1, text, button,
  ssoBox, ssoTitle, ssoBadge, infoBox, expiryNote, footer, LOGO_URL, displayName,
} from './_lavoro-shared'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  userName?: string | null
  userEmail?: string | null
}

export const RecoveryEmail = ({ confirmationUrl, userName, userEmail }: RecoveryEmailProps) => {
  const name = displayName(userName, userEmail)
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Redefinição de senha — Hub Lavoro Seguros</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_URL} alt="Lavoro Seguros" style={logoImg} />
          </Section>
          <Section style={subHeader}>
            <Text style={subHeaderText}>Hub Lavoro Seguros</Text>
          </Section>
          <Section style={card}>
            <Heading as="h2" style={h1}>
              {name ? `Olá, ${name} 👋` : 'Olá 👋'}
            </Heading>
            <Text style={text}>
              Recebemos uma solicitação para redefinir a senha da sua conta no{' '}
              <strong>Hub Lavoro Seguros</strong>.
            </Text>
            <Text style={text}>
              Lembrando que o acesso padrão ao Hub é <strong>via SSO Microsoft</strong>{' '}
              com o seu e-mail corporativo <strong>@lavoroseguros.com.br</strong>.
            </Text>

            <Section style={ssoBox}>
              <Text style={ssoTitle}>Acesso recomendado</Text>
              <Text style={{ ...ssoBadge, textDecoration: 'none' }}>
                🔐 Entrar com Microsoft (SSO)
              </Text>
            </Section>

            <Text style={infoBox}>
              Se ainda assim precisar redefinir sua senha, use o botão abaixo para
              criar uma nova.
            </Text>

            <div style={{ textAlign: 'center', margin: '24px 0 8px' }}>
              <Button style={button} href={confirmationUrl}>Redefinir senha</Button>
            </div>
            <Text style={expiryNote}>
              Este link de criação de senha expira em <strong>1 hora</strong>.
            </Text>
          </Section>
          <Text style={footer}>
            © {new Date().getFullYear()} Lavoro Seguros — Todos os direitos reservados.<br />
            Mensagem automática, por favor não responda este e-mail.<br />
            <strong>Equipe de Dados e IA</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail
