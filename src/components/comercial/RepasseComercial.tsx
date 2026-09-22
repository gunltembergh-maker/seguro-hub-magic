// Repasse por parceiro na visão do Comercial.
//
// Os números vêm das mesmas RPCs do Fluxo Diário e a planilha é gerada pelo
// mesmo módulo (`@/lib/repasse/exportar-repasse`). A data prevista é a do
// ciclo, definida pelo Financeiro — aqui ela só é exibida.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCicloRepasse } from "@/hooks/use-ciclo-repasse";
import { chaveCanal, exportarRepasse } from "@/lib/repasse/exportar-repasse";
import { cicloPadrao } from "@/lib/repasse/ciclo-datas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

type CanalRow = {
  ciclo_ano: number;
  ciclo_mes: number;
  canal_repasse: string;
  situacao_repasse: string | null;
  valor: number;
  total_canal_no_ciclo: number;
  situacao: "A_PAGAR" | "RETIDO_MINIMO" | "PAGO";
};

const PILL: Record<string, { bg: string; color: string; label: string }> = {
  A_PAGAR: { bg: "#DCFCE7", color: "#166534", label: "A pagar" },
  RETIDO_MINIMO: { bg: "#FEF3C7", color: "#92400E", label: "Retido pelo mínimo de R$ 100" },
  PAGO: { bg: "#E5E7EB", color: "#4B5563", label: "Pago" },
  SEM_VALOR: { bg: "#F3F4F6", color: "#6B7280", label: "Sem valor" },
};

export function RepasseComercial({
  podeExportarPorChave,
}: {
  /** Chave normalizada do canal → pode exportar (trava do contrato, vinda do banco). */
  podeExportarPorChave: Map<string, boolean>;
}) {
  const ciclo = useMemo(() => cicloPadrao(new Set<string>()), []);
  const { data: estadoCiclo } = useCicloRepasse(ciclo.ano, ciclo.mes);
  const [exportando, setExportando] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["lavoro-repasse-por-canal", ciclo.ano, ciclo.mes, "PROVISIONADO", null, null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_repasse_por_canal" as never, {
        p_ano: ciclo.ano,
        p_mes: ciclo.mes,
        p_modo: "PROVISIONADO",
        p_canal_repasse: null,
        p_situacao_repasse: null,
      } as never);
      if (error) throw error;
      return (data || []) as CanalRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const linhas = useMemo(() => {
    const map = new Map<
      string,
      { canal: string; cicloCorrente: number; acumulado: number; situacao: string }
    >();
    for (const r of data || []) {
      const cur = map.get(r.canal_repasse) ?? {
        canal: r.canal_repasse,
        cicloCorrente: 0,
        acumulado: 0,
        situacao: "SEM_VALOR",
      };
      const v = Number(r.valor || 0);
      cur.acumulado += v;
      if (r.ciclo_ano === ciclo.ano && r.ciclo_mes === ciclo.mes) {
        cur.cicloCorrente += v;
        cur.situacao = r.situacao;
      }
      map.set(r.canal_repasse, cur);
    }
    return Array.from(map.values())
      .map((l) => ({ ...l, situacao: l.cicloCorrente > 0 ? l.situacao : "SEM_VALOR" }))
      .sort((a, b) => b.cicloCorrente - a.cicloCorrente);
  }, [data, ciclo]);

  async function exportar(canal: string) {
    if (exportando) return;
    setExportando(canal);
    const toastId = toast.loading("Gerando a relação do parceiro…");
    try {
      const r = await exportarRepasse({
        canal,
        ano: ciclo.ano,
        mes: ciclo.mes,
        modo: "PARCEIRO",
        modoDados: "PROVISIONADO",
        situacaoRepasse: null,
      });
      toast.success(r.arquivo, { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { id: toastId });
    } finally {
      setExportando(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repasse</CardTitle>
        <CardDescription>
          Ciclo de {MESES[ciclo.mes - 1]}/{ciclo.ano}. A relação enviada ao parceiro não traz prêmio
          nem comissão da Lavoro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {estadoCiclo && !estadoCiclo.data_prevista ? (
          <Alert className="border-amber-600/40 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ciclo sem data de pagamento</AlertTitle>
            <AlertDescription>
              O Financeiro ainda não definiu a data prevista deste ciclo. Sem ela a relação não pode
              ser enviada aos parceiros.
            </AlertDescription>
          </Alert>
        ) : estadoCiclo ? (
          <p className="text-sm text-muted-foreground">
            Pagamento previsto para{" "}
            <strong className="text-foreground">{fmtBR(estadoCiclo.data_prevista)}</strong>
            {estadoCiclo.definida_por_nome ? `, definido por ${estadoCiclo.definida_por_nome}` : ""}.
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error ? error.message : String(error)}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead className="text-right">Ciclo corrente</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Envio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Carregando
                  </TableCell>
                </TableRow>
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Nenhum repasse neste ciclo.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l) => {
                  const liberado = podeExportarPorChave.get(chaveCanal(l.canal)) === true;
                  const pill = PILL[l.situacao] ?? PILL.SEM_VALOR;
                  return (
                    <TableRow key={l.canal}>
                      <TableCell className="font-medium">{l.canal}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {BRL(l.cicloCorrente)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {BRL(l.acumulado)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{ background: pill.bg, color: pill.color, borderColor: "transparent" }}
                        >
                          {pill.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {liberado ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={exportando !== null}
                            onClick={() => void exportar(l.canal)}
                          >
                            {exportando === l.canal ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Exportar e enviar
                          </Button>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Sem contrato válido
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default RepasseComercial;
