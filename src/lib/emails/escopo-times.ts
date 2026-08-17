import { normalizeTimes } from '@/lib/receita-escopo'

/**
 * Retorna os times de receita do destinatário (vazio = sem restrição / ADMIN).
 * Aceita qualquer client Supabase (usuário ou admin).
 */
export async function fetchTimesReceita(client: any, userId: string | null): Promise<string[]> {
  if (!userId) return []
  try {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      client.from('profiles').select('times_receita').eq('user_id', userId).maybeSingle(),
      client.from('user_roles').select('role').eq('user_id', userId),
    ])
    const isAdmin = ((roles ?? []) as Array<{ role: string }>).some((r) => r.role === 'ADMIN')
    if (isAdmin) return []
    return normalizeTimes((prof as { times_receita?: string[] } | null)?.times_receita)
  } catch {
    return []
  }
}
