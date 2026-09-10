import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MINIMO = 5;

/**
 * Diálogo de cancelamento de reserva de terceiro: exige justificativa
 * com no mínimo 5 caracteres antes de confirmar.
 */
export function CancelarComMotivoDialog({
  aberto,
  descricao,
  processando,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  descricao: string;
  processando: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (aberto) setMotivo("");
  }, [aberto]);

  const valido = motivo.trim().length >= MINIMO;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !processando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar reserva</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="rp-motivo">Motivo do cancelamento</Label>
          <Textarea
            id="rp-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
            placeholder="Descreva por que a reserva está sendo cancelada"
            rows={4}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={valido ? "text-muted-foreground" : "text-destructive"}>
              {valido ? "Motivo válido" : `Informe ao menos ${MINIMO} caracteres`}
            </span>
            <span className="text-muted-foreground">{motivo.trim().length}/500</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={processando}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirmar(motivo.trim())}
            disabled={!valido || processando}
          >
            {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
