import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useRpMinhasReservas } from "@/hooks/use-reserva-posicoes";
import {
  dataBR,
  hhmm,
  isoDeData,
  mensagemErro,
  STATUS_CLASSE,
  STATUS_LABEL,
  type RpMinhaReserva,
  type RpReservaRetorno,
} from "@/lib/rp/rp-tipos";
import { enviarEmailReserva } from "@/lib/rp/rp-email.functions";

const podeCancelar = (r: RpMinhaReserva) => {
  if (!["reservada", "confirmada"].includes(r.status)) return false;
  const inicio = new Date(`${r.data}T${hhmm(r.hora_inicio)}:00`);
  return inicio.getTime() > Date.now();
};

export function MinhasReservas() {
  const qc = useQueryClient();
  const { data: reservas, isLoading } = useRpMinhasReservas();
  const [alvo, setAlvo] = useState<RpMinhaReserva | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const hojeIso = isoDeData(new Date());

  const cancelar = async () => {
    if (!alvo) return;
    setCancelando(true);
    try {
      const { data, error } = await supabase.rpc("rpc_rp_cancelar_reserva", {
        p_reserva_id: alvo.id,
      });
      if (error) throw error;
      const reserva = data as unknown as RpReservaRetorno;

      setAlvo(null);
      await qc.invalidateQueries({ queryKey: ["rp-minhas-reservas"] });
      await qc.invalidateQueries({ queryKey: ["rp-grade-dia"] });
      toast.success("Reserva cancelada.");

      enviarEmailReserva({ data: { tipo: "cancelamento", reserva } }).catch((e) =>
        console.error("[rp] e-mail de cancelamento falhou", e),
      );
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCancelando(false);
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
                  <div className="flex justify-end gap-2">
                    {r.data === hojeIso && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant="outline" disabled>
                                <QrCode className="mr-1.5 h-3.5 w-3.5" />
                                Fazer check-in
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Disponível em breve</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {podeCancelar(r) && (
                      <Button size="sm" variant="destructive" onClick={() => setAlvo(r)}>
                        Cancelar
                      </Button>
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
    </div>
  );
}
