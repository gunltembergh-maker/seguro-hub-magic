// =====================================================================
// Originação — a área do time de Garantia.
//
// Uma aba por ramo, de propósito. O time trabalha por produto: quem
// negocia seguro garantia judicial usa outro argumento, outro prazo e
// outra base legal de quem negocia performance em licitação. Uma fila
// única com filtro obriga a pessoa a lembrar de filtrar, e o número que
// aparece no topo passa a ser a soma de coisas que ninguém vende juntas.
//
// Acima das abas fica o consolidado, para quem precisa da visão do todo.
// =====================================================================

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResumoRamos } from "@/hooks/use-analise-background";
import { brlCurto, num } from "@/lib/ab-format";
import { RAMOS, type Modalidade } from "@/lib/ab-types";
import { EstadoVazio } from "@/components/analise-background/AbBits";
import FilaGarantias from "./FilaGarantias";

interface Props {
  onAbrirLead: (id: string) => void;
}

export default function OriginacaoGarantia({ onAbrirLead }: Props) {
  const { data: resumo, isLoading } = useResumoRamos();
  const [ramo, setRamo] = useState<Modalidade>("JUDICIAL");

  const total = Object.values(resumo ?? {}).reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      is: acc.is + r.is,
      premio: acc.premio + r.premio,
      vencendo: acc.vencendo + r.vencendo,
      bloqueados: acc.bloqueados + r.bloqueados,
    }),
    { leads: 0, is: 0, premio: 0, vencendo: 0, bloqueados: 0 },
  );

  const ativo = RAMOS.find((r) => r.chave === ramo) ?? RAMOS[0];

  return (
    <div className="space-y-5">
      {/* -------- consolidado -------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading
          ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          : (
            <>
              <Cartao rotulo="Oportunidades" valor={num(total.leads)} />
              <Cartao rotulo="IS necessária" valor={brlCurto(total.is)} destaque
                nota="valor de execução + acréscimo legal" />
              <Cartao rotulo="Prêmio de referência" valor={brlCurto(total.premio)}
                nota="taxa de referência × IS — não é cotação" />
              <Cartao
                rotulo="Prazo em 15 dias"
                valor={num(total.vencendo)}
                nota={total.vencendo ? "exige contato agora" : undefined}
              />
              <Cartao
                rotulo="Fora de subscrição"
                valor={num(total.bloqueados)}
                nota="sanção, RJ ou garantia já prestada"
              />
            </>
          )}
      </div>

      {/* -------- abas por ramo ------------------------------------ */}
      <Tabs value={ramo} onValueChange={(v) => setRamo(v as Modalidade)}>
        <TabsList className="flex-wrap h-auto">
          {RAMOS.map((r) => {
            const n = resumo?.[r.chave]?.leads ?? 0;
            return (
              <TabsTrigger key={r.chave} value={r.chave} className="gap-2">
                {r.titulo}
                {n > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">{n}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {RAMOS.map((r) => (
          <TabsContent key={r.chave} value={r.chave} className="mt-4 space-y-4">
            {/* O argumento de venda e a base legal ficam na tela, não num
                treinamento que ninguém relê. */}
            <Card className="bg-muted/40">
              <CardContent className="pt-4 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">{r.produto}</span>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {r.chave}
                  </Badge>
                </div>
                <p className="text-[13px] text-muted-foreground max-w-3xl">{r.descricao}</p>
                <p className="text-[11px] text-muted-foreground/80 font-mono">{r.baseLegal}</p>
              </CardContent>
            </Card>

            {r.chave === "LOCATICIA" && (
              <EstadoVazio
                titulo="Este ramo não tem gatilho público"
                detalhe={
                  "Nenhuma base oficial revela contrato de locação. O que aparece aqui vem " +
                  "de proxy de expansão (CNAE, novo contrato público, abertura de filial) e " +
                  "entra com confiança 0,45. Trate como cross-sell na carteira — não como " +
                  "gatilho legal."
                }
              />
            )}

            {ramo === r.chave && (
              <FilaGarantias onAbrirLead={onAbrirLead} modalidade={r.chave} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-[11px] text-muted-foreground">
        Ramo em foco: <strong>{ativo.titulo}</strong>. A fila é ordenada por prêmio × urgência ×
        probabilidade de subscrição, e quem tem filtro negativo (sanção, recuperação judicial,
        garantia já prestada) fica com prioridade zero em vez de desaparecer — some da fila é
        pior que aparecer explicado.
      </p>
    </div>
  );
}

function Cartao({
  rotulo, valor, nota, destaque,
}: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <p className={`text-xl font-semibold tabular-nums ${destaque ? "text-primary" : ""}`}>
          {valor}
        </p>
        {nota && <p className="text-[11px] text-muted-foreground mt-0.5">{nota}</p>}
      </CardContent>
    </Card>
  );
}
