import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text,
  divider, footer, LOGO_URL, NAVY, MUTED, BORDER,
} from './_lavoro-shared'

export interface AuditEvento {
  id: string
  ator: string
  acao: string
  entidade: string
  alvo: string
  quando: string
  mudancas: { campo: string; antes: string; depois: string }[]
}

interface Props {
  eventos: AuditEvento[]
}

const cell: React.CSSProperties = {
  fontSize: '12px',
  padding: '6px 8px',
  borderBottom: `1px solid ${BORDER}`,
  color: '#1F2937',
  verticalAlign: 'top',
}

export const AdminAuditEmail = ({ eventos }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Alteração administrativa registrada no Hub Lavoro Seguros</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
        </Section>
        <Section style={accentBar}>&nbsp;</Section>
        <Section style={card}>
          <Text style={eyebrow}>Auditoria administrativa</Text>
          <Heading as="h1" style={{ ...h1, margin: '0 0 12px' }}>
            {eventos.length === 1 ? '1 alteração registrada' : `${eventos.length} alterações registradas`}
          </Heading>
          <Text style={text}>
            Registro completo das alterações feitas em usuários e perfis de acesso do Hub.
          </Text>

          {eventos.map((ev) => (
            <Section key={ev.id} style={{ margin: '18px 0 0', padding: '14px', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
              <Text style={{ margin: 0, fontSize: '13px', color: NAVY, fontWeight: 700 }}>
                {ev.acao} · {ev.entidade}
              </Text>
              <Text style={{ margin: '6px 0 0', fontSize: '13px', color: '#1F2937' }}>
                <strong>Administrador:</strong> {ev.ator}
              </Text>
              <Text style={{ margin: '2px 0 0', fontSize: '13px', color: '#1F2937' }}>
                <strong>Alvo:</strong> {ev.alvo}
              </Text>
              <Text style={{ margin: '2px 0 10px', fontSize: '12px', color: MUTED }}>
                {ev.quando}
              </Text>

              {ev.mudancas.length > 0 && (
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...cell, textAlign: 'left', color: MUTED }}>Campo</th>
                      <th style={{ ...cell, textAlign: 'left', color: MUTED }}>Antes</th>
                      <th style={{ ...cell, textAlign: 'left', color: MUTED }}>Depois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ev.mudancas.map((m) => (
                      <tr key={m.campo}>
                        <td style={cell}>{m.campo}</td>
                        <td style={cell}>{m.antes}</td>
                        <td style={{ ...cell, fontWeight: 700 }}>{m.depois}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          ))}

          <Section style={divider}>&nbsp;</Section>
          <Text style={footer}>
            Hub Lavoro Seguros — notificação automática de auditoria.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default AdminAuditEmail
