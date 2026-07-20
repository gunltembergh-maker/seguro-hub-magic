import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, brand, brandSub, card, h1, text, button, footer,
} from './_lavoro-shared'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinição de senha — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Lavoro Seguros</Heading>
          <Text style={brandSub}>Hub Interno</Text>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h1}>Redefinir sua senha</Heading>
          <Text style={text}>
            Recebemos uma solicitação para redefinir sua senha no{' '}
            <strong>{siteName}</strong>. Clique no botão abaixo para escolher uma
            nova senha.
          </Text>
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>Redefinir senha</Button>
          </div>
          <Text style={text}>
            Se você não fez esta solicitação, pode ignorar este e-mail com
            segurança. Sua senha atual permanece inalterada.
          </Text>
        </Section>
        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub Interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
