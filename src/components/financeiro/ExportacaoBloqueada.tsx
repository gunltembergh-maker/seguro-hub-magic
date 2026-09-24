// Trava da exportação de repasse: o parceiro não tem contrato válido no Hub.
//
// Dá duas saídas ao usuário: enviar o contrato assinado, ou pedir liberação
// sem contrato anexando o De Acordo — que só Alessandro Oliveira aprova.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro";
import { supabase } from "@/integrations/supabase/client";
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
  proximoPasso?: string | null;
  liberacaoStatus?: "PENDENTE" | "APROVADA" | "USADA" | null;
  liberacaoUsadaEm?: string | null;
  quemLibera?: "ADMINISTRADOR" | "FINANCEIRO" | "JURIDICO" | "COMERCIAL" | null;
  podeCobrar?: boolean;
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
  proximoPasso,
  liberacaoStatus,
  liberacaoUsadaEm,
  quemLibera,
  podeCobrar,
  valor,
  ano,
  mes,
  onFechar,
}: ExportacaoBloqueadaProps) {
  const queryClient = useQueryClient();
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [pedirAberto, setPedirAberto] = useState(false);
  const [cobrando, setCobrando] = useState(false);

  async function cobrar() {
    if (cobrando) return;
    setCobrando(true);
    try {
      const { data, error } = await supabase.rpc("rpc_canal_parceiro_cobrar_pendencia" as never, {
        p_canal_planilha: chavePlanilha,
      } as never);
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as { mensagem?: string | null } | null;
      toast.success(r?.mensagem ?? "Cobrança enviada.");
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-notificacoes"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setCobrando(false);
    }
  }

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
                  : situacao === "EM_CONFERENCIA"
                    ? "Contrato em conferência"
                  : "Parceiro sem contrato assinado no Hub"}
            </AlertTitle>
            <AlertDescription>
              {liberacaoStatus === "USADA"
                ? `Liberação usada${liberacaoUsadaEm ? ` em ${new Date(liberacaoUsadaEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}. Para exportar de novo, peça outra liberação.`
                : proximoPasso ?? motivo ??
                "Enquanto não houver contrato válido no Hub, o arquivo de repasse deste parceiro não pode ser gerado."}
            </AlertDescription>
          </Alert>

          {quemLibera ? (
            <p className="text-sm font-medium text-foreground">
              Depende de: {quemLibera === "COMERCIAL" ? "você" : quemLibera === "ADMINISTRADOR" ? "Administrador" : quemLibera === "FINANCEIRO" ? "Financeiro" : "Jurídico"}
            </p>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            {podeCobrar ? (
              <Button variant="outline" onClick={() => void cobrar()} disabled={cobrando}>
                {cobrando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cobrar
              </Button>
            ) : null}
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
