// Ingestão PNCP (contratos e editais). Chamada pelo pg_cron.
//
// Autenticação: cabeçalho `x-ab-secret` igual ao AB_MOTOR_SECRET
// (segredo server-only, nunca prefixado com VITE_).
//
// Corpo: {} | {"dias":7,"horizonte":30,"maxPaginas":3}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  dias: z.number().int().min(1).max(90).optional(),
  horizonte: z.number().int().min(1).max(180).optional(),
  maxPaginas: z.number().int().min(1).max(10).optional(),
  tamanhoPagina: z.number().int().min(10).max(500).optional(),
})

export const Route = createFileRoute('/api/public/hooks/ab-ingest-pncp')({
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
  const expected = process.env.AB_MOTOR_SECRET
  if (!expected) return json({ erro: 'server_misconfigured' }, 500)
  if (request.headers.get('x-ab-secret') !== expected) return json({ erro: 'unauthorized' }, 401)

  let bruto: unknown = {}
  try {
    bruto = await request.json()
  } catch {
    bruto = {}
  }
  const parsed = corpoSchema.safeParse(bruto ?? {})
  if (!parsed.success) return json({ erro: 'corpo_invalido', detalhe: parsed.error.message }, 400)

  const { ingestPncp } = await import('@/lib/ab/ingest-pncp.server')
  const { status, body } = await ingestPncp(parsed.data)
  return json(body, status)
}
