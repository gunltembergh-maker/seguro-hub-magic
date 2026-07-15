import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const InputSchema = z.object({
  to: z.string().email('Email inválido'),
  nome: z.string().max(120).optional(),
})

export const sendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is ADMIN using their own RLS-scoped client
    const { data: isAdmin, error: roleError } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'ADMIN',
    })
    if (roleError) throw new Error(roleError.message)
    if (!isAdmin) throw new Error('Apenas administradores podem disparar emails de teste.')

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')

    const quandoBR = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const disparadoPor = (context.claims?.email as string | undefined) ?? context.userId

    try {
      const result = await sendTemplateEmail('teste', data.to, {
        templateData: {
          nome: data.nome,
          disparadoPor,
          quandoBR,
        },
        idempotencyKey: `teste-${context.userId}-${Date.now()}`,
      })

      if (!result.sent) {
        return {
          ok: false,
          reason: result.reason,
          message:
            'O destinatário está bloqueado por um bounce, reclamação ou descadastro anterior.',
        }
      }
      return { ok: true, to: data.to, quandoBR }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const code = (error as any)?.code as string | undefined
      const status = (error as any)?.status as number | undefined
      return { ok: false, message, code, status }
    }
  })
