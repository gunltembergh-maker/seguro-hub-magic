// Enriquecimento cadastral por CNPJ — telefone, endereço, CNAE, porte e QSA.
//
// Autenticação: cabeçalho `x-ab-secret` igual ao AB_MOTOR_SECRET.
//
// Corpo: {} → lote em rodízio (os menos recentemente enriquecidos)
//        {"limite":20} | {"cnpjs":["..."]} | {"forcar":true}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  cnpjs: z.array(z.string().min(11).max(20)).max(60).optional(),
  limite: z.number().int().min(1).max(60).optional(),
  forcar: z.boolean().optional(),
  orcamentoMs: z.number().int().min(5_000).max(55_000).optional(),
})

export const Route = createFileRoute('/api/public/hooks/ab-enriquecer')({
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

  const { enriquecerCadastro } = await import('@/lib/ab/enriquecer.server')
  const { status, body } = await enriquecerCadastro(parsed.data)
  return json(body, status)
}
