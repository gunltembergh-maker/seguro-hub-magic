// Dossiê de CNPJ (Compliance) e de CPF (RH).
//
// Rota autenticada pelo JWT do usuário: a permissão depende da finalidade
// (ab_rh, ab_compliance ou ab_garantia) e o id do solicitante fica gravado
// em ab_dossie. Sem consentimento válido, CPF responde 403 — é o que
// mantém RH e Compliance defensáveis (LGPD art. 7º).
//
// POST /api/ab/bgcheck  {"documento":"...","finalidade":"COMPLIANCE"}
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/ab/bgcheck')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { bgcheck } = await import('@/lib/ab/bgcheck.server')
        return bgcheck(request)
      },
    },
  },
})
