// Aba Oportunidades — a fila do time de Garantia.
// Ranqueada por comissão esperada × urgência × probabilidade de subscrição.

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useFila, type FiltroFila } from "@/hooks/use-analise-background";
import { brl, brlCurto, cnpjFmt, dataFmt, num, tituloCase } from "@/lib/ab-format";
import {
  CATALOGO_GATILHOS, MODALIDADE_LABEL, STATUS_LABEL,
  type Modalidade, type StatusLead,
} from "@/lib/ab-types";
import {
  AvisoDemo, BarraProbabilidade, Dinheiro, EstadoVazio, GatilhoBadge, PrazoBadge,
} from "@/components/analise-background/AbBits";

interface PropsFila {
  onAbrirLead: (id: string) => void;
  /**
   * Quando a fila é renderizada dentro de uma aba de ramo, a modalidade
   * vem fixada e o seletor de modalidade desaparece — deixar um filtro
   * que contradiz a aba em que a pessoa está é convite a erro de leitura.
   */
  modalidade?: Modalidade;
}

export default function FilaGarantias({ onAbrirLead, modalidade }: PropsFila) {
  const [filtro, setFiltro] = useState<FiltroFila>({
    bloqueados: "ocultar",
    ordenarPor: "prioridade",
    modalidade,
  });

  // troca de aba: refaz o filtro preservando o resto
  useEffect(() => {
    setFiltro((f) => (f.modalidade === modalidade ? f : { ...f, modalidade }));
  }, [modalidade]);
  const [busca, setBusca] = useState("");
  const { data, isLoading, error } = useFila(filtro);

  const kpi = useMemo(() => {
    const linhas = data ?? [];
    const ativos = linhas.filter((l) => !l.bloqueios);
    return {
      leads: ativos.length,
      bloqueados: linhas.length - ativos.length,
      is: ativos.reduce((s, l) => s + Number(l.importancia_segurada), 0),
      premio: ativos.reduce((s, l) => s + Number(l.premio_estimado), 0),
      comissao: ativos.reduce((s, l) => s + Number(l.comissao_estimada), 0),
      economia: ativos.reduce((s, l) => s + Number(l.economia_cliente), 0),
      urgentes: ativos.filter(
        (l) => l.dias_para_prazo !== null && l.dias_para_prazo <= 15,
      ).length,
    };
  }, [data]);

  const temDemo = (data ?? []).some((l) => l.razao_social.startsWith("DEMO "));

  const aplicarBusca = () => setFiltro((f) => ({ ...f, busca }));

  if (error) {
    return (
      <EstadoVazio
        titulo="Não foi possível carregar a fila"
        detalhe={(error as Error).message}
      />
    );
  }

  return (
    <div className="space-y-5">
      {temDemo && <AvisoDemo />}

      {/* O time precisa saber, na tela, o que é fato e o que é conta. Um
          número sem essa ressalva vira promessa na boca de quem vende. */}
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
        <strong className="text-foreground">Prêmio e comissão são estimativas</strong> —
        aritmética sobre os parâmetros em Administração › Fontes, não cotação. Servem para
        ordenar a fila e dimensionar o esforço. O que decide se é lead está no dossiê:
        o gatilho, a evidência e o que falta confirmar.
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiSimples valor={num(kpi.leads)} rotulo="Leads ativos"
          apoio={`${kpi.bloqueados} com filtro negativo`} />
        <KpiSimples valor={brlCurto(kpi.is)} rotulo="Importância segurada"
          apoio="soma da carteira mapeada" />
        <KpiSimples valor={brlCurto(kpi.premio)} rotulo="Prêmio estimado/ano"
          apoio="taxa de referência × IS" />
        <KpiSimples valor={brlCurto(kpi.comissao)} rotulo="Comissão estimada" destaque
          apoio="sobre o prêmio estimado" />
        <KpiSimples valor={num(kpi.urgentes)} rotulo="Prazo em ≤ 15 dias"
          apoio="ação imediata" />
        <KpiSimples valor={brlCurto(kpi.economia)} rotulo="Economia p/ clientes"
          apoio="capital liberado × Selic − prêmio" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {!modalidade && (
          <Select
            value={filtro.modalidade ?? "todas"}
            onValueChange={(v) =>
              setFiltro((f) => ({ ...f, modalidade: v === "todas" ? undefined : v }))}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as modalidades</SelectItem>
              {Object.entries(MODALIDADE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filtro.gatilho ?? "todos"}
          onValueChange={(v) => setFiltro((f) => ({ ...f, gatilho: v === "todos" ? undefined : v }))}
        >
          <SelectTrigger className="w-[230px]"><SelectValue placeholder="Gatilho" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os gatilhos</SelectItem>
            {CATALOGO_GATILHOS.map((g) => (
              <SelectItem key={g.codigo} value={g.codigo}>
                {g.codigo} — {g.nome.slice(0, 34)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtro.status ?? "todos"}
          onValueChange={(v) => setFiltro((f) => ({ ...f, status: v === "todos" ? undefined : v }))}
        >
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtro.bloqueados}
          onValueChange={(v) => setFiltro((f) => ({ ...f, bloqueados: v as FiltroFila["bloqueados"] }))}
        >
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ocultar">Ocultar bloqueados</SelectItem>
            <SelectItem value="mostrar">Mostrar bloqueados</SelectItem>
            <SelectItem value="somente">Somente bloqueados</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtro.ordenarPor}
          onValueChange={(v) => setFiltro((f) => ({ ...f, ordenarPor: v as FiltroFila["ordenarPor"] }))}
        >
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="prioridade">Ordenar por prioridade</SelectItem>
            <SelectItem value="comissao_estimada">Ordenar por comissão</SelectItem>
            <SelectItem value="deadline">Ordenar por prazo</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Empresa ou CNPJ"
            className="w-[220px]"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && aplicarBusca()}
          />
          <Button variant="secondary" onClick={aplicarBusca}>Buscar</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !data?.length ? (
        <EstadoVazio
          titulo="Nenhuma oportunidade com esses filtros"
          detalhe="Se a base está vazia, rode a ingestão na aba Fontes e depois o motor. Para ver o módulo funcionando sem contrato de dados, execute select ab_seed_demo() no SQL Editor."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-[92px]">Prio</TableHead>
                <TableHead className="min-w-[240px]">Empresa</TableHead>
                <TableHead className="min-w-[190px]">Modalidade / produto</TableHead>
                <TableHead>Gatilhos</TableHead>
                <TableHead className="text-right">IS</TableHead>
                <TableHead className="text-right">Prêmio/ano</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Subscr.</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((l) => (
                <TableRow
                  key={l.lead_id}
                  className="cursor-pointer"
                  onClick={() => onAbrirLead(l.lead_id)}
                >
                  <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                    {num(l.prioridade, 0)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{tituloCase(l.razao_social)}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {cnpjFmt(l.cnpj)} · {l.uf ?? "—"}
                      {l.relacao === "cliente" && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">cliente</Badge>
                      )}
                      {l.monitorado && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">monitorada</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px]">{MODALIDADE_LABEL[l.modalidade]}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{l.produto}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(l.gatilhos ?? []).map((g) => <GatilhoBadge key={g} codigo={g} />)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right"><Dinheiro valor={l.importancia_segurada} /></TableCell>
                  <TableCell className="text-right"><Dinheiro valor={l.premio_estimado} /></TableCell>
                  <TableCell className="text-right"><Dinheiro valor={l.comissao_estimada} forte /></TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.deadline ? (
                      <div className="space-y-1">
                        <div className="text-xs">{dataFmt(l.deadline)}</div>
                        <PrazoBadge dias={l.dias_para_prazo} />
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><BarraProbabilidade valor={Number(l.prob_subscricao)} /></TableCell>
                  <TableCell>
                    {l.bloqueios?.length ? (
                      <Badge variant="destructive" className="text-[10px]">bloqueado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        {STATUS_LABEL[l.status as StatusLead] ?? l.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!!data?.length && (
        <p className="text-xs text-muted-foreground">
          {data.length} linha(s) · comissão potencial somada {brl(kpi.comissao)} ·
          clique em qualquer linha para abrir o dossiê com a evidência e a minuta.
        </p>
      )}
    </div>
  );
}

function KpiSimples({
  valor, rotulo, apoio, destaque,
}: { valor: string; rotulo: string; apoio?: string; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-primary/40" : undefined}>
      <CardContent className="p-4">
        <div className="text-xl font-semibold tracking-tight tabular-nums">{valor}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
          {rotulo}
        </div>
        {apoio && <div className="text-xs text-muted-foreground/80 mt-1">{apoio}</div>}
      </CardContent>
    </Card>
  );
}
