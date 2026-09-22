// Trava da exportação de repasse: o parceiro não tem contrato válido no Hub.
//
// Dá duas saídas ao usuário: enviar o contrato assinado, ou pedir liberação
// sem contrato anexando o De Acordo — que só Alessandro Oliveira aprova.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Upload } from "lucide-react";
import EnviarContratoParceiro from "@/components/comercial/EnviarContratoParceiro";
import { PedirLiberacaoSemContrato } from "@/components/repasse/PedirLiberacaoSemContrato";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface ExportacaoBloqueadaProps {
  aberto: boolean;
  parceiro: string;
  /** Chave já normalizada do canal na planilha. */
  chavePlanilha: string;
  canalId?: string | null;
  situacao?: string | null;
  motivo?: string | null;
  valor: number;
  ano: number;
  mes: number;
  onFechar: () => void;
}

export function ExportacaoBloqueada({
  aberto,
  parceiro,
  chavePlanilha,
  canalId,
  situacao,
  motivo,
  valor,
  ano,
  mes,
  onFechar,
}: ExportacaoBloqueadaProps) {
  const queryClient = useQueryClient();
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [pedirAberto, setPedirAberto] = useState(false);

  function fechar() {
    setPedirAberto(false);
    onFechar();
  }

  return (
    <>
      <Dialog
        open={aberto && !enviarAberto && !pedirAberto}
        onOpenChange={(v) => {
          if (!v) fechar();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Exportação bloqueada
            </DialogTitle>
            <DialogDescription>
              {parceiro} · {BRL(valor)} travados neste ciclo.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTitle>
              {situacao === "VENCIDO"
                ? "Contrato vencido"
                : situacao === "VINCULO_A_CONFIRMAR"
                  ? "Vínculo a confirmar"
                  : "Parceiro sem contrato assinado no Hub"}
            </AlertTitle>
            <AlertDescription>
              {motivo ??
                "Enquanto não houver contrato válido no Hub, o arquivo de repasse deste parceiro não pode ser gerado."}
            </AlertDescription>
          </Alert>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => setEnviarAberto(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Enviar contrato
            </Button>
            <Button onClick={() => setPedirAberto(true)}>Pedir liberação sem contrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PedirLiberacaoSemContrato
        aberto={pedirAberto}
        onFechar={() => setPedirAberto(false)}
        onSucesso={() => {
          setPedirAberto(false);
          onFechar();
        }}
        canal={chavePlanilha}
        parceiro={parceiro}
        ano={ano}
        mes={mes}
        valor={valor}
      />

      <EnviarContratoParceiro
        aberto={enviarAberto}
        canalId={canalId ?? null}
        canalNome={parceiro}
        onFechar={() => setEnviarAberto(false)}
        onSucesso={() => {
          queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
          setEnviarAberto(false);
          fechar();
        }}
      />
    </>
  );
}

export default ExportacaoBloqueada;
