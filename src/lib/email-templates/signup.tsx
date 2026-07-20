import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, brand, brandSub, card, h1, text, link, button, footer,
} from './_lavoro-shared'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Lavoro Seguros</Heading>
          <Text style={brandSub}>Hub Interno</Text>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h1}>Confirme seu e-mail</Heading>
          <Text style={text}>
            Boas-vindas ao{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>!
          </Text>
          <Text style={text}>
            Por favor, confirme o e-mail{' '}
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
            clicando no botão abaixo:
          </Text>
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>Confirmar e-mail</Button>
          </div>
          <Text style={text}>
            Se você não criou esta conta, pode ignorar este e-mail com segurança.
          </Text>
        </Section>
        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub Interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
