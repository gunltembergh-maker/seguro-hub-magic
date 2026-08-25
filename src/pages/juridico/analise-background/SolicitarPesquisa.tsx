// =====================================================================
// Solicitar pesquisa de processos.
//
// É a tela equivalente à busca da Tratum: digita o documento, pede os
// processos. Três diferenças deliberadas em relação a uma busca solta:
//
//  1. A FINALIDADE é escolhida antes, não depois. Ela decide a base legal
//     da consulta, quem vê o resultado (RLS) e em que fila o lead entra.
//  2. O CUSTO aparece ANTES de clicar. Consulta em bureau é tarifada, e o
//     teto da área fica visível na mesma tela — descobrir o limite pelo
//     erro é a pior forma de descobrir.
//  3. O pedido fica REGISTRADO com quem pediu. Não é auditoria por
//     desconfiança: é o que permite responder à ANPD, ao cliente e ao
//     financeiro sem arqueologia.
// =====================================================================

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  useCotas, useMinhaArea, useProvedores, useSolicitacoes, useSolicitar,
  type ChaveAb,
} from "@/hooks/use-analise-background";
import { brl, dataFmt, docFmt, num, soDigitos } from "@/lib/ab-format";
import {
  FINALIDADE_LABEL, STATUS_SOLICITACAO_LABEL,
  type Escopo, type Finalidade, type StatusSolicitacao,
} from "@/lib/ab-types";
import { EstadoVazio } from "@/components/analise-background/AbBits";

const TOM_STATUS: Record<StatusSolicitacao, string> = {
  CONCLUIDA: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  EM_ANDAMENTO: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  PENDENTE: "bg-muted text-muted-foreground",
  SEM_PROVEDOR: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  BLOQUEADA_COTA: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  SEM_CONSENTIMENTO: "bg-destructive/10 text-destructive border-destructive/30",
  RECUSADA: "bg-destructive/10 text-destructive border-destructive/30",
  ERRO: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  /** Finalidades que este usuário pode declarar, conforme as chaves dele. */
  finalidadesPermitidas: Finalidade[];
  pode: (...chaves: ChaveAb[]) => boolean;
}

export default function SolicitarPesquisa({ finalidadesPermitidas, pode }: Props) {
  const [documento, setDocumento] = useState("");
  const [nome, setNome] = useState("");
  const [finalidade, setFinalidade] = useState<Finalidade>(
    finalidadesPermitidas[0] ?? "GARANTIA",
  );
  const [escopo, setEscopo] = useState<Escopo>("PROCESSOS");

  const solicitar = useSolicitar();
  const { data: area } = useMinhaArea();
  const { data: cotas } = useCotas();
  const { data: provedores, isLoading: carregandoProv } = useProvedores();
  const { data: historico, isLoading: carregandoHist } = useSolicitacoes({ limite: 40 });

  const dig = soDigitos(documento);
  const docValido = dig.length === 11 || dig.length === 14;
  const tipo = dig.length === 11 ? "CPF" : dig.length === 14 ? "CNPJ" : null;

  const provedorAtivo = useMemo(
    () => (provedores ?? []).find((p) => p.ativo && p.capacidades.processos_por_documento),
    [provedores],
  );

  const mesAtual = new Date().toISOString().slice(0, 8) + "01";
  const minhaCota = (cotas ?? []).find((c) => c.area === area && c.mes === mesAtual);

  const custo = provedorAtivo?.custo_consulta ?? 0;
  const semTeto = minhaCota?.limite_consultas === null && minhaCota?.limite_valor === null;
  const bloqueada = minhaCota?.situacao === "BLOQUEADA" || minhaCota?.situacao === "ESGOTADA";

  const enviar = async () => {
    if (!docValido) {
      toast.error("Informe um CNPJ (14 dígitos) ou CPF (11 dígitos).");
      return;
    }
    try {
      const r = await solicitar.mutateAsync({
        documento: dig, finalidade, escopo, nome: nome.trim() || undefined,
      });
      const rotulo = STATUS_SOLICITACAO_LABEL[r.status as StatusSolicitacao] ?? r.status;
      if (r.status === "CONCLUIDA") {
        toast.success(rotulo, { description: r.detalhe });
      } else {
        toast.warning(rotulo, { description: r.detalhe, duration: 12_000 });
      }
    } catch (e) {
      const err = e as Error & { erro?: string };
      toast.error(err.erro === "sem_permissao" ? "Sem permissão" : "Não foi possível solicitar", {
        description: err.message,
        duration: 12_000,
      });
    }
  };

  if (!pode("ab_solicitar")) {
    return (
      <EstadoVazio
        titulo="Você não tem permissão para solicitar pesquisa"
        detalhe={
          "Solicitar pesquisa pode gerar consulta paga, então é uma chave separada. " +
          "Peça a um administrador para marcar ab_solicitar no seu perfil, em " +
          "Administração › Perfis de Acesso."
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* -------- o formulário -------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nova pesquisa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ab-doc">CNPJ ou CPF</Label>
              <Input
                id="ab-doc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder="11.035.301/0001-77"
                inputMode="numeric"
              />
              {dig.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {tipo
                    ? `${tipo} · ${docFmt(dig)}`
                    : `${dig.length} dígito(s) — faltam ${dig.length < 11 ? 11 - dig.length : 14 - dig.length}`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Finalidade</Label>
              <Select value={finalidade} onValueChange={(v) => setFinalidade(v as Finalidade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {finalidadesPermitidas.map((f) => (
                    <SelectItem key={f} value={f}>{FINALIDADE_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Escopo</Label>
              <Select value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROCESSOS">Processos agora</SelectItem>
                  <SelectItem value="MONITORAMENTO">Monitorar daqui em diante</SelectItem>
                  <SelectItem value="COMPLETO">Processos + monitoramento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ab-nome">Nome (opcional)</Label>
            <Input
              id="ab-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Razão social ou nome do titular, se você já souber"
            />
          </div>

          {/* -------- o que vai acontecer, antes de clicar ---------- */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-[13px]">
            {carregandoProv ? (
              <Skeleton className="h-4 w-64" />
            ) : provedorAtivo ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{provedorAtivo.nome}</span>
                  {provedorAtivo.capacidades.filtro_termos && (
                    <Badge variant="secondary" className="text-[11px]">
                      filtro de termo no andamento
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    {custo > 0 ? `${brl(custo)} por consulta` : "sem tarifa cadastrada"}
                  </span>
                </div>
                {custo > 0 && (
                  <p className="text-muted-foreground">
                    {semTeto
                      ? `Área "${area}" está sem teto configurado.`
                      : minhaCota
                        ? `Área "${area}": ${num(minhaCota.consumido_consultas)} de ` +
                          `${minhaCota.limite_consultas ?? "∞"} consultas usadas neste mês` +
                          (minhaCota.limite_valor !== null
                            ? ` · ${brl(minhaCota.consumido_valor)} de ${brl(minhaCota.limite_valor)}`
                            : "")
                        : `Área "${area}" ainda não tem cota deste mês — ela é criada na primeira consulta.`}
                  </p>
                )}
                {bloqueada && (
                  <p className="text-destructive font-medium">
                    O teto do mês está esgotado ou bloqueado. Um gestor com a chave
                    ab_cota_gerir precisa elevar o limite em Administração › Cotas e custos.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Nenhum bureau judicial contratado. A pesquisa vai responder com o que as fontes
                gratuitas já trouxeram e dizer o que falta —{" "}
                <strong>processo por documento com texto de andamento não existe de graça</strong>.
                É esse dado que alimenta os gatilhos T1, T2, T4 e T13.
              </p>
            )}

            {tipo === "CPF" && (
              <p className="text-amber-700 dark:text-amber-400">
                CPF é dado pessoal: a consulta só sai se existir base legal registrada e vigente —
                consentimento (LGPD art. 7º I) ou, no Jurídico, exercício regular de direitos em
                processo (art. 7º VI). O registro é feito na aba de Background Check.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={enviar} disabled={!docValido || solicitar.isPending}>
              {solicitar.isPending ? "Consultando…" : "Solicitar pesquisa"}
            </Button>
            {solicitar.isPending && (
              <span className="text-[12px] text-muted-foreground">
                A consulta ao bureau pode levar alguns segundos.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -------- histórico ----------------------------------------- */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Últimas solicitações
        </h3>
        {carregandoHist ? (
          <Skeleton className="h-40 w-full" />
        ) : !historico?.length ? (
          <EstadoVazio
            titulo="Nenhuma solicitação ainda"
            detalhe="Cada pesquisa feita aqui fica registrada com finalidade, custo e responsável."
          />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Processos</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Quem pediu</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      {docFmt(s.documento)}
                      {s.razao_social && (
                        <span className="block font-sans text-muted-foreground">
                          {s.razao_social}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{s.finalidade}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-normal ${TOM_STATUS[s.status] ?? ""}`}
                        title={s.detalhe ?? undefined}
                      >
                        {STATUS_SOLICITACAO_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(s.processos_encontrados)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(s.leads_gerados)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.custo > 0 ? brl(s.custo) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{s.solicitante_nome ?? "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {dataFmt(s.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          O CPF aparece mascarado nesta lista de propósito: quem precisa auditar o pedido não
          precisa ver o número inteiro.
        </p>
      </section>
    </div>
  );
}
