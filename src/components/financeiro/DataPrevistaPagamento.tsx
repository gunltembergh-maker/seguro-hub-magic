// Definição da data prevista de pagamento do ciclo de repasse.
//
// Quem define é o Financeiro, uma vez por ciclo. A janela válida vem do banco
// (hoje, os dias 11 a 15) e o calendário bloqueia tudo fora dela.
import { mensagemDeErro } from "@/lib/erro";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCicloRepasse } from "@/hooks/use-ciclo-repasse";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { cn } from "@/lib/utils";

const pad2 = (n: number) => String(n).padStart(2, "0");
const paraISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const doISO = (s: string) => new Date(`${String(s).slice(0, 10)}T12:00:00`);
const fmtBR = (s: string) => doISO(s).toLocaleDateString("pt-BR");
const soData = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface DataPrevistaPagamentoProps {
  aberto: boolean;
  ano: number;
  mes: number;
  /** Sugestão inicial; quem manda é a data escolhida. */
  sugestao?: string | null;
  onFechar: () => void;
  onDefinida?: (dataISO: string) => void;
}

export function DataPrevistaPagamento({
  aberto,
  ano,
  mes,
  sugestao,
  onFechar,
  onDefinida,
}: DataPrevistaPagamentoProps) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<Date | undefined>(undefined);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: ciclo, isLoading, error } = useCicloRepasse(ano, mes);

  const limites = useMemo(() => {
    if (!ciclo?.janela_inicio || !ciclo?.janela_fim) return null;
    return { inicio: soData(doISO(ciclo.janela_inicio)), fim: soData(doISO(ciclo.janela_fim)) };
  }, [ciclo]);

  const sugerida = useMemo(() => {
    const base = ciclo?.data_prevista ?? sugestao;
    if (!base || !limites) return undefined;
    const d = soData(doISO(base));
    return d >= limites.inicio && d <= limites.fim ? d : undefined;
  }, [ciclo, sugestao, limites]);

  const escolhida = data ?? sugerida;

  function fechar() {
    setData(undefined);
    setObservacao("");
    onFechar();
  }

  async function salvar() {
    if (!escolhida || salvando) return;
    const iso = paraISO(escolhida);
    setSalvando(true);
    try {
      const { error: erro } = await supabase.rpc(
        "rpc_canal_parceiro_definir_data_ciclo" as never,
        {
          p_ano: ano,
          p_mes: mes,
          p_data: iso,
          p_canal_id: null,
          p_observacao: observacao.trim() || null,
        } as never,
      );
      if (erro) throw erro;
      toast.success(`Pagamento do ciclo previsto para ${fmtBR(iso)}.`);
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-ciclo"] });
      onDefinida?.(iso);
      fechar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Data do ciclo de pagamento</DialogTitle>
          <DialogDescription>
            {limites
              ? `Escolha qualquer dia útil. A janela disponível vai de ${fmtBR(ciclo!.janela_inicio!)} a ${fmtBR(ciclo!.janela_fim!)}.`
              : "Escolha qualquer dia útil."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando a janela de pagamento…
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {limites && (
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={escolhida}
              onSelect={setData}
              defaultMonth={limites.inicio}
              disabled={(d) => {
                const x = soData(d);
                return x < limites.inicio || x > limites.fim || d.getDay() === 0 || d.getDay() === 6;
              }}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          O Hub não verifica feriados: confira o calendário antes de definir a data.
        </p>

        <div className="space-y-2">
          <Label htmlFor="observacao-ciclo">Observação (opcional)</Label>
          <Textarea
            id="observacao-ciclo"
            rows={3}
            value={observacao}
            onChange={(ev) => setObservacao(ev.target.value)}
            placeholder="Algo que o time precise saber sobre esta data."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button disabled={!escolhida || salvando} onClick={salvar}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar data do ciclo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DataPrevistaPagamento;
