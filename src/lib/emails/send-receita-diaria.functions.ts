import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const InputSchema = z.object({
  to: z.string().email('Email inválido'),
})

/**
 * Coleta KPIs YTD e MTD via RPCs de Lavoro Receita e dispara o template
 * `receita-diaria`. Somente ADMIN pode disparar (validação client-server).
 */
export const sendReceitaDiaria = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'ADMIN',
    })
    if (roleError) throw new Error(roleError.message)
    if (!isAdmin) throw new Error('Apenas administradores podem disparar reports.')

    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth() + 1

    const [ytdRes, mtdRes, vencidoRes] = await Promise.all([
      context.supabase.rpc('rpc_lavoro_receita_kpis' as never, {
        p_ano: ano, p_mes: mes, p_periodo: 'YTD',
      } as never),
      context.supabase.rpc('rpc_lavoro_receita_kpis' as never, {
        p_ano: ano, p_mes: mes, p_periodo: 'MTD',
      } as never),
      context.supabase.rpc('rpc_receita_executivo_mensal' as never, { p_ano: ano } as never),
    ])

    if (ytdRes.error) throw new Error(`YTD: ${ytdRes.error.message}`)
    if (mtdRes.error) throw new Error(`MTD: ${mtdRes.error.message}`)

    const ytd = (ytdRes.data as any[])?.[0] ?? null
    const mtd = (mtdRes.data as any[])?.[0] ?? null
    const linhaMes = ((vencidoRes.data as any[]) ?? []).find((r) => Number(r.mes) === mes)
    const comissaoVencidaMes = Number(linhaMes?.saldo_vencido ?? 0)

    const quandoBR = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    try {
      const result = await sendTemplateEmail('receita-diaria', data.to, {
        templateData: { ano, mes, quandoBR, ytd, mtd, comissaoVencidaMes },
        idempotencyKey: `receita-diaria-${ano}-${mes}-${hoje.getDate()}-${data.to}`,
      })

      // Log dispatch (best-effort; ignore FK/permission errors)
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        await supabaseAdmin.from('report_disparos' as any).insert({
          tipo: 'receita_diaria',
          disparado_por: context.userId,
          status: result.sent ? 'ok' : 'suppressed',
          total_destinatarios: 1,
          erro: result.sent ? null : (result as any).reason,
          periodo_ref: `${ano}-${String(mes).padStart(2, '0')}`,
          payload: { to: data.to, ytd, mtd, comissaoVencidaMes },
        })
      } catch { /* noop */ }

      if (!result.sent) {
        return { ok: false, reason: result.reason, message: 'Destinatário bloqueado (bounce/reclamação/descadastro).' }
      }
      return { ok: true, to: data.to, quandoBR }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const code = (error as any)?.code as string | undefined
      const status = (error as any)?.status as number | undefined
      return { ok: false, message, code, status }
    }
  })
