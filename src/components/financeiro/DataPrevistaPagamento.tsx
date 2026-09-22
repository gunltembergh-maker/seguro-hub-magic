// Escolha da data prevista de pagamento do repasse.
//
// A janela válida vem do banco (`canal_parceiro_janela_pagamento`), que hoje
// devolve os dias 11 a 15. O calendário bloqueia tudo fora dela.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  parceiro?: string;
  /** Apenas sugestão inicial; quem manda é a data escolhida. */
  sugestao?: string | null;
  onFechar: () => void;
  onConfirmar: (dataISO: string) => void;
}

export function DataPrevistaPagamento({
  aberto,
  parceiro,
  sugestao,
  onFechar,
  onConfirmar,
}: DataPrevistaPagamentoProps) {
  const [data, setData] = useState<Date | undefined>(undefined);

  const { data: janela, isLoading, error } = useQuery({
    queryKey: ["canal-parceiro-janela-pagamento"],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("canal_parceiro_janela_pagamento" as never);
      if (error) throw error;
      const linha = (Array.isArray(data) ? data[0] : data) as
        { inicio: string; fim: string } | undefined;
      return linha ?? null;
    },
    staleTime: 60 * 60 * 1000,
  });

  const limites = useMemo(() => {
    if (!janela) return null;
    return { inicio: soData(doISO(janela.inicio)), fim: soData(doISO(janela.fim)) };
  }, [janela]);

  const sugerida = useMemo(() => {
    if (!sugestao || !limites) return undefined;
    const d = soData(doISO(sugestao));
    return d >= limites.inicio && d <= limites.fim ? d : undefined;
  }, [sugestao, limites]);

  const escolhida = data ?? sugerida;

  function fechar() {
    setData(undefined);
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Data prevista de pagamento</DialogTitle>
          <DialogDescription>
            {parceiro ? `Repasse de ${parceiro}. ` : ""}
            {janela
              ? `O pagamento acontece entre os dias 11 e 15. A janela disponível é de ${fmtBR(janela.inicio)} a ${fmtBR(janela.fim)}.`
              : "O pagamento acontece entre os dias 11 e 15."}
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
                return x < limites.inicio || x > limites.fim;
              }}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            disabled={!escolhida}
            onClick={() => {
              if (!escolhida) return;
              const iso = paraISO(escolhida);
              setData(undefined);
              onConfirmar(iso);
            }}
          >
            Confirmar e exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DataPrevistaPagamento;
