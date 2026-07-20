import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, brand, brandSub, card, h1, text, link, button, footer,
} from './_lavoro-shared'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Lavoro Seguros</Heading>
          <Text style={brandSub}>Hub Interno</Text>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h1}>Você foi convidado 👋</Heading>
          <Text style={text}>
            Você recebeu um convite para acessar o{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
            Clique no botão abaixo para ativar sua conta e definir sua senha.
          </Text>
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>Aceitar convite</Button>
          </div>
          <Text style={text}>
            Este link é pessoal e expira em breve. Se você não estava esperando este
            convite, pode ignorar esta mensagem com segurança.
          </Text>
        </Section>
        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub Interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
