// Confirmação destrutiva com motivo obrigatório (mínimo 5 caracteres).
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmarExclusaoDialog({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  pendente,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar: string;
  pendente: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    if (aberto) setMotivo("");
  }, [aberto]);
  const valido = motivo.trim().length >= 5;

  return (
    <AlertDialog open={aberto} onOpenChange={(o) => !o && !pendente && onFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="motivo-exclusao">Motivo</Label>
          <Textarea
            id="motivo-exclusao"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
          />
          {!valido && <p className="text-xs text-muted-foreground">Informe ao menos 5 caracteres.</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={!valido || pendente} onClick={() => onConfirmar(motivo.trim())}>
            {pendente && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
