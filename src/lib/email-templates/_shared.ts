// Shared constants for email templates (server + preview).

export const LAVORO_COLORS = {
  navy: '#14405C',
  navyDark: '#0E2E43',
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
  process.env.SITE_URL ||
  process.env.LOVABLE_APP_URL ||
  'https://project--ae780930-9fc8-45f0-9908-31d89569a898.lovable.app'

// White logo (for dark navy header). Asset id from src/assets/logo-branca.png.asset.json.
export const LOGO_BRANCA_URL = `${SITE_URL}/__l5e/assets-v1/67b635fc-94fb-475d-a9b5-dbab30f2127e/logo-branca.png`

export const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export const MESES_PT_LONGO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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
