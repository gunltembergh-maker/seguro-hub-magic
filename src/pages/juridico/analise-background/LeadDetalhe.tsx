// Dossiê do lead: gatilhos com a EVIDÊNCIA (o trecho do andamento que
// disparou), precificação, simulador e a minuta de apoio.
//
// É a tela que o corretor abre antes de ligar para o cliente.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useLead, useMoverLead } from "@/hooks/use-analise-background";
import {
  brl, cnpjFmt, dataFmt, num, pct, processoFmt, tituloCase,
} from "@/lib/ab-format";
import {
  CATALOGO_GATILHOS, MODALIDADE_LABEL, STATUS_LABEL, type StatusLead,
} from "@/lib/ab-types";
import {
  AConfirmar, Dinheiro, Estimado, EstadoVazio, GatilhoBadge, AbKpi,
  QualidadeLead, RestritivoBadge, SinalChip,
} from "@/components/analise-background/AbBits";

const GAT = new Map(CATALOGO_GATILHOS.map((g) => [g.codigo, g]));
const SINAIS_RELEVANTES = new Set([
  "BLOQUEIO_ATIVOS", "PENHORA_DEFERIDA", "ARRESTO", "EXIGE_GARANTIA",
  "DEPOSITO_RECURSAL", "SENTENCA_CONDENATORIA", "EXECUCAO_FISCAL", "GARANTIA_ACEITA",
]);

export default function LeadDetalhe({
  leadId, onVoltar,
}: { leadId: string; onVoltar: () => void }) {
  const { data, isLoading, error } = useLead(leadId);
  const mover = useMoverLead();
  const [nota, setNota] = useState("");
  const [novoStatus, setNovoStatus] = useState<StatusLead | "">("");

  // simulador
  const [simValor, setSimValor] = useState<number | null>(null);
  const [simTaxa, setSimTaxa] = useState(1.5);
  const [simSelic, setSimSelic] = useState(15);

  const sim = useMemo(() => {
    if (!data) return null;
    const { lead } = data;
    const fator = Number(lead.valor_base) > 0
      ? Number(lead.importancia_segurada) / Number(lead.valor_base)
      : 1;
    const base = simValor ?? Number(lead.valor_base);
    const is = base * fator;
    const premio = is * (simTaxa / 100);
    const ehPercentual = lead.modalidade === "LICITACAO" || lead.modalidade === "PERFORMANCE";
    const custoCaixa = base * (ehPercentual ? fator : 1) * (simSelic / 100);
    return {
      base, is, premio,
      custoCaixa,
      economia: Math.max(0, custoCaixa - premio),
      spread: simSelic - simTaxa,
    };
  }, [data, simValor, simTaxa, simSelic]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return <EstadoVazio titulo="Lead não encontrado" detalhe={(error as Error)?.message} />;
  }

  const { lead, empresa, eventos, processos, inscricoes, contratos, restritivos, socios } = data;
  const dividaTotal = inscricoes.reduce((s, i) => s + Number(i.valor), 0);
  const processosRelevantes = processos.filter(
    (p) => eventos.some((ev) => ev.referencia === p.numero) ||
      p.fase === "EXECUCAO" || p.fase === "RECURSAL",
  );

  const salvarStatus = async () => {
    if (!novoStatus) return;
    try {
      await mover.mutateAsync({ leadId, status: novoStatus, nota: nota || undefined });
      toast.success(`Lead movido para ${STATUS_LABEL[novoStatus]}`);
      setNota("");
      setNovoStatus("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={onVoltar} className="-ml-2 mb-1">
            ← voltar para a fila
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">
            {tituloCase(empresa.razao_social)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {cnpjFmt(empresa.cnpj)} · {empresa.cnae_descricao ?? "—"} ·{" "}
            {empresa.municipio ?? ""} {empresa.uf ?? ""} · porte {empresa.porte ?? "—"} ·
            capital {brl(empresa.capital_social)}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Mover no funil</Label>
            <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as StatusLead)}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={salvarStatus} disabled={!novoStatus || mover.isPending}>
            {mover.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {!!lead.bloqueios?.length && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">
              Filtro negativo acionado — não acionar o comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[13px] space-y-1.5">
            <ul className="list-disc pl-5 space-y-0.5">
              {lead.bloqueios.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <p className="text-muted-foreground">
              O lead fica na base para histórico. A seguradora provavelmente não subscreve, e o
              contato queima credibilidade com ela.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <AbKpi valor={brl(lead.importancia_segurada)} rotulo="Importância segurada"
          apoio={`valor base ${brl(lead.valor_base)}${
            ["JUDICIAL", "FISCAL"].includes(lead.modalidade) ? " + 30% (execução)" : ""}`} />
        <AbKpi valor={brl(lead.premio_estimado)} rotulo="Prêmio anual (ref.)"
          apoio="faixa de 0,5% a 3,0% a.a." />
        <AbKpi valor={`${num(Number(lead.prob_subscricao) * 100, 0)}%`}
          rotulo="Prob. de subscrição" apoio="heurística — calibrar com seguradoras" />
        <AbKpi valor={lead.deadline ? dataFmt(lead.deadline) : "—"} rotulo="Prazo mais próximo"
          apoio={`urgência ${num(Number(lead.urgencia) * 100, 0)}%`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
        {/* ---------------- coluna esquerda ---------------- */}
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Por que isto é um lead
            </h3>
            {eventos.map((ev) => {
              const meta = GAT.get(ev.gatilho);
              return (
                <Card key={ev.id}>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <GatilhoBadge codigo={ev.gatilho} />
                      <span className="font-medium text-[14px]">{meta?.nome ?? ev.gatilho}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {MODALIDADE_LABEL[ev.modalidade]}
                      </Badge>
                      <QualidadeLead confianca={Number(ev.confianca)} />
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                        {/^\d/.test(ev.referencia) ? processoFmt(ev.referencia) : ev.referencia}
                      </span>
                    </div>

                    <p className="text-[13px] leading-relaxed">{ev.descricao}</p>

                    {meta?.produto && (
                      <p className="text-[13px]">
                        <span className="text-muted-foreground">O que a Lavoro atende: </span>
                        <strong className="font-medium">{meta.produto}</strong>
                      </p>
                    )}

                    <AConfirmar itens={ev.evidencia?.verificar} />

                    {ev.evidencia?.trecho && (
                      <blockquote className="border-l-2 border-primary/60 pl-3 py-1 text-[13px] italic text-muted-foreground">
                        “{ev.evidencia.trecho}”
                      </blockquote>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>Valor base: {brl(ev.valor_base)}</span>
                      {ev.deadline && <span>· prazo {dataFmt(ev.deadline)}</span>}
                      {!!ev.evidencia?.sinais?.length && (
                        <span className="flex items-center gap-1">
                          · sinais:{" "}
                          {ev.evidencia.sinais.map((s) => <SinalChip key={s} nome={s} />)}
                        </span>
                      )}
                      <span>· fonte: {meta?.fonte ?? "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {!!processosRelevantes.length && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Processos relacionados ({processosRelevantes.length})
              </h3>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processo</TableHead>
                      <TableHead>Área / tribunal</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="min-w-[260px]">Movimentação relevante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processosRelevantes.map((p) => {
                      const movs = (p.ab_movimentacao ?? [])
                        .slice()
                        .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
                      const rel = movs.find((m) =>
                        (m.sinais ?? []).some((s) => SINAIS_RELEVANTES.has(s)),
                      ) ?? movs[0];
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-[11px]">
                            {processoFmt(p.numero)}
                          </TableCell>
                          <TableCell className="text-[13px]">
                            {p.area ?? "—"}
                            <div className="text-xs text-muted-foreground">
                              {p.tribunal ?? ""} {p.orgao_julgador ?? ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            {p.fase ? (
                              <Badge
                                variant={p.fase === "EXECUCAO" ? "destructive" : "secondary"}
                                className="text-[10px]"
                              >
                                {p.fase}
                              </Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                            {p.garantia_prestada && (
                              <Badge variant="outline" className="text-[10px] ml-1">garantido</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dinheiro valor={p.valor_execucao ?? p.valor_causa} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {rel ? (
                              <>
                                <span className="font-medium text-foreground">
                                  {dataFmt(rel.data)} · {rel.tipo ?? ""}
                                </span>
                                <div className="line-clamp-3">{rel.texto}</div>
                              </>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Argumento e minuta de apoio
            </h3>
            <Card>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed max-h-[520px] overflow-y-auto">
                  {lead.argumento ?? "—"}
                </pre>
                <p className="text-xs text-muted-foreground mt-3">
                  Modelo de apoio gerado automaticamente. Revisar com o advogado do cliente
                  antes do protocolo — não constitui parecer jurídico.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* ---------------- coluna direita ---------------- */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Simulador</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Label className="text-xs">Valor base</Label>
                <Input
                  type="number" className="w-[150px] h-8"
                  value={simValor ?? Math.round(Number(lead.valor_base))}
                  onChange={(e) => setSimValor(Number(e.target.value))}
                />
                <Label className="text-xs">Taxa (% a.a.)</Label>
                <Input
                  type="number" step="0.05" className="w-[150px] h-8"
                  value={simTaxa} onChange={(e) => setSimTaxa(Number(e.target.value))}
                />
                <Label className="text-xs">Selic (% a.a.)</Label>
                <Input
                  type="number" step="0.25" className="w-[150px] h-8"
                  value={simSelic} onChange={(e) => setSimSelic(Number(e.target.value))}
                />
              </div>
              <Separator />
              {sim && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                  <dt className="text-muted-foreground">Importância segurada</dt>
                  <dd className="text-right font-medium tabular-nums">{brl(sim.is)}</dd>
                  <dt className="text-muted-foreground">Prêmio anual</dt>
                  <dd className="text-right tabular-nums">{brl(sim.premio)}</dd>
                  <dt className="text-muted-foreground">Custo de imobilizar</dt>
                  <dd className="text-right tabular-nums">{brl(sim.custoCaixa)}</dd>
                  <dt className="text-muted-foreground">Economia líquida</dt>
                  <dd className="text-right font-semibold tabular-nums text-primary">
                    {brl(sim.economia)}
                  </dd>
                  <dt className="text-muted-foreground">Vantagem</dt>
                  <dd className="text-right tabular-nums">{num(sim.spread, 1)} p.p. ao ano</dd>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Restritivos e fiscal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              {restritivos.filter((r) => r.ativo).map((r) => (
                <div key={r.id} className="flex items-start gap-2">
                  <RestritivoBadge tipo={r.tipo} />
                  <span className="text-muted-foreground">
                    {r.descricao ?? "—"}{r.valor ? ` — ${brl(r.valor)}` : ""}
                  </span>
                </div>
              ))}
              {!!inscricoes.length && (
                <div className="pt-1">
                  <span className="text-muted-foreground">Dívida ativa: </span>
                  <span className="font-medium">
                    {inscricoes.length} inscrição(ões) — {brl(dividaTotal)}
                  </span>
                </div>
              )}
              {!restritivos.some((r) => r.ativo) && !inscricoes.length && (
                <p className="text-muted-foreground">Nada encontrado nas fontes consultadas.</p>
              )}
            </CardContent>
          </Card>

          {!!contratos.length && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Contratos públicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px]">
                {contratos.slice(0, 5).map((c) => (
                  <div key={c.id}>
                    <div className="font-medium">{brl(c.valor)} · {c.orgao ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.identificador} · assinado {dataFmt(c.data_assinatura)}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{c.objeto}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {!!socios.length && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Quadro societário</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-[13px]">
                {socios.map((s) => (
                  <div key={s.id}>
                    <span className="text-muted-foreground">{s.qualificacao ?? "—"}: </span>
                    {s.nome}{" "}
                    <span className="text-xs text-muted-foreground">{s.documento_mascarado ?? ""}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  CPF de sócio é dado pessoal — armazenado mascarado, como na base da Receita.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Nota do comercial</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={4}
                placeholder="O que foi conversado, objeção, próximo passo…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A nota é gravada junto com a mudança de status, com autor e data.
              </p>
              {lead.observacao && (
                <p className="text-[13px] border-l-2 pl-3 text-muted-foreground">
                  Última nota: {lead.observacao}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
