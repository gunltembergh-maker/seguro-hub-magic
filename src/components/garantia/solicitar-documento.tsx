// "Solicitar documento ao comercial": avisa o time comercial no sino, coloca a
// demanda em aguard_doc_contrato e registra o pedido no histórico (RPC).
import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentosDaDemanda } from "@/hooks/use-garantia-documentos";
import { useSolicitarDocumento } from "@/hooks/use-garantia-comercial";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import { pendenciasAnaliseDemanda } from "@/lib/garantia/documentos-regra";
import { mensagemDeErro } from "@/lib/erro";

export function SolicitarDocumentoComercial({ demanda }: { demanda: DemandaLista }) {
  const [aberto, setAberto] = useState(false);
  const [faltando, setFaltando] = useState("");
  const [obs, setObs] = useState("");
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const solicitar = useSolicitarDocumento();

  const sugestao = useMemo(() => {
    const tipos = new Set(docs.filter((d) => !d.substituido_por_id).map((d) => d.tipo));
    return pendenciasAnaliseDemanda(demanda, tipos).map((p) => p.texto).join("\n");
  }, [docs, demanda]);

  const abrir = () => {
    setFaltando(sugestao);
    setObs("");
    setAberto(true);
  };

  const enviar = async () => {
    try {
      const qtd = await solicitar.mutateAsync({
        demandaId: demanda.id,
        faltando: faltando.trim(),
        observacao: obs.trim() || null,
      });
      if (qtd === 0) {
        toast.warning("Pedido registrado. Nenhum comercial com acesso à aba foi avisado — avise por fora até a permissão ser liberada.");
      } else {
        toast.success(`Pedido enviado a ${qtd} ${qtd === 1 ? "pessoa" : "pessoas"} do comercial.`);
      }
      setAberto(false);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar o pedido."));
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir} data-tour="gar-solicitar-documento">
        <Send className="mr-1 h-4 w-4" /> Solicitar documento ao comercial
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar documento ao comercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Documentos que faltam *</Label>
              <Textarea rows={3} value={faltando} onChange={(e) => setFaltando(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              O time comercial recebe o aviso no sino e a demanda passa a “Aguardando documentação do contrato”.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={!faltando.trim() || solicitar.isPending} onClick={() => void enviar()}>
              {solicitar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Enviar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
