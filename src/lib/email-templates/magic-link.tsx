import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, brand, brandSub, card, h1, text, button, footer,
} from './_lavoro-shared'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Lavoro Seguros</Heading>
          <Text style={brandSub}>Hub Interno</Text>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h1}>Seu link de acesso</Heading>
          <Text style={text}>
            Clique no botão abaixo para entrar no <strong>{siteName}</strong>.
            Este link é único, pessoal e expira em poucos minutos.
          </Text>
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>Entrar no Hub</Button>
          </div>
          <Text style={text}>
            Se você não solicitou este acesso, pode ignorar esta mensagem com
            segurança — nenhuma ação será realizada.
          </Text>
        </Section>
        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub Interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
