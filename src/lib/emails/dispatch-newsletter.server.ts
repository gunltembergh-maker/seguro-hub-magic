// Server-only. Dispatch de newsletters — usado pelo hook automático (cron) e
// (opcionalmente) por qualquer chamada admin. NÃO importar de código cliente.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Modulo = 'receita_lavoro' | 'executivo_lavoro' | 'fechamento_lavoro'

const TEMPLATE_BY_MODULO: Record<Modulo, string> = {
  receita_lavoro: 'receita-lavoro',
  executivo_lavoro: 'executivo-lavoro',
  fechamento_lavoro: 'fechamento-lavoro',
}

export interface DispatchResult {
  ok: boolean
  disparoId?: string
  total: number
  enviados: number
  falhas: number
  status: 'concluido' | 'falha_parcial' | 'falha_total' | 'sem_destinatarios'
  motivo?: string
}

/**
 * Executa o disparo de uma newsletter. Assume que:
 *  - `supabase` é um client com service_role (bypass RLS) — ideal para o cron
 *  - Um registro em `email_disparos_automaticos` JÁ foi criado (para respeitar
 *    o índice único diário automático) e seu id é passado em `disparoId`.
 *  - `destinatarios` já foi coletada.
 */
export async function dispatchNewsletterCore(opts: {
  supabase: SupabaseClient
  modulo: Modulo
  ano: number
  mes: number
  disparoId: string
  destinatarios: Array<{ email: string; user_id?: string | null }>
  idempotencyPrefix: string
}): Promise<DispatchResult> {
  const { supabase, modulo, ano, mes, disparoId, destinatarios, idempotencyPrefix } = opts

  if (destinatarios.length === 0) {
    await supabase
      .from('email_disparos_automaticos' as never)
      .update({
        status: 'falha_total',
        total_sucessos: 0,
        total_falhas: 0,
        finalizado_em: new Date().toISOString(),
        detalhes_erro: [{ motivo: 'sem_destinatarios' }],
      } as never)
      .eq('id', disparoId)
    return { ok: false, disparoId, total: 0, enviados: 0, falhas: 0, status: 'sem_destinatarios' }
  }

  // Coleta dados do template — por destinatário, respeitando o(s) time(s)
  // de receita de cada um (Garantia / Benefícios / Demais Ramos).
  const quandoBR = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const { fetchEscopoReceita } = await import('@/lib/emails/escopo-times')

  const { canaisVisiveis } = await import('@/lib/receita-escopo')

  async function buildTemplateData(userId: string | null): Promise<Record<string, any>> {
    const escopoTimes = (await fetchEscopoReceita(supabase, userId)).times
    const permitidos = canaisVisiveis(escopoTimes)
    const filtraCanais = <T extends { canal: string }>(rows: T[]) =>
      permitidos.length === 0 ? rows : rows.filter((r) => permitidos.includes(r.canal))

    const [ytdRes, mtdRes, vencidoRes, canaisRes, canaisMesRes] = await Promise.all([
      supabase.rpc('rpc_lavoro_receita_kpis' as never, { p_ano: ano, p_mes: mes, p_periodo: 'YTD', p_user_id: userId } as never),
      supabase.rpc('rpc_lavoro_receita_kpis' as never, { p_ano: ano, p_mes: mes, p_periodo: 'MTD', p_user_id: userId } as never),
      supabase.rpc('rpc_receita_executivo_mensal' as never, { p_ano: ano, p_user_id: userId } as never),
      supabase.rpc('rpc_receita_executivo_canais' as never, { p_ano: ano, p_mes: mes, p_user_id: userId } as never),
      supabase.rpc('rpc_receita_executivo_canais_mes' as never, { p_ano: ano, p_mes: mes, p_user_id: userId } as never),
    ])
    const canais = filtraCanais((((canaisRes.data as unknown) as any[]) ?? []) as Array<{
      canal: string; caixa_corrente: number; a_receber_futuro: number
      emitido: number; caixa_esperado: number; saldo_vencido: number
    }>)
    const mesDetalheCanais = filtraCanais((((canaisMesRes.data as unknown) as any[]) ?? []) as Array<{
      canal: string; emitido: number; caixa_esperado: number; caixa_recebido: number; saldo_vencido: number
    }>)
    const ytdKpis = ((ytdRes.data as unknown) as any[])?.[0] ?? null
    const mtd = ((mtdRes.data as unknown) as any[])?.[0] ?? null
    const linhasMensais = (((vencidoRes.data as unknown) as any[]) ?? []) as Array<{
      mes: number; emitido: number; caixa: number; caixa_corrente: number
      saldo_vencido: number; a_receber_futuro: number | null
    }>
    const linhaMes = linhasMensais.find((r) => Number(r.mes) === mes)
    const comissaoVencidaMes = Number(linhaMes?.saldo_vencido ?? 0)

    if (modulo === 'executivo_lavoro') {
      const ytdLinhas = linhasMensais.filter((r) => Number(r.mes) <= mes)
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
      return { ano, mes, quandoBR, escopoTimes, ytd: { emitido, caixaEsperado, caixaRecebido, aReceberFuturo, pctCaixa }, canais, mesDetalhe, mesDetalheCanais }
    }
    return { ano, mes, quandoBR, escopoTimes, ytd: ytdKpis, mtd, comissaoVencidaMes }
  }


  const cache = new Map<string, Record<string, any>>()

  const templateName = TEMPLATE_BY_MODULO[modulo]
  const periodo_ref = `${ano}-${String(mes).padStart(2, '0')}`
  // Chave de idempotência precisa incluir o DIA — caso contrário a API
  // trata envios do mesmo mês como duplicata e responde ok sem entregar.
  const hojeISO = new Date().toISOString().slice(0, 10)

  const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
  let enviados = 0
  let falhas = 0
  const detalhes: any[] = []
  for (const { email: to, user_id: uid } of destinatarios) {
    try {
      const escopoDest = await fetchEscopoReceita(supabase, uid ?? null)
      if (escopoDest.semAcesso) {
        detalhes.push({ to, ok: false, reason: 'sem_acesso_receita' })
        continue
      }
      const cacheKey = uid ?? '__all__'

      let templateData = cache.get(cacheKey)
      if (!templateData) {
        templateData = await buildTemplateData(uid ?? null)
        cache.set(cacheKey, templateData)
      }
      const r = await sendTemplateEmail(templateName, to, {
        templateData,
        idempotencyKey: `${modulo}-${idempotencyPrefix}-${hojeISO}-${to}`,
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

  const status = falhas === 0 ? 'concluido' : enviados === 0 ? 'falha_total' : 'falha_parcial'
  await supabase
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
}
