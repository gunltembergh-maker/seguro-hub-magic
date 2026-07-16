import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Clock, Loader2, ShieldAlert, Save } from 'lucide-react'
import { toast } from 'sonner'

import { useMeuPerfil, hasRole } from '@/hooks/use-meu-perfil'
import { listarSchedules, salvarSchedule } from '@/lib/admin-emails.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_authenticated/admin/emails/schedules')({
  component: SchedulesPage,
})

const MODULO_LABEL: Record<string, string> = {
  receita_lavoro: 'Receita',
  executivo_lavoro: 'Executivo',
  fechamento_lavoro: 'Fechamento',
}

function SchedulesPage() {
  const { data: perfil } = useMeuPerfil()
  const isAdmin = hasRole(perfil, 'ADMIN')
  const qc = useQueryClient()
  const listar = useServerFn(listarSchedules)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['email-schedules'],
    queryFn: () => listar(),
    enabled: isAdmin,
  })

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Agendamento de Newsletters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina frequência e horário (BRT) de cada disparo automático.
          </p>
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 inline-block">
            ⚠️ A ativação do cron (pg_cron) será feita na próxima fase. Por ora, use o disparo manual em <a href="/admin/emails" className="underline">Emails</a>.
          </p>
        </div>
        <a href="/admin/emails" className="text-sm text-primary underline underline-offset-4">
          ← Voltar
        </a>
      </header>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Carregando…</div>
      ) : (
        <div className="grid gap-4">
          {(rows as any[]).map((s) => (
            <ScheduleCard key={s.modulo} inicial={s} onSaved={() => qc.invalidateQueries({ queryKey: ['email-schedules'] })} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleCard({ inicial, onSaved }: { inicial: any; onSaved: () => void }) {
  const salvar = useServerFn(salvarSchedule)
  const [ativo, setAtivo] = useState<boolean>(!!inicial.ativo)
  const [frequencia, setFrequencia] = useState<string>(inicial.frequencia ?? 'diario')
  const [horario, setHorario] = useState<string>(String(inicial.horario_brt ?? '08:00').slice(0, 5))
  const [diaSemana, setDiaSemana] = useState<number | null>(inicial.dia_semana ?? null)
  const [diaMes, setDiaMes] = useState<number | null>(inicial.dia_mes ?? null)

  useEffect(() => {
    setAtivo(!!inicial.ativo)
    setFrequencia(inicial.frequencia ?? 'diario')
    setHorario(String(inicial.horario_brt ?? '08:00').slice(0, 5))
    setDiaSemana(inicial.dia_semana ?? null)
    setDiaMes(inicial.dia_mes ?? null)
  }, [inicial])

  const mut = useMutation({
    mutationFn: async () =>
      salvar({ data: {
        modulo: inicial.modulo,
        ativo, frequencia: frequencia as any,
        horario_brt: horario.length === 5 ? `${horario}:00` : horario,
        dia_semana: frequencia === 'semanal' ? diaSemana : null,
        dia_mes: frequencia === 'mensal' ? diaMes : null,
      } }),
    onSuccess: () => { toast.success('Agendamento salvo'); onSaved() },
    onError: (e: Error) => toast.error('Falha', { description: e.message }),
  })

  const podeSalvar = horario.length === 5

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {MODULO_LABEL[inicial.modulo] ?? inicial.modulo}
          </span>
          <div className="flex items-center gap-2 text-sm font-normal">
            <span className="text-muted-foreground">{ativo ? 'Ativo' : 'Pausado'}</span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4 items-end">
        <div className="space-y-1">
          <Label>Frequência</Label>
          <Select value={frequencia} onValueChange={setFrequencia}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diária (dias úteis)</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Horário (BRT)</Label>
          <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </div>

        {frequencia === 'semanal' && (
          <div className="space-y-1">
            <Label>Dia da semana</Label>
            <Select value={String(diaSemana ?? 1)} onValueChange={(v) => setDiaSemana(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {frequencia === 'mensal' && (
          <div className="space-y-1">
            <Label>Dia do mês</Label>
            <Input
              type="number" min={1} max={31}
              value={diaMes ?? ''}
              onChange={(e) => setDiaMes(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        )}

        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !podeSalvar}
          className="gap-2"
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  )
}
