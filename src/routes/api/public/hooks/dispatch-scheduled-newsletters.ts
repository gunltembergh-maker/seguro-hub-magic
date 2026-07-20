// Hook chamado pelo pg_cron a cada minuto. Verifica quais schedules devem
// disparar agora (BRT) e, respeitando o índice único diário automático,
// executa o envio das newsletters devidas.
//
// Autenticação: cabeçalho `apikey` deve ser igual ao SUPABASE_PUBLISHABLE_KEY.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/dispatch-scheduled-newsletters')({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request), // permite ping manual pelo browser (com apikey)
    },
  },
})

type Modulo = 'receita_lavoro' | 'executivo_lavoro' | 'fechamento_lavoro'

async function handle(request: Request): Promise<Response> {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!expected) return json({ error: 'server_misconfigured' }, 500)
  const provided = request.headers.get('apikey') || request.headers.get('x-apikey')
  if (provided !== expected) return json({ error: 'unauthorized' }, 401)

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  // Hora atual em BRT (America/Sao_Paulo)
  const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hh = String(nowBRT.getHours()).padStart(2, '0')
  const mm = String(nowBRT.getMinutes()).padStart(2, '0')
  const currentHM = `${hh}:${mm}`
  const currentDow = nowBRT.getDay() // 0=Dom .. 6=Sab
  const yyyy = nowBRT.getFullYear()
  const mmNum = nowBRT.getMonth() + 1
  const ddNum = String(nowBRT.getDate()).padStart(2, '0')
  const hojeISO = `${yyyy}-${String(mmNum).padStart(2, '0')}-${ddNum}`

  // Schedules ativos e não pausados
  const { data: schedules, error: schedErr } = await supabaseAdmin
    .from('email_schedules_config' as never)
    .select('modulo,ativo,hora_brt,dias_semana,pausado_por' as never)
  if (schedErr) return json({ error: schedErr.message }, 500)

  const results: any[] = []
  for (const raw of (schedules ?? []) as any[]) {
    const modulo = raw.modulo as Modulo
    if (!raw.ativo || raw.pausado_por) {
      results.push({ modulo, skipped: 'inativo_ou_pausado' })
      continue
    }
    const scheduledHM = String(raw.hora_brt).slice(0, 5) // "HH:MM:SS" -> "HH:MM"
    const dias = (raw.dias_semana ?? []) as number[]
    if (scheduledHM !== currentHM) {
      results.push({ modulo, skipped: `hora_diferente (${scheduledHM} vs ${currentHM})` })
      continue
    }
    if (!dias.includes(currentDow)) {
      results.push({ modulo, skipped: `dia_diferente (dow=${currentDow})` })
      continue
    }

    // Tenta reservar o disparo do dia (índice único bloqueia duplicatas automáticas)
    const { data: disparoIns, error: disparoErr } = await supabaseAdmin
      .from('email_disparos_automaticos' as never)
      .insert({
        modulo,
        data_envio: hojeISO,
        status: 'em_processamento',
        forcado_por: null,
        periodo_ref: `${yyyy}-${String(mmNum).padStart(2, '0')}`,
        total_destinatarios: 0,
      } as never)
      .select('id')
      .single()

    if (disparoErr) {
      // Já disparado hoje (conflito no índice único) — silencioso
      results.push({ modulo, skipped: 'ja_disparado_hoje', detail: disparoErr.message })
      continue
    }
    const disparoId = (disparoIns as any).id as string

    // Destinatários ativos + email do profile
    const { data: destRows, error: destErr } = await supabaseAdmin
      .from('email_destinatarios_automaticos' as never)
      .select('user_id,ativo' as never)
      .eq('modulo' as never, modulo as never)
      .eq('ativo' as never, true as never)
    if (destErr) {
      await supabaseAdmin
        .from('email_disparos_automaticos' as never)
        .update({ status: 'falha_total', finalizado_em: new Date().toISOString(), detalhes_erro: [{ error: destErr.message }] } as never)
        .eq('id', disparoId)
      results.push({ modulo, error: destErr.message })
      continue
    }

    const userIds = (destRows ?? []).map((r: any) => r.user_id as string)
    let destinatarios: Array<{ email: string }> = []
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles' as never)
        .select('user_id,email,active,blocked' as never)
        .in('user_id' as never, userIds as never)
      destinatarios = ((profs ?? []) as any[])
        .filter((p) => p.email && p.active !== false && !p.blocked)
        .map((p) => ({ email: String(p.email) }))
    }

    await supabaseAdmin
      .from('email_disparos_automaticos' as never)
      .update({ total_destinatarios: destinatarios.length } as never)
      .eq('id', disparoId)

    const { dispatchNewsletterCore } = await import('@/lib/emails/dispatch-newsletter.server')
    const r = await dispatchNewsletterCore({
      supabase: supabaseAdmin as any,
      modulo,
      ano: yyyy,
      mes: mmNum,
      disparoId,
      destinatarios,
      idempotencyPrefix: 'auto',
    })
    results.push({ modulo, ...r })
  }

  return json({ ok: true, at: nowBRT.toISOString(), currentHM, currentDow, results })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
