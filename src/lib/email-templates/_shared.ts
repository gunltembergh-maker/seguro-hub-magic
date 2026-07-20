// Shared constants for email templates (server + preview).

export const LAVORO_COLORS = {
  navy: '#14405C',
  navyDark: '#0E2E43',
  blueLight: '#8AAFC9',
  blue: '#00BAF2',
  amber: '#D97706',
  red: '#DC2626',
  green: '#059669',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E5E7EB',
  textMuted: '#4B6D88',
  textDark: '#0E2E43',
}

// Absolute URL used by email clients to fetch images (must be reachable
// externally — CDN asset paths resolve on any of the project's app URLs).
export const SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.LOVABLE_APP_URL ||
  'https://hub.lavoroseguros.com.br'

// White Lavoro Seguros logo — oficial (source: Logo_Lavoro_Branca-2.png).
export const LOGO_BRANCA_URL = `${SITE_URL}/__l5e/assets-v1/7869490b-ef06-42fc-a753-2a6967781570/logo-lavoro-branca.png`

export const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export const MESES_PT_LONGO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** Formata o período de referência para uso em Subject: "Junho de 2026". */
export const periodoRefLongo = (ano: number, mes: number) =>
  `${MESES_PT_LONGO[mes - 1]} de ${ano}`

export const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

export const PCT = (v: number | null | undefined, digits = 1) =>
  v == null || !isFinite(Number(v))
    ? '—'
    : `${(Number(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`

export const nowBR = () =>
  new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// Padrão de footer para todos os templates Lavoro.
export const FOOTER_ASSINATURA = {
  time: 'Equipe de Dados & AI',
  empresa: 'Lavoro Seguros',
}
