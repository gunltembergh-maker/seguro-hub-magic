// Ingestão PNCP (contratos e editais). Chamada pelo pg_cron.
//
// Autenticação: cabeçalho `x-ab-secret` igual ao AB_MOTOR_SECRET
// (segredo server-only, nunca prefixado com VITE_).
//
// Corpo: {} | {"dias":2,"ufs":["SP","MG"],"pagina":37,"maxPaginas":20}
//
// A rotina tem prazo próprio: quando o orçamento aperta ela para, grava o
// que leu e devolve `resumo.proxima_pagina`. Isso é resposta 200 com
// `parcial: true`, não erro — o cron continua dali.
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  dias: z.number().int().min(1).max(90).optional(),
  horizonte: z.number().int().min(1).max(180).optional(),
  maxPaginas: z.number().int().min(1).max(200).optional(),
  tamanhoPagina: z.number().int().min(10).max(500).optional(),
  pagina: z.number().int().min(1).max(100_000).optional(),
  valorMinimo: z.number().min(0).optional(),
  ufs: z.array(z.string().length(2)).max(27).optional(),
  // teto de 55 s: a borda derruba a resposta perto de 60 s
  orcamentoMs: z.number().int().min(5_000).max(55_000).optional(),
  soContratos: z.boolean().optional(),
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
