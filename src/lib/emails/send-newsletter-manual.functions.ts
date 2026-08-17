import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const ModuloEnum = z.enum(['receita_lavoro', 'executivo_lavoro', 'fechamento_lavoro'])

const InputSchema = z.object({
  modulo: ModuloEnum,
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  destinatariosOverride: z.array(z.string().email()).optional(),
})

/**
 * Dispara manualmente a newsletter de um módulo para todos os destinatários
 * ativos (ou para uma lista override). Usa exatamente o mesmo núcleo do
 * disparo automático (dispatchNewsletterCore), de forma que cada destinatário
 * recebe os dados já filtrados pelo(s) seu(s) time(s) de receita.
 */
export const dispararNewsletterManual = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => InputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'ADMIN',
    })
    if (!isAdmin) throw new Error('Apenas administradores podem disparar newsletters.')

    // 1) Coleta destinatários (email + user_id)
    let destinatarios: Array<{ email: string; user_id: string | null }> = []
    if (data.destinatariosOverride && data.destinatariosOverride.length > 0) {
      const emails = data.destinatariosOverride.map((e) => e.trim().toLowerCase())
      const { data: profs } = await context.supabase
        .from('profiles')
        .select('user_id,email')
        .in('email', emails)
      const byEmail = new Map<string, string>()
      for (const p of ((profs ?? []) as any[])) {
        if (p?.email) byEmail.set(String(p.email).toLowerCase(), p.user_id as string)
      }
      destinatarios = emails.map((email) => ({ email, user_id: byEmail.get(email) ?? null }))
    } else {
      const { data: rows, error } = await context.supabase.rpc(
        'rpc_listar_destinatarios_automaticos' as never,
        { p_modulo: data.modulo } as never,
      )
      if (error) throw new Error(error.message)
      const vistos = new Set<string>()
      destinatarios = (((rows ?? []) as unknown) as any[])
        .filter((r) => r.ativo && r.email)
        .map((r) => ({
          email: String(r.email).toLowerCase(),
          user_id: (r.user_id as string | null) ?? null,
        }))
        .filter((r) => {
          if (vistos.has(r.email)) return false
          vistos.add(r.email)
          return true
        })
    }

    if (destinatarios.length === 0) {
      return { ok: false, motivo: 'sem_destinatarios', total: 0, enviados: 0, falhas: 0 }
    }

    // 2) Registro de disparo (manual → forcado_por = userId, escapa do índice único)
    const hojeISO = new Date().toISOString().slice(0, 10)
    const periodo_ref = `${data.ano}-${String(data.mes).padStart(2, '0')}`
    const { data: disparoIns, error: disparoErr } = await context.supabase
      .from('email_disparos_automaticos' as never)
      .insert({
        modulo: data.modulo,
        data_envio: hojeISO,
        periodo_ref,
        status: 'em_processamento',
        forcado_por: context.userId,
        total_destinatarios: destinatarios.length,
      } as never)
      .select('id')
      .single()
    if (disparoErr) throw new Error(disparoErr.message)
    const disparoId = (disparoIns as any).id as string

    // 3) Mesmo núcleo do disparo automático (dados por destinatário + escopo de time)
    const { dispatchNewsletterCore } = await import('@/lib/emails/dispatch-newsletter.server')
    return await dispatchNewsletterCore({
      supabase: context.supabase as any,
      modulo: data.modulo,
      ano: data.ano,
      mes: data.mes,
      disparoId,
      destinatarios,
      idempotencyPrefix: `manual-${Date.now()}`,
    })
  })
