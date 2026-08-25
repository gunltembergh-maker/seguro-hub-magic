// Callback do bureau judicial (Judit, Digesto, Escavador…).
//
// Configure esta URL no painel do fornecedor:
//   https://<dominio-do-hub>/api/public/hooks/ab-bureau-webhook?secret=...
//
// Autenticação: BUREAU_WEBHOOK_SECRET, em header `X-Hub-Secret` ou em
// `?secret=` na URL — nem todo fornecedor deixa configurar header
// customizado no callback.
//
// Nota de segurança: o segredo do webhook é DIFERENTE do AB_MOTOR_SECRET,
// de propósito. Ele fica em poder de um terceiro; se vazar, revoga-se só
// este, sem mexer no que o pg_cron usa.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/ab-bureau-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handle(request: Request): Promise<Response> {
  const expected = process.env.BUREAU_WEBHOOK_SECRET
  if (!expected) return json({ erro: 'server_misconfigured' }, 500)
  const url = new URL(request.url)
  const provided = request.headers.get('x-hub-secret')
    ?? request.headers.get('x-ab-secret')
    ?? url.searchParams.get('secret')
  if (provided !== expected) return json({ erro: 'segredo_invalido' }, 401)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ erro: 'corpo_invalido' }, 400)
  }

  const { bureauWebhook } = await import('@/lib/ab/bureau-webhook.server')
  const { status, body } = await bureauWebhook(payload)
  return json(body, status)
}
