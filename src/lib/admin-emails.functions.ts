import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const ModuloEnum = z.enum(['receita_lavoro', 'executivo_lavoro', 'fechamento_lavoro'])
export type Modulo = z.infer<typeof ModuloEnum>

async function ensureAdmin(context: any) {
  const { data: isAdmin, error } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'ADMIN',
  })
  if (error) throw new Error(error.message)
  if (!isAdmin) throw new Error('Apenas administradores.')
}

// ────── Destinatários ──────
export const listarDestinatarios = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ modulo: ModuloEnum }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    const { data: rows, error } = await context.supabase
      .from('email_destinatarios_automaticos' as any)
      .select('*')
      .eq('modulo', data.modulo)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (rows ?? []) as any[]
  })

export const upsertDestinatario = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      modulo: ModuloEnum,
      nome: z.string().min(1),
      email: z.string().email(),
      ativo: z.boolean().default(true),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    if (data.id) {
      const { error } = await context.supabase
        .from('email_destinatarios_automaticos' as any)
        .update({ nome: data.nome, email: data.email, ativo: data.ativo })
        .eq('id', data.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await context.supabase
        .from('email_destinatarios_automaticos' as any)
        .insert({
          modulo: data.modulo,
          nome: data.nome,
          email: data.email,
          ativo: data.ativo,
          created_by: context.userId,
        })
      if (error) throw new Error(error.message)
    }
    return { ok: true }
  })

export const removerDestinatario = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    const { error } = await context.supabase
      .from('email_destinatarios_automaticos' as any)
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ────── Schedules ──────
export const listarSchedules = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context)
    const { data, error } = await context.supabase
      .from('email_schedules_config' as any)
      .select('*')
      .order('modulo')
    if (error) throw new Error(error.message)
    return (data ?? []) as any[]
  })

export const salvarSchedule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      modulo: ModuloEnum,
      ativo: z.boolean(),
      frequencia: z.enum(['diario', 'semanal', 'mensal']),
      horario_brt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      dia_semana: z.number().int().min(0).max(6).nullable().optional(),
      dia_mes: z.number().int().min(1).max(31).nullable().optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    const { error } = await context.supabase
      .from('email_schedules_config' as any)
      .update({
        ativo: data.ativo,
        frequencia: data.frequencia,
        horario_brt: data.horario_brt,
        dia_semana: data.dia_semana ?? null,
        dia_mes: data.dia_mes ?? null,
        updated_by: context.userId,
      })
      .eq('modulo', data.modulo)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ────── Disparos (histórico) ──────
export const listarDisparos = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      modulo: ModuloEnum.optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    let q = context.supabase
      .from('email_disparos_automaticos' as any)
      .select('*')
      .order('iniciado_em', { ascending: false })
      .limit(data.limit)
    if (data.modulo) q = q.eq('modulo', data.modulo)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return (rows ?? []) as any[]
  })
