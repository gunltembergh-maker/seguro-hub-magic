import { normalizeTimes, semAcessoReceita } from '@/lib/receita-escopo'

export interface EscopoReceitaDest {
  /** true = destinatário não pode ver nenhum dado de receita */
  semAcesso: boolean
  /** times específicos; vazio = sem restrição (ADMIN ou 'TODOS') */
  times: string[]
}

/**
 * Escopo de receita do destinatário.
 * ADMIN ou 'TODOS' => sem restrição; vazio/NULL => sem acesso.
 */
export async function fetchEscopoReceita(client: any, userId: string | null): Promise<EscopoReceitaDest> {
  if (!userId) return { semAcesso: false, times: [] }
  try {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      client.from('profiles').select('times_receita').eq('user_id', userId).maybeSingle(),
      client.from('user_roles').select('role').eq('user_id', userId),
    ])
    const isAdmin = ((roles ?? []) as Array<{ role: string }>).some((r) => r.role === 'ADMIN')
    if (isAdmin) return { semAcesso: false, times: [] }
    const raw = (prof as { times_receita?: string[] } | null)?.times_receita
    return { semAcesso: semAcessoReceita(raw), times: normalizeTimes(raw) }
  } catch {
    return { semAcesso: false, times: [] }
  }
}

/**
 * Retorna os times de receita do destinatário (vazio = sem restrição / ADMIN).
 * Aceita qualquer client Supabase (usuário ou admin).
 */
export async function fetchTimesReceita(client: any, userId: string | null): Promise<string[]> {
  const { times } = await fetchEscopoReceita(client, userId)
  return times
}
