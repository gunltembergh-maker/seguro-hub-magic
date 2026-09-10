import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarIcon, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useFeriados,
  useRpGradeDia,
  useRpMinhasReservas,
  useRpParametros,
} from "@/hooks/use-reserva-posicoes";
import {
  dataBR,
  hhmm,
  isoDeData,
  mensagemErro,
  opcoesHorario,
  STATUS_CLASSE,
  STATUS_LABEL,
  type RpMinhaReserva,
  type RpReservaRetorno,
} from "@/lib/rp/rp-tipos";
import { enviarEmailReserva } from "@/lib/rp/rp-email.functions";
import { fazerCheckin } from "@/lib/rp/rp-checkin.functions";
import { processarAusencias } from "@/lib/rp/rp-ausencias.functions";
import { cancelarReservaComMotivo } from "@/lib/rp/rp-cancelar";


/** Converte a data da reserva (ISO ou DD/MM/AAAA) + hora em um Date local. */
const dataHoraLocal = (data: string, hora: string) => {
  const br = dataBR(data);
  const [dd, mm, aaaa] = br.split("/").map(Number);
  const [h, min] = hhmm(hora).split(":").map(Number);
  return new Date(aaaa ?? 0, (mm ?? 1) - 1, dd ?? 1, h ?? 0, min ?? 0, 0, 0);
};

/** Data ISO (AAAA-MM-DD) a partir do valor devolvido pela RPC. */
const isoDaReserva = (data: string) => {
  const br = dataBR(data);
  const [dd, mm, aaaa] = br.split("/");
  return aaaa && mm && dd ? `${aaaa}-${mm}-${dd}` : data;
};

/** Pode cancelar/alterar enquanto o horário de FIM não tiver passado. */
const podeMexer = (r: RpMinhaReserva) => {
  if (!["reservada", "confirmada"].includes(r.status)) return false;
  return dataHoraLocal(r.data, r.hora_fim).getTime() > Date.now();
};

export function MinhasReservas() {
  const qc = useQueryClient();
  const { data: reservas, isLoading } = useRpMinhasReservas();
  const { data: params } = useRpParametros();
  const { data: feriados } = useFeriados();

  const [alvo, setAlvo] = useState<RpMinhaReserva | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [checkinEm, setCheckinEm] = useState<string | null>(null);
  const hojeIso = isoDeData(new Date());

  // Motivos de cancelamento (quando o RH/Admin cancelou a reserva do colaborador).
  const { data: motivos } = useQuery({
    queryKey: ["rp-motivos-cancelamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rp_reservas")
        .select("id, cancelamento_motivo")
        .eq("status", "cancelada")
        .not("cancelamento_motivo", "is", null);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.id, r.cancelamento_motivo as string]));
    },
    staleTime: 60_000,
  });


  // Dispara o processamento de ausências ao abrir a tela (idempotente no servidor).
  useEffect(() => {
    processarAusencias()
      .then((r) => {
        if (r?.enviados) qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const antesMin = params?.rp_checkin_liberado_antes_min ?? 30;
  const toleranciaMin = params?.rp_tolerancia_checkin_min ?? 15;

  /** Janela de check-in: de X min antes do início até Y min após o início. */
  const janelaCheckin = (r: RpMinhaReserva) => {
    const inicio = dataHoraLocal(r.data, r.hora_inicio).getTime();
    const agora = Date.now();
    if (agora < inicio - antesMin * 60_000)
      return {
        aberta: false,
        motivo: `O check-in abre ${antesMin} minutos antes do início da reserva.`,
      };
    if (agora > inicio + toleranciaMin * 60_000)
      return {
        aberta: false,
        motivo: `O prazo de check-in (${toleranciaMin} minutos após o início) já passou.`,
      };
    return { aberta: true, motivo: "Conecte-se ao Wi-Fi do escritório para confirmar sua presença." };
  };

  const fazerCheckinReserva = async (r: RpMinhaReserva) => {
    setCheckinEm(r.id);
    try {
      const res = await fazerCheckin({ data: { reserva_id: r.id } });
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
      await qc.invalidateQueries({ queryKey: ["rp-grade-dia"] });
      toast.success("Check-in confirmado, boa jornada!");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCheckinEm(null);
    }
  };

  // ---- alteração de reserva ----
  const [editando, setEditando] = useState<RpMinhaReserva | null>(null);
  const [dia, setDia] = useState<Date>(new Date());
  const [posicaoId, setPosicaoId] = useState<string>("");
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("18:00");
  const [salvando, setSalvando] = useState(false);
  const [antigaCancelada, setAntigaCancelada] = useState(false);

  const dataIsoEdit = isoDeData(dia);
  const { data: grade } = useRpGradeDia(dataIsoEdit);

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

  const diaBloqueado = (d: Date) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    if (dd < hoje || dd > limite) return true;
    if (dd.getDay() === 0 || dd.getDay() === 6) return true;
    return feriados?.has(isoDeData(dd)) ?? false;
  };

  const posicoesDisponiveis = (grade ?? []).filter((p) => p.ativa && !p.fixa);

  // Ao abrir o modal (ou trocar o dia) pré-seleciona a posição original quando existir.
  useEffect(() => {
    if (!editando || !posicoesDisponiveis.length) return;
    const existe = posicoesDisponiveis.some((p) => p.id === posicaoId);
    if (existe) return;
    const mesma = posicoesDisponiveis.find((p) => p.numero === editando.posicao_numero);
    setPosicaoId(mesma?.id ?? posicoesDisponiveis[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, grade]);

  const abrirAlterar = (r: RpMinhaReserva) => {
    const iso = isoDaReserva(r.data);
    const [aaaa, mm, dd] = iso.split("-").map(Number);
    setDia(new Date(aaaa ?? 0, (mm ?? 1) - 1, dd ?? 1));
    setPosicaoId("");
    setInicio(hhmm(r.hora_inicio));
    setFim(hhmm(r.hora_fim));
    setAntigaCancelada(false);
    setEditando(r);
  };

  const cancelar = async () => {
    if (!alvo) return;
    setCancelando(true);
    try {
      await cancelarReservaComMotivo(alvo.id);
      setAlvo(null);
      await qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
      await qc.invalidateQueries({ queryKey: ["rp-grade-dia"] });
      toast.success("Reserva cancelada.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCancelando(false);
    }
  };


  const confirmarAlteracao = async () => {
    if (!editando || !posicaoId) return;
    if (fim <= inicio) {
      toast.error("A hora de término deve ser maior que a de início.");
      return;
    }
    setSalvando(true);
    try {
      // 1) cancela a reserva antiga (sem e-mail de cancelamento nesta operação)
      if (!antigaCancelada) {
        const { error: errCancel } = await supabase.rpc("rpc_rp_cancelar_reserva", {
          p_reserva_id: editando.id,
        });
        if (errCancel) throw errCancel;
        setAntigaCancelada(true);
        await qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
        await qc.invalidateQueries({ queryKey: ["rp-grade-dia"] });
      }

      // 2) cria a nova reserva
      const { data, error } = await supabase.rpc("rpc_rp_criar_reserva", {
        p_posicao_id: posicaoId,
        p_data: dataIsoEdit,
        p_hora_inicio: `${inicio}:00`,
        p_hora_fim: `${fim}:00`,
      });
      if (error) throw error;
      const reserva = data as unknown as RpReservaRetorno;

      setEditando(null);
      setAntigaCancelada(false);
      await qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
      await qc.invalidateQueries({ queryKey: ["rp-grade-dia"] });
      toast.success(
        `Reserva alterada: posição ${reserva.posicao_numero} em ${dataBR(reserva.data)}, das ${hhmm(reserva.hora_inicio)} às ${hhmm(reserva.hora_fim)}.`,
      );

      // apenas a confirmação da nova reserva
      enviarEmailReserva({ data: { tipo: "confirmacao", reserva } }).catch((e) =>
        console.error("[rp] e-mail de confirmação falhou", e),
      );
    } catch (e) {
      toast.error(mensagemErro(e), {
        description: antigaCancelada
          ? "A reserva anterior já foi cancelada. Escolha outra posição ou outro horário para concluir."
          : undefined,
        duration: 8000,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando suas reservas…
        </div>
      ) : !reservas?.length ? (
        <p className="text-sm text-slate-600">Você ainda não tem reservas registradas.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Posição</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservas.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{dataBR(r.data)}</TableCell>
                <TableCell>
                  {r.posicao_numero}
                  {r.posicao_apelido ? ` · ${r.posicao_apelido}` : ""}
                </TableCell>
                <TableCell>
                  {hhmm(r.hora_inicio)} às {hhmm(r.hora_fim)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_CLASSE[r.status] ?? ""}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {isoDaReserva(r.data) === hojeIso && r.status === "reservada" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!janelaCheckin(r).aberta || checkinEm === r.id}
                                onClick={() => fazerCheckinReserva(r)}
                              >
                                {checkinEm === r.id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <QrCode className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Fazer check-in
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{janelaCheckin(r).motivo}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {podeMexer(r) && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => abrirAlterar(r)}>
                          Alterar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setAlvo(r)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              {alvo
                ? `Posição ${alvo.posicao_numero} em ${dataBR(alvo.data)}, das ${hhmm(alvo.hora_inicio)} às ${hhmm(alvo.hora_fim)}.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelar} disabled={cancelando}>
              {cancelando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!editando}
        onOpenChange={(o) => {
          if (!o) {
            setEditando(null);
            setAntigaCancelada(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar reserva</DialogTitle>
            <DialogDescription>
              {editando
                ? `Atual: posição ${editando.posicao_numero} em ${dataBR(editando.data)}, das ${hhmm(editando.hora_inicio)} às ${hhmm(editando.hora_fim)}.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {antigaCancelada && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              A reserva anterior já foi cancelada. Escolha uma posição e um horário disponíveis para
              concluir a alteração.
            </p>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataBR(dataIsoEdit)}
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
            </div>

            <div className="space-y-1.5">
              <Label>Posição</Label>
              <Select value={posicaoId} onValueChange={setPosicaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a posição" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {posicoesDisponiveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Posição {p.numero}
                      {p.apelido ? ` · ${p.apelido}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditando(null);
                setAntigaCancelada(false);
              }}
              disabled={salvando}
            >
              Fechar
            </Button>
            <Button onClick={confirmarAlteracao} disabled={salvando || !posicaoId}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
