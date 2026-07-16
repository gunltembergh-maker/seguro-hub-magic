import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const ModuloEnum = z.enum(['receita_lavoro', 'executivo_lavoro', 'fechamento_lavoro'])
type Modulo = z.infer<typeof ModuloEnum>

const InputSchema = z.object({
  modulo: ModuloEnum,
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  destinatariosOverride: z.array(z.string().email()).optional(),
})

const TEMPLATE_BY_MODULO: Record<Modulo, string> = {
  receita_lavoro: 'receita-lavoro',
  executivo_lavoro: 'executivo-lavoro',
  fechamento_lavoro: 'fechamento-lavoro',
}

/**
 * Dispara manualmente a newsletter de um módulo para todos os destinatários
 * ativos (ou para uma lista override). ADMIN pode chamar N vezes por dia —
 * o índice de idempotência só bloqueia disparos automáticos.
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

    // 1) Coleta destinatários (via RPC segura, com join no profile)
    let destinatarios: Array<{ email: string }>
    if (data.destinatariosOverride && data.destinatariosOverride.length > 0) {
      destinatarios = data.destinatariosOverride.map((email) => ({ email }))
    } else {
      const { data: rows, error } = await context.supabase.rpc(
        'rpc_listar_destinatarios_automaticos' as never,
        { p_modulo: data.modulo } as never,
      )
      if (error) throw new Error(error.message)
      destinatarios = (((rows ?? []) as unknown) as any[])
        .filter((r) => r.ativo && r.email)
        .map((r) => ({ email: r.email as string }))
    }

    if (destinatarios.length === 0) {
      return { ok: false, motivo: 'sem_destinatarios', total: 0, enviados: 0, falhas: 0 }
    }

    // 2) Cria registro de disparo (manual → forcado_por = userId, escapa do índice único)
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

    // 3) Coleta dados do template (uma vez)
    const [ytdRes, mtdRes, vencidoRes] = await Promise.all([
      context.supabase.rpc('rpc_lavoro_receita_kpis' as never, {
        p_ano: data.ano, p_mes: data.mes, p_periodo: 'YTD',
      } as never),
      context.supabase.rpc('rpc_lavoro_receita_kpis' as never, {
        p_ano: data.ano, p_mes: data.mes, p_periodo: 'MTD',
      } as never),
      context.supabase.rpc('rpc_receita_executivo_mensal' as never, { p_ano: data.ano } as never),
    ])

    const ytdKpis = ((ytdRes.data as unknown) as any[])?.[0] ?? null
    const mtd = ((mtdRes.data as unknown) as any[])?.[0] ?? null
    const linhasMensais = (((vencidoRes.data as unknown) as any[]) ?? []) as Array<{
      mes: number; emitido: number; caixa: number; caixa_corrente: number;
      saldo_vencido: number; a_receber_futuro: number | null;
    }>
    const linhaMes = linhasMensais.find((r) => Number(r.mes) === data.mes)
    const comissaoVencidaMes = Number(linhaMes?.saldo_vencido ?? 0)
    const quandoBR = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    let templateData: Record<string, any>
    if (data.modulo === 'executivo_lavoro') {
      const ytdLinhas = linhasMensais.filter((r) => Number(r.mes) <= data.mes)
      const emitido = ytdLinhas.reduce((a, r) => a + Number(r.emitido || 0), 0)
      const caixaEsperado = ytdLinhas.reduce((a, r) => a + Number(r.caixa || 0), 0)
      const caixaRecebido = ytdLinhas.reduce((a, r) => a + Number(r.caixa_corrente || 0), 0)
      const aReceberFuturo = Number(linhaMes?.a_receber_futuro ?? 0)
      const pctCaixa = caixaEsperado > 0 ? caixaRecebido / caixaEsperado : 0
      const mesDetalhe = linhaMes
        ? {
            emitido: Number(linhaMes.emitido || 0),
            caixa: Number(linhaMes.caixa || 0),
            caixaCorrente: Number(linhaMes.caixa_corrente || 0),
            saldoVencido: Number(linhaMes.saldo_vencido || 0),
            aReceberFuturo: Number(linhaMes.a_receber_futuro ?? 0),
          }
        : null
      templateData = {
        ano: data.ano,
        mes: data.mes,
        quandoBR,
        ytd: { emitido, caixaEsperado, caixaRecebido, aReceberFuturo, pctCaixa },
        mesDetalhe,
      }
    } else {
      templateData = { ano: data.ano, mes: data.mes, quandoBR, ytd: ytdKpis, mtd, comissaoVencidaMes }
    }
    const templateName = TEMPLATE_BY_MODULO[data.modulo]

    // 4) Fan-out
    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    let enviados = 0
    let falhas = 0
    const detalhes: any[] = []
    for (const { email: to } of destinatarios) {
      try {
        const r = await sendTemplateEmail(templateName, to, {
          templateData,
          idempotencyKey: `${data.modulo}-manual-${periodo_ref}-${to}-${Date.now()}`,
        })
        if (r.sent) enviados++
        else {
          falhas++
          detalhes.push({ to, ok: false, reason: (r as any).reason })
        }
      } catch (e) {
        falhas++
        detalhes.push({ to, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const status =
      falhas === 0 ? 'concluido' : enviados === 0 ? 'falha_total' : 'falha_parcial'

    await context.supabase
      .from('email_disparos_automaticos' as never)
      .update({
        status,
        total_sucessos: enviados,
        total_falhas: falhas,
        finalizado_em: new Date().toISOString(),
        detalhes_erro: detalhes.length > 0 ? detalhes : null,
      } as never)
      .eq('id', disparoId)

    return { ok: true, disparoId, total: destinatarios.length, enviados, falhas, status }
  })
