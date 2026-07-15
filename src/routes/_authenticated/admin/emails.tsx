import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Loader2, Mail, Send, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useMeuPerfil, hasRole } from '@/hooks/use-meu-perfil'
import { sendTestEmail } from '@/lib/emails/send-test-email.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_authenticated/admin/emails')({
  component: AdminEmailsPage,
})

type Resultado =
  | { ok: true; to: string; quandoBR: string }
  | { ok: false; message?: string; reason?: string; code?: string; status?: number }

function AdminEmailsPage() {
  const { data: perfil } = useMeuPerfil()
  const isAdmin = hasRole(perfil, 'ADMIN')

  const [to, setTo] = useState(perfil?.email ?? '')
  const [nome, setNome] = useState(perfil?.full_name?.split(' ')[0] ?? '')
  const [ultimo, setUltimo] = useState<Resultado | null>(null)

  const sendFn = useServerFn(sendTestEmail)
  const mut = useMutation({
    mutationFn: async () =>
      (await sendFn({ data: { to: to.trim(), nome: nome.trim() || undefined } })) as Resultado,
    onSuccess: (res) => {
      setUltimo(res)
      if (res.ok) {
        toast.success('Email enviado', { description: `Para ${res.to}` })
      } else {
        toast.error('Falha ao enviar', { description: res.message ?? res.reason ?? 'Erro' })
      }
    },
    onError: (e: Error) => {
      const r: Resultado = { ok: false, message: e.message }
      setUltimo(r)
      toast.error('Falha ao enviar', { description: e.message })
    },
  })

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administradores podem gerenciar emails.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envia emails de teste para validar a entrega pelo domínio{' '}
          <span className="font-medium">notify.hub.lavoroseguros.com.br</span>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" /> Enviar email de teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="to">Destinatário</Label>
              <Input
                id="to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="voce@lavoroseguros.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome (opcional)</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João"
              />
            </div>
          </div>

          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !to.trim()}
            className="gap-2"
          >
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar teste
          </Button>

          {ultimo && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                ultimo.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {ultimo.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="space-y-1">
                {ultimo.ok ? (
                  <>
                    <p className="font-medium">Enviado com sucesso</p>
                    <p className="text-xs opacity-80">
                      Para <span className="font-mono">{ultimo.to}</span> às {ultimo.quandoBR}.
                    </p>
                    <p className="text-xs opacity-80">
                      Confirme na caixa de entrada. Enquanto o DNS ainda está verificando, a
                      entrega pode falhar silenciosamente — verifique também em Cloud → Emails.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Falha no envio</p>
                    <p className="text-xs opacity-80">
                      {ultimo.message ?? ultimo.reason ?? 'Erro desconhecido'}
                      {ultimo.code ? ` (código: ${ultimo.code})` : ''}
                      {ultimo.status ? ` — HTTP ${ultimo.status}` : ''}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Remetente: <span className="font-mono">noreply@hub.lavoroseguros.com.br</span> ·
            Enquanto o domínio estiver em verificação DNS, alguns provedores podem rejeitar. Uma
            vez ativo, os reports automáticos usam a mesma infraestrutura.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
