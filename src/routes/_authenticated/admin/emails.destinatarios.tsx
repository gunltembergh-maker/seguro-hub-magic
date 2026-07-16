import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Loader2, Plus, Trash2, ShieldAlert, Users } from 'lucide-react'
import { toast } from 'sonner'

import { useMeuPerfil, hasRole } from '@/hooks/use-meu-perfil'
import {
  listarDestinatarios,
  upsertDestinatario,
  removerDestinatario,
} from '@/lib/admin-emails.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/admin/emails/destinatarios')({
  component: DestinatariosPage,
})

const MODULOS = [
  { key: 'receita_lavoro', label: 'Receita' },
  { key: 'executivo_lavoro', label: 'Executivo' },
  { key: 'fechamento_lavoro', label: 'Fechamento' },
] as const

type Modulo = (typeof MODULOS)[number]['key']

function DestinatariosPage() {
  const { data: perfil } = useMeuPerfil()
  const isAdmin = hasRole(perfil, 'ADMIN')

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Destinatários de Newsletters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie quem recebe cada disparo automático de e-mail.
          </p>
        </div>
        <a href="/admin/emails" className="text-sm text-primary underline underline-offset-4">
          ← Voltar
        </a>
      </header>

      <Tabs defaultValue="receita_lavoro">
        <TabsList>
          {MODULOS.map((m) => (
            <TabsTrigger key={m.key} value={m.key}>{m.label}</TabsTrigger>
          ))}
        </TabsList>
        {MODULOS.map((m) => (
          <TabsContent key={m.key} value={m.key} className="mt-4">
            <DestinatariosDoModulo modulo={m.key} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function DestinatariosDoModulo({ modulo }: { modulo: Modulo }) {
  const qc = useQueryClient()
  const listar = useServerFn(listarDestinatarios)
  const upsert = useServerFn(upsertDestinatario)
  const remover = useServerFn(removerDestinatario)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['email-dest', modulo],
    queryFn: () => listar({ data: { modulo } }),
  })

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')

  const mutAdd = useMutation({
    mutationFn: async () => upsert({ data: { modulo, nome, email, ativo: true } }),
    onSuccess: () => {
      toast.success('Destinatário adicionado')
      setNome(''); setEmail('')
      qc.invalidateQueries({ queryKey: ['email-dest', modulo] })
    },
    onError: (e: Error) => toast.error('Falha', { description: e.message }),
  })

  const mutToggle = useMutation({
    mutationFn: async (r: any) =>
      upsert({ data: { id: r.id, modulo, nome: r.nome, email: r.email, ativo: !r.ativo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-dest', modulo] }),
  })

  const mutDel = useMutation({
    mutationFn: async (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success('Destinatário removido')
      qc.invalidateQueries({ queryKey: ['email-dest', modulo] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" /> Destinatários ativos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@lavoroseguros.com.br" />
          </div>
          <Button
            onClick={() => mutAdd.mutate()}
            disabled={mutAdd.isPending || !nome.trim() || !email.trim()}
            className="gap-2"
          >
            {mutAdd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum destinatário cadastrado para este módulo.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-24">Ativo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell>
                    <Switch checked={r.ativo} onCheckedChange={() => mutToggle.mutate(r)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => mutDel.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
