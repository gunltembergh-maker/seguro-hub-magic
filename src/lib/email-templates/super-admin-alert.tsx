import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text,
  infoBox, divider, footer, footerStrong, LOGO_URL,
} from './_lavoro-shared'

export interface SuperAdminAlertProps {
  area: string
  tentativas: number
  usuarioNome?: string | null
  usuarioEmail?: string | null
  quando: string
  origem?: string | null
}

export const SuperAdminAlertEmail = ({
  area, tentativas, usuarioNome, usuarioEmail, quando, origem,
}: SuperAdminAlertProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Tentativa de acesso com senha de super administrador incorreta</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
        </Section>
        <Section style={accentBar}>&nbsp;</Section>

        <Section style={card}>
          <Text style={eyebrow}>Alerta de segurança</Text>
          <Heading as="h1" style={h1}>Senha de super administrador incorreta 🔐</Heading>

          <Text style={text}>
            Alguém tentou desbloquear uma área restrita do <strong>Hub Lavoro Seguros</strong> e
            digitou a senha de super administrador errada.
          </Text>

          <div style={infoBox}>
            <div><strong>Área:</strong> {area}</div>
            <div><strong>Usuário:</strong> {usuarioNome ?? '—'}</div>
            <div><strong>E-mail:</strong> {usuarioEmail ?? '—'}</div>
            <div><strong>Data e hora:</strong> {quando}</div>
            <div><strong>Tentativas nesta sessão:</strong> {tentativas}</div>
            {origem ? <div><strong>Origem:</strong> {origem}</div> : null}
          </div>

          <Text style={text}>
            Se não foi você quem autorizou esta tentativa, considere trocar a senha de super
            administrador imediatamente.
          </Text>

          <div style={divider} />
          <Text style={footer}>
            <span style={footerStrong}>Hub Lavoro Seguros</span> · alerta automático de segurança
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SuperAdminAlertEmail
