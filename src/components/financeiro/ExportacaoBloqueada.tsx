// Trava da exportação de repasse: o parceiro não tem contrato válido no Hub.
//
// Dá duas saídas ao usuário: enviar o contrato assinado, ou pedir liberação
// excepcional — que só Alessandro Oliveira aprova.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import EnviarContratoParceiro from "@/components/comercial/EnviarContratoParceiro";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  const [pedindo, setPedindo] = useState(false);
  const [mostrarPedido, setMostrarPedido] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  function fechar() {
    setMostrarPedido(false);
    setJustificativa("");
    setPedindo(false);
    onFechar();
  }

  async function solicitar() {
    if (!justificativa.trim() || enviando) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_solicitar_liberacao" as never,
        {
          p_canal_planilha: chavePlanilha,
          p_ano: ano,
          p_mes: mes,
          p_justificativa: justificativa.trim(),
        } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as { mensagem?: string } | null;
      toast.success(r?.mensagem ?? "Pedido registrado.");
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-liberacoes"] });
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Dialog open={aberto && !enviarAberto} onOpenChange={(v) => { if (!v) fechar(); }}>
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

          {mostrarPedido ? (
            <div className="space-y-2">
              <Label htmlFor="justificativa-liberacao">Justificativa</Label>
              <Textarea
                id="justificativa-liberacao"
                rows={4}
                value={justificativa}
                onChange={(ev) => setJustificativa(ev.target.value)}
                placeholder="Explique por que este repasse precisa sair sem contrato válido."
              />
              <p className="text-xs text-muted-foreground">
                O pedido vai para Alessandro Oliveira. Somente ele aprova liberações excepcionais.
              </p>
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={fechar} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => setEnviarAberto(true)} disabled={enviando}>
              <Upload className="mr-2 h-4 w-4" />
              Enviar contrato
            </Button>
            {mostrarPedido ? (
              <Button onClick={solicitar} disabled={!justificativa.trim() || enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar pedido
              </Button>
            ) : (
              <Button
                onClick={() => { setMostrarPedido(true); setPedindo(true); }}
                disabled={pedindo}
              >
                Solicitar liberação excepcional
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
