// Relação do ciclo de repasse na tela — visão interna do Hub.
//
// Usada pelo Comercial (antes de pedir) e pelo Financeiro (antes de decidir).
// Nada aqui altera a exportação: prêmio e comissão aparecem só na tela.
import { mensagemDeErro } from "@/lib/erro";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ModoDados = "PROVISIONADO" | "HISTORICO";

type LinhaDetalhe = {
  tomador: string | null;
  segurado: string | null;
  seguradora: string | null;
  ramo: string | null;
  numero_apolice: string | null;
  numero_da_parcela: number | null;
  qtd_parcelas: number | null;
  data_pagamento: string | null;
  premio_total: number | null;
  percentual_comissao: number | null;
  valor_recebido_a_receber: number | null;
  percentual_imposto: number | null;
  base_liquida: number | null;
  percentual_repasse: number | null;
  valor_repasse_total: number | null;
  status_parcela_comissao: string | null;
};

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const PCT = (v: number | null | undefined) => {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
};

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function DetalheRepasseCiclo({
  aberto,
  onFechar,
  canal,
  parceiro,
  ano,
  mes,
  modoDados = "PROVISIONADO",
  situacaoRepasse = null,
  valorDoPedido,
}: {
  aberto: boolean;
  onFechar: () => void;
  canal: string;
  parceiro: string;
  ano: number;
  mes: number;
  modoDados?: ModoDados;
  situacaoRepasse?: string | null;
  valorDoPedido?: number;
}) {
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<"INTERNA" | "PARCEIRO">("INTERNA");
  const visaoParceiro = visao === "PARCEIRO";

  const { data, isLoading, error } = useQuery({
    queryKey: ["repasse-detalhe-ciclo", canal, ano, mes, modoDados, situacaoRepasse],
    enabled: aberto && !!canal,
    staleTime: 60_000,
    queryFn: async () => {
      const PAGINA = 500;
      let offset = 0;
      const todas: LinhaDetalhe[] = [];
      for (let i = 0; i < 40; i++) {
        const { data, error } = await supabase.rpc("rpc_lavoro_repasse_detalhe" as never, {
          p_ano: ano,
          p_mes: mes,
          p_modo: modoDados,
          p_canal_repasse: canal,
          p_situacao_repasse: situacaoRepasse,
          p_limit: PAGINA,
          p_offset: offset,
        } as never);
        if (error) throw new Error(error.message);
        const lote = (data || []) as LinhaDetalhe[];
        todas.push(...lote);
        if (lote.length < PAGINA) break;
        offset += PAGINA;
      }
      return todas;
    },
  });

  const linhas = useMemo(() => {
    const todas = data ?? [];
    const q = semAcento(busca.trim());
    if (!q) return todas;
    return todas.filter((l) =>
      semAcento(`${l.tomador ?? ""} ${l.segurado ?? ""} ${l.numero_apolice ?? ""}`).includes(q),
    );
  }, [data, busca]);

  const totais = useMemo(() => {
    let comissao = 0;
    let base = 0;
    let repasse = 0;
    for (const l of linhas) {
      comissao += Number(l.valor_recebido_a_receber || 0);
      base += Number(l.base_liquida || 0);
      repasse += Number(l.valor_repasse_total || 0);
    }
    return { comissao, base, repasse, parcelas: linhas.length };
  }, [linhas]);

  const totalGeral = useMemo(
    () => (data ?? []).reduce((acc, l) => acc + Number(l.valor_repasse_total || 0), 0),
    [data],
  );

  const divergente =
    valorDoPedido != null && data != null && Math.abs(Number(valorDoPedido) - totalGeral) > 0.01;

  return (
    <Dialog open={aberto} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relação de {parceiro}</DialogTitle>
          <DialogDescription>
            Ciclo {String(mes).padStart(2, "0")}/{ano}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {mensagemDeErro(error)}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Parcelas" valor={String(totais.parcelas)} />
          <Numero rotulo="Comissão recebida" valor={BRL(totais.comissao)} />
          <Numero rotulo="Base líquida" valor={BRL(totais.base)} />
          <Numero rotulo="Valor do repasse" valor={BRL(totais.repasse)} enfase />
        </div>

        {divergente ? (
          <Alert className="border-amber-600/40 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Os valores não batem</AlertTitle>
            <AlertDescription>
              O pedido foi enviado com {BRL(valorDoPedido)} e a relação soma {BRL(totalGeral)} agora.
              Confira antes de decidir.
            </AlertDescription>
          </Alert>
        ) : null}

        <ToggleGroup
          type="single"
          size="sm"
          value={visao}
          onValueChange={(v) => {
            if (v === "INTERNA" || v === "PARCEIRO") setVisao(v);
          }}
        >
          <ToggleGroupItem value="INTERNA">Visão interna</ToggleGroupItem>
          <ToggleGroupItem value="PARCEIRO">Visão do parceiro</ToggleGroupItem>
        </ToggleGroup>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por tomador, segurado ou número da apólice"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {visaoParceiro
            ? "Estas são as mesmas informações do arquivo enviado ao parceiro. Prêmio e percentual de comissão não saem para ele."
            : "Visão interna do Hub. O arquivo enviado ao parceiro não traz prêmio nem comissão."}
        </p>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tomador</TableHead>
                <TableHead>Segurado</TableHead>
                <TableHead>Seguradora</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead>Nº Apólice</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Data de pagamento</TableHead>
                {!visaoParceiro ? (
                  <TableHead className="text-right">Prêmio total</TableHead>
                ) : null}
                {!visaoParceiro ? (
                  <TableHead className="text-right">% Comissão</TableHead>
                ) : null}
                <TableHead className="text-right">Comissão recebida</TableHead>
                <TableHead className="text-right">% Imposto</TableHead>
                <TableHead className="text-right">Base líquida</TableHead>
                <TableHead className="text-right">% Repasse</TableHead>
                <TableHead className="text-right">Valor do repasse</TableHead>
                <TableHead>Status da parcela</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={visaoParceiro ? 13 : 15}
                    className="text-sm text-muted-foreground"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Carregando
                  </TableCell>
                </TableRow>
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visaoParceiro ? 13 : 15}
                    className="text-sm text-muted-foreground"
                  >
                    Nenhuma parcela nesta relação.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l, i) => (
                  <TableRow key={`${l.numero_apolice ?? ""}-${l.numero_da_parcela ?? ""}-${i}`}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {l.tomador ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.segurado ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.seguradora ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.ramo ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.numero_apolice ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {l.numero_da_parcela ?? "—"} / {l.qtd_parcelas ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtBR(l.data_pagamento)}</TableCell>
                    {!visaoParceiro ? (
                      <TableCell className="whitespace-nowrap text-right font-mono tabular-nums">
                        {BRL(l.premio_total)}
                      </TableCell>
                    ) : null}
                    {!visaoParceiro ? (
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {PCT(l.percentual_comissao)}
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-nowrap text-right font-mono tabular-nums">
                      {BRL(l.valor_recebido_a_receber)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {PCT(l.percentual_imposto)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono tabular-nums">
                      {BRL(l.base_liquida)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {PCT(l.percentual_repasse)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono font-semibold tabular-nums">
                      {BRL(l.valor_repasse_total)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.status_parcela_comissao ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {linhas.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={visaoParceiro ? 7 : 9}>Total</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {BRL(totais.comissao)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono tabular-nums">
                    {BRL(totais.base)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono font-semibold tabular-nums">
                    {BRL(totais.repasse)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Numero({
  rotulo,
  valor,
  enfase,
}: {
  rotulo: string;
  valor: string;
  enfase?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p
          className={
            enfase
              ? "font-mono text-2xl font-semibold tabular-nums text-primary"
              : "font-mono text-xl font-semibold tabular-nums text-foreground"
          }
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}

export default DetalheRepasseCiclo;
