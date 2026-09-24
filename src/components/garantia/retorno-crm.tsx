// Retornos no fluxo de Garantia.
//
// - MotivoDialog: campo curto e obrigatório de motivo (voltar de etapa, pedir volta).
// - BlocoRetornoCrm: no modal de uma demanda no CRM, pedir a volta para a
//   negociação; com pedido pendente, mostra o aviso e, para ADMIN, decide.
// - FaixaRetornosPendentes: topo do CRM, só para ADMIN e só com pedidos.
//
// Quem decide é o banco (rpc_garantia_decidir_retorno exige ADMIN); a tela só
// esconde os botões de quem não pode.

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasRole } from "@/hooks/use-meu-perfil";
import {
  useDecidirRetorno,
  useRetornosPendentes,
  useSolicitarRetorno,
  type RetornoSolicitacao,
} from "@/hooks/use-garantia-negociacao";
import { mensagemDeErro } from "@/lib/erro";
import { dataCurta } from "@/lib/garantia/formato";

export function MotivoDialog({
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
  pendente?: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void | Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) { setMotivo(""); onFechar(); } }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="motivo-retorno">Motivo</Label>
          <Textarea
            id="motivo-retorno"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setMotivo(""); onFechar(); }}>Cancelar</Button>
          <Button
            disabled={!motivo.trim() || pendente}
            onClick={async () => {
              await onConfirmar(motivo.trim());
              setMotivo("");
            }}
          >
            {rotuloConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvisoPedido({ pedido, podeDecidir, mostrarDemanda }: {
  pedido: RetornoSolicitacao;
  podeDecidir: boolean;
  mostrarDemanda?: boolean;
}) {
  const decidir = useDecidirRetorno();
  const [resposta, setResposta] = useState("");

  const executar = async (aprovar: boolean) => {
    try {
      await decidir.mutateAsync({ id: pedido.id, aprovar, resposta });
      toast.success(aprovar ? "Volta aprovada: a demanda voltou para a negociação." : "Pedido recusado.");
      setResposta("");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">
        {mostrarDemanda && (pedido.demanda?.codigo || pedido.demanda?.legenda)
          ? `${pedido.demanda?.codigo ?? ""} ${pedido.demanda?.legenda ?? ""} · `
          : ""}
        Volta solicitada em {dataCurta(pedido.solicitado_em)}, aguardando análise do admin
      </p>
      <p className="break-words text-xs">Motivo: {pedido.motivo}</p>
      {podeDecidir && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            placeholder="Resposta (opcional)"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            className="bg-background"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-[#338B85] hover:bg-[#338B85]/90" disabled={decidir.isPending} onClick={() => executar(true)}>
              Aprovar
            </Button>
            <Button size="sm" variant="outline" disabled={decidir.isPending} onClick={() => executar(false)}>
              Recusar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BlocoRetornoCrm({ demandaId }: { demandaId: string }) {
  const perfil = useMeuPerfilEfetivo();
  const ehAdmin = hasRole(perfil, "ADMIN");
  const { data: pendentes = [] } = useRetornosPendentes(demandaId);
  const solicitar = useSolicitarRetorno();
  const [aberto, setAberto] = useState(false);

  const pedido = pendentes[0];
  if (pedido) return <AvisoPedido pedido={pedido} podeDecidir={ehAdmin} />;

  return (
    <>
      <Button variant="ghost" size="sm" className="h-auto whitespace-normal px-2 text-left text-muted-foreground" onClick={() => setAberto(true)}>
        <Undo2 className="mr-2 h-4 w-4 shrink-0" /> Solicitar volta para a negociação
      </Button>
      <MotivoDialog
        aberto={aberto}
        titulo="Solicitar volta para a negociação"
        descricao="Um administrador analisa o pedido. Aprovado, a demanda volta para a etapa 5 com o mesmo código GAR."
        rotuloConfirmar="Enviar pedido"
        pendente={solicitar.isPending}
        onFechar={() => setAberto(false)}
        onConfirmar={async (motivo) => {
          try {
            await solicitar.mutateAsync({ demandaId, motivo });
            toast.success("Pedido enviado ao admin.");
            setAberto(false);
          } catch (e) {
            toast.error(mensagemDeErro(e));
          }
        }}
      />
    </>
  );
}

export function FaixaRetornosPendentes() {
  const perfil = useMeuPerfilEfetivo();
  const ehAdmin = hasRole(perfil, "ADMIN");
  const { data: pendentes = [] } = useRetornosPendentes(null, ehAdmin);
  if (!ehAdmin || !pendentes.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-[#14405C]">
        Pedidos de volta para a negociação ({pendentes.length})
      </h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {pendentes.map((p) => (
          <AvisoPedido key={p.id} pedido={p} podeDecidir mostrarDemanda />
        ))}
      </div>
    </section>
  );
}
