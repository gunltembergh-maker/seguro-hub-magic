// =====================================================================
// Cotas e custos.
//
// Consulta em bureau é tarifada por documento. Sem teto visível, a
// primeira notícia do gasto é a fatura. Aqui o teto é por área
// (profiles.area, a noção de time que o Hub já tem) e por mês.
//
// Semântica dos limites, igual à do banco e dita na tela:
//   vazio → sem teto      0 → área bloqueada      N → teto de N
//
// Quem edita precisa da chave ab_cota_gerir. Quem não tem, vê só a
// própria área — e vê, porque saber quanto sobrou é parte do trabalho.
// =====================================================================

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  useCotas, useDefinirCota, useMinhaArea, useProvedores,
} from "@/hooks/use-analise-background";
import { brl, dataFmt, num } from "@/lib/ab-format";
import type { Cota, SituacaoCota } from "@/lib/ab-types";
import { EstadoVazio } from "@/components/analise-background/AbBits";

const TOM: Record<SituacaoCota, string> = {
  OK: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  ATENCAO: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  ESGOTADA: "bg-destructive/10 text-destructive border-destructive/30",
  BLOQUEADA: "bg-destructive/10 text-destructive border-destructive/30",
  SEM_TETO: "bg-muted text-muted-foreground",
};

const ROTULO: Record<SituacaoCota, string> = {
  OK: "Dentro do teto",
  ATENCAO: "Perto do teto",
  ESGOTADA: "Esgotada",
  BLOQUEADA: "Bloqueada",
  SEM_TETO: "Sem teto",
};

export default function CotasCustos({ podeGerir }: { podeGerir: boolean }) {
  const { data: cotas, isLoading } = useCotas();
  const { data: area } = useMinhaArea();
  const { data: provedores } = useProvedores();
  const definir = useDefinirCota();
  const [editando, setEditando] = useState<string | null>(null);
  const [consultas, setConsultas] = useState("");
  const [valor, setValor] = useState("");

  const provedorAtivo = (provedores ?? []).find(
    (p) => p.ativo && p.capacidades.processos_por_documento,
  );

  const mesAtual = new Date().toISOString().slice(0, 8) + "01";
  const doMes = (cotas ?? []).filter((c) => c.mes === mesAtual);
  const anteriores = (cotas ?? []).filter((c) => c.mes !== mesAtual);

  const abrir = (c: Cota) => {
    setEditando(c.id);
    setConsultas(c.limite_consultas === null ? "" : String(c.limite_consultas));
    setValor(c.limite_valor === null ? "" : String(c.limite_valor));
  };

  const salvar = async (c: Cota) => {
    try {
      await definir.mutateAsync({
        area: c.area,
        mes: c.mes,
        limiteConsultas: consultas.trim() === "" ? null : Number(consultas),
        limiteValor: valor.trim() === "" ? null : Number(valor),
      });
      toast.success(`Teto de "${c.area}" atualizado`);
      setEditando(null);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: (e as Error).message });
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <Card className="bg-muted/40">
        <CardContent className="pt-4 text-[13px] space-y-1">
          {provedorAtivo ? (
            <p>
              Fornecedor ativo: <strong>{provedorAtivo.nome}</strong> ·{" "}
              {provedorAtivo.custo_consulta > 0
                ? `${brl(provedorAtivo.custo_consulta)} por consulta`
                : "tarifa não cadastrada em ab_provedor — o teto não freia nada enquanto ela for zero"}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Nenhum bureau contratado. Nada é tarifado hoje, e o teto abaixo passa a valer
              no dia em que você definir <code>BUREAU_PROVIDER</code> e ativar o fornecedor.
            </p>
          )}
          <p className="text-muted-foreground">
            Campo vazio significa <strong>sem teto</strong>. Zero significa{" "}
            <strong>área bloqueada</strong>. A cota do mês é criada sozinha na primeira consulta
            da área.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Mês corrente
        </h3>
        {!doMes.length ? (
          <EstadoVazio
            titulo="Nenhuma cota neste mês"
            detalhe="A linha aparece na primeira consulta tarifada de cada área."
          />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Consultas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Atualizado</TableHead>
                  {podeGerir && <TableHead className="text-right">Teto</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {doMes.map((c) => {
                  const pctConsultas = c.limite_consultas
                    ? Math.min(100, (c.consumido_consultas / c.limite_consultas) * 100)
                    : 0;
                  return (
                    <TableRow key={c.id} className={c.area === area ? "bg-primary/5" : undefined}>
                      <TableCell className="text-xs font-medium">
                        {c.area}
                        {c.area === area && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">sua área</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline"
                          className={`text-[11px] font-normal ${TOM[c.situacao]}`}>
                          {ROTULO[c.situacao]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums min-w-[150px]">
                        {num(c.consumido_consultas)} / {c.limite_consultas ?? "∞"}
                        {c.limite_consultas ? (
                          <Progress value={pctConsultas} className="h-1.5 mt-1" />
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {brl(c.consumido_valor)} / {c.limite_valor === null ? "∞" : brl(c.limite_valor)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {dataFmt(c.updated_at)}
                      </TableCell>
                      {podeGerir && (
                        <TableCell className="text-right">
                          {editando === c.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Input
                                className="h-8 w-24"
                                value={consultas}
                                onChange={(e) => setConsultas(e.target.value)}
                                placeholder="consultas"
                                inputMode="numeric"
                              />
                              <Input
                                className="h-8 w-24"
                                value={valor}
                                onChange={(e) => setValor(e.target.value)}
                                placeholder="R$"
                                inputMode="decimal"
                              />
                              <Button size="sm" onClick={() => salvar(c)}
                                disabled={definir.isPending}>
                                Salvar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => abrir(c)}>
                              Ajustar
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {!podeGerir && (
          <p className="text-[11px] text-muted-foreground">
            Você vê o consumo, mas ajustar o teto exige a chave <code>ab_cota_gerir</code>.
          </p>
        )}
      </section>

      {anteriores.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Meses anteriores
          </h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Consultas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anteriores.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{c.mes.slice(0, 7)}</TableCell>
                    <TableCell className="text-xs">{c.area}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {num(c.consumido_consultas)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {brl(c.consumido_valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Fornecedores cadastrados
        </h3>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Processo por documento</TableHead>
                <TableHead>Texto do andamento</TableHead>
                <TableHead>Filtro de termo</TableHead>
                <TableHead className="text-right">Por consulta</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(provedores ?? []).map((p) => (
                <TableRow key={p.chave} className={p.ativo ? "bg-primary/5" : undefined}>
                  <TableCell className="text-xs font-medium">
                    {p.nome}
                    {p.ativo && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell><Sim v={p.capacidades.processos_por_documento} /></TableCell>
                  <TableCell><Sim v={p.capacidades.texto_andamento} /></TableCell>
                  <TableCell><Sim v={p.capacidades.filtro_termos} /></TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {p.custo_consulta > 0 ? brl(p.custo_consulta) : "—"}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground max-w-md">
                    {p.observacao}
                    {p.doc_url && (
                      <a href={p.doc_url} target="_blank" rel="noreferrer"
                        className="ml-1 underline">doc</a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-3xl">
          A coluna que decide a contratação é <strong>filtro de termo</strong>: filtro nativo de
          palavra-chave no andamento. Com ele, o gatilho de penhora/bloqueio (T4) é uma
          configuração; sem ele, é varredura do acervo inteiro, e o custo cresce com o tamanho
          da carteira em vez de com o número de eventos. A credencial nunca fica nesta tabela —
          fica no secret <code>BUREAU_API_KEY</code>.
        </p>
      </section>
    </div>
  );
}

function Sim({ v }: { v?: boolean }) {
  return (
    <span className={`text-xs ${v ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
      {v ? "sim" : "não"}
    </span>
  );
}
