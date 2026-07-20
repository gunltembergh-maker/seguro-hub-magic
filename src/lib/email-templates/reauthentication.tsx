import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, brand, brandSub, card, h1, text, codeStyle, footer,
} from './_lavoro-shared'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Lavoro Seguros</Heading>
          <Text style={brandSub}>Hub Interno</Text>
        </Section>
        <Section style={card}>
          <Heading as="h2" style={h1}>Confirme sua identidade</Heading>
          <Text style={text}>Use o código abaixo para confirmar a operação:</Text>
          <div style={{ textAlign: 'center' }}>
            <Text style={codeStyle}>{token}</Text>
          </div>
          <Text style={text}>
            Este código expira em poucos minutos. Se você não solicitou esta ação,
            pode ignorar esta mensagem com segurança.
          </Text>
        </Section>
        <Text style={footer}>
          © {new Date().getFullYear()} Lavoro Seguros — Hub Interno
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
