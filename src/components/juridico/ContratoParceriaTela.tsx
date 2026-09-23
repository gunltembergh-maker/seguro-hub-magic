import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSignature, FileText, Lock, RefreshCw, ShieldOff, Unlock, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "@/hooks/use-meu-perfil";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { mensagemDeErro } from "@/lib/erro";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import EnviarContratoParceiro from "@/components/comercial/EnviarContratoParceiro";
import { useAbrirContrato } from "@/components/comercial/FilaVerificacaoContratos";

type Linha = {
  canal_id: string;
  parceiro: string;
  razao_social: string | null;
  cnpj: string | null;
  contrato_id: string | null;
  arquivo_nome: string | null;
  arquivo_path: string | null;
  tipo: string | null;
  situacao: string;
  motivo_bloqueio: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  dias_para_vencer: number | null;
  renovacao_automatica: boolean | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  minimo_repasse: number | null;
  bloqueado: boolean;
  bloqueio_motivo: string | null;
  bloqueio_em: string | null;
  bloqueio_por: string | null;
  repasse_acumulado: number | null;
  suspenso_motivo: string | null;
  renovado_em: string | null;
  renovado_por: string | null;
};

type Filtro = "AGUARDANDO_JURIDICO" | "VENCIDO" | "SUSPENSO" | "BLOQUEADO" | "VENCENDO_60" | null;
type TipoAcao = "RENOVAR" | "SUSPENDER" | "BLOQUEAR" | "LIBERAR";

const dia = (v?: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const pct = (v?: number | null) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const vence60 = (l: { situacao: string; dias_para_vencer: number | null }) =>
  l.situacao === "ATIVO" && l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 60;

function Dica({ texto, children }: { texto?: React.ReactNode; children: React.ReactNode }) {
  if (!texto) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="cursor-help">{children}</span></TooltipTrigger>
      <TooltipContent className="max-w-xs">{texto}</TooltipContent>
    </Tooltip>
  );
}

function SituacaoBadges({ l }: { l: Linha }) {
  const base = "border-transparent";
  let principal: React.ReactNode;
  switch (l.situacao) {
    case "ATIVO":
      principal = (
        <>
          <Badge className={cn(base, "bg-emerald-100 text-emerald-800 hover:bg-emerald-100")}>Ativo</Badge>
          {l.dias_para_vencer != null && l.dias_para_vencer <= 60 && (
            <Badge className={cn(base, "bg-amber-100 text-amber-800 hover:bg-amber-100")}>
              vence em {l.dias_para_vencer} dias
            </Badge>
          )}
        </>
      );
      break;
    case "AGUARDANDO_JURIDICO":
      principal = <Badge className={cn(base, "bg-amber-100 text-amber-800 hover:bg-amber-100")}>Aguardando o Jurídico</Badge>;
      break;
    case "VENCIDO":
      principal = <Badge className={cn(base, "bg-red-100 text-red-800 hover:bg-red-100")}>Vencido</Badge>;
      break;
    case "SUSPENSO":
      principal = (
        <Dica texto={l.suspenso_motivo}>
          <Badge variant="secondary">Suspenso</Badge>
        </Dica>
      );
      break;
    case "SEM_CONTRATO":
      principal = <Badge variant="secondary">Sem contrato</Badge>;
      break;
    default:
      principal = <Badge variant="secondary">{l.situacao}</Badge>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {principal}
      {l.bloqueado && (
        <Dica
          texto={
            <div className="space-y-0.5">
              <div>{l.bloqueio_motivo ?? "Sem motivo informado"}</div>
              <div className="text-xs opacity-80">
                {l.bloqueio_por ?? "—"} em {dataHora(l.bloqueio_em)}
              </div>
            </div>
          }
        >
          <Badge className={cn(base, "bg-red-600 text-white hover:bg-red-600")}>Repasse bloqueado</Badge>
        </Dica>
      )}
    </div>
  );
}

const podeRenovarSituacao = (l: Linha) =>
  l.situacao === "VENCIDO" || l.situacao === "AGUARDANDO_JURIDICO" || vence60(l);

export default function ContratoParceriaTela() {
  const perfil = useMeuPerfilEfetivo();
  const podeVer = hasPermission(perfil, "menu_juridico_contratos");
  const podeRenovar = hasPermission(perfil, "juridico_renovar_contrato");
  const podeSuspender = hasPermission(perfil, "juridico_suspender_contrato");
  const podeBloquear = hasPermission(perfil, "juridico_bloquear_repasse");

  const qc = useQueryClient();
  const { abrir, ocupado } = useAbrirContrato();
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [acao, setAcao] = useState<{ tipo: TipoAcao; linha: Linha } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [envio, setEnvio] = useState<Linha | null>(null);

  const { data: linhas = [], isLoading, error } = useQuery({
    queryKey: ["juridico-contratos"],
    enabled: podeVer,
    queryFn: async (): Promise<Linha[]> => {
      const { data, error } = await supabase.rpc("rpc_juridico_contratos" as never, { p_situacao: null } as never);
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const contagem = useMemo(
    () => ({
      AGUARDANDO_JURIDICO: linhas.filter((l) => l.situacao === "AGUARDANDO_JURIDICO").length,
      VENCIDO: linhas.filter((l) => l.situacao === "VENCIDO").length,
      SUSPENSO: linhas.filter((l) => l.situacao === "SUSPENSO").length,
      BLOQUEADO: linhas.filter((l) => l.bloqueado).length,
      VENCENDO_60: linhas.filter(vence60).length,
    }),
    [linhas],
  );

  const visiveis = useMemo(() => {
    if (!filtro) return linhas;
    if (filtro === "BLOQUEADO") return linhas.filter((l) => l.bloqueado);
    if (filtro === "VENCENDO_60") return linhas.filter(vence60);
    return linhas.filter((l) => l.situacao === filtro);
  }, [linhas, filtro]);

  const semClausulaVencendo = useMemo(
    () => linhas.filter((l) => vence60(l) && l.renovacao_automatica === false),
    [linhas],
  );

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["juridico-contratos"] });
    qc.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
    qc.invalidateQueries({ queryKey: ["canal-repasse-demandas"] });
  }

  const executar = useMutation({
    mutationFn: async ({ tipo, linha, texto }: { tipo: TipoAcao; linha: Linha; texto: string }) => {
      const chamadas: Record<TipoAcao, [string, Record<string, unknown>]> = {
        RENOVAR: ["rpc_juridico_renovar_contrato", { p_contrato_id: linha.contrato_id, p_justificativa: texto }],
        SUSPENDER: ["rpc_juridico_suspender_contrato", { p_contrato_id: linha.contrato_id, p_justificativa: texto }],
        BLOQUEAR: ["rpc_juridico_bloquear_repasse", { p_canal_id: linha.canal_id, p_motivo: texto }],
        LIBERAR: ["rpc_juridico_liberar_repasse", { p_canal_id: linha.canal_id, p_motivo: texto }],
      };
      const [fn, args] = chamadas[tipo];
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      return { tipo, linha, row };
    },
    onSuccess: ({ tipo, linha, row }) => {
      setAcao(null);
      setJustificativa("");
      if (tipo === "RENOVAR") {
        toast.success((row?.mensagem as string) || `Contrato de ${linha.parceiro} renovado.`);
      } else if (tipo === "SUSPENDER") {
        toast.success((row?.mensagem as string) || `Contrato de ${linha.parceiro} suspenso.`);
      } else if (tipo === "BLOQUEAR") {
        const n = Number(row?.demandas_derrubadas ?? 0);
        toast.success(
          `Repasse de ${linha.parceiro} bloqueado.` +
            (n > 0 ? ` ${n} ${n === 1 ? "pedido de repasse caiu" : "pedidos de repasse caíram"}.` : ""),
        );
      } else {
        toast.success((row?.mensagem as string) || `Repasse de ${linha.parceiro} liberado.`);
      }
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  if (!podeVer) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold text-[#14405C]">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você não tem permissão para ver os contratos de parceria.
          </p>
        </CardContent>
      </Card>
    );
  }

  const contadores: { chave: Exclude<Filtro, null>; rotulo: string; cor: string }[] = [
    { chave: "AGUARDANDO_JURIDICO", rotulo: "Aguardando o Jurídico", cor: "text-amber-700" },
    { chave: "VENCIDO", rotulo: "Vencidos", cor: "text-red-700" },
    { chave: "SUSPENSO", rotulo: "Suspensos", cor: "text-muted-foreground" },
    { chave: "BLOQUEADO", rotulo: "Repasse bloqueado", cor: "text-red-700" },
    { chave: "VENCENDO_60", rotulo: "Vencendo em 60 dias", cor: "text-amber-700" },
  ];

  const textoValido = justificativa.trim().length >= 10;
  const infoAcao: Record<TipoAcao, { titulo: string; efeito: string; botao: string; destrutivo?: boolean }> = {
    RENOVAR: {
      titulo: "Renovar contrato",
      efeito: "A vigência é prorrogada conforme a cláusula de renovação automática do documento, pelos períodos necessários até cobrir a data de hoje.",
      botao: "Renovar",
    },
    SUSPENDER: {
      titulo: "Suspender contrato",
      efeito: "O repasse deste parceiro fica travado até entrar um contrato novo.",
      botao: "Suspender",
      destrutivo: true,
    },
    BLOQUEAR: {
      titulo: "Bloquear repasse",
      efeito: "Pedidos de repasse em andamento deste parceiro serão cancelados.",
      botao: "Bloquear repasse",
      destrutivo: true,
    },
    LIBERAR: {
      titulo: "Liberar repasse",
      efeito: "O bloqueio é retirado e o parceiro volta a seguir a situação do contrato.",
      botao: "Liberar repasse",
    },
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6" data-tour="jur-contratos">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#14405C]">Contrato de Parceria</h1>
          <p className="text-sm text-muted-foreground">
            Vigência, renovação e bloqueio de repasse dos parceiros do grupo Lavoro.
          </p>
        </div>

        {semClausulaVencendo.length > 0 && (
          <Alert className="border-amber-400 bg-amber-50 text-amber-900">
            <AlertDescription>
              <div className="font-semibold">Contratos vencendo sem renovação automática</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {semClausulaVencendo.map((l) => (
                  <li key={l.canal_id}>
                    {l.parceiro} vence em {dia(l.vigencia_fim)}, sem renovação automática
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-tour="jur-resumo">
          {contadores.map((c) => (
            <button
              key={c.chave}
              type="button"
              onClick={() => setFiltro(filtro === c.chave ? null : c.chave)}
              className={cn(
                "rounded-lg border bg-card px-4 py-3 text-left transition hover:border-primary/50",
                filtro === c.chave && "border-primary ring-1 ring-primary",
              )}
            >
              <div className={cn("text-2xl font-semibold", c.cor)}>{contagem[c.chave]}</div>
              <div className="text-xs text-muted-foreground">{c.rotulo}</div>
            </button>
          ))}
        </div>

        {filtro && (
          <div className="text-sm text-muted-foreground">
            Filtrando: {contadores.find((c) => c.chave === filtro)?.rotulo}.{" "}
            <button className="underline" onClick={() => setFiltro(null)}>Mostrar todos</button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {error ? (
              <Alert variant="destructive" className="m-4 w-auto">
                <AlertDescription>{mensagemDeErro(error)}</AlertDescription>
              </Alert>
            ) : (
              <Table data-tour="jur-tabela">
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Renovação automática</TableHead>
                    <TableHead>% Repasse</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                  ) : visiveis.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum parceiro nesta situação.</TableCell></TableRow>
                  ) : (
                    visiveis.map((l) => {
                      const renovavel = l.renovacao_automatica === true && podeRenovarSituacao(l) && !!l.contrato_id;
                      return (
                        <TableRow key={l.canal_id}>
                          <TableCell className="align-top">
                            <div className="font-medium">{l.parceiro}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.razao_social ?? "—"}{l.cnpj ? ` · ${l.cnpj}` : ""}
                            </div>
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap text-sm">
                            {l.vigencia_inicio || l.vigencia_fim
                              ? `${dia(l.vigencia_inicio)} a ${dia(l.vigencia_fim)}`
                              : "—"}
                            {vence60(l) && (
                              l.renovacao_automatica === true ? (
                                <div className="mt-1 whitespace-normal text-xs text-amber-700">
                                  renova por igual período, confirme até {dia(l.vigencia_fim)}
                                </div>
                              ) : l.renovacao_automatica === false ? (
                                <div className="mt-1 whitespace-normal rounded border border-amber-400 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                                  não tem renovação automática, precisa de novo contrato até {dia(l.vigencia_fim)}
                                </div>
                              ) : (
                                <div className="mt-1 whitespace-normal text-xs text-amber-700">
                                  cláusula não identificada no documento, confira o contrato
                                </div>
                              )
                            )}
                          </TableCell>
                          <TableCell className="align-top"><SituacaoBadges l={l} /></TableCell>
                          <TableCell className="align-top text-sm">
                            {l.renovacao_automatica === true ? "Sim" : l.renovacao_automatica === false ? "Não" : "Não identificada"}
                          </TableCell>
                          <TableCell className="align-top text-sm tabular-nums">
                            Benefícios {pct(l.pct_beneficios)} · Garantia {pct(l.pct_garantia)} · Demais{" "}
                            {l.pct_demais != null ? pct(l.pct_demais) : (
                              <>{pct(l.pct_garantia)} <span className="text-xs text-muted-foreground">(herdado)</span></>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap justify-end gap-1" data-tour="jur-acoes">
                              {l.arquivo_path && (
                                <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => abrir(l.arquivo_path)}>
                                  <FileText className="mr-1 h-4 w-4" /> Abrir contrato
                                </Button>
                              )}
                              {podeRenovar && l.contrato_id && (
                                renovavel ? (
                                  <Button size="sm" variant="outline" onClick={() => { setJustificativa(""); setAcao({ tipo: "RENOVAR", linha: l }); }}>
                                    <RefreshCw className="mr-1 h-4 w-4" /> Renovar
                                  </Button>
                                ) : l.renovacao_automatica !== true ? (
                                  <span className="max-w-[14rem] self-center text-right text-xs text-muted-foreground">
                                    Sem cláusula de renovação no documento. Envie um contrato novo ou suspenda.
                                  </span>
                                ) : null
                              )}
                              <Button size="sm" variant="outline" onClick={() => setEnvio(l)}>
                                <Upload className="mr-1 h-4 w-4" /> Enviar novo contrato
                              </Button>
                              {podeSuspender && l.contrato_id && l.situacao !== "SUSPENSO" && (
                                <Button size="sm" variant="outline" onClick={() => { setJustificativa(""); setAcao({ tipo: "SUSPENDER", linha: l }); }}>
                                  <ShieldOff className="mr-1 h-4 w-4" /> Suspender
                                </Button>
                              )}
                              {podeBloquear && (
                                l.bloqueado ? (
                                  <Button size="sm" variant="outline" onClick={() => { setJustificativa(""); setAcao({ tipo: "LIBERAR", linha: l }); }}>
                                    <Unlock className="mr-1 h-4 w-4" /> Liberar repasse
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" className="text-red-700" onClick={() => { setJustificativa(""); setAcao({ tipo: "BLOQUEAR", linha: l }); }}>
                                    <Lock className="mr-1 h-4 w-4" /> Bloquear repasse
                                  </Button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!acao} onOpenChange={(v) => { if (!v && !executar.isPending) setAcao(null); }}>
          <DialogContent className="w-[calc(100vw-2rem)] min-w-0 sm:max-w-lg">
            {acao && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" /> {infoAcao[acao.tipo].titulo}
                  </DialogTitle>
                  <DialogDescription className="break-words">{acao.linha.parceiro}</DialogDescription>
                </DialogHeader>
                <Alert className={infoAcao[acao.tipo].destrutivo ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}>
                  <AlertDescription className={acao.tipo === "BLOQUEAR" ? "font-semibold" : undefined}>
                    {infoAcao[acao.tipo].efeito}
                  </AlertDescription>
                </Alert>
                {acao.tipo === "RENOVAR" && (
                  <p className="text-sm text-muted-foreground">
                    Vigência atual: {dia(acao.linha.vigencia_inicio)} a {dia(acao.linha.vigencia_fim)}.
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Justificativa</label>
                  <Textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={4}
                    placeholder="Explique o motivo (mínimo 10 caracteres)"
                  />
                  {!textoValido && (
                    <p className="text-xs text-muted-foreground">
                      Faltam {10 - justificativa.trim().length} caracteres.
                    </p>
                  )}
                </div>
                <DialogFooter className="flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setAcao(null)} disabled={executar.isPending}>Cancelar</Button>
                  <Button
                    variant={infoAcao[acao.tipo].destrutivo ? "destructive" : "default"}
                    disabled={!textoValido || executar.isPending}
                    onClick={() => executar.mutate({ tipo: acao.tipo, linha: acao.linha, texto: justificativa.trim() })}
                  >
                    {executar.isPending ? "Salvando…" : infoAcao[acao.tipo].botao}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <EnviarContratoParceiro
          canalId={envio?.canal_id ?? null}
          canalNome={envio?.parceiro}
          aberto={!!envio}
          onFechar={() => setEnvio(null)}
          onSucesso={invalidar}
        />
      </div>
    </TooltipProvider>
  );
}
