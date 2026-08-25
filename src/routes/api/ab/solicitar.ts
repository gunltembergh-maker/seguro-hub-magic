// Solicitação de pesquisa de processos — a tela equivalente à busca da
// Tratum, mas com finalidade, custo e responsável registrados.
//
// Duas permissões, cumulativas:
//   * `ab_solicitar` — quem pode gerar despesa. O admin concede em
//     Administração › Perfis de Acesso, perfil por perfil.
//   * a chave da finalidade — ab_garantia | ab_juridico | ab_compliance |
//     ab_rh. Pedir com finalidade GARANTIA sem ter ab_garantia é 403.
//
// POST /api/ab/solicitar
//   {"documento":"11035301000177","finalidade":"GARANTIA","escopo":"PROCESSOS"}
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corpoSchema = z.object({
  documento: z.string().min(11).max(20),
  finalidade: z.enum(['GARANTIA', 'JURIDICO', 'COMPLIANCE', 'RH']).optional(),
  escopo: z.enum(['PROCESSOS', 'MONITORAMENTO', 'COMPLETO']).optional(),
  nome: z.string().max(200).optional(),
})

export const Route = createFileRoute('/api/ab/solicitar')({
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

  const { contextoUsuario } = await import('@/lib/ab/db.server')
  const ctx = await contextoUsuario(request)
  if (ctx instanceof Response) return ctx

  if (!ctx.pode('ab_solicitar')) {
    return json(
      {
        erro: 'sem_permissao',
        chaves_necessarias: ['ab_solicitar'],
        detalhe:
          'Solicitar pesquisa pode gerar consulta paga. Peça a um administrador ' +
          'para marcar a chave ab_solicitar no seu perfil, em Administração › Perfis de Acesso.',
      },
      403,
    )
  }

  const { CHAVE_POR_FINALIDADE, criarSolicitacao } = await import('@/lib/ab/solicitacao.server')
  const finalidade = parsed.data.finalidade ?? 'GARANTIA'
  const chaveFinalidade = CHAVE_POR_FINALIDADE[finalidade]

  if (!ctx.pode(chaveFinalidade)) {
    return json(
      {
        erro: 'sem_permissao',
        chaves_necessarias: [chaveFinalidade],
        detalhe:
          `Você tem ab_solicitar, mas não tem ${chaveFinalidade} — que é a chave da ` +
          `finalidade ${finalidade}. A finalidade não é rótulo: é o que delimita o uso ` +
          `do dado e quem vê o resultado depois.`,
      },
      403,
    )
  }

  const { status, body } = await criarSolicitacao(parsed.data, {
    userId: ctx.userId,
    area: ctx.area,
  })
  return json(body, status)
}
