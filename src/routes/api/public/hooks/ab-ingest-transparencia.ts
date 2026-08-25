// Ingestão CEIS/CNEP/CEPIM do Portal da Transparência (filtro negativo).
//
// Autenticação: cabeçalho `x-ab-secret` igual ao AB_MOTOR_SECRET.
//
// Corpo: {} → lote em rodízio (os menos recentemente consultados)
//        {"limite":30} | {"cnpjs":["..."]}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  cnpjs: z.array(z.string().min(11).max(20)).max(60).optional(),
  limite: z.number().int().min(1).max(60).optional(),
})

export const Route = createFileRoute('/api/public/hooks/ab-ingest-transparencia')({
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

  const { ingestTransparencia } = await import('@/lib/ab/ingest-transparencia.server')
  const { status, body } = await ingestTransparencia(parsed.data)
  return json(body, status)
}
