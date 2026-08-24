// Rota do motor de garantias (ab-motor-run).
//
// Autenticação: cabeçalho `x-ab-secret` deve ser igual ao AB_MOTOR_SECRET
// (segredo server-only, nunca prefixado com VITE_).
//
// Corpo aceito: {} | {"cnpj":"..."} | {"limite":N}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  cnpj: z.string().min(11).max(20).optional(),
  limite: z.number().int().min(1).max(5000).optional(),
})

export const Route = createFileRoute('/api/public/hooks/ab-motor-run')({
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
  const provided = request.headers.get('x-ab-secret')
  if (provided !== expected) return json({ erro: 'unauthorized' }, 401)

  let bruto: unknown = {}
  try {
    bruto = await request.json()
  } catch {
    bruto = {}
  }
  const parsed = corpoSchema.safeParse(bruto ?? {})
  if (!parsed.success) return json({ erro: 'corpo_invalido', detalhe: parsed.error.message }, 400)

  const { rodarMotor } = await import('@/lib/ab/motor.server')
  const { status, body } = await rodarMotor(parsed.data)
  return json(body, status)
}
