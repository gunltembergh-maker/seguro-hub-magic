// Repasse por parceiro na visão do Comercial.
//
// Os números vêm das mesmas RPCs do Fluxo Diário e a planilha é gerada pelo
// mesmo módulo (`@/lib/repasse/exportar-repasse`). O Comercial pede a
// autorização ao Financeiro e só exporta ao parceiro depois de aprovado.
import { mensagemDeErro } from "@/lib/erro";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  FileSearch,
  FileText,
  Loader2,
  Lock,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCicloRepasse } from "@/hooks/use-ciclo-repasse";
import { DetalheRepasseCiclo } from "@/components/repasse/DetalheRepasseCiclo";
import { ContratoDoParceiro } from "@/components/repasse/ContratoDoParceiro";
import { PedirLiberacaoSemContrato } from "@/components/repasse/PedirLiberacaoSemContrato";
import { chaveCanal, exportarRepasse } from "@/lib/repasse/exportar-repasse";
import { cicloPadrao } from "@/lib/repasse/ciclo-datas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const fmtCurto = (iso: string | null | undefined) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "—";

const fmtDataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

type CanalRow = {
  ciclo_ano: number;
  ciclo_mes: number;
  canal_repasse: string;
  situacao_repasse: string | null;
  valor: number;
  total_canal_no_ciclo: number;
  situacao: "A_PAGAR" | "RETIDO_MINIMO" | "PAGO";
};

type DivergenciaPct = {
  chave_planilha: string;
  linhas: number | null;
  linhas_com_regra: number | null;
  linhas_divergentes: number | null;
  valor_divergente: number | null;
  pct_planilha: number[] | null;
  pct_hub: number[] | null;
  resumo: string | null;
};

export type DemandaNF = {
  demanda_id: string;
  canal_id: string | null;
  chave_planilha: string;
  parceiro: string;
  ciclo_ano: number;
  ciclo_mes: number;
  linhas: number | null;
  valor_total: number | null;
  situacao: string;
  solicitado_por_nome: string | null;
  solicitado_em: string | null;
  decidido_por_nome: string | null;
  decidido_em: string | null;
  data_prevista_pagamento: string | null;
  dias_para_a_data: number | null;
  baixa_data_pagamento: string | null;
  baixa_confirmada_por: string | null;
  baixa_confirmada_em: string | null;
  observacao_solicitante: string | null;
  observacao_financeiro: string | null;
  sou_o_aprovador: boolean | null;
  sou_o_solicitante: boolean | null;
};

const PILL: Record<string, { bg: string; color: string; label: string }> = {
  A_PAGAR: { bg: "#DCFCE7", color: "#166534", label: "A pagar" },
  RETIDO_MINIMO: { bg: "#FEF3C7", color: "#92400E", label: "Retido pelo mínimo de R$ 100" },
  PAGO: { bg: "#E5E7EB", color: "#4B5563", label: "Pago" },
  SEM_VALOR: { bg: "#F3F4F6", color: "#6B7280", label: "Sem valor" },
};

function BadgeFinanceiro({ d }: { d: DemandaNF | undefined }) {
  if (!d) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sem pedido
      </Badge>
    );
  }
  if (d.baixa_data_pagamento) {
    return (
      <Badge variant="outline" className="border-transparent bg-blue-100 text-blue-800">
        Pago em {fmtCurto(d.baixa_data_pagamento)}
      </Badge>
    );
  }
  if (d.situacao === "APROVADA") {
    return (
      <div className="space-y-0.5">
        <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800">
          Aprovado pelo financeiro
        </Badge>
        {d.data_prevista_pagamento ? (
          <p className="text-xs text-muted-foreground">
            pagamento previsto para {fmtBR(d.data_prevista_pagamento)}
          </p>
        ) : null}
      </div>
    );
  }
  if (d.situacao === "RECUSADA") {
    return (
      <Badge variant="outline" className="border-transparent bg-red-100 text-red-800">
        Recusado pelo financeiro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-900">
      Aguardando o financeiro
    </Badge>
  );
}

export function RepasseComercial({
  podeExportarPorChave,
  pctPorChave,
}: {
  /** Chave normalizada do canal → pode exportar (trava do contrato, vinda do banco). */
  podeExportarPorChave: Map<string, boolean>;
  pctPorChave: Map<
    string,
    {
      beneficios: number | null;
      garantia: number | null;
      demais: number | null;
      origemBeneficios: string | null;
      origemGarantia: string | null;
      origemDemais: string | null;
    }
  >;
}) {
  const ciclo = useMemo(() => cicloPadrao(new Set<string>()), []);
  const { data: estadoCiclo } = useCicloRepasse(ciclo.ano, ciclo.mes);
  const [exportando, setExportando] = useState<string | null>(null);
  const [relacao, setRelacao] = useState<string | null>(null);
  const [contrato, setContrato] = useState<string | null>(null);
  const [liberacao, setLiberacao] = useState<{ canal: string; valor: number } | null>(null);
  const [pedido, setPedido] = useState<{ canal: string; linhas: number; valor: number } | null>(
    null,
  );
  const queryClient = useQueryClient();

  const search = useSearch({ strict: false }) as { demanda?: string };
  const demandaDestaque = search?.demanda;

  const { data, isLoading, error } = useQuery({
    queryKey: ["lavoro-repasse-por-canal", ciclo.ano, ciclo.mes, "PROVISIONADO", null, null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_lavoro_repasse_por_canal" as never,
        {
          p_ano: ciclo.ano,
          p_mes: ciclo.mes,
          p_modo: "PROVISIONADO",
          p_canal_repasse: null,
          p_situacao_repasse: null,
        } as never,
      );
      if (error) throw error;
      return (data || []) as CanalRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const demandas = useQuery({
    queryKey: ["canal-repasse-demandas", ciclo.ano, ciclo.mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_repasse_demandas" as never,
        {
          p_situacao: null,
          p_ano: ciclo.ano,
          p_mes: ciclo.mes,
        } as never,
      );
      if (error) throw error;
      return (data || []) as DemandaNF[];
    },
    staleTime: 60_000,
  });

  const demandaPorChave = useMemo(() => {
    const m = new Map<string, DemandaNF>();
    for (const d of demandas.data ?? []) m.set(chaveCanal(d.chave_planilha ?? d.parceiro), d);
    return m;
  }, [demandas.data]);

  // Aviso (não trava): percentual calculado na base gerencial diferente da regra do Hub.
  const divergencias = useQuery({
    queryKey: ["canal-repasse-divergencia-pct", ciclo.ano, ciclo.mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_repasse_divergencia_pct" as never,
        { p_ano: ciclo.ano, p_mes: ciclo.mes, p_canal_repasse: null } as never,
      );
      if (error) throw error;
      return (data || []) as DivergenciaPct[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const divergenciaPorChave = useMemo(() => {
    const m = new Map<string, DivergenciaPct>();
    for (const d of divergencias.data ?? []) m.set(chaveCanal(d.chave_planilha), d);
    return m;
  }, [divergencias.data]);

  const parceiros = useQuery({
    queryKey: ["canal-parceiro-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_canal_parceiro_lista" as never, {} as never);
      if (error) throw error;
      return (data || []) as {
        canal_id: string;
        nome: string | null;
        razao_social: string | null;
        chaves_planilha: string[] | null;
      }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const razaoPorChave = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of parceiros.data ?? []) {
      if (!p.razao_social) continue;
      for (const c of p.chaves_planilha ?? []) m.set(chaveCanal(c), p.razao_social);
    }
    return m;
  }, [parceiros.data]);

  const linhas = useMemo(() => {
    const map = new Map<
      string,
      {
        canal: string;
        cicloCorrente: number;
        acumulado: number;
        situacao: string;
        parcelas: number;
      }
    >();
    for (const r of data || []) {
      const cur = map.get(r.canal_repasse) ?? {
        canal: r.canal_repasse,
        cicloCorrente: 0,
        acumulado: 0,
        situacao: "SEM_VALOR",
        parcelas: 0,
      };
      const v = Number(r.valor || 0);
      cur.acumulado += v;
      if (r.ciclo_ano === ciclo.ano && r.ciclo_mes === ciclo.mes) {
        cur.cicloCorrente += v;
        cur.situacao = r.situacao;
        cur.parcelas += 1;
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
      toast.error(mensagemDeErro(e), { id: toastId });
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
          <p className="text-sm text-muted-foreground">
            A data prevista de pagamento é definida pelo Financeiro ao autorizar cada envio.
          </p>
        ) : estadoCiclo ? (
          <p className="text-sm text-muted-foreground">
            Pagamento previsto para{" "}
            <strong className="text-foreground">{fmtBR(estadoCiclo.data_prevista)}</strong>
            {estadoCiclo.definida_por_nome ? `, definido por ${estadoCiclo.definida_por_nome}` : ""}
            , usada como padrão quando o Financeiro não informar outra.
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {mensagemDeErro(error)}
            </AlertDescription>
          </Alert>
        ) : null}

        {divergenciaPorChave.size > 0 ? (
          <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">
                O percentual da base gerencial está diferente da regra do Hub
              </p>
              {Array.from(divergenciaPorChave.values()).map((d) => (
                <p key={d.chave_planilha}>
                  {d.chave_planilha}: {d.resumo}
                </p>
              ))}
              <p>
                A exportação continua liberada. Corrija na base gerencial ou ajuste a regra no Hub
                para os dois voltarem a bater.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <TooltipProvider>
            <Table data-tour="cp-repasse-tabela">
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead className="text-right">% Repasse</TableHead>
                  <TableHead className="text-right">Ciclo corrente</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead className="text-right">Envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Carregando
                    </TableCell>
                  </TableRow>
                ) : linhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Nenhum repasse neste ciclo.
                    </TableCell>
                  </TableRow>
                ) : (
                  linhas.map((l, index) => {
                    const chave = chaveCanal(l.canal);
                    const liberado = podeExportarPorChave.get(chave) === true;
                    const pill = PILL[l.situacao] ?? PILL.SEM_VALOR;
                    const d = demandaPorChave.get(chave);
                    return (
                      <LinhaRepasse
                        key={l.canal}
                        canal={l.canal}
                        razaoSocial={razaoPorChave.get(chave) ?? null}
                        percentuais={pctPorChave.get(chave)}
                        divergencia={divergenciaPorChave.get(chave)}
                        primeiraLinha={index === 0}
                        onCancelado={() =>
                          void queryClient.invalidateQueries({
                            queryKey: ["canal-repasse-demandas"],
                          })
                        }
                        cicloCorrente={l.cicloCorrente}
                        acumulado={l.acumulado}
                        parcelas={l.parcelas}
                        pill={pill}
                        demanda={d}
                        liberado={liberado}
                        destacar={!!d && d.demanda_id === demandaDestaque}
                        exportando={exportando}
                        onExportar={() => void exportar(l.canal)}
                        onPedir={() =>
                          setPedido({ canal: l.canal, linhas: l.parcelas, valor: l.cicloCorrente })
                        }
                        onVerRelacao={() => setRelacao(l.canal)}
                        onVerContrato={() => setContrato(l.canal)}
                        onPedirLiberacao={() =>
                          setLiberacao({ canal: l.canal, valor: l.cicloCorrente })
                        }
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </CardContent>

      <PedirNFDialog
        aberto={pedido !== null && relacao === null && contrato === null && liberacao === null}
        canal={pedido?.canal ?? ""}
        ciclo={ciclo}
        linhas={pedido?.linhas ?? 0}
        valor={pedido?.valor ?? 0}
        onFechar={() => setPedido(null)}
        onSucesso={() => {
          void queryClient.invalidateQueries({ queryKey: ["canal-repasse-demandas"] });
          setPedido(null);
        }}
        onVerRelacao={() => setRelacao(pedido?.canal ?? null)}
      />

      <DetalheRepasseCiclo
        aberto={relacao !== null}
        onFechar={() => setRelacao(null)}
        canal={relacao ?? ""}
        parceiro={relacao ?? ""}
        ano={ciclo.ano}
        mes={ciclo.mes}
        modoDados="PROVISIONADO"
        situacaoRepasse={null}
      />

      <ContratoDoParceiro
        aberto={contrato !== null}
        onFechar={() => setContrato(null)}
        canal={contrato ?? ""}
        parceiro={contrato ?? ""}
      />

      <PedirLiberacaoSemContrato
        aberto={liberacao !== null}
        onFechar={() => setLiberacao(null)}
        canal={liberacao?.canal ?? ""}
        parceiro={liberacao?.canal ?? ""}
        ano={ciclo.ano}
        mes={ciclo.mes}
        valor={liberacao?.valor}
      />
    </Card>
  );
}

function LinhaRepasse({
  canal,
  razaoSocial,
  percentuais,
  divergencia,
  primeiraLinha,
  cicloCorrente,
  acumulado,
  parcelas,
  pill,
  demanda,
  liberado,
  destacar,
  exportando,
  onExportar,
  onPedir,
  onVerRelacao,
  onVerContrato,
  onPedirLiberacao,
  onCancelado,
}: {
  canal: string;
  razaoSocial: string | null;
  percentuais:
    | {
        beneficios: number | null;
        garantia: number | null;
        demais: number | null;
        origemBeneficios: string | null;
        origemGarantia: string | null;
        origemDemais: string | null;
      }
    | undefined;
  divergencia: DivergenciaPct | undefined;
  primeiraLinha: boolean;
  cicloCorrente: number;
  acumulado: number;
  parcelas: number;
  pill: { bg: string; color: string; label: string };
  demanda: DemandaNF | undefined;
  liberado: boolean;
  destacar: boolean;
  exportando: string | null;
  onExportar: () => void;
  onPedir: () => void;
  onVerRelacao: () => void;
  onVerContrato: () => void;
  onPedirLiberacao: () => void;
  onCancelado: () => void;
}) {
  const ref = useRef<HTMLTableRowElement | null>(null);
  const [aceso, setAceso] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  useEffect(() => {
    if (!destacar) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setAceso(true);
    const t = setTimeout(() => setAceso(false), 6000);
    return () => clearTimeout(t);
  }, [destacar]);

  const situacao = demanda?.situacao ?? null;
  const pago = !!demanda?.baixa_data_pagamento;

  const podeCancelarJanela =
    situacao === "PENDENTE" && demanda?.sou_o_solicitante === true && !!demanda?.solicitado_em;
  const restanteMs = podeCancelarJanela
    ? new Date(demanda!.solicitado_em as string).getTime() + 10 * 60 * 1000 - agora
    : 0;
  const dentroDaJanela = podeCancelarJanela && restanteMs > 0;

  useEffect(() => {
    if (!podeCancelarJanela) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [podeCancelarJanela]);

  const contador = (() => {
    const s = Math.max(0, Math.floor(restanteMs / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  })();

  const horasParaReenvio =
    situacao === "RECUSADA" && demanda?.decidido_em
      ? Math.ceil(
          (new Date(demanda.decidido_em).getTime() + 24 * 60 * 60 * 1000 - agora) /
            (60 * 60 * 1000),
        )
      : 0;
  const bloqueado24h = horasParaReenvio > 0;

  async function cancelar() {
    if (!demanda || cancelando) return;
    setCancelando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_repasse_cancelar_nf" as never,
        {
          p_demanda_id: demanda.demanda_id,
        } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as { mensagem?: string } | null;
      toast.success(r?.mensagem ?? "Envio cancelado.");
      onCancelado();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setCancelando(false);
    }
  }

  return (
    <TableRow ref={ref} className={aceso ? "ring-2 ring-primary ring-offset-2" : undefined}>
      <TableCell className="font-medium">
        {canal}
        {razaoSocial ? <p className="text-xs text-muted-foreground">{razaoSocial}</p> : null}
        {situacao === "RECUSADA" && demanda?.observacao_financeiro ? (
          <p className="mt-1 text-xs text-destructive">{demanda.observacao_financeiro}</p>
        ) : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <PercentualRepasse percentuais={percentuais} />
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{BRL(cicloCorrente)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{BRL(acumulado)}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          style={{ background: pill.bg, color: pill.color, borderColor: "transparent" }}
        >
          {pill.label}
        </Badge>
      </TableCell>
      <TableCell>
        <BadgeFinanceiro d={demanda} />
      </TableCell>
      <TableCell className="text-right" data-tour={primeiraLinha ? "cp-repasse-acoes" : undefined}>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {!liberado ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" />
              Sem contrato válido
            </Badge>
          ) : !demanda ? (
            <Button size="sm" variant="default" onClick={onPedir} disabled={cicloCorrente <= 0}>
              <Send className="mr-2 h-4 w-4" />
              Enviar ao financeiro
            </Button>
          ) : situacao === "PENDENTE" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" variant="outline" disabled>
                    Aguardando o financeiro
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Pedido em {fmtDataHora(demanda.solicitado_em)}
                {demanda.solicitado_por_nome ? ` por ${demanda.solicitado_por_nome}` : ""}
              </TooltipContent>
            </Tooltip>
          ) : situacao === "RECUSADA" ? (
            <Button size="sm" variant="outline" onClick={onPedir} disabled={bloqueado24h}>
              <Send className="mr-2 h-4 w-4" />
              {bloqueado24h ? `Novo envio em ${horasParaReenvio}h` : "Pedir de novo"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={exportando !== null || pago}
              onClick={onExportar}
            >
              {exportando === canal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exportar ao parceiro
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" title="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onVerRelacao}>
                <FileSearch className="mr-2 h-4 w-4" />
                Ver a relação
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onVerContrato}>
                <FileText className="mr-2 h-4 w-4" />
                Ver o contrato
              </DropdownMenuItem>
              {!liberado ? (
                <DropdownMenuItem onSelect={onPedirLiberacao}>
                  <Lock className="mr-2 h-4 w-4" />
                  Pedir liberação sem contrato
                </DropdownMenuItem>
              ) : null}
              {dentroDaJanela ? (
                <DropdownMenuItem
                  disabled={cancelando}
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmarCancelar(true);
                  }}
                >
                  {cancelando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cancelar envio ({contador})
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmarCancelar} onOpenChange={setConfirmarCancelar}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar o envio ao Financeiro?</AlertDialogTitle>
                <AlertDialogDescription>
                  O pedido de {canal} sai da fila do Financeiro e você pode enviar de novo depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void cancelar()}>
                  Cancelar envio
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {situacao === "PENDENTE" && !dentroDaJanela && demanda?.sou_o_solicitante === true ? (
          <p className="mt-1 text-xs text-muted-foreground">Só o Financeiro pode desfazer agora</p>
        ) : null}
        {parcelas > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">{parcelas} parcelas</p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function PercentualRepasse({
  percentuais,
}: {
  percentuais:
    | {
        beneficios: number | null;
        garantia: number | null;
        demais: number | null;
        origemBeneficios: string | null;
        origemGarantia: string | null;
        origemDemais: string | null;
      }
    | undefined;
}) {
  if (!percentuais) return <span className="text-muted-foreground">—</span>;
  const formatar = (valor: number | null) =>
    valor == null
      ? "—"
      : `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  const rotuloOrigem = (origem: string | null) =>
    origem === "DIRETORIA" ? " (diretoria)" : origem === "CONTRATO" ? " (contrato)" : "";
  const valores = [percentuais.beneficios, percentuais.garantia, percentuais.demais];
  const disponiveis = valores.filter((v): v is number => v != null);
  if (disponiveis.length === 0) return <span className="text-muted-foreground">—</span>;
  const unicos = Array.from(new Set(disponiveis));
  const resumo = unicos.map(formatar).join(" / ");
  const temDiretoria =
    percentuais.origemBeneficios === "DIRETORIA" ||
    percentuais.origemGarantia === "DIRETORIA" ||
    percentuais.origemDemais === "DIRETORIA";
  const seloDiretoria = temDiretoria ? (
    <Badge
      variant="outline"
      className="border-amber-600/40 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      title="Percentual autorizado pela diretoria"
    >
      diretoria
    </Badge>
  ) : null;
  if (unicos.length === 1 && disponiveis.length === 3) {
    return (
      <span className="inline-flex items-center justify-end gap-1.5">
        {resumo}
        {seloDiretoria}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-4">
            {resumo}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Benefícios {formatar(percentuais.beneficios)}
          {rotuloOrigem(percentuais.origemBeneficios)}, Garantia {formatar(percentuais.garantia)}
          {rotuloOrigem(percentuais.origemGarantia)}, Demais ramos {formatar(percentuais.demais)}
          {rotuloOrigem(percentuais.origemDemais)}
        </TooltipContent>
      </Tooltip>
      {seloDiretoria}
    </span>
  );
}

function PedirNFDialog({
  aberto,
  canal,
  ciclo,
  linhas,
  valor,
  onFechar,
  onSucesso,
  onVerRelacao,
}: {
  aberto: boolean;
  canal: string;
  ciclo: { ano: number; mes: number };
  linhas: number;
  valor: number;
  onFechar: () => void;
  onSucesso: () => void;
  onVerRelacao: () => void;
}) {
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setObservacao("");
  }, [canal]);

  async function enviar() {
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_repasse_solicitar_nf" as never,
        {
          p_canal_planilha: canal,
          p_ano: ciclo.ano,
          p_mes: ciclo.mes,
          p_linhas: linhas,
          p_valor: valor,
          p_observacao: observacao.trim() || null,
        } as never,
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { mensagem?: string } | null;
      toast.success(row?.mensagem ?? "Pedido enviado ao Financeiro.");
      onSucesso();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar ao financeiro</DialogTitle>
          <DialogDescription>
            O Financeiro vai conferir o valor e autorizar a emissão da nota fiscal. Você recebe um
            aviso assim que ele responder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{canal}</p>
            <p className="text-muted-foreground">
              Ciclo de {MESES[ciclo.mes - 1]}/{ciclo.ano} · {linhas} parcelas
            </p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {BRL(valor)}
          </p>
          <Textarea
            placeholder="Observação para o Financeiro (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onVerRelacao} disabled={enviando}>
            <FileSearch className="mr-2 h-4 w-4" />
            Ver a relação antes de enviar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={() => void enviar()} disabled={enviando}>
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar ao financeiro
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RepasseComercial;
