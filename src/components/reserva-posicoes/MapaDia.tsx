import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarIcon, ChevronLeft, ChevronRight, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFeriados, useRpGradeDia, useRpParametros } from "@/hooks/use-reserva-posicoes";
import {
  dataBR,
  hhmm,
  isoDeData,
  mensagemErro,
  opcoesHorario,
  primeiroNome,
  type RpPosicaoGrade,
  type RpReservaRetorno,
} from "@/lib/rp/rp-tipos";
import { enviarEmailReserva } from "@/lib/rp/rp-email.functions";
import { PlantaEscritorio, LegendaPlanta, estadoDaPosicao } from "./PlantaEscritorio";
import { ComoFunciona } from "./ComoFunciona";

function PosicaoCard({
  pos,
  onSelecionar,
}: {
  pos: RpPosicaoGrade;
  onSelecionar: (pos: RpPosicaoGrade) => void;
}) {
  const indisponivel = !pos.ativa || pos.fixa;
  const temMinha = pos.reservas.some((r) => r.minha && r.status !== "cancelada");
  const ativas = pos.reservas.filter((r) => r.status !== "cancelada");

  return (
    <button
      type="button"
      disabled={indisponivel}
      onClick={() => onSelecionar(pos)}
      className={cn(
        "flex min-h-[132px] flex-col rounded-xl border p-3 text-left transition",
        indisponivel
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
          : "cursor-pointer border-slate-200 bg-white hover:border-[#00BAF2] hover:shadow-md",
        temMinha && "border-[#00BAF2] bg-[#EEF9FF] ring-2 ring-[#00BAF2]/40",
        !indisponivel && ativas.length === 0 && "border-emerald-200 bg-emerald-50/60",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl font-bold text-[#14405C]">{pos.numero}</span>
        {pos.fixa && <Lock className="h-4 w-4 text-slate-500" />}
      </div>
      {pos.apelido && <span className="text-xs text-slate-600">{pos.apelido}</span>}

      <div className="mt-2 space-y-1 text-[11px] leading-tight">
        {!pos.ativa && <span className="text-slate-500">Posição inativa</span>}
        {pos.ativa && pos.fixa && (
          <span className="text-slate-600">
            Fixa{pos.fixa_nome ? ` · ${primeiroNome(pos.fixa_nome)}` : ""}
          </span>
        )}
        {pos.ativa && !pos.fixa && ativas.length === 0 && (
          <span className="text-emerald-700">Livre o dia todo</span>
        )}
        {pos.ativa &&
          !pos.fixa &&
          ativas.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded bg-slate-100 px-1.5 py-0.5",
                r.minha && "bg-[#00BAF2]/20 font-medium text-[#14405C]",
              )}
            >
              <span>
                {hhmm(r.hora_inicio)}–{hhmm(r.hora_fim)}
              </span>
              <span className="truncate">{r.minha ? "Você" : primeiroNome(r.nome)}</span>
            </div>
          ))}
      </div>
    </button>
  );
}

export function MapaDia() {
  const qc = useQueryClient();
  const [dia, setDia] = useState<Date>(new Date());
  const dataIso = isoDeData(dia);

  const { data: params } = useRpParametros();
  const { data: feriados } = useFeriados();
  const { data: grade, isLoading } = useRpGradeDia(dataIso);

  const [posSel, setPosSel] = useState<RpPosicaoGrade | null>(null);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("18:00");
  const [salvando, setSalvando] = useState(false);

  const horarios = useMemo(
    () =>
      opcoesHorario(
        params?.rp_horario_funcionamento?.inicio ?? "07:00",
        params?.rp_horario_funcionamento?.fim ?? "20:00",
      ),
    [params],
  );

  const limite = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (params?.rp_janela_antecedencia_dias ?? 30));
    return d;
  }, [params]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diaBloqueado = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    if (dd < hoje || dd > limite) return true;
    if (dd.getDay() === 0 || dd.getDay() === 6) return true;
    return feriados?.has(isoDeData(dd)) ?? false;
  };

  const navegar = (delta: number) => {
    const d = new Date(dia);
    d.setDate(d.getDate() + delta);
    setDia(d);
  };

  const livres = (grade ?? []).filter((p) => {
    const e = estadoDaPosicao(p);
    return e === "livre" || e === "parcial" || e === "minha";
  }).length;

  const abrirModal = (pos: RpPosicaoGrade) => {
    setPosSel(pos);
    setInicio("09:00");
    setFim("18:00");
  };

  const confirmar = async () => {
    if (!posSel) return;
    if (fim <= inicio) {
      toast.error("A hora de término deve ser maior que a de início.");
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("rpc_rp_criar_reserva", {
        p_posicao_id: posSel.id,
        p_data: dataIso,
        p_hora_inicio: `${inicio}:00`,
        p_hora_fim: `${fim}:00`,
      });
      if (error) throw error;
      const reserva = data as unknown as RpReservaRetorno;

      setPosSel(null);
      await qc.invalidateQueries({ queryKey: ["rp-grade-dia"] });
      await qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
      toast.success(
        `Posição ${reserva.posicao_numero} reservada para ${dataBR(reserva.data)}, das ${hhmm(reserva.hora_inicio)} às ${hhmm(reserva.hora_fim)}.`,
      );

      enviarEmailReserva({ data: { tipo: "confirmacao", reserva } }).catch((e) =>
        console.error("[rp] e-mail de confirmação falhou", e),
      );
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Button variant="outline" size="icon" onClick={() => navegar(-1)} aria-label="Dia anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[190px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataBR(dataIso)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dia}
              onSelect={(d) => d && setDia(d)}
              disabled={diaBloqueado}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => navegar(1)} aria-label="Próximo dia">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={() => setDia(new Date())}>
          Hoje
        </Button>
        {diaBloqueado(dia) && (
          <span className="text-sm text-amber-700">
            Data indisponível para reserva (fim de semana, feriado ou fora da janela).
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando o mapa do dia…
        </div>
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
            <PlantaEscritorio posicoes={grade ?? []} onSelecionar={abrirModal} />
            <LegendaPlanta />
          </div>
          <div className="h-full">
            <ComoFunciona params={params} livres={livres} total={(grade ?? []).length || 9} />
          </div>
        </div>
      )}

      <Dialog open={!!posSel} onOpenChange={(o) => !o && setPosSel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reservar posição {posSel?.numero}</DialogTitle>
            <DialogDescription>
              {posSel?.apelido ? `${posSel.apelido} · ` : ""}
              {dataBR(dataIso)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Hora de início</Label>
              <Select value={inicio} onValueChange={setInicio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {horarios.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hora de término</Label>
              <Select value={fim} onValueChange={setFim}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {horarios.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPosSel(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
