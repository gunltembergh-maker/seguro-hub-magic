import { Fragment, useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import { useMeuPerfil, hasRole } from '@/hooks/use-meu-perfil'
import { dispararNewsletterManual } from '@/lib/emails/send-newsletter-manual.functions'
import { AdicionarDestinatarioModal } from '@/components/email/AdicionarDestinatarioModal'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Send, Trash2, UserPlus, Loader2, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronDown, ChevronRight, ShieldAlert, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";

export const Route = createFileRoute('/_authenticated/admin/emails_/schedules')({
  component: ProtegidoSchedulesPage,
})

const MODULOS: Array<{ key: 'receita_lavoro' | 'executivo_lavoro' | 'fechamento_lavoro'; label: string }> = [
  { key: 'receita_lavoro', label: 'Newsletter Receita' },
  { key: 'executivo_lavoro', label: 'Report Executivo' },
  { key: 'fechamento_lavoro', label: 'Report Fechamento' },
]

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtData(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    concluido: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
    falha_parcial: { label: 'Falha parcial', cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: AlertTriangle },
    falha_total: { label: 'Falha total', cls: 'bg-red-100 text-red-700 border-red-200', Icon: XCircle },
    falha: { label: 'Falha', cls: 'bg-red-100 text-red-700 border-red-200', Icon: XCircle },
    em_processamento: { label: 'Em processamento', cls: 'bg-blue-100 text-blue-700 border-blue-200', Icon: Clock },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200', Icon: Clock }
  const { Icon } = cfg
  return (
    <Badge variant="outline" className={`${cfg.cls} gap-1 font-medium`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  )
}

function formatDateBR(d: Date) {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return `${dias[d.getDay()]}, ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} BRT`
}

function SchedulesPage() {
  const { data: perfil } = useMeuPerfil()
  const isAdmin = hasRole(perfil, 'ADMIN')

  const [modulo, setModulo] = useState<typeof MODULOS[number]['key']>(MODULOS[0].key)
  const moduloLabel = MODULOS.find((m) => m.key === modulo)?.label ?? modulo

  const [pauseOpen, setPauseOpen] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('')
  const [addDestOpen, setAddDestOpen] = useState(false)
  const [removerDestId, setRemoverDestId] = useState<string | null>(null)
  const [disparando, setDisparando] = useState(false)
  const [historicoExpandido, setHistoricoExpandido] = useState<string | null>(null)

  // Edição de schedule
  const [horaEdit, setHoraEdit] = useState<string>('08:30')
  const [diasEdit, setDiasEdit] = useState<number[]>([1, 2, 3, 4, 5])
  const [ativoEdit, setAtivoEdit] = useState<boolean>(true)
  const [salvando, setSalvando] = useState(false)

  const qc = useQueryClient()
  const dispararManual = useServerFn(dispararNewsletterManual)

  const { data: config } = useQuery({
    queryKey: ['email-schedule-config', modulo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_schedules_config' as never)
        .select('*')
        .eq('modulo', modulo)
        .maybeSingle()
      if (error) throw error
      return data as any
    },
    enabled: isAdmin,
  })

  useEffect(() => {
    if (!config) return
    setHoraEdit(String(config.hora_brt ?? '08:30:00').slice(0, 5))
    setDiasEdit((config.dias_semana as number[]) ?? [1, 2, 3, 4, 5])
    setAtivoEdit(!!config.ativo)
  }, [config])

  const { data: proxExec, refetch: refetchProx } = useQuery({
    queryKey: ['email-proxima-execucao', modulo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_proxima_execucao_schedule' as never, { p_modulo: modulo } as never)
      if (error) throw error
      return data as unknown as string | null
    },
    enabled: isAdmin,
  })
  const proximaExecucao = proxExec ? new Date(proxExec) : null

  const { data: destinatarios = [], refetch: refetchDest } = useQuery({
    queryKey: ['email-destinatarios', modulo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_listar_destinatarios_automaticos' as never, { p_modulo: modulo } as never)
      if (error) throw error
      return (data ?? []) as any[]
    },
    enabled: isAdmin,
  })

  const { data: historico = [], refetch: refetchHist } = useQuery({
    queryKey: ['email-historico', modulo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_historico_disparos' as never, { p_modulo: modulo, p_limit: 30 } as never)
      if (error) throw error
      return (data ?? []) as any[]
    },
    enabled: isAdmin,
  })

  const ultimoDisparo = historico[0]
  const jaCadastradosSet = useMemo(
    () => new Set(destinatarios.map((d: any) => d.user_id)),
    [destinatarios]
  )

  const horaConfig = String(config?.hora_brt ?? '08:30:00').slice(0, 5)
  const diasConfig = (config?.dias_semana as number[] | undefined) ?? []
  const alterado =
    horaEdit !== horaConfig ||
    JSON.stringify([...diasEdit].sort()) !== JSON.stringify([...diasConfig].sort()) ||
    ativoEdit !== !!config?.ativo

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    )
  }

  const handleTogglePausar = async () => {
    if (config?.ativo) {
      setMotivoPausa('')
      setPauseOpen(true)
      return
    }
    const { error } = await supabase.rpc('rpc_toggle_schedule' as never, { p_modulo: modulo, p_motivo: null } as never)
    if (error) { toast.error(error.message); return }
    toast.success('Agendamento reativado')
    qc.invalidateQueries({ queryKey: ['email-schedule-config', modulo] })
  }

  const confirmarPausa = async () => {
    const { error } = await supabase.rpc('rpc_toggle_schedule' as never, { p_modulo: modulo, p_motivo: motivoPausa || null } as never)
    if (error) { toast.error(error.message); return }
    toast.success('Agendamento pausado')
    setPauseOpen(false)
    qc.invalidateQueries({ queryKey: ['email-schedule-config', modulo] })
  }

  const handleDisparar = async () => {
    setDisparando(true)
    try {
      const hoje = new Date()
      const res = await dispararManual({ data: {
        modulo,
        ano: hoje.getFullYear(),
        mes: hoje.getMonth() + 1,
      } })
      if (!res.ok) {
        toast.warning(`Nenhum e-mail enviado`, { description: (res as any).motivo ?? 'Sem destinatários' })
      } else {
        toast.success(`Disparo concluído — ${res.enviados}/${res.total} sucesso(s)`, {
          description: res.falhas > 0 ? `${res.falhas} falha(s)` : undefined,
        })
      }
      await Promise.all([refetchHist(), refetchDest()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao disparar')
    } finally {
      setDisparando(false)
    }
  }

  const handleRemover = async () => {
    if (!removerDestId) return
    const { error } = await supabase.rpc('rpc_remover_destinatario_automatico' as never, { p_id: removerDestId } as never)
    if (error) { toast.error(error.message); return }
    toast.success('Destinatário removido')
    setRemoverDestId(null)
    refetchDest()
  }

  const handleSalvar = async () => {
    if (diasEdit.length === 0) { toast.error('Selecione ao menos um dia da semana'); return }
    setSalvando(true)
    try {
      const { error } = await supabase.rpc('rpc_atualizar_schedule_config' as never, {
        p_modulo: modulo,
        p_hora_brt: `${horaEdit}:00`,
        p_dias_semana: diasEdit,
        p_ativo: ativoEdit,
      } as never)
      if (error) throw error
      toast.success('Agendamento atualizado')
      await qc.invalidateQueries({ queryKey: ['email-schedule-config', modulo] })
      await refetchProx()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/admin/emails"><ArrowLeft className="w-4 h-4" /> Admin</Link>
        </Button>
      </div>

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Agendamentos de E-mail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle os disparos automáticos das newsletters do Hub Lavoro.
        </p>
      </header>

      {/* Seletor de módulo */}
      <div className="flex gap-2 flex-wrap">
        {MODULOS.map((m) => (
          <button
            key={m.key}
            onClick={() => setModulo(m.key)}
            className={`px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${
              modulo === m.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Card de configuração do schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{moduloLabel}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Disparo automático diário</p>
          </div>
          <Badge
            variant="outline"
            className={ativoEdit
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-gray-100 text-gray-700 border-gray-200'}
          >
            {ativoEdit ? '✅ Ativo' : '⏸ Pausado'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Horário (BRT)</Label>
            <Input
              type="time"
              value={horaEdit}
              onChange={(e) => setHoraEdit(e.target.value)}
              className="w-32 mt-1"
            />
          </div>

          <div>
            <Label>Dias da semana</Label>
            <div className="flex gap-4 mt-2">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((nome, idx) => (
                <label key={idx} className="flex flex-col items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={diasEdit.includes(idx)}
                    onCheckedChange={(checked) => {
                      setDiasEdit(
                        checked
                          ? [...diasEdit, idx].sort((a, b) => a - b)
                          : diasEdit.filter((d) => d !== idx)
                      )
                    }}
                  />
                  <span className="text-xs">{nome}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={ativoEdit} onCheckedChange={setAtivoEdit} />
            <span className="text-sm">{ativoEdit ? 'Ativo' : 'Pausado'}</span>
          </div>

          {proximaExecucao && ativoEdit && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
              Próxima execução: <strong>{formatDateBR(proximaExecucao)}</strong>
            </div>
          )}

          <div className="rounded-md border p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Último envio</p>
            <p className="font-medium mt-1">
              {ultimoDisparo ? fmtDataHora(ultimoDisparo.disparado_em) : 'Nenhum disparo registrado'}
            </p>
            {ultimoDisparo && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <StatusBadge status={ultimoDisparo.status} />
                <span className="text-muted-foreground">
                  {ultimoDisparo.total_sucessos}/{ultimoDisparo.total_destinatarios} sucesso(s), {ultimoDisparo.total_falhas} falha(s)
                </span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground border-l-2 border-amber-300 pl-3">
            ℹ️ Mesmo nos dias selecionados, o disparo é cancelado em feriados nacionais.
          </div>

          <div className="flex flex-wrap gap-2 justify-between pt-2 border-t">
            <Button
              onClick={handleDisparar}
              disabled={disparando}
              variant="outline"
              className="gap-2"
            >
              {disparando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {disparando ? 'Disparando...' : 'Disparar agora'}
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={!alterado || salvando}
              className="gap-2"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Destinatários */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Destinatários ({destinatarios.length})</CardTitle>
          <Button onClick={() => setAddDestOpen(true)} size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {destinatarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum destinatário cadastrado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {destinatarios.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{d.email}</TableCell>
                    <TableCell>
                      {d.role && (
                        <Badge variant="outline" className="text-[10px]">{d.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDataHora(d.criado_em)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoverDestId(d.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico (últimos 30 disparos)</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem disparos registrados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Data</TableHead>
                  <TableHead>Disparado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h: any) => {
                  const exp = historicoExpandido === h.id
                  const temErros = h.detalhes_erro && (
                    Array.isArray(h.detalhes_erro)
                      ? h.detalhes_erro.length > 0
                      : Object.keys(h.detalhes_erro).length > 0
                  )
                  return (
                    <Fragment key={h.id}>
                      <TableRow
                        className={temErros ? 'cursor-pointer' : ''}
                        onClick={() => temErros && setHistoricoExpandido(exp ? null : h.id)}
                      >
                        <TableCell>
                          {temErros && (exp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        </TableCell>
                        <TableCell className="font-medium">{fmtData(h.data_envio)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDataHora(h.disparado_em)}</TableCell>
                        <TableCell><StatusBadge status={h.status} /></TableCell>
                        <TableCell className="text-xs">
                          {h.total_sucessos}/{h.total_destinatarios} sucesso(s), {h.total_falhas} falha(s)
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.forcado_por_nome ? (
                            <Badge variant="outline" className="text-[10px]">Manual · {h.forcado_por_nome}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-blue-50">Automático</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {exp && temErros && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-red-50">
                            <pre className="text-xs whitespace-pre-wrap text-red-700 p-2">
                              {JSON.stringify(h.detalhes_erro, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal pausar */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Enquanto pausado, nenhum e-mail será enviado automaticamente. Você ainda pode disparar manualmente.
            </p>
            <Textarea
              placeholder="Motivo (opcional)"
              value={motivoPausa}
              onChange={(e) => setMotivoPausa(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarPausa}>Confirmar pausa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar destinatário */}
      <AdicionarDestinatarioModal
        open={addDestOpen}
        modulo={modulo}
        jaCadastrados={jaCadastradosSet as Set<string>}
        onClose={() => setAddDestOpen(false)}
        onAdicionado={() => refetchDest()}
      />

      {/* Confirmar remoção */}
      <AlertDialog open={!!removerDestId} onOpenChange={(v) => !v && setRemoverDestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover destinatário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário deixará de receber a newsletter automática. Você pode adicioná-lo novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ProtegidoSchedulesPage() {
  return (
    <SuperAdminGate area="emails_schedules" titulo="O Agendamento de e-mails">
      <SchedulesPage />
    </SuperAdminGate>
  );
}
