import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const InputSchema = z.object({
  to: z.string().email('Email inválido'),
})

function semanaDoAno(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Coleta métricas do Dashboard Executivo YTD e dispara o template semanal.
 * Somente ADMIN.
 */
export const sendResumoExecutivo = createServerFn({ method: 'POST' })
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
    const semanaAno = semanaDoAno(hoje)

    const { data: destProfile } = await context.supabase
      .from('profiles')
      .select('user_id')
      .eq('email', data.to.trim().toLowerCase())
      .maybeSingle()
    const destUserId = (destProfile as { user_id: string } | null)?.user_id ?? null

    const [mensalRes, compRes, canaisRes] = await Promise.all([
      context.supabase.rpc('rpc_receita_executivo_mensal' as never, { p_ano: ano, p_user_id: destUserId } as never),
      context.supabase.rpc('rpc_receita_executivo_complementares' as never, { p_ano: ano } as never),
      context.supabase.rpc('rpc_receita_executivo_canais' as never, { p_ano: ano, p_mes: mes, p_user_id: destUserId } as never),
    ])
    if (mensalRes.error) throw new Error(`Mensal: ${mensalRes.error.message}`)
    if (compRes.error) throw new Error(`Complementares: ${compRes.error.message}`)
    const canais = (((canaisRes.data as unknown) as any[]) ?? []) as Array<{ canal: string; caixa_corrente: number; a_receber_futuro: number }>

    const linhas = (mensalRes.data as any[]) ?? []
    const soma = (k: string) => linhas.reduce((acc, r) => acc + Number(r[k] ?? 0), 0)
    const ytd = {
      emitido: soma('emitido'),
      caixa: soma('caixa'),
      caixaCorrente: soma('caixa_corrente'),
      aReceberFuturo: soma('a_receber_futuro'),
      pctCaixa: 0,
    }
    ytd.pctCaixa = ytd.emitido > 0 ? ytd.caixa / ytd.emitido : 0

    const comp = ((compRes.data as any[]) ?? [])[0] ?? {}
    const posicaoTotalVencida = Number(comp.posicao_total_vencida ?? 0)
    const vencidosAnteriores = Number(comp.vencidos_anteriores_2026 ?? 0)

    const quandoBR = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    try {
      const result = await sendTemplateEmail('resumo-executivo-semanal', data.to, {
        templateData: { ano, mes, semanaAno, quandoBR, ytd, canais, posicaoTotalVencida, vencidosAnteriores, escopoTimes },
        idempotencyKey: `executivo-semanal-${ano}-w${semanaAno}-${data.to}-${Date.now()}`,
      })

      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        await supabaseAdmin.from('report_disparos' as any).insert({
          tipo: 'executivo_semanal',
          disparado_por: context.userId,
          status: result.sent ? 'ok' : 'suppressed',
          total_destinatarios: 1,
          erro: result.sent ? null : (result as any).reason,
          periodo_ref: `${ano}-S${semanaAno}`,
          payload: { to: data.to, ytd, posicaoTotalVencida, vencidosAnteriores },
        })
      } catch { /* noop */ }

      if (!result.sent) {
        return { ok: false, reason: result.reason, message: 'Destinatário bloqueado.' }
      }
      return { ok: true, to: data.to, quandoBR }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const code = (error as any)?.code as string | undefined
      const status = (error as any)?.status as number | undefined
      return { ok: false, message, code, status }
    }
  })
