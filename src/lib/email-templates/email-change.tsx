import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, brand, brandSub, card, h1, text, link, button, footer,
} from './_lavoro-shared'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName, oldEmail, newEmail, confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração de e-mail — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Lavoro Seguros</Heading>
          <Text style={brandSub}>Hub Interno</Text>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h1}>Confirme a alteração de e-mail</Heading>
          <Text style={text}>
            Você solicitou alterar o e-mail da sua conta no{' '}
            <strong>{siteName}</strong> de{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
            para{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>Confirmar alteração</Button>
          </div>
          <Text style={text}>
            Se você não solicitou esta alteração, entre em contato com o administrador
            imediatamente para proteger sua conta.
          </Text>
        </Section>
        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub Interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
