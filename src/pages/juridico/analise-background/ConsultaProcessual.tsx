// =====================================================================
// Consulta processual — a tela do Jurídico.
//
// Mesmo acervo da originação, leitura diferente. Aqui não há prêmio,
// comissão nem prioridade: quem instrui um caso não tem por que ver a
// fila de vendas, e a view ab_v_processo simplesmente não expõe esses
// campos. A separação é no banco, não só no layout.
//
// O que o Jurídico precisa e a fila comercial não mostra: o texto do
// andamento com o sinal que o classificador marcou. É a evidência.
// =====================================================================

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useAndamentos, useProcessos, type FiltroProcesso,
} from "@/hooks/use-analise-background";
import { brl, brlCurto, cnpjFmt, dataFmt, num, processoFmt } from "@/lib/ab-format";
import { EstadoVazio, SinalChip } from "@/components/analise-background/AbBits";

const FASES = ["CONHECIMENTO", "RECURSAL", "EXECUCAO"];

export default function ConsultaProcessual() {
  const [filtro, setFiltro] = useState<FiltroProcesso>({ ordenarPor: "valor" });
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const { data, isLoading, error } = useProcessos(filtro);

  if (error) {
    return (
      <EstadoVazio
        titulo="Não foi possível carregar o acervo"
        detalhe={(error as Error).message}
      />
    );
  }

  const linhas = data ?? [];
  const totalExec = linhas.reduce(
    (s, p) => s + Number(p.valor_execucao ?? p.valor_causa ?? 0), 0,
  );
  const comConstricao = linhas.filter((p) => p.movimentacoes_constricao > 0).length;
  const comExigencia = linhas.filter((p) => p.movimentacoes_exigencia > 0).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Processos" valor={num(linhas.length)} />
        <Kpi rotulo="Exposição somada" valor={brlCurto(totalExec)}
          nota="valor de execução, ou da causa quando não há" />
        <Kpi rotulo="Com indício de constrição" valor={num(comConstricao)}
          nota="penhora, bloqueio ou arresto no texto" />
        <Kpi rotulo="Com exigência de garantia" valor={num(comExigencia)}
          nota="intimação para garantir o juízo" />
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="ab-busca-proc" className="text-[11px]">Busca</Label>
          <Input
            id="ab-busca-proc"
            className="w-[280px]"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setFiltro((f) => ({ ...f, busca }))}
            placeholder="razão social, CNPJ ou número do processo"
          />
        </div>
        <Button variant="secondary" onClick={() => setFiltro((f) => ({ ...f, busca }))}>
          Buscar
        </Button>

        <Select
          value={filtro.fase ?? "todas"}
          onValueChange={(v) => setFiltro((f) => ({ ...f, fase: v === "todas" ? undefined : v }))}
        >
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as fases</SelectItem>
            {FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filtro.polo ?? "todos"}
          onValueChange={(v) => setFiltro((f) => ({ ...f, polo: v === "todos" ? undefined : v }))}
        >
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Polo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Ativo e passivo</SelectItem>
            <SelectItem value="PASSIVO">Só passivo</SelectItem>
            <SelectItem value="ATIVO">Só ativo</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtro.ordenarPor ?? "valor"}
          onValueChange={(v) =>
            setFiltro((f) => ({ ...f, ordenarPor: v as FiltroProcesso["ordenarPor"] }))}
        >
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="valor">Maior exposição</SelectItem>
            <SelectItem value="recente">Andamento mais recente</SelectItem>
            <SelectItem value="constricao">Mais indícios de constrição</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <Checkbox
            checked={!!filtro.somenteConstricao}
            onCheckedChange={(c) => setFiltro((f) => ({ ...f, somenteConstricao: !!c }))}
          />
          Só com constrição
        </label>

        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <Checkbox
            checked={!!filtro.semGarantia}
            onCheckedChange={(c) => setFiltro((f) => ({ ...f, semGarantia: !!c }))}
          />
          Sem garantia prestada
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !linhas.length ? (
        <EstadoVazio
          titulo="Nenhum processo com esse recorte"
          detalhe={
            "Se a base estiver vazia para este documento, use Solicitar pesquisa. " +
            "Sem bureau contratado, processo por documento com texto de andamento " +
            "não entra sozinho."
          }
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Parte</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead className="text-right">Exposição</TableHead>
                <TableHead>Sinais</TableHead>
                <TableHead>Último andamento</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((p) => (
                <Fragment key={p.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setAberto(aberto === p.id ? null : p.id)}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {processoFmt(p.numero)}
                      {p.garantia_prestada && (
                        <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                          garantia prestada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.razao_social}
                      <span className="block text-muted-foreground font-mono">
                        {cnpjFmt(p.cnpj)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {p.tribunal ?? "—"}{p.uf ? ` · ${p.uf}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.fase ?? "—"}
                      <span className="block text-muted-foreground">{p.polo ?? ""}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {brl(Number(p.valor_execucao ?? p.valor_causa ?? 0))}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {p.movimentacoes_constricao > 0 && (
                          <Badge variant="outline"
                            className="text-[10px] border-destructive/40 text-destructive">
                            {p.movimentacoes_constricao} constrição
                          </Badge>
                        )}
                        {p.movimentacoes_exigencia > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {p.movimentacoes_exigencia} exigência
                          </Badge>
                        )}
                        {!p.movimentacoes_constricao && !p.movimentacoes_exigencia && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {dataFmt(p.ultima_movimentacao)}
                      <span className="block text-muted-foreground">
                        {num(p.movimentacoes)} andamento(s)
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {aberto === p.id ? "fechar" : "abrir"}
                    </TableCell>
                  </TableRow>
                  {aberto === p.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 p-0">
                        <Andamentos processoId={p.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground max-w-3xl">
        Esta tela não mostra prêmio, comissão nem prioridade — a view que a alimenta não expõe
        esses campos. Processo em segredo de justiça fica fora de tudo, por lei, e ordens
        SISBAJUD frequentemente tramitam em expediente restrito: dimensione por recall, não
        prometa completude.
      </p>
    </div>
  );
}

function Andamentos({ processoId }: { processoId: string }) {
  const { data, isLoading } = useAndamentos(processoId);
  if (isLoading) return <div className="p-4"><Skeleton className="h-24 w-full" /></div>;
  if (!data?.length) {
    return (
      <p className="p-4 text-[13px] text-muted-foreground">
        Sem andamento gravado. Sem bureau contratado, o Hub conhece o processo mas não o texto.
      </p>
    );
  }
  return (
    <ol className="divide-y">
      {data.map((m) => (
        <li key={m.id} className="p-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">{dataFmt(m.data)}</span>
            {m.tipo && <span>{m.tipo}</span>}
            {m.codigo_tpu && <span className="font-mono">TPU {m.codigo_tpu}</span>}
            {m.fonte && <span className="opacity-70">{m.fonte}</span>}
            <div className="flex flex-wrap gap-1">
              {(m.sinais ?? []).map((s) => <SinalChip key={s} nome={s} />)}
            </div>
          </div>
          <p className="text-[13px] whitespace-pre-wrap">{m.texto ?? "—"}</p>
        </li>
      ))}
    </ol>
  );
}

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <p className="text-xl font-semibold tabular-nums">{valor}</p>
        {nota && <p className="text-[11px] text-muted-foreground mt-0.5">{nota}</p>}
      </CardContent>
    </Card>
  );
}
