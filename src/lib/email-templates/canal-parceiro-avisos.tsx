// Modelo único dos avisos do Canal Parceiros (repasse, conferência de contrato
// e alteração de percentual). Mesmo visual dos demais e-mails do Hub.
import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import {
  main, container, header, logoImg, accentBar, card, eyebrow, h1, text, button, buttonWrap,
  divider, footer, footerStrong, LOGO_URL, NAVY, NAVY_DEEP, MUTED, BORDER, LIGHT_BG,
} from './_lavoro-shared'

export interface AvisoCanalParceiroProps {
  eyebrowTexto: string
  titulo: string
  /** Parágrafos do corpo; `**texto**` vira negrito. */
  paragrafos: string[]
  destaque?: { titulo: string; subtitulo?: string } | null
  itens?: { rotulo: string; valor: string }[]
  observacao?: { rotulo: string; texto: string } | null
  botao?: { rotulo: string; href: string } | null
  notaFinal?: string | null
  assinaturaNome?: string | null
  assinaturaArea?: string | null
  rodape: string
  preview: string
}

const label: React.CSSProperties = {
  fontSize: '11px',
  color: MUTED,
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  margin: '0 0 2px',
  fontWeight: 700,
}

const valorStyle: React.CSSProperties = {
  fontSize: '14px',
  color: NAVY_DEEP,
  margin: '0 0 12px',
  fontWeight: 600,
}

const dadosBox: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  backgroundColor: LIGHT_BG,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '18px 0 0',
}

const destaqueBox: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '18px 0 0',
  textAlign: 'center',
}

function negrito(s: string, key: number) {
  const partes = String(s).split(/\*\*(.+?)\*\*/g)
  return (
    <React.Fragment key={key}>
      {partes.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </React.Fragment>
  )
}

export const AvisoCanalParceiroEmail = ({
  eyebrowTexto = 'Canal Parceiros',
  titulo = 'Aviso do Hub',
  paragrafos = [],
  destaque = null,
  itens = [],
  observacao = null,
  botao = null,
  notaFinal = null,
  assinaturaNome = null,
  assinaturaArea = null,
  rodape = 'aviso automático do Canal Parceiros',
  preview = 'Aviso do Hub Lavoro',
}: Partial<AvisoCanalParceiroProps>) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Lavoro Seguros" width="101" height="34" style={logoImg} />
        </Section>
        <Section style={accentBar}>&nbsp;</Section>
        <Section style={card}>
          <Text style={eyebrow}>{eyebrowTexto}</Text>
          <Heading as="h1" style={{ ...h1, margin: '0 0 12px' }}>
            {titulo}
          </Heading>

          <Text style={{ fontSize: '13px', color: MUTED, margin: '0 0 16px', lineHeight: '20px' }}>
            Mensagem automática do Hub Lavoro. Não é necessário responder.
          </Text>

          {(paragrafos ?? []).map((p, i) => (
            <Text key={i} style={text}>
              {negrito(p, i)}
            </Text>
          ))}

          {destaque ? (
            <Section style={destaqueBox}>
              <Text style={{ fontSize: '26px', fontWeight: 700, color: NAVY_DEEP, margin: 0 }}>
                {destaque.titulo}
              </Text>
              {destaque.subtitulo ? (
                <Text style={{ fontSize: '13px', color: MUTED, margin: '6px 0 0' }}>
                  {destaque.subtitulo}
                </Text>
              ) : null}
            </Section>
          ) : null}

          {itens && itens.length > 0 ? (
            <Section style={dadosBox}>
              {itens.map((it, i) => (
                <React.Fragment key={i}>
                  <Text style={label}>{it.rotulo}</Text>
                  <Text style={{ ...valorStyle, margin: i === itens.length - 1 ? 0 : '0 0 12px' }}>
                    {it.valor}
                  </Text>
                </React.Fragment>
              ))}
            </Section>
          ) : null}

          {observacao ? (
            <Section style={dadosBox}>
              <Text style={label}>{observacao.rotulo}</Text>
              <Text style={{ fontSize: '14px', color: NAVY_DEEP, margin: 0, lineHeight: '21px' }}>
                {observacao.texto}
              </Text>
            </Section>
          ) : null}

          {botao ? (
            <Section style={buttonWrap}>
              <Button style={button} href={botao.href}>
                {botao.rotulo}
              </Button>
            </Section>
          ) : null}

          {notaFinal ? (
            <Text style={{ fontSize: '13px', color: MUTED, margin: '0 0 10px', lineHeight: '20px' }}>
              {notaFinal}
            </Text>
          ) : null}

          {assinaturaNome || assinaturaArea ? (
            <>
              <Section style={divider}>&nbsp;</Section>
              <Text style={{ fontSize: '14px', color: NAVY, margin: 0, lineHeight: '21px' }}>
                {[assinaturaNome, assinaturaArea].filter(Boolean).join(', ')}
              </Text>
            </>
          ) : null}
        </Section>
        <Section style={{ ...divider, margin: 0, borderTop: `1px solid ${BORDER}` }}>&nbsp;</Section>
        <Section style={footer}>
          <Text style={{ margin: 0 }}>
            <span style={footerStrong}>Hub Lavoro Seguros</span> · {rodape}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

function entrada(displayName: string, previewData: Record<string, any>) {
  return {
    component: AvisoCanalParceiroEmail,
    subject: (d: Record<string, any>) => String(d?.assunto ?? 'Aviso do Hub Lavoro'),
    displayName,
    previewData,
  }
}

const basePreview = {
  assunto: 'Aviso do Hub Lavoro',
  eyebrowTexto: 'Canal Parceiros',
  rodape: 'aviso automático do Canal Parceiros',
  preview: 'Aviso do Hub Lavoro',
}

export const templateSolicitacao = entrada('Canal Parceiros · Repasse: pedido de autorização', {
  ...basePreview,
  assunto: 'Autorizar repasse de PARCEIRO EXEMPLO, ciclo 09/2026',
  titulo: 'Autorização de repasse',
  paragrafos: [
    'Maria Silva conferiu a relação de repasse de **PARCEIRO EXEMPLO** do ciclo 09/2026 e pede sua autorização para o envio ao parceiro, para emissão da nota fiscal.',
  ],
  destaque: { titulo: 'R$ 18.420,00', subtitulo: '37 parcelas' },
  botao: { rotulo: 'Abrir no Hub', href: 'https://hub.lavoroseguros.com.br/financeiro/fluxo-diario' },
  notaFinal: 'Na tela você confere o valor, autoriza e informa a data prevista do pagamento.',
})

export const templateResposta = entrada('Canal Parceiros · Repasse: resposta do Financeiro', {
  ...basePreview,
  assunto: 'Financeiro respondeu o repasse de PARCEIRO EXEMPLO, ciclo 09/2026',
  titulo: 'Resposta do Financeiro',
  paragrafos: [
    'João Souza autorizou o envio da relação de **PARCEIRO EXEMPLO**, ciclo 09/2026. Pagamento previsto para 10/10/2026, após o recebimento da nota fiscal.',
  ],
  botao: { rotulo: 'Abrir no Hub', href: 'https://hub.lavoroseguros.com.br/comercial/canal-parceiros' },
})

export const templateCobranca = entrada('Canal Parceiros · Repasse: o pagamento saiu?', {
  ...basePreview,
  assunto: 'O repasse de PARCEIRO EXEMPLO foi pago?',
  titulo: 'O pagamento foi feito?',
  paragrafos: [
    'A data prevista de pagamento de **PARCEIRO EXEMPLO**, ciclo 09/2026, era 10/10/2026, e já se passaram 2 dia(s). O pagamento foi feito?',
  ],
  botao: { rotulo: 'Responder no Hub', href: 'https://hub.lavoroseguros.com.br/financeiro/fluxo-diario' },
  notaFinal: 'Confirmando a data, o Hub dá baixa no repasse deste ciclo.',
})

export const templateConferencia = entrada('Canal Parceiros · Conferência de contrato', {
  ...basePreview,
  assunto: 'Conferir contrato de PARCEIRO EXEMPLO',
  titulo: 'Contrato para conferência',
  paragrafos: [
    'Um contrato precisa da sua conferência. Maria Silva enviou **Contrato_Exemplo.pdf** em 20/09/2026.',
  ],
  itens: [
    { rotulo: 'Situação', valor: 'AGUARDANDO_VERIFICACAO' },
    { rotulo: 'Motivo', valor: 'Assinatura não localizada no arquivo' },
  ],
  botao: { rotulo: 'Abrir no Hub', href: 'https://hub.lavoroseguros.com.br/comercial/canal-parceiros' },
  notaFinal: 'Na tela você abre o documento por um link temporário e decide.',
})

export const templateAlteracaoPedido = entrada('Canal Parceiros · Alteração de percentual: pedido', {
  ...basePreview,
  assunto: 'Aprovar alteração de percentual de PARCEIRO EXEMPLO',
  titulo: 'Alteração de percentual',
  paragrafos: [
    'Maria Silva pediu alteração de percentual de **PARCEIRO EXEMPLO**, com De Acordo de diretoria@lavoroseguros.com.br.',
  ],
  itens: [{ rotulo: 'Garantia', valor: '30% para 25%' }],
  botao: { rotulo: 'Abrir no Hub', href: 'https://hub.lavoroseguros.com.br/comercial/canal-parceiros' },
})

export const templateAlteracaoDecisao = entrada('Canal Parceiros · Alteração de percentual: decisão', {
  ...basePreview,
  assunto: 'Alteração de percentual de PARCEIRO EXEMPLO: APROVADA',
  titulo: 'Alteração de percentual decidida',
  paragrafos: ['Alessandro Oliveira aprovou a alteração de percentual de **PARCEIRO EXEMPLO**.'],
  itens: [{ rotulo: 'Garantia', valor: '30% para 25%' }],
  botao: { rotulo: 'Abrir no Hub', href: 'https://hub.lavoroseguros.com.br/comercial/canal-parceiros' },
})
