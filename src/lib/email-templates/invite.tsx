import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
  Row, Column,
} from '@react-email/components'
import {
  main, container, header, logoImg, headerTag, accentBar, card, eyebrow, h1, text,
  button, buttonWrap, infoBox, ssoLine, ssoStrong, expiryNote, divider, footer, footerStrong,
  LOGO_URL, displayName,
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
      <Preview>Seu acesso ao Hub Lavoro Seguros está pronto</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Row style={{ width: '100%' }}>
              <Column>
                <Img src={LOGO_URL} alt="Lavoro Seguros" style={logoImg} />
              </Column>
              <Column>
                <Text style={headerTag}>Hub Lavoro Seguros</Text>
              </Column>
            </Row>
          </Section>
          <Section style={accentBar}>&nbsp;</Section>

          <Section style={card}>
            <Text style={eyebrow}>Convite de acesso</Text>
            <Heading as="h1" style={h1}>
              {name
                ? `${name}, seu acesso ao Hub Lavoro Seguros está pronto 🎯`
                : 'Seu acesso ao Hub Lavoro Seguros está pronto 🎯'}
            </Heading>

            <Text style={text}>
              Você foi convidado para acessar o <strong>Hub Lavoro Seguros</strong>,
              a plataforma interna corporativa da Lavoro.
            </Text>

            <Text style={text}>
              O acesso é <strong>exclusivo via SSO Microsoft</strong>, com o seu
              e-mail corporativo <strong>@lavoroseguros.com.br</strong>.
            </Text>

            <div style={buttonWrap}>
              <Button style={button} href={confirmationUrl}>
                Aceitar convite e entrar
              </Button>
            </div>

            <Text style={ssoLine}>
              Ao clicar, você será direcionado para autenticar com{' '}
              <span style={ssoStrong}>Entrar com Microsoft</span>.
            </Text>

            <Text style={expiryNote}>
              Este link expira em <strong>1 hora</strong>.
            </Text>

            <Text style={infoBox}>
              ✓ Seu perfil já está <strong>pré-aprovado</strong> pela{' '}
              <strong>Equipe de Dados e IA</strong>. Basta autenticar com sua
              conta Microsoft Lavoro Seguros.
            </Text>

            <div style={divider}>&nbsp;</div>

            <Text style={{ ...text, fontSize: '12px', color: '#6B7280', margin: 0 }}>
              Se você não esperava este convite, pode ignorar este e-mail com
              segurança.
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

export default InviteEmail
