// Fila do Financeiro para as demandas de nota fiscal do repasse de parceiro.
//
// O Comercial pede, o Financeiro autoriza informando a data prevista de
// pagamento (contada a partir do recebimento da nota) e, depois da data,
// confirma se o pagamento saiu.
import { mensagemDeErro } from "@/lib/erro";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  FileSearch,
  FileText,
  FolderOpen,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DetalheRepasseCiclo } from "@/components/repasse/DetalheRepasseCiclo";
import { ContratoDoParceiro } from "@/components/repasse/ContratoDoParceiro";
import {
  BotaoBaixarDocumento,
  ConferirNFDialog,
  DocumentosParceiroDialog,
  RegistrarPagamentoDialog,
} from "@/components/repasse/DocumentosRepasse";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "";

const fmtDataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  prazo_resposta_em: string | null;
  horas_para_expirar: number | null;
  nf_documento_id?: string | null;
  nf_status?: string | null;
  nf_numero?: string | null;
  nf_valor?: number | null;
  nf_valor_diverge?: boolean | null;
  nf_enviada_em?: string | null;
  nf_enviada_por_nome?: string | null;
  comprovante_documento_id?: string | null;
};

function useDemandas(situacao: string) {
  return useQuery({
    queryKey: ["canal-repasse-demandas", situacao],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_canal_repasse_demandas" as never, {
        p_situacao: situacao,
        p_ano: null,
        p_mes: null,
      } as never);
      if (error) throw error;
      return (data || []) as DemandaNF[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function DemandasRepasseNF() {
  const pendentes = useDemandas("PENDENTE");
  const aprovadas = useDemandas("APROVADA");
  const queryClient = useQueryClient();

  const search = useSearch({ strict: false }) as { demanda?: string };
  const destaque = search?.demanda;

  const [autorizar, setAutorizar] = useState<DemandaNF | null>(null);
  const [recusar, setRecusar] = useState<DemandaNF | null>(null);
  const [confirmar, setConfirmar] = useState<DemandaNF | null>(null);
  const [naoPagou, setNaoPagou] = useState<DemandaNF | null>(null);
  const [relacao, setRelacao] = useState<DemandaNF | null>(null);
  const [contrato, setContrato] = useState<DemandaNF | null>(null);
  const [conferir, setConferir] = useState<DemandaNF | null>(null);
  const [registrar, setRegistrar] = useState<DemandaNF | null>(null);
  const [documentos, setDocumentos] = useState<DemandaNF | null>(null);
  void setConfirmar;
  void confirmar;

  // Repasses aprovados: todos sem baixa e os pagos nos últimos 30 dias.
  const aConfirmar = useMemo(() => {
    const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return (aprovadas.data ?? []).filter(
      (d) =>
        !d.baixa_data_pagamento ||
        new Date(`${d.baixa_data_pagamento.slice(0, 10)}T12:00:00`).getTime() >= limite,
    );
  }, [aprovadas.data]);

  const listaPendentes = pendentes.data ?? [];

  function apósDecidir() {
    void queryClient.invalidateQueries({ queryKey: ["canal-repasse-demandas"] });
    void queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
    void queryClient.invalidateQueries({ queryKey: ["canal-parceiro-eventos"] });
  }

  if (listaPendentes.length === 0 && aConfirmar.length === 0) return null;

  return (
    <>
      <Card className="mb-6 border-amber-600/40">
        <CardHeader>
          <CardTitle>Repasse de parceiro · nota fiscal</CardTitle>
          <CardDescription>
            Autorizações de emissão de nota e confirmação dos pagamentos do repasse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {listaPendentes.length > 0 ? (
            <section className="space-y-3" data-tour="fin-demandas">
              <h3 className="text-sm font-semibold text-foreground">Autorizações pendentes</h3>
               {listaPendentes.map((d, index) => (
                <BlocoDemanda key={d.demanda_id} destacar={d.demanda_id === destaque}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{d.parceiro}</p>
                      <p className="text-xs text-muted-foreground">
                        Ciclo de {MESES[(d.ciclo_mes ?? 1) - 1]}/{d.ciclo_ano} · {d.linhas ?? 0}{" "}
                        parcelas
                      </p>
                      <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
                        {BRL(d.valor_total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pedido por {d.solicitado_por_nome ?? "não informado"} em {fmtDataHora(d.solicitado_em)}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          (d.horas_para_expirar ?? 0) === 0
                            ? "text-destructive"
                            : (d.horas_para_expirar ?? 0) <= 6
                              ? "text-amber-700"
                              : "text-muted-foreground",
                        )}
                      >
                        {(d.horas_para_expirar ?? 0) === 0
                          ? "Prazo vencido, o pedido vai cair"
                          : `Vence em ${d.horas_para_expirar}h`}
                      </p>
                      {d.observacao_solicitante ? (
                        <p className="text-sm text-foreground">{d.observacao_solicitante}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        data-tour={index === 0 ? "fin-abrir-relacao" : undefined}
                        size="sm"
                        variant="outline"
                        onClick={() => setRelacao(d)}
                      >
                        <FileSearch className="mr-2 h-4 w-4" />
                        Abrir a relação
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setContrato(d)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Ver o contrato
                      </Button>
                      {d.sou_o_aprovador ? (
                        <>
                          <Button
                            data-tour={index === 0 ? "fin-autorizar" : undefined}
                            size="sm"
                            onClick={() => setAutorizar(d)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Autorizar
                          </Button>
                          <Button
                            data-tour={index === 0 ? "fin-recusar" : undefined}
                            size="sm"
                            variant="outline"
                            onClick={() => setRecusar(d)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Recusar
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Aguardando autorização do gestor do Financeiro.
                        </Badge>
                      )}
                    </div>
                  </div>
                </BlocoDemanda>
              ))}
            </section>
          ) : null}

          {aConfirmar.length > 0 ? (
            <section className="space-y-3" data-tour="fin-pagamentos">
              <h3 className="text-sm font-semibold text-foreground">Repasses aprovados</h3>
              {aConfirmar.map((d) => {
                const dias = Number(d.dias_para_a_data ?? 0);
                const pago = !!d.baixa_data_pagamento;
                const selo = pago
                  ? { r: `Pago em ${fmtBR(d.baixa_data_pagamento)}`, c: "bg-blue-100 text-blue-800" }
                  : d.nf_status === "EM_CONFERENCIA"
                    ? { r: "Nota em conferência", c: "bg-amber-200 text-amber-950 font-semibold" }
                    : d.nf_status === "APROVADA"
                      ? { r: "Nota aprovada", c: "bg-emerald-100 text-emerald-800" }
                      : d.nf_status === "RECUSADA"
                        ? { r: "Nota recusada", c: "bg-red-100 text-red-800" }
                        : { r: "Aguardando nota fiscal", c: "bg-muted text-muted-foreground" };
                return (
                  <BlocoDemanda key={d.demanda_id} destacar={d.demanda_id === destaque}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {d.parceiro}{" "}
                          <Badge variant="outline" className={cn("ml-1 border-transparent", selo.c)}>
                            {selo.r}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ciclo de {MESES[(d.ciclo_mes ?? 1) - 1]}/{d.ciclo_ano}
                          {d.nf_numero ? ` · nota nº ${d.nf_numero}` : ""}
                        </p>
                        <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                          {BRL(d.valor_total)}
                        </p>
                        {!pago && d.data_prevista_pagamento ? (
                          <p className="text-xs text-muted-foreground">
                            Previsto para {fmtBR(d.data_prevista_pagamento)}
                            {dias <= 0 ? (
                              <span className="text-amber-700">
                                {" · "}
                                {dias === 0 ? "vence hoje" : `${Math.abs(dias)} dia(s) de atraso`}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        {!pago && d.nf_status !== "APROVADA" ? (
                          <p className="text-xs text-muted-foreground">
                            O pagamento só pode ser registrado depois da nota fiscal aprovada.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRelacao(d)}>
                          <FileSearch className="mr-2 h-4 w-4" />
                          Abrir a relação
                        </Button>
                        {d.canal_id ? (
                          <Button size="sm" variant="ghost" onClick={() => setDocumentos(d)}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Documentos
                          </Button>
                        ) : null}
                        {pago ? (
                          <>
                            <BotaoBaixarDocumento id={d.comprovante_documento_id} rotulo="Baixar comprovante" />
                            <BotaoBaixarDocumento id={d.nf_documento_id} rotulo="Baixar nota" />
                          </>
                        ) : !d.sou_o_aprovador ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            Aguardando o gestor do Financeiro.
                          </Badge>
                        ) : d.nf_status === "EM_CONFERENCIA" ? (
                          <Button size="sm" onClick={() => setConferir(d)}>
                            <Check className="mr-2 h-4 w-4" />
                            Conferir nota
                          </Button>
                        ) : d.nf_status === "APROVADA" ? (
                          <>
                            <Button size="sm" onClick={() => setRegistrar(d)}>
                              <Check className="mr-2 h-4 w-4" />
                              Registrar pagamento
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setNaoPagou(d)}>
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Ainda não foi pago
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </BlocoDemanda>
                );
              })}
            </section>
          ) : null}
        </CardContent>
      </Card>

      <AutorizarDialog
        demanda={autorizar}
        onFechar={() => setAutorizar(null)}
        onSucesso={() => {
          apósDecidir();
          setAutorizar(null);
        }}
      />
      <RecusarDialog
        demanda={recusar}
        onFechar={() => setRecusar(null)}
        onSucesso={() => {
          apósDecidir();
          setRecusar(null);
        }}
      />
      <ConferirNFDialog demanda={conferir} onFechar={() => setConferir(null)} />
      <RegistrarPagamentoDialog demanda={registrar} onFechar={() => setRegistrar(null)} />
      <DocumentosParceiroDialog
        canalId={documentos?.canal_id ?? null}
        parceiro={documentos?.parceiro ?? ""}
        onFechar={() => setDocumentos(null)}
      />
      <NaoPagouDialog
        demanda={naoPagou}
        onFechar={() => setNaoPagou(null)}
        onSucesso={() => {
          apósDecidir();
          setNaoPagou(null);
        }}
      />
      <DetalheRepasseCiclo
        aberto={relacao !== null}
        onFechar={() => setRelacao(null)}
        canal={relacao?.chave_planilha ?? ""}
        parceiro={relacao?.parceiro ?? ""}
        ano={relacao?.ciclo_ano ?? 0}
        mes={relacao?.ciclo_mes ?? 1}
        valorDoPedido={relacao?.valor_total ?? undefined}
      />
      <ContratoDoParceiro
        aberto={contrato !== null}
        onFechar={() => setContrato(null)}
        canal={contrato?.chave_planilha ?? ""}
        parceiro={contrato?.parceiro ?? ""}
      />
    </>
  );
}

function BlocoDemanda({
  destacar,
  children,
}: {
  destacar: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [aceso, setAceso] = useState(false);

  useEffect(() => {
    if (!destacar) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setAceso(true);
    const t = setTimeout(() => setAceso(false), 6000);
    return () => clearTimeout(t);
  }, [destacar]);

  return (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card p-4", aceso && "ring-2 ring-primary ring-offset-2")}
    >
      {children}
    </div>
  );
}

function AutorizarDialog({
  demanda,
  onFechar,
  onSucesso,
}: {
  demanda: DemandaNF | null;
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const [data, setData] = useState<Date | undefined>();
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (demanda) {
      setData(undefined);
      setObservacao("");
    }
  }, [demanda]);

  async function salvar() {
    if (!demanda || !data) return;
    setSalvando(true);
    try {
      const { data: r, error } = await supabase.rpc("rpc_canal_repasse_decidir_nf" as never, {
        p_demanda_id: demanda.demanda_id,
        p_aprovar: true,
        p_data_prevista: iso(data),
        p_observacao: observacao.trim() || null,
      } as never);
      if (error) throw error;
      const row = (Array.isArray(r) ? r[0] : r) as { mensagem?: string } | null;
      toast.success(row?.mensagem ?? "Autorizado.");
      onSucesso();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Autorizar a emissão da nota</DialogTitle>
          <DialogDescription>
            Data prevista do pagamento, contada a partir do recebimento da nota fiscal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {demanda?.parceiro} · {BRL(demanda?.valor_total)}
          </p>
          <p className="text-sm text-foreground">
            A data é livre, quem define é o Financeiro. Conte a partir do recebimento da nota
            fiscal.
          </p>
          <Calendar
            mode="single"
            selected={data}
            onSelect={setData}
            disabled={(d) => d < hoje}
            initialFocus
            className={cn("pointer-events-auto rounded-md border p-3")}
          />
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !data}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecusarDialog({
  demanda,
  onFechar,
  onSucesso,
}: {
  demanda: DemandaNF | null;
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (demanda) setObservacao("");
  }, [demanda]);

  async function salvar() {
    if (!demanda) return;
    setSalvando(true);
    try {
      const { data: r, error } = await supabase.rpc("rpc_canal_repasse_decidir_nf" as never, {
        p_demanda_id: demanda.demanda_id,
        p_aprovar: false,
        p_data_prevista: null,
        p_observacao: observacao.trim(),
      } as never);
      if (error) throw error;
      const row = (Array.isArray(r) ? r[0] : r) as { mensagem?: string } | null;
      toast.success(row?.mensagem ?? "Pedido recusado.");
      onSucesso();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar o pedido</DialogTitle>
          <DialogDescription>
            Explique o motivo. O Comercial vê esta observação na tela dele.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Motivo da recusa"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void salvar()}
            disabled={salvando || observacao.trim().length === 0}
          >
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Recusar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarBaixaDialog({
  demanda,
  onFechar,
  onSucesso,
}: {
  demanda: DemandaNF | null;
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const [data, setData] = useState<Date | undefined>();
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  useEffect(() => {
    if (demanda) {
      setData(new Date());
      setObservacao("");
    }
  }, [demanda]);

  async function salvar() {
    if (!demanda || !data) return;
    setSalvando(true);
    try {
      const { data: r, error } = await supabase.rpc("rpc_canal_repasse_confirmar_baixa" as never, {
        p_demanda_id: demanda.demanda_id,
        p_pago: true,
        p_data_pagamento: iso(data),
        p_nova_data_prevista: null,
        p_observacao: observacao.trim() || null,
      } as never);
      if (error) throw error;
      const row = (Array.isArray(r) ? r[0] : r) as { mensagem?: string } | null;
      toast.success(row?.mensagem ?? "Pagamento confirmado.");
      onSucesso();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
          <DialogDescription>Informe a data em que o pagamento foi feito.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {demanda?.parceiro} · {BRL(demanda?.valor_total)}
          </p>
          <Calendar
            mode="single"
            selected={data}
            onSelect={setData}
            disabled={(d) => d > hoje}
            initialFocus
            className={cn("pointer-events-auto rounded-md border p-3")}
          />
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !data}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NaoPagouDialog({
  demanda,
  onFechar,
  onSucesso,
}: {
  demanda: DemandaNF | null;
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const [data, setData] = useState<Date | undefined>();
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (demanda) {
      setData(undefined);
      setObservacao("");
    }
  }, [demanda]);

  async function salvar() {
    if (!demanda) return;
    setSalvando(true);
    try {
      const { data: r, error } = await supabase.rpc("rpc_canal_repasse_confirmar_baixa" as never, {
        p_demanda_id: demanda.demanda_id,
        p_pago: false,
        p_data_pagamento: null,
        p_nova_data_prevista: data ? iso(data) : null,
        p_observacao: observacao.trim() || null,
      } as never);
      if (error) throw error;
      const row = (Array.isArray(r) ? r[0] : r) as { mensagem?: string } | null;
      toast.success(row?.mensagem ?? "Registrado.");
      onSucesso();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ainda não pagou</DialogTitle>
          <DialogDescription>
            <CalendarClock className="mr-1 inline h-4 w-4" />
            Informe uma nova data prevista ou explique o que houve.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Calendar
            mode="single"
            selected={data}
            onSelect={setData}
            disabled={(d) => d < hoje}
            initialFocus
            className={cn("pointer-events-auto rounded-md border p-3")}
          />
          <Textarea
            placeholder="Observação"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={() => void salvar()}
            disabled={salvando || (!data && observacao.trim().length === 0)}
          >
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DemandasRepasseNF;
