// =====================================================================
// Aba "Oportunidades por processo" — a linha que o comercial usa.
//
// A diferença em relação à Fila: a Fila é o PIPELINE (uma linha por
// empresa e modalidade, que é o que um CRM quer). Esta tela é a
// CONSULTA: digita o CNPJ e vê, processo por processo, o que vence
// quando e quanto de garantia precisa. As duas leem a mesma base.
//
// ---------------------------------------------------------------------
// TRÊS REGRAS QUE NÃO SÃO ESTÉTICA
//
// 1. FATO E SIMULAÇÃO NÃO SE MISTURAM NA MESMA COLUNA.
//    Valor de execução vem do processo. IS necessária é ele + 30% (CPC
//    art. 835 §2º). Prêmio e comissão dependem de taxa que varia por
//    seguradora, prazo, limite de crédito e apetite — então vivem no
//    simulador, com o percentual digitado pelo comercial, e não são
//    gravados. Um número calculado com percentual fixo chega à tela com
//    cara de cálculo, e alguém cotaria cliente com ele.
//
// 2. PRAZO ESTIMADO NÃO SE PARECE COM PRAZO LIDO.
//    `deadline_fonte = 'texto'` é data que saiu do andamento e pode ser
//    dita ao cliente. `'padrao'` é estimativa da parametrização e aparece
//    como "estimado". Um comercial que liga afirmando "o senhor tem até
//    dia 20" com base num padrão queima a credibilidade da Lavoro numa
//    ligação — e não teria como saber que a data era palpite.
//
// 3. O PISO CONTA O QUE ESCONDEU.
//    Filtro que oculta sem dizer quantas linhas ocultou é
//    indistinguível de dado que desapareceu. E valor de execução cresce:
//    o processo abaixo do piso hoje pode passar dele depois de uma
//    sentença. Por isso o piso filtra a exibição e nunca apaga evento.
// =====================================================================

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Scale, FileText } from "lucide-react";

import {
  useOportunidades, type FiltroOportunidade,
} from "@/hooks/use-analise-background";
import { simular } from "@/lib/ab/pricing";
import { brl, brlCurto, cnpjFmt, dataFmt, processoFmt, tituloCase } from "@/lib/ab-format";
import {
  MODALIDADE_LABEL, type Modalidade, type Oportunidade,
} from "@/lib/ab-types";
import {
  Dinheiro, EstadoVazio, GatilhoBadge, PrazoBadge, QualidadeLead,
} from "@/components/analise-background/AbBits";

// ---------------------------------------------------------------------
// Prazo: a etiqueta muda conforme a origem da data.
// ---------------------------------------------------------------------
function Prazo({ o }: { o: Oportunidade }) {
  if (!o.deadline) {
    return <span className="text-xs text-muted-foreground">sem prazo declarado</span>;
  }
  const lido = o.deadline_fonte === "texto";
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="tabular-nums text-sm">{dataFmt(o.deadline)}</span>
      <div className="flex items-center gap-1">
        <PrazoBadge dias={o.dias_para_prazo} />
        <Badge
          variant={lido ? "default" : "outline"}
          className={lido ? "" : "border-dashed text-muted-foreground"}
          title={
            lido
              ? "Prazo lido do texto do andamento. Pode ser informado ao cliente."
              : "Prazo ESTIMADO pela parametrização — o andamento não declarou. " +
                "Confirme nos autos antes de informar ao cliente."
          }
        >
          {lido ? "do andamento" : "estimado"}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Simulador. Vive no topo, com as taxas valendo para toda a tabela — é
// assim que o comercial trabalha: uma seguradora por vez.
// ---------------------------------------------------------------------
interface Taxas {
  premioPct: string;
  comissaoPct: string;
}

function frac(v: string): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n / 100 : 0;
}

export default function Oportunidades() {
  const [filtro, setFiltro] = useState<FiltroOportunidade>({
    ocultarGarantidos: true,
    ocultarBloqueados: true,
    somentePassivo: true,
    ordenarPor: "importancia_segurada",
  });
  const [busca, setBusca] = useState("");
  const [pisoTexto, setPisoTexto] = useState("");
  const [taxas, setTaxas] = useState<Taxas>({ premioPct: "", comissaoPct: "" });

  const { data, isLoading, error } = useOportunidades(filtro);
  const linhas = data?.linhas ?? [];

  const tPremio = frac(taxas.premioPct);
  const tComissao = frac(taxas.comissaoPct);
  const simulando = tPremio > 0;

  const totalSimulado = useMemo(() => {
    if (!simulando) return { premio: 0, comissao: 0 };
    return linhas.reduce(
      (acc, o) => {
        const s = simular({
          importanciaSegurada: Number(o.importancia_segurada ?? 0),
          valorImobilizado: Number(o.valor_base ?? 0),
          taxaPremio: tPremio,
          taxaComissao: tComissao,
        });
        return { premio: acc.premio + s.premio, comissao: acc.comissao + s.comissao };
      },
      { premio: 0, comissao: 0 },
    );
  }, [linhas, tPremio, tComissao, simulando]);

  const aplicarBusca = () => setFiltro((f) => ({ ...f, busca }));
  const aplicarPiso = () => {
    const n = Number(pisoTexto.replace(/[^\d]/g, ""));
    setFiltro((f) => ({ ...f, isMinima: Number.isFinite(n) && n > 0 ? n : undefined }));
  };

  return (
    <div className="space-y-4">
      {/* ---------------- consulta ---------------- */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[280px] flex-1 space-y-1">
              <Label htmlFor="op-busca">CNPJ, razão social ou número do processo</Label>
              <div className="flex gap-2">
                <Input
                  id="op-busca"
                  placeholder="33.649.575/0001-99"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && aplicarBusca()}
                />
                <Button onClick={aplicarBusca}>Consultar</Button>
              </div>
            </div>

            <div className="w-[200px] space-y-1">
              <Label htmlFor="op-piso">IS mínima (R$)</Label>
              <Input
                id="op-piso"
                inputMode="numeric"
                placeholder="sem piso"
                value={pisoTexto}
                onChange={(e) => setPisoTexto(e.target.value)}
                onBlur={aplicarPiso}
                onKeyDown={(e) => e.key === "Enter" && aplicarPiso()}
              />
            </div>

            <div className="w-[190px] space-y-1">
              <Label>Modalidade</Label>
              <Select
                value={filtro.modalidade ?? "todas"}
                onValueChange={(v) =>
                  setFiltro((f) => ({ ...f, modalidade: v === "todas" ? undefined : v }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(Object.keys(MODALIDADE_LABEL) as Modalidade[]).map((m) => (
                    <SelectItem key={m} value={m}>{MODALIDADE_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[180px] space-y-1">
              <Label>Vencimento</Label>
              <Select
                value={filtro.venceEmDias === undefined ? "todos" : String(filtro.venceEmDias)}
                onValueChange={(v) =>
                  setFiltro((f) => ({
                    ...f,
                    venceEmDias: v === "todos" ? undefined : Number(v),
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer prazo</SelectItem>
                  <SelectItem value="7">Até 7 dias</SelectItem>
                  <SelectItem value="15">Até 15 dias</SelectItem>
                  <SelectItem value="30">Até 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[190px] space-y-1">
              <Label>Ordenar por</Label>
              <Select
                value={filtro.ordenarPor ?? "importancia_segurada"}
                onValueChange={(v) =>
                  setFiltro((f) => ({ ...f, ordenarPor: v as FiltroOportunidade["ordenarPor"] }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="importancia_segurada">IS necessária</SelectItem>
                  <SelectItem value="deadline">Vencimento</SelectItem>
                  <SelectItem value="valor_base">Valor de execução</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!!filtro.somentePassivo}
                onCheckedChange={(v) => setFiltro((f) => ({ ...f, somentePassivo: v }))}
              />
              Só onde a empresa é ré/executada
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!!filtro.ocultarGarantidos}
                onCheckedChange={(v) => setFiltro((f) => ({ ...f, ocultarGarantidos: v }))}
              />
              Esconder quem já prestou garantia
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!!filtro.ocultarBloqueados}
                onCheckedChange={(v) => setFiltro((f) => ({ ...f, ocultarBloqueados: v }))}
              />
              Esconder empresa bloqueada
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            O filtro de polo passivo existe porque a garantia é do lado que precisa
            garantir. Sem ele, metade da lista seria empresa figurando como autora — e
            oferecer garantia a quem cobra é ligação perdida.
          </p>
        </CardContent>
      </Card>

      {/* ---------------- simulador ---------------- */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-[170px] space-y-1">
              <Label htmlFor="sim-premio">Taxa de prêmio (%)</Label>
              <Input
                id="sim-premio"
                inputMode="decimal"
                placeholder="1,5"
                value={taxas.premioPct}
                onChange={(e) => setTaxas((t) => ({ ...t, premioPct: e.target.value }))}
              />
            </div>
            <div className="w-[170px] space-y-1">
              <Label htmlFor="sim-comissao">Comissão (%)</Label>
              <Input
                id="sim-comissao"
                inputMode="decimal"
                placeholder="ex.: 15"
                value={taxas.comissaoPct}
                onChange={(e) => setTaxas((t) => ({ ...t, comissaoPct: e.target.value }))}
              />
            </div>

            {simulando ? (
              <div className="flex flex-1 flex-wrap gap-6">
                <div>
                  <div className="text-xs text-muted-foreground">Prêmio simulado (soma)</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {brl(totalSimulado.premio)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Comissão simulada (soma)</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {tComissao > 0 ? brl(totalSimulado.comissao) : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="flex-1 text-sm text-muted-foreground">
                Informe a taxa para simular. Nada é calculado sozinho: taxa de prêmio e
                comissão variam por seguradora, prazo, limite de crédito e apetite, e não
                existe percentual único que sirva para todas. A faixa de mercado costuma
                ficar entre 0,5% e 3% ao ano — referência de ordem de grandeza, não cotação.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------- resultado ---------------- */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : error ? (
        <EstadoVazio
          titulo="Não foi possível carregar as oportunidades"
          detalhe={(error as Error).message}
        />
      ) : !linhas.length ? (
        <EstadoVazio
          titulo="Nenhuma oportunidade para estes filtros"
          detalhe={
            data?.abaixoDoPiso
              ? `${data.abaixoDoPiso} linha(s) existem, mas estão abaixo do piso de IS. ` +
                "Baixe o piso para vê-las."
              : "Se você consultou um CNPJ que não está na base, ele ainda não foi " +
                "ingerido nem consultado em bureau — não há processo para analisar."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Processo / fonte</TableHead>
                  <TableHead>Gatilhos</TableHead>
                  <TableHead className="text-right">Valor de execução</TableHead>
                  <TableHead className="text-right">IS necessária</TableHead>
                  {simulando && <TableHead className="text-right">Prêmio</TableHead>}
                  {simulando && tComissao > 0 && (
                    <TableHead className="text-right">Comissão</TableHead>
                  )}
                  <TableHead className="text-right">Vencimento</TableHead>
                  <TableHead>Qualificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((o) => {
                  const s = simular({
                    importanciaSegurada: Number(o.importancia_segurada ?? 0),
                    valorImobilizado: Number(o.valor_base ?? 0),
                    taxaPremio: tPremio,
                    taxaComissao: tComissao,
                  });
                  return (
                    <TableRow key={`${o.empresa_id}-${o.modalidade}-${o.referencia}`}>
                      <TableCell className="align-top">
                        <div className="font-medium leading-tight">
                          {tituloCase(o.razao_social)}
                        </div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {cnpjFmt(o.cnpj)}
                          {o.uf ? ` · ${o.uf}` : ""}
                        </div>
                        {o.telefone && (
                          <a
                            href={`tel:${o.telefone}`}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {o.telefone}
                          </a>
                        )}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {o.origem === "PROCESSO"
                            ? <Scale className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          {o.processo_numero ? processoFmt(o.processo_numero) : o.referencia}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[o.tribunal, o.area, MODALIDADE_LABEL[o.modalidade]]
                            .filter(Boolean).join(" · ")}
                        </div>
                        {o.polo && o.polo !== "PASSIVO" && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            polo {o.polo.toLowerCase()}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {o.gatilhos.map((g) => <GatilhoBadge key={g} codigo={g} />)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right align-top">
                        <Dinheiro valor={o.valor_base} />
                      </TableCell>

                      <TableCell className="text-right align-top">
                        <Dinheiro valor={o.importancia_segurada} forte />
                        {o.importancia_segurada === null && (
                          <div className="text-xs text-muted-foreground">
                            rode o motor
                          </div>
                        )}
                      </TableCell>

                      {simulando && (
                        <TableCell className="text-right align-top tabular-nums text-sm">
                          {brlCurto(s.premio)}
                        </TableCell>
                      )}
                      {simulando && tComissao > 0 && (
                        <TableCell className="text-right align-top tabular-nums text-sm font-medium">
                          {brlCurto(s.comissao)}
                        </TableCell>
                      )}

                      <TableCell className="text-right align-top">
                        <Prazo o={o} />
                      </TableCell>

                      <TableCell className="align-top">
                        <QualidadeLead confianca={o.confianca} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ---------------- rodapé: o que o filtro escondeu ---------------- */}
      {!!linhas.length && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span>
            {linhas.length} oportunidade(s) · IS somada {brl(data?.isTotal ?? 0)}
          </span>
          {!!data?.abaixoDoPiso && (
            <span className="font-medium text-amber-600 dark:text-amber-500">
              {data.abaixoDoPiso} abaixo do piso de {brl(filtro.isMinima ?? 0)} — não listadas
            </span>
          )}
          {filtro.somentePassivo && <span>polo ativo oculto</span>}
          {filtro.ocultarGarantidos && <span>garantia já prestada oculta</span>}
        </div>
      )}
    </div>
  );
}
