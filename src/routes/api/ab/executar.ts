// Disparo manual das rotinas do módulo, pela tela "Fontes e gatilhos".
//
// Por que existe: as rotinas de máquina (/api/public/hooks/ab-*) são
// protegidas por AB_MOTOR_SECRET, que é server-only e NÃO pode ir para o
// navegador. Então o front não chama aquelas rotas — chama esta, que
// autentica pelo JWT do usuário, confere a permissão ab_garantia no
// modelo do próprio Hub (rpc_meu_perfil) e executa em processo.
//
// POST /api/ab/executar   {"nome":"ab-motor-run","body":{"limite":200}}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const ROTINAS = [
  'ab-motor-run',
  'ab-ingest-pncp',
  'ab-ingest-pgfn',
  'ab-ingest-transparencia',
  'ab-enriquecer',
  'ab-bureau-monitorar',
] as const

const corpoSchema = z.object({
  nome: z.enum(ROTINAS),
  body: z.record(z.unknown()).optional(),
})

export const Route = createFileRoute('/api/ab/executar')({
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
  let bruto: unknown = {}
  try {
    bruto = await request.json()
  } catch {
    bruto = {}
  }
  const parsed = corpoSchema.safeParse(bruto ?? {})
  if (!parsed.success) {
    return json({
      erro: 'corpo_invalido',
      detalhe: parsed.error.message,
      rotinas_validas: ROTINAS,
    }, 400)
  }

  const { exigirPerfil } = await import('@/lib/ab/db.server')
  const perm = await exigirPerfil(request, ['ab_garantia'])
  if (perm instanceof Response) return perm

  const { nome } = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const corpo = (parsed.data.body ?? {}) as any

  try {
    switch (nome) {
      case 'ab-motor-run': {
        const { rodarMotor } = await import('@/lib/ab/motor.server')
        const r = await rodarMotor(corpo)
        return json(r.body, r.status)
      }
      case 'ab-ingest-pncp': {
        const { ingestPncp } = await import('@/lib/ab/ingest-pncp.server')
        const r = await ingestPncp(corpo)
        return json(r.body, r.status)
      }
      case 'ab-ingest-pgfn': {
        const { ingestPgfn } = await import('@/lib/ab/ingest-pgfn.server')
        const r = await ingestPgfn(corpo)
        return json(r.body, r.status)
      }
      case 'ab-ingest-transparencia': {
        const { ingestTransparencia } = await import('@/lib/ab/ingest-transparencia.server')
        const r = await ingestTransparencia(corpo)
        return json(r.body, r.status)
      }
      case 'ab-enriquecer': {
        const { enriquecerCadastro } = await import('@/lib/ab/enriquecer.server')
        const r = await enriquecerCadastro(corpo)
        return json(r.body, r.status)
      }
      case 'ab-bureau-monitorar': {
        const { bureauMonitorar } = await import('@/lib/ab/bureau-monitorar.server')
        const r = await bureauMonitorar(corpo)
        return json(r.body, r.status)
      }
    }
  } catch (err) {
    return json({ ok: false, erro: (err as Error).message }, 500)
  }
}
