// Detalhe da demanda de Garantia Judicial (somente leitura).
//
// A consulta de mercado é lida com o MESMO normalizador da planilha e do
// e-mail (garantia-judicial-normalizar), para não haver divergência entre o
// que o administrador vê e o que o time recebe.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { reenviarEmailNovaDemanda } from "@/lib/garantia/garantia-judicial-reenvio.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BotoesAnexos,
  EtiquetaStatus,
  formatarDataHora,
  formatarDuracao,
} from "./formulario-admin-comuns";
import {
  fmtBRL,
  resumirResultadoMercado,
  type GrupoResumo,
  type SeguradoraResumo,
} from "@/lib/garantia/garantia-judicial-normalizar";
import { DESTINATARIO_NOVA_DEMANDA } from "@/lib/garantia/garantia-judicial-constantes";

const SITUACAO: Record<GrupoResumo, string> = {
  com_limite: "Com limite",
  sem_limite: "Sem limite",
  nao_consultado: "Não consultado",
};

const COR_SITUACAO: Record<GrupoResumo, string> = {
  com_limite: "text-emerald-700",
  sem_limite: "text-red-600",
  nao_consultado: "text-purple-700",
};

const ORDEM_GRUPO: Record<GrupoResumo, number> = { com_limite: 0, sem_limite: 1, nao_consultado: 2 };

type Detalhe = {
  id: string;
  protocolo: string | null;
  status: string;
  criado_em: string;
  email_enviado_em: string | null;
  alerta_enviado_em: string | null;
  erro_mensagem: string | null;
  nome_tomador: string | null;
  cnpj_tomador: string | null;
  numero_processo: string | null;
  pdf_path: string | null;
  xlsx_path: string | null;
  dados_formulario: Record<string, unknown> | null;
  resultado_mercado: unknown;
};

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return String(valor);
}

function somenteDigitos(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "");
}

/** Valores monetários chegam do formulário em centavos inteiros. */
function moedaDeCentavos(valor: unknown): string {
  const n = Number(valor);
  if (!Number.isFinite(n) || n === 0) return "—";
  return fmtBRL(n / 100);
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="break-words text-sm text-foreground">{valor}</p>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function obj(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function linhasMercado(seguradoras: SeguradoraResumo[]) {
  const ordenadas = [...seguradoras].sort((a, b) => {
    const g = ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo];
    if (g !== 0) return g;
    if (a.grupo === "com_limite") return b.capacidade - a.capacidade;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  const linhas: {
    chave: string;
    seguradora: string;
    grupo: GrupoResumo;
    capacidade: string;
    modalidade: string;
    limite: string;
    taxa: string;
    observacao: string;
  }[] = [];

  for (const seg of ordenadas) {
    const base = {
      seguradora: seg.label,
      grupo: seg.grupo,
      capacidade: seg.capacidadeFmt || "—",
      observacao: seg.mensagem || "",
    };
    if (!seg.modalidades.length) {
      linhas.push({ ...base, chave: seg.key, modalidade: "—", limite: "—", taxa: "—" });
      continue;
    }
    seg.modalidades.forEach((m, i) => {
      linhas.push({
        ...base,
        chave: `${seg.key}-${i}`,
        modalidade: m.label || "—",
        limite: m.limite || "—",
        taxa: m.taxa || "—",
        observacao: i === 0 ? base.observacao : "",
      });
    });
  }
  return linhas;
}

export function FormularioAdminDetalhe({
  solicitacaoId,
  onOpenChange,
}: {
  solicitacaoId: string | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["garantia-formulario-admin-detalhe", solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data: linha, error: err } = await supabase
        .from("garantia_judicial_solicitacoes")
        .select(
          "id,protocolo,status,criado_em,email_enviado_em,alerta_enviado_em,erro_mensagem," +
            "nome_tomador,cnpj_tomador,numero_processo,pdf_path,xlsx_path," +
            "dados_formulario,resultado_mercado",
        )
        .eq("id", solicitacaoId as string)
        .maybeSingle();
      if (err) throw err;
      return linha as unknown as Detalhe | null;
    },
  });

  const form = obj(data?.dados_formulario);
  const responsavel = obj(form["responsavel"]);
  const autor = obj(form["autor"]);
  const reu = obj(form["reu"]);
  const advogado = obj(form["advogado"]);
  const processo = obj(form["processo"]);
  const garantia = obj(form["garantia"]);
  const vigencia = obj(form["vigencia"]);
  const entrega = obj(form["entrega"]);
  const representante = obj(form["representante"]);
  const menorIdade = String(form["menorIdade"] ?? "").toLowerCase();
  const ehMenor = menorIdade === "sim" || form["menorIdade"] === true;
  const assinatura = typeof form["assinatura"] === "string" ? (form["assinatura"] as string) : "";

  const resumo = data?.resultado_mercado ? resumirResultadoMercado(data.resultado_mercado) : null;
  const linhas = resumo ? linhasMercado(resumo.seguradoras) : [];

  const [reenviando, setReenviando] = useState(false);
  const reenviar = useServerFn(reenviarEmailNovaDemanda);

  async function confirmarReenvio() {
    if (!data) return;
    setReenviando(true);
    try {
      const r = await reenviar({ data: { solicitacaoId: data.id } });
      if (r.ok) toast.success("E-mail reenviado para o time.");
      else toast.error(`Não foi possível reenviar: ${r.detalhe || r.erro}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar o e-mail.");
    } finally {
      setReenviando(false);
    }
  }

  const emailResponsavel = String(responsavel["email"] ?? "");
  const telResponsavel = String(responsavel["telefone"] ?? "");

  return (
    <Sheet open={!!solicitacaoId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Demanda {data?.protocolo ?? ""}</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {!isLoading && (error || !data) && (
          <p className="mt-6 text-sm text-destructive">Não foi possível carregar esta demanda.</p>
        )}

        {!isLoading && data && (
          <TooltipProvider>
            <div className="mt-4 space-y-4 pb-10">
              <Bloco titulo="Demanda">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Campo rotulo="Protocolo" valor={texto(data.protocolo)} />
                  <Campo rotulo="Status" valor={<EtiquetaStatus status={data.status} />} />
                  <Campo rotulo="Recebida em" valor={formatarDataHora(data.criado_em)} />
                  <Campo rotulo="E-mail enviado em" valor={formatarDataHora(data.email_enviado_em)} />
                  <Campo
                    rotulo="Tempo até o e-mail"
                    valor={formatarDuracao(data.criado_em, data.email_enviado_em) || "—"}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <BotoesAnexos
                    protocolo={data.protocolo}
                    pdfPath={data.pdf_path}
                    xlsxPath={data.xlsx_path}
                    tamanho="completo"
                  />

                  {data.xlsx_path ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" disabled={reenviando}>
                          {reenviando ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Reenviar e-mail para o time
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reenviar e-mail desta demanda?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O e-mail da demanda {data.protocolo ?? ""} será enviado novamente para{" "}
                            operacoes@lavoroseguros.com.br, com o formulário em PDF e a planilha da
                            consulta de mercado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void confirmarReenvio()}>
                            Reenviar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button variant="outline" size="sm" className="gap-2" disabled>
                            <Send className="h-4 w-4" />
                            Reenviar e-mail para o time
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        A planilha da consulta de mercado ainda não foi gerada — a demanda segue em
                        processamento.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {data.alerta_enviado_em && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Alerta técnico disparado para operações em {formatarDataHora(data.alerta_enviado_em)}.
                    </span>
                  </div>
                )}

                {data.erro_mensagem && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-pre-wrap break-words">{data.erro_mensagem}</span>
                  </div>
                )}
              </Bloco>

              <Bloco titulo="Solicitante">
                <div className="grid grid-cols-2 gap-4">
                  <Campo rotulo="Empresa" valor={texto(responsavel["empresa"])} />
                  <Campo rotulo="Nome" valor={texto(responsavel["nome"])} />
                  <Campo
                    rotulo="E-mail"
                    valor={
                      emailResponsavel ? (
                        <a className="text-primary underline" href={`mailto:${emailResponsavel}`}>
                          {emailResponsavel}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Campo
                    rotulo="Telefone"
                    valor={
                      telResponsavel ? (
                        <a className="text-primary underline" href={`tel:${somenteDigitos(telResponsavel)}`}>
                          {telResponsavel}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
              </Bloco>

              <Bloco titulo="Tomador e processo">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Campo rotulo="Tomador" valor={texto(data.nome_tomador)} />
                  <Campo rotulo="CNPJ" valor={texto(data.cnpj_tomador)} />
                  <Campo rotulo="Nº do processo" valor={texto(data.numero_processo)} />
                  <Campo rotulo="Natureza" valor={texto(form["naturezaRotulo"] ?? form["natureza"])} />
                  <Campo rotulo="Ramo" valor={texto(processo["ramo"])} />
                  <Campo rotulo="Juízo" valor={texto(processo["juizo"])} />
                  <Campo
                    rotulo="Tribunal"
                    valor={texto(processo["tribunal"] ?? processo["tribunalRegional"])}
                  />
                  <Campo
                    rotulo="Importância segurada"
                    valor={moedaDeCentavos(garantia["importanciaSegurada"])}
                  />
                  <Campo rotulo="Índice" valor={texto(form["indice"])} />
                  <Campo rotulo="Objetivo" valor={texto(form["objetivo"])} />
                  <Campo
                    rotulo="Vigência"
                    valor={
                      vigencia["inicio"] || vigencia["fim"]
                        ? `${texto(vigencia["inicio"])} a ${texto(vigencia["fim"])}` +
                          (vigencia["anos"] ? ` (${vigencia["anos"]} ano(s))` : "")
                        : "—"
                    }
                  />
                  <Campo
                    rotulo="Entrega"
                    valor={
                      entrega["prazo"]
                        ? `${texto(entrega["prazo"])}` +
                          (entrega["diasRestantes"] !== undefined && entrega["diasRestantes"] !== null
                            ? ` · ${entrega["diasRestantes"]} dia(s)`
                            : "")
                        : texto(form["entrega"])
                    }
                  />
                  <Campo rotulo="Êxito" valor={texto(form["exito"])} />
                </div>
              </Bloco>

              <Bloco titulo="Partes">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Campo rotulo="Autor" valor={texto(autor["nome"])} />
                  <Campo rotulo="Documento do autor" valor={texto(autor["documento"])} />
                  <Campo rotulo="Tipo do autor" valor={texto(autor["tipo"])} />
                  <Campo rotulo="Réu" valor={texto(reu["nome"])} />
                  <Campo rotulo="Documento do réu" valor={texto(reu["documento"])} />
                  <Campo rotulo="Tipo do réu" valor={texto(reu["tipo"])} />
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Campo rotulo="Advogado" valor={texto(advogado["nome"])} />
                  <Campo rotulo="OAB" valor={texto(advogado["oab"])} />
                  <Campo rotulo="UF" valor={texto(advogado["uf"])} />
                </div>
              </Bloco>

              {ehMenor && (
                <Bloco titulo="Menor de idade · representante legal">
                  <div className="grid grid-cols-2 gap-4">
                    <Campo rotulo="Nome do representante" valor={texto(representante["nome"])} />
                    <Campo rotulo="CPF do representante" valor={texto(representante["cpf"])} />
                  </div>
                </Bloco>
              )}

              {assinatura && (
                <Bloco titulo="Assinatura">
                  <img
                    src={assinatura}
                    alt="Assinatura do solicitante"
                    className="max-h-40 rounded-lg border border-border bg-white p-2"
                  />
                </Bloco>
              )}

              <Bloco titulo="Consulta de mercado">
                {!resumo ? (
                  <p className="text-sm text-muted-foreground">
                    A consulta de mercado ainda não foi concluída para esta demanda.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {resumo.com_limite.length} com limite · {resumo.sem_limite.length} sem limite ·{" "}
                      {resumo.nao_consultado.length} não consultada(s)
                    </p>

                    {resumo.com_limite.length === 0 && (
                      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Nenhuma seguradora liberou capacidade para este tomador.
                      </p>
                    )}

                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Seguradora</TableHead>
                            <TableHead>Situação</TableHead>
                            <TableHead>Capacidade total</TableHead>
                            <TableHead>Modalidade</TableHead>
                            <TableHead>Limite</TableHead>
                            <TableHead>Taxa</TableHead>
                            <TableHead>Observação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linhas.map((l) => (
                            <TableRow key={l.chave}>
                              <TableCell className="whitespace-nowrap font-medium">{l.seguradora}</TableCell>
                              <TableCell className={`whitespace-nowrap ${COR_SITUACAO[l.grupo]}`}>
                                {SITUACAO[l.grupo]}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{l.capacidade}</TableCell>
                              <TableCell className="max-w-[260px]">{l.modalidade}</TableCell>
                              <TableCell className="whitespace-nowrap">{l.limite}</TableCell>
                              <TableCell className="whitespace-nowrap">{l.taxa}</TableCell>
                              <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                                {l.observacao}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      “Não consultada” significa falha técnica na consulta automática àquela seguradora, e
                      não recusa comercial: a seguradora pode ter limite disponível.
                    </p>
                  </>
                )}
              </Bloco>
            </div>
          </TooltipProvider>
        )}
      </SheetContent>
    </Sheet>
  );
}
