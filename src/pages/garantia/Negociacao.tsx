// Quadro de Negociação do ramo Garantia.
//
// As colunas e os status NÃO estão escritos aqui: vêm de
// garantia_status_catalogo (fase = negociacao, ativo = true). Status novo é
// INSERT no catálogo e aparece sem deploy.
//
// Contagem de tempo e SLA só existem para quem tem `menu_garantia_painel`:
// quando a permissão falta, esses elementos não são renderizados.
//
// Nada é escrito em garantia_status_historico pela interface — o relógio é do
// trigger do banco.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Building2, CircleDollarSign, Clock, Inbox, Layers3, Loader2, RotateCcw, Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { GarantiaShell } from "@/components/garantia/garantia-shell";
import { DemandaSheet, SeloProduto } from "@/components/garantia/demanda-sheet";
import { AjudaFase } from "@/components/garantia/ajuda-fase";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import { useCanais, useResponsaveis } from "@/hooks/use-entrada-demandas";
import {
  MOTIVOS_PERDA,
  colunasDoCatalogo,
  impedimentoDaTransicao,
  rotuloMotivoPerda,
  useDemandasNegociacao,
  useInicioDoStatus,
  usePerdas,
  useReabrirPerda,
  useStatusNegociacao,
  useTrocarStatus,
  type DemandaLista,
  type FiltrosNegociacao,
  type FiltrosPerdas,
  type PerdaLista,
  type StatusCatalogo,
} from "@/hooks/use-garantia-negociacao";
import {
  MODALIDADES,
  ROTULO_PRODUTO,
  dataCurta,
  duracaoLegivel,
  horasDesde,
  moeda,
  rotuloEtapa,
  rotuloModalidade,
} from "@/lib/garantia/formato";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erro";
import { useDocsAposPedido } from "@/hooks/use-garantia-comercial";
import { TimeComercialBotao } from "@/components/garantia/time-comercial";

const TODOS = "__todos__";

/* ------------------------------------------------------------------ */
/* Cartão                                                             */
/* ------------------------------------------------------------------ */

const CHIP_SITUACAO: Record<string, string> = {
  aguard_comercial: "Com o comercial",
  aguard_cliente_comercial: "Comercial aguardando cliente",
  aguard_cliente: "Aguardando cliente",
};

function Cartao({
  demanda,
  statusNome,
  statusInterno,
  chegouDocumento,
  slaHoras,
  inicioStatus,
  podeVerTempo,
  responsavel,
  onAbrir,
  onArrastar,
}: {
  demanda: DemandaLista;
  statusNome: string;
  statusInterno: boolean;
  chegouDocumento?: boolean;
  slaHoras: number | null;
  inicioStatus?: string;
  podeVerTempo: boolean;
  responsavel: string | null;
  onAbrir: () => void;
  onArrastar: (e: React.DragEvent) => void;
}) {
  const horasNoStatus = podeVerTempo && inicioStatus ? horasDesde(inicioStatus) : null;
  const slaEstourado = horasNoStatus != null && slaHoras != null && horasNoStatus > slaHoras;
  const informacoes = [
    demanda.segurado?.nome ? { rotulo: demanda.produto === "fianca_locaticia" ? "Locador" : "Segurado", valor: demanda.segurado.nome, Icone: ShieldCheck } : null,
    demanda.modalidade ? { rotulo: "Modalidade", valor: rotuloModalidade(demanda.modalidade), Icone: Layers3 } : null,
    demanda.importancia_segurada != null ? { rotulo: "Importância segurada (R$)", valor: moeda(demanda.importancia_segurada), Icone: CircleDollarSign } : null,
    responsavel ? { rotulo: "Responsável técnico", valor: responsavel, Icone: UserRound } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <button
      type="button"
      draggable={demanda.triagem_completa}
      onDragStart={onArrastar}
      onClick={onAbrir}
      className={cn(
        "w-full rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50",
        !demanda.triagem_completa && "border-warning/60",
      )}
    >
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <AjudaFase etapa={demanda.etapa} />
          <Badge className={cn("max-w-full truncate text-[10px] font-medium", statusInterno ? "bg-primary hover:bg-primary" : "bg-muted text-muted-foreground hover:bg-muted")}>
            {statusNome}
          </Badge>
        </div>
        <SeloProduto produto={demanda.produto} />
      </div>
      <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-card-foreground">
        {demanda.numero} · {demanda.cliente?.nome ?? "Cliente"}
      </h3>

      {informacoes.length ? (
        <div className="mt-3 space-y-2.5">
          {informacoes.map(({ rotulo, valor, Icone }) => (
            <div key={rotulo} className="grid grid-cols-[14px_minmax(0,1fr)] gap-2">
              <Icone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground">{rotulo}</p>
                <p className="line-clamp-2 text-xs font-medium text-card-foreground">{valor}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> dados a conferir</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        {!demanda.triagem_completa && (
          <Badge variant="outline" className="border-warning/60 text-[10px] text-foreground">
            conferência pendente
          </Badge>
        )}
        {chegouDocumento && <Badge variant="secondary" className="text-[10px]">chegou documento depois do pedido</Badge>}
        {demanda.codigo && <Badge variant="outline" className="text-[10px] font-normal">{demanda.codigo}</Badge>}
        {/* Tempo no status e SLA: só para quem tem o Painel da Gerência. */}
        {podeVerTempo && horasNoStatus != null && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {duracaoLegivel(Math.round(horasNoStatus * 3600))} no status
          </span>
        )}
        {podeVerTempo && slaEstourado && (
          <Badge variant="destructive" className="text-[11px]">SLA estourado</Badge>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Quadro                                                             */
/* ------------------------------------------------------------------ */

function Quadro({
  demandas,
  catalogo,
  podeVerTempo,
  nomePessoa,
  onAbrir,
}: {
  demandas: DemandaLista[];
  catalogo: StatusCatalogo[];
  podeVerTempo: boolean;
  nomePessoa: (id: string | null) => string | null;
  onAbrir: (d: DemandaLista) => void;
}) {
  const colunas = useMemo(() => colunasDoCatalogo(catalogo), [catalogo]);
  const { data: inicios = {} } = useInicioDoStatus(podeVerTempo);
  const { data: docsAposPedido } = useDocsAposPedido();
  const trocar = useTrocarStatus();
  const [arrastando, setArrastando] = useState<DemandaLista | null>(null);

  const soltarEm = async (coluna: (typeof colunas)[number]) => {
    const d = arrastando;
    setArrastando(null);
    if (!d) return;
    if (coluna.etapa === d.etapa) return;
    const destino = coluna.entrada;
    if (!destino) return;
    const origem = catalogo.find((s) => s.codigo === d.status_atual);
    // Voltar de etapa pede motivo: pelo quadro não há onde digitar, então abre o card.
    if (origem && destino.ordem < origem.ordem && destino.etapa !== "qualquer" && destino.etapa !== d.etapa) {
      toast.info("Para voltar de etapa, abra o card e escolha o destino: o motivo do retorno é obrigatório.");
      return;
    }
    const impedimento = impedimentoDaTransicao(d, destino, undefined, undefined, undefined, origem);
    if (impedimento) {
      toast.error(impedimento);
      return;
    }
    try {
      await trocar.mutateAsync({ demanda: d, destino });
      toast.success(`Movida para ${rotuloEtapa(coluna.etapa, colunas)}.`);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível mover a demanda."));
    }
  };

  return (
    <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
      {colunas.map((coluna) => {
        const daColuna = demandas.filter((d) => d.etapa === coluna.etapa);
        return (
          <div
            key={coluna.etapa}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => soltarEm(coluna)}
            className="flex w-[280px] shrink-0 flex-col rounded-lg bg-muted/40 p-3 sm:w-[320px]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{rotuloEtapa(coluna.etapa, colunas)}</h2>
              <Badge variant="secondary">{daColuna.length}</Badge>
            </div>
            <div className="space-y-2">
              {daColuna.map((d) => (
                <Cartao
                  key={d.id}
                  demanda={d}
                  statusNome={CHIP_SITUACAO[d.status_atual] ?? (catalogo.find((s) => s.codigo === d.status_atual)?.com_quem === "seguradora" ? "Com a seguradora" : catalogo.find((s) => s.codigo === d.status_atual)?.nome ?? d.status_atual)}
                  statusInterno={catalogo.find((s) => s.codigo === d.status_atual)?.relogio === "interno"}
                  chegouDocumento={docsAposPedido?.has(d.id)}
                  slaHoras={catalogo.find((s) => s.codigo === d.status_atual)?.sla_horas ?? null}
                  inicioStatus={inicios[d.id]}
                  podeVerTempo={podeVerTempo}
                  responsavel={nomePessoa(d.responsavel_tecnico_id)}
                  onAbrir={() => onAbrir(d)}
                  onArrastar={() => setArrastando(d)}
                />
              ))}
              {!daColuna.length && (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nenhuma demanda nesta etapa.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-visão de perdidos                                              */
/* ------------------------------------------------------------------ */

function Perdidos({ podeVerValor, ativo }: { podeVerValor: boolean; ativo: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosPerdas>({});
  const { data: perdas = [], isLoading } = usePerdas(filtros, ativo);
  const reabrir = useReabrirPerda();

  const total = useMemo(
    () =>
      perdas.reduce(
        (soma, p) => soma + (p.premio_estimado ?? 0) + (p.comissao_estimada ?? 0),
        0,
      ),
    [perdas],
  );

  const reabrirPerda = async (p: PerdaLista) => {
    try {
      await reabrir.mutateAsync(p);
      toast.success("Demanda reaberta na etapa em que estava. O registro da perda foi mantido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reabrir.");
    }
  };

  return (
    <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 space-y-1">
          <Label>Motivo</Label>
          <Select
            value={filtros.motivo ?? TODOS}
            onValueChange={(v) => setFiltros({ ...filtros, motivo: v === TODOS ? undefined : v })}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {MOTIVOS_PERDA.map((m) => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
          <div className="min-w-0 space-y-1">
          <Label>De</Label>
          <Input
            type="date"
            value={filtros.de?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setFiltros({ ...filtros, de: e.target.value ? `${e.target.value}T00:00:00` : undefined })
            }
          />
        </div>
          <div className="min-w-0 space-y-1">
          <Label>Até</Label>
          <Input
            type="date"
            value={filtros.ate?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setFiltros({ ...filtros, ate: e.target.value ? `${e.target.value}T23:59:59` : undefined })
            }
          />
        </div>
        {/* Valor deixado na mesa: só para quem tem o Painel da Gerência. */}
        {podeVerValor && (
            <div className="rounded-md border border-border bg-card px-4 py-2 text-sm xl:ml-auto">
            <span className="text-muted-foreground">Deixado na mesa: </span>
            <span className="font-semibold">{moeda(total)}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !perdas.length ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum negócio perdido registrado no período.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Registro</TableHead>
                {podeVerValor && <TableHead className="text-right">Prêmio + comissão</TableHead>}
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perdas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.demanda?.cliente?.nome ?? "—"}</TableCell>
                  <TableCell>
                    {p.demanda ? (ROTULO_PRODUTO[p.demanda.produto] ?? p.demanda.produto) : "—"}
                  </TableCell>
                  <TableCell>{rotuloMotivoPerda(p.motivo)}</TableCell>
                  <TableCell>{rotuloEtapa(p.etapa_perdida)}</TableCell>
                  <TableCell>
                    {dataCurta(p.criado_em)}
                    {p.reaberta_em && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        reaberta em {dataCurta(p.reaberta_em)}
                      </span>
                    )}
                  </TableCell>
                  {podeVerValor && (
                    <TableCell className="text-right">
                      {moeda((p.premio_estimado ?? 0) + (p.comissao_estimada ?? 0))}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reabrir.isPending || p.demanda?.fase === "negociacao"}
                      onClick={() => reabrirPerda(p)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reabrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tela                                                               */
/* ------------------------------------------------------------------ */

export default function Negociacao() {
  const perfil = useMeuPerfilEfetivo();
  const podeVerTempo = hasPermission(perfil, "menu_garantia_painel");

  const [aba, setAba] = useState("quadro");
  const [filtros, setFiltros] = useState<FiltrosNegociacao>({});
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const { data: catalogo = [], isLoading: carregandoCatalogo } = useStatusNegociacao();
  const { data: demandas = [], isLoading } = useDemandasNegociacao({ ...filtros, busca });
  const { data: canais = [] } = useCanais();
  const { data: pessoas = [] } = useResponsaveis();

  const nomePessoa = (id: string | null) =>
    id ? (pessoas.find((p) => p.user_id === id)?.nome ?? null) : null;

  const demandaAberta = demandas.find((d) => d.id === aberta) ?? null;

  // Link do sino: /garantia/negociacao?demanda=<id> abre o card.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("demanda");
    if (id) setAberta(id);
  }, []);

  return (
    <GarantiaShell titulo="Negociação" trilha={["Negociação"]}>
      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <TabsList>
          <TabsTrigger value="quadro">Quadro</TabsTrigger>
          <TabsTrigger value="perdidos">Perdidos</TabsTrigger>
        </TabsList>

        <TabsContent value="quadro" className="space-y-6">
          <div className="flex justify-end">
            <TimeComercialBotao />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1">
              <Label>Produto</Label>
              <Select
                value={filtros.produto ?? TODOS}
                onValueChange={(v) => setFiltros({ ...filtros, produto: v === TODOS ? undefined : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  <SelectItem value="seguro_garantia">Seguro Garantia</SelectItem>
                  <SelectItem value="fianca_locaticia">Fiança Locatícia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label>Modalidade</Label>
              <Select
                value={filtros.modalidade ?? TODOS}
                onValueChange={(v) => setFiltros({ ...filtros, modalidade: v === TODOS ? undefined : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {MODALIDADES.map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>
                  ))}
                  <SelectItem value="locaticia">Locatícia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label>Responsável técnico</Label>
              <Select
                value={filtros.responsavel_tecnico_id ?? TODOS}
                onValueChange={(v) =>
                  setFiltros({ ...filtros, responsavel_tecnico_id: v === TODOS ? undefined : v })
                }
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {pessoas.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label>Canal</Label>
              <Select
                value={filtros.canal_id ?? TODOS}
                onValueChange={(v) => setFiltros({ ...filtros, canal_id: v === TODOS ? undefined : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {canais.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1 sm:col-span-2 xl:col-span-4">
              <Label>Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-full pl-8"
                  placeholder="Buscar por nome ou CNPJ"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isLoading || carregandoCatalogo ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando o quadro…
            </div>
          ) : !demandas.length ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 font-display text-lg font-semibold">Nenhuma demanda ainda</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                As demandas de Garantia nascem na Entrada de Demandas e chegam aqui em Triagem.
              </p>
              <Link
                to="/entrada-demandas"
                className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Abrir a Entrada de Demandas
              </Link>
            </div>
          ) : (
            <Quadro
              demandas={demandas}
              catalogo={catalogo}
              podeVerTempo={podeVerTempo}
              nomePessoa={nomePessoa}
              onAbrir={(d) => setAberta(d.id)}
            />
          )}

          {demandas.some((d) => !d.triagem_completa) && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Cartão com triagem incompleta não pode ser arrastado: complete a etapa 1 no detalhe da demanda.
            </p>
          )}
        </TabsContent>

        <TabsContent value="perdidos">
          <Perdidos podeVerValor={podeVerTempo} ativo={aba === "perdidos"} />
        </TabsContent>
      </Tabs>

      <DemandaSheet
        demanda={demandaAberta}
        catalogo={catalogo}
        podeVerTempo={podeVerTempo}
        onFechar={() => setAberta(null)}
      />
    </GarantiaShell>
  );
}
