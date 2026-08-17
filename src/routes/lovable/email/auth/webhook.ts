import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { render } from '@react-email/render'
import { createHmac, timingSafeEqual } from 'crypto'
import { sendLovableEmail } from '@lovable.dev/email-js'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = 'Hub Lavoro Seguros'
const SENDER_DOMAIN = 'notify.hub.lavoroseguros.com.br'
const FROM_DOMAIN = 'notify.hub.lavoroseguros.com.br'
const ROOT_DOMAIN = 'hub.lavoroseguros.com.br'
const SITE_URL = `https://${ROOT_DOMAIN}`
const FROM = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`

// Supabase Send Email Hook payload (Standard Webhooks)
interface SupabaseAuthHookPayload {
  user: { email: string; new_email?: string | null }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type:
      | 'signup'
      | 'invite'
      | 'magiclink'
      | 'recovery'
      | 'email_change'
      | 'email_change_current'
      | 'email_change_new'
      | 'reauthentication'
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

/** Verify Standard Webhooks signature (Supabase Auth Send Email Hook). */
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const sigHeader = headers.get('webhook-signature')
  if (!id || !timestamp || !sigHeader) return false

  // Reject stale (>5 min)
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false

  // Secret format: "v1,whsec_<base64>"
  const secretB64 = secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '')
  let keyBytes: Buffer
  try {
    keyBytes = Buffer.from(secretB64, 'base64')
  } catch {
    return false
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`
  const expected = createHmac('sha256', keyBytes).update(signedContent).digest('base64')

  // Header may contain multiple signatures: "v1,<sig> v1,<sig2>"
  const sigs = sigHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean)
  for (const sig of sigs) {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length === b.length && timingSafeEqual(a, b)) return true
  }
  return false
}

function buildConfirmationUrl(payload: SupabaseAuthHookPayload): string {
  const { site_url, token_hash, email_action_type, redirect_to } = payload.email_data
  // O endpoint de verificação vive na API do Supabase, não no site.
  // Alguns payloads já trazem site_url com "/auth/v1" no final — normalizamos
  // para não gerar links duplicados (.../auth/v1/auth/v1/verify).
  const rawBase =
    process.env['SUPABASE_URL'] ||
    process.env['VITE_SUPABASE_URL'] ||
    site_url ||
    ''
  const base = rawBase.replace(/\/+$/, '').replace(/\/auth\/v1$/, '')
  const params = new URLSearchParams({
    token: token_hash,
    type: email_action_type,
    redirect_to: redirect_to || SITE_URL,
  })
  const apikey = process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY']
  if (apikey) params.set('apikey', apikey)
  return `${base}/auth/v1/verify?${params.toString()}`
}


async function renderEmail(payload: SupabaseAuthHookPayload): Promise<{
  subject: string
  element: React.ReactElement
  to: string
}> {
  const url = buildConfirmationUrl(payload)
  const to = payload.user.email
  const type = payload.email_data.email_action_type

  switch (type) {
    case 'signup':
      return {
        subject: 'Confirme seu e-mail — Hub Lavoro Seguros',
        to,
        element: React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: to,
          confirmationUrl: url,
        }),
      }
    case 'invite':
      return {
        subject: 'Você foi convidado — Hub Lavoro Seguros',
        to,
        element: React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          confirmationUrl: url,
        }),
      }
    case 'magiclink':
      return {
        subject: 'Seu link de acesso — Hub Lavoro Seguros',
        to,
        element: React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: url,
        }),
      }
    case 'recovery':
      return {
        subject: 'Redefinição de senha — Hub Lavoro Seguros',
        to,
        element: React.createElement(RecoveryEmail, {
          siteName: SITE_NAME,
          confirmationUrl: url,
        }),
      }
    case 'email_change':
    case 'email_change_current':
    case 'email_change_new': {
      const newEmail = payload.user.new_email ?? ''
      const recipient = type === 'email_change_new' && newEmail ? newEmail : to
      return {
        subject: 'Confirme seu novo e-mail — Hub Lavoro Seguros',
        to: recipient,
        element: React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: to,
          email: recipient,
          newEmail,
          confirmationUrl: url,
        }),
      }
    }
    case 'reauthentication':
      return {
        subject: 'Seu código de verificação — Hub Lavoro Seguros',
        to,
        element: React.createElement(ReauthenticationEmail, {
          token: payload.email_data.token ?? '',
        }),
      }
    default:
      throw new Error(`Unsupported email_action_type: ${type}`)
  }
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET
  if (!secret) {
    console.error('[auth webhook] SEND_EMAIL_HOOK_SECRET is not configured')
    return new Response('Server misconfigured', { status: 500 })
  }
  const apiKey = process.env.LOVABLE_API_KEY
  if (!apiKey) {
    console.error('[auth webhook] LOVABLE_API_KEY is not configured')
    return new Response('Server misconfigured', { status: 500 })
  }

  const rawBody = await request.text()
  if (!verifySignature(rawBody, request.headers, secret)) {
    console.warn('[auth webhook] invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: SupabaseAuthHookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    const { subject, element, to } = await renderEmail(payload)
    const html = await render(element)
    const text = await render(element, { plainText: true })
    await sendLovableEmail(
      {
        to,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: `auth:${payload.email_data.email_action_type}`,
        idempotency_key: `${request.headers.get('webhook-id') ?? crypto.randomUUID()}`,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    )
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[auth webhook] send failed', err)
    // Return 200 so Supabase does not retry indefinitely on a template bug;
    // errors are visible in Cloud → Emails logs and here in server logs.
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    )
  }
}

export const Route = createFileRoute('/lovable/email/auth/webhook')({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
})
