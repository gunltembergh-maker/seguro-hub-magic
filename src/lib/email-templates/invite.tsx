import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, subHeader, subHeaderText, card, h1, text, button,
  ssoBox, ssoTitle, ssoBadge, infoBox, expiryNote, footer, LOGO_URL, displayName,
} from './_lavoro-shared'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  userName?: string | null
  userEmail?: string | null
}

export const InviteEmail = ({ confirmationUrl, userName, userEmail }: InviteEmailProps) => {
  const name = displayName(userName, userEmail)
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Você foi convidado para o Hub Lavoro Seguros</Preview>
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
              {name
                ? `${name}, seu acesso ao Hub Lavoro Seguros está pronto 🎯`
                : 'Seu acesso ao Hub Lavoro Seguros está pronto 🎯'}
            </Heading>
            <Text style={text}>
              Você foi convidado para acessar o <strong>Hub Lavoro Seguros</strong>,
              sua plataforma interna corporativa.
            </Text>
            <Text style={text}>
              O acesso é <strong>exclusivo via SSO</strong> e deve ser feito com o
              seu e-mail corporativo <strong>@lavoroseguros.com.br</strong>.
            </Text>

            <Section style={ssoBox}>
              <Text style={ssoTitle}>Como entrar</Text>
              <Text style={{ ...ssoBadge, textDecoration: 'none' }}>
                🔐 Entrar com Microsoft (SSO)
              </Text>
            </Section>

            <Text style={infoBox}>
              ✅ Seu perfil já está <strong>pré-aprovado</strong> pela{' '}
              <strong>Equipe de Dados e IA</strong>. Basta aceitar o convite abaixo
              e autenticar com sua conta Microsoft Lavoro Seguros.
            </Text>

            <div style={{ textAlign: 'center', margin: '24px 0 8px' }}>
              <Button style={button} href={confirmationUrl}>Aceitar convite</Button>
            </div>
            <Text style={expiryNote}>
              Este link de ativação expira em <strong>1 hora</strong>.
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

export default InviteEmail
