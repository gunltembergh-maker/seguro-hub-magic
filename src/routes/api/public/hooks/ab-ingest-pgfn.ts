// Ingestão PGFN (dívida ativa da União — gatilho T6).
//
// Autenticação: cabeçalho `x-ab-secret` igual ao AB_MOTOR_SECRET.
//
// Corpo: {"modo":"csv","csv":"CPF_CNPJ;...","ente":"UNIAO"}
//        {"modo":"csv","csvUrl":"https://..."}
//        {"modo":"lista","cnpjs":["..."]}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  modo: z.enum(['csv', 'lista']).optional(),
  // 4 MB de CSV é o teto prático de corpo aceito pela borda
  csv: z.string().max(4_000_000).optional(),
  csvUrl: z.string().url().optional(),
  ente: z.string().max(40).optional(),
  valorMinimo: z.number().min(0).optional(),
  cnpjs: z.array(z.string().min(11).max(20)).max(500).optional(),
})

export const Route = createFileRoute('/api/public/hooks/ab-ingest-pgfn')({
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

  const { ingestPgfn } = await import('@/lib/ab/ingest-pgfn.server')
  const { status, body } = await ingestPgfn(parsed.data)
  return json(body, status)
}
