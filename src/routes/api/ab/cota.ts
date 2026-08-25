// Teto mensal de consulta paga, por área.
//
// Permissão: `ab_cota_gerir`. Quem tem esta chave define quanto cada área
// pode gastar no mês — e é a única pessoa que pode desbloquear uma área
// que esbarrou no limite.
//
// Semântica dos limites, igual à do banco:
//   null → sem teto      0 → bloqueada      N → teto de N
//
// POST /api/ab/cota
//   {"area":"Comercial - Garantia","limiteConsultas":500,"limiteValor":1500}
//   {"area":"RH","limiteConsultas":0}                → bloqueia a área
//   {"area":"Comercial - Garantia","limiteConsultas":null}  → sem teto
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  area: z.string().min(1).max(120),
  /** Mês de referência (AAAA-MM-01). Omitido = mês corrente. */
  mes: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limiteConsultas: z.number().int().min(0).max(1_000_000).nullable().optional(),
  limiteValor: z.number().min(0).max(10_000_000).nullable().optional(),
  observacao: z.string().max(500).optional(),
})

export const Route = createFileRoute('/api/ab/cota')({
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
    return json({ erro: 'corpo_invalido', detalhe: parsed.error.message }, 400)
  }

  const { contextoUsuario, admin } = await import('@/lib/ab/db.server')
  const ctx = await contextoUsuario(request)
  if (ctx instanceof Response) return ctx

  if (!ctx.pode('ab_cota_gerir')) {
    return json(
      {
        erro: 'sem_permissao',
        chaves_necessarias: ['ab_cota_gerir'],
        detalhe:
          'Definir teto de gasto é atribuição de gestão. Peça a chave ab_cota_gerir ' +
          'em Administração › Perfis de Acesso.',
      },
      403,
    )
  }

  const mes = parsed.data.mes ?? new Date().toISOString().slice(0, 8) + '01'
  const linha: Record<string, unknown> = { area: parsed.data.area.trim(), mes }
  // `undefined` significa "não mexer"; `null` significa "sem teto".
  if (parsed.data.limiteConsultas !== undefined) {
    linha.limite_consultas = parsed.data.limiteConsultas
  }
  if (parsed.data.limiteValor !== undefined) linha.limite_valor = parsed.data.limiteValor

  // Rastro de quem mexeu no teto. Fica na própria linha da cota, e não em
  // ab_consumo: aquela tabela é livro-caixa de consulta tarifada, e
  // encher de linhas com custo zero estragaria a conferência da fatura.
  const quem = ctx.userId.slice(0, 8)
  const quando = new Date().toISOString().slice(0, 16).replace('T', ' ')
  linha.observacao = parsed.data.observacao
    ? `${parsed.data.observacao} — ajustado por ${quem} em ${quando}`
    : `Teto ajustado por ${quem} em ${quando}`

  const sb = admin()
  const { data, error } = await sb
    .from('ab_cota')
    .upsert(linha, { onConflict: 'area,mes' })
    .select('*')
    .single()

  if (error) return json({ erro: 'falha_gravacao', detalhe: error.message }, 500)

  return json({ ok: true, cota: data })
}
