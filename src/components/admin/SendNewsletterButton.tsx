import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

import { useMeuPerfil, hasRole } from '@/hooks/use-meu-perfil'
import { dispararNewsletterManual } from '@/lib/emails/send-newsletter-manual.functions'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

type Modulo = 'receita_lavoro' | 'executivo_lavoro' | 'fechamento_lavoro'

const MODULO_LABEL: Record<Modulo, string> = {
  receita_lavoro: 'Receita',
  executivo_lavoro: 'Executivo',
  fechamento_lavoro: 'Fechamento',
}

export function SendNewsletterButton({
  modulo, ano, mes, size = 'sm',
}: {
  modulo: Modulo
  ano: number
  mes: number
  size?: 'sm' | 'default'
}) {
  const { data: perfil } = useMeuPerfil()
  const isAdmin = hasRole(perfil, 'ADMIN')
  const [open, setOpen] = useState(false)
  const disparar = useServerFn(dispararNewsletterManual)

  const mut = useMutation({
    mutationFn: async () => disparar({ data: { modulo, ano, mes } }),
    onSuccess: (r: any) => {
      setOpen(false)
      if (!r.ok && r.motivo === 'sem_destinatarios') {
        toast.warning('Nenhum destinatário cadastrado', {
          description: 'Cadastre em Admin → Emails → Destinatários.',
        })
        return
      }
      const desc = `${r.enviados}/${r.total} enviados${r.falhas ? ` · ${r.falhas} falhas` : ''}`
      if (r.status === 'concluido') toast.success('Newsletter enviada', { description: desc })
      else if (r.status === 'falha_parcial') toast.warning('Envio parcial', { description: desc })
      else toast.error('Falha no envio', { description: desc })
    },
    onError: (e: Error) => toast.error('Falha', { description: e.message }),
  })

  if (!isAdmin) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline" className="gap-2">
          <Send className="h-4 w-4" />
          Enviar Newsletter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar {MODULO_LABEL[modulo]} agora</DialogTitle>
          <DialogDescription>
            Dispara o e-mail para todos os destinatários cadastrados e ativos para o módulo
            <b> {MODULO_LABEL[modulo]}</b>, com base no período {String(mes).padStart(2, '0')}/{ano}.
            Este disparo é registrado como <b>manual</b> e não é bloqueado por idempotência.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
