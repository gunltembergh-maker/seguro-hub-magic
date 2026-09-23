// Nota fiscal e comprovante de pagamento do repasse de parceiro.
// Upload pelo client do usuário no bucket privado; download pela rota do Hub.
import { mensagemDeErro } from "@/lib/erro";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { exportarRepasse } from "@/lib/repasse/exportar-repasse";

const BUCKET = "canal-parceiros-documentos";
const MAX_BYTES = 20 * 1024 * 1024;
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "";
export const dataHoraBR = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";
const hojeISO = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export const cicloRotulo = (ano: number, mes: number) => `${MESES[(mes ?? 1) - 1]}/${ano}`;

/* ------------------------------------------------------------- download */

export async function baixarDocumentoArquivo(id: string, nome?: string | null): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente no Hub.");
  const resp = await fetch("/api/canal-parceiro-documento", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  if (!resp.ok) {
    let msg = "Não foi possível baixar o documento.";
    try {
      const j = (await resp.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* sem corpo */
    }
    throw new Error(msg);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome || "documento";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function BotaoBaixarDocumento({
  id,
  nome,
  rotulo = "Baixar",
  variant = "outline",
  size = "sm",
  className,
}: {
  id?: string | null;
  nome?: string | null;
  rotulo?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [baixando, setBaixando] = useState(false);
  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      disabled={baixando || !id}
      onClick={async () => {
        if (!id) return;
        setBaixando(true);
        try {
          await baixarDocumentoArquivo(id, nome);
        } catch (e) {
          toast.error(mensagemDeErro(e));
        } finally {
          setBaixando(false);
        }
      }}
    >
      {baixando ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {rotulo}
    </Button>
  );
}

/* --------------------------------------------------------------- upload */

function sanitizar(nome: string) {
  return (
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "arquivo"
  );
}

function validarArquivo(f: File, exts: string[]): string | null {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if (!exts.includes(ext)) return `Formato não aceito. Use ${exts.map((e) => e.toUpperCase()).join(", ")}.`;
  if (f.size > MAX_BYTES) return "Arquivo acima de 20 MB.";
  return null;
}

async function subir(
  f: File,
  canalId: string,
  ano: number,
  mes: number,
  pasta: "nf" | "comprovante",
): Promise<string> {
  const path = `${canalId}/${ano}-${String(mes).padStart(2, "0")}/${pasta}/${Date.now()}-${sanitizar(f.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
    upsert: false,
    contentType: f.type || undefined,
  });
  if (error) throw error;
  return path;
}

async function remover(path: string) {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* limpeza silenciosa */
  }
}

function primeira<T>(r: unknown): T | null {
  return (Array.isArray(r) ? r[0] : r) as T | null;
}

export function invalidarRepasse(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["canal-repasse-demandas"] });
  void qc.invalidateQueries({ queryKey: ["canal-parceiro-documentos"] });
  void qc.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
  void qc.invalidateQueries({ queryKey: ["canal-parceiro-eventos"] });
}

/** Dados mínimos da demanda usados nos diálogos. */
export type DemandaDoc = {
  demanda_id: string;
  canal_id: string | null;
  chave_planilha?: string | null;
  parceiro: string;
  ciclo_ano: number;
  ciclo_mes: number;
  valor_total: number | null;
  nf_documento_id?: string | null;
  nf_status?: string | null;
  nf_numero?: string | null;
  nf_valor?: number | null;
  nf_valor_diverge?: boolean | null;
  nf_enviada_em?: string | null;
  nf_enviada_por_nome?: string | null;
  comprovante_documento_id?: string | null;
};

/* ---------------------------------------------------- enviar nota fiscal */

function valorEmReais(txt: string): number | null {
  const limpo = txt.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return txt.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

export function EnviarNFDialog({
  demanda,
  onFechar,
}: {
  demanda: DemandaDoc | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [numero, setNumero] = useState("");
  const [valor, setValor] = useState("");
  const [emissao, setEmissao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (demanda) {
      setArquivo(null);
      setNumero("");
      setValor("");
      setEmissao("");
    }
  }, [demanda]);

  const valorNum = valorEmReais(valor);
  const autorizado = Number(demanda?.valor_total ?? 0);
  const diverge = valorNum != null && Math.abs(valorNum - autorizado) >= 0.01;
  const erroArquivo = arquivo ? validarArquivo(arquivo, ["pdf", "xml", "png", "jpg", "jpeg"]) : null;
  const hoje = hojeISO();
  const emissaoFutura = !!emissao && emissao > hoje;
  const ok = !!arquivo && !erroArquivo && numero.trim() && valorNum != null && !emissaoFutura;

  async function enviar() {
    if (!demanda || !arquivo || !ok || salvando) return;
    if (!demanda.canal_id) {
      toast.error("Parceiro sem cadastro no Hub. Não é possível anexar a nota.");
      return;
    }
    setSalvando(true);
    let path: string | null = null;
    try {
      path = await subir(arquivo, demanda.canal_id, demanda.ciclo_ano, demanda.ciclo_mes, "nf");
      const { data, error } = await supabase.rpc("rpc_canal_repasse_enviar_nf" as never, {
        p_demanda_id: demanda.demanda_id,
        p_arquivo_path: path,
        p_arquivo_nome: arquivo.name,
        p_numero_nf: numero.trim(),
        p_valor_nf: valorNum,
        p_data_emissao: emissao || null,
      } as never);
      if (error) throw error;
      toast.success(primeira<{ mensagem?: string }>(data)?.mensagem ?? "Nota fiscal enviada.");
      invalidarRepasse(qc);
      onFechar();
    } catch (e) {
      if (path) await remover(path);
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o && !salvando ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] min-w-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar nota fiscal</DialogTitle>
          <DialogDescription className="break-words">
            {demanda?.parceiro}, ciclo de {demanda ? cicloRotulo(demanda.ciclo_ano, demanda.ciclo_mes) : ""}.
            Valor autorizado pelo Financeiro: {BRL(autorizado)}.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <Label>Arquivo da nota (PDF, XML, PNG ou JPG, até 20 MB)</Label>
            <Input
              type="file"
              accept=".pdf,.xml,.png,.jpg,.jpeg"
              className="w-full min-w-0"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {erroArquivo ? <p className="text-xs text-destructive">{erroArquivo}</p> : null}
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <Label>Número da nota</Label>
              <Input className="w-full min-w-0" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="min-w-0 space-y-1">
              <Label>Valor da nota (R$)</Label>
              <Input
                className="w-full min-w-0"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Data de emissão (opcional)</Label>
            <Input
              type="date"
              max={hoje}
              className="w-full min-w-0"
              value={emissao}
              onChange={(e) => setEmissao(e.target.value)}
            />
            {emissaoFutura ? (
              <p className="text-xs text-destructive">A data de emissão não pode ser futura.</p>
            ) : null}
          </div>
          {diverge ? (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                O valor da nota é diferente do valor autorizado ({BRL(autorizado)}). O Financeiro vai
                conferir.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={!ok || salvando}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar nota fiscal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------- conferir nota fiscal */

export function ConferirNFDialog({
  demanda,
  onFechar,
}: {
  demanda: DemandaDoc | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (demanda) {
      setRecusando(false);
      setMotivo("");
    }
  }, [demanda]);

  async function decidir(aprovar: boolean) {
    if (!demanda?.nf_documento_id || salvando) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("rpc_canal_repasse_conferir_nf" as never, {
        p_documento_id: demanda.nf_documento_id,
        p_aprovar: aprovar,
        p_motivo: aprovar ? null : motivo.trim(),
      } as never);
      if (error) throw error;
      toast.success(
        primeira<{ mensagem?: string }>(data)?.mensagem ??
          (aprovar ? "Nota fiscal aprovada." : "Nota fiscal recusada."),
      );
      invalidarRepasse(qc);
      onFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o && !salvando ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] min-w-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conferir nota fiscal</DialogTitle>
          <DialogDescription className="break-words">
            {demanda?.parceiro}, ciclo de {demanda ? cicloRotulo(demanda.ciclo_ano, demanda.ciclo_mes) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>Número: <span className="font-medium">{demanda?.nf_numero ?? ""}</span></p>
          <p>Valor da nota: <span className="font-mono font-medium">{BRL(demanda?.nf_valor)}</span></p>
          <p>Valor autorizado: <span className="font-mono">{BRL(demanda?.valor_total)}</span></p>
          <p className="text-muted-foreground">
            Enviada por {demanda?.nf_enviada_por_nome ?? "não informado"}
            {demanda?.nf_enviada_em ? ` em ${dataHoraBR(demanda.nf_enviada_em)}` : ""}
          </p>
          {demanda?.nf_valor_diverge ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                O valor da nota não bate com o valor autorizado. Confira antes de aprovar.
              </AlertDescription>
            </Alert>
          ) : null}
          <BotaoBaixarDocumento id={demanda?.nf_documento_id} rotulo="Baixar nota" />
          {recusando ? (
            <Textarea
              placeholder="Motivo da recusa (o Comercial vê este texto)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          ) : null}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Fechar
          </Button>
          {recusando ? (
            <Button
              variant="destructive"
              disabled={salvando || motivo.trim().length === 0}
              onClick={() => void decidir(false)}
            >
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar recusa
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={salvando} onClick={() => setRecusando(true)}>
                <X className="mr-2 h-4 w-4" />
                Recusar
              </Button>
              <Button disabled={salvando} onClick={() => void decidir(true)}>
                {salvando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Aprovar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------- registrar pagamento */

export function RegistrarPagamentoDialog({
  demanda,
  onFechar,
}: {
  demanda: DemandaDoc | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const hoje = hojeISO();
  const [data, setData] = useState(hoje);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (demanda) {
      setData(hojeISO());
      setArquivo(null);
      setObservacao("");
    }
  }, [demanda]);

  const erroArquivo = arquivo ? validarArquivo(arquivo, ["pdf", "png", "jpg", "jpeg"]) : null;
  const futura = !!data && data > hoje;
  const ok = !!data && !futura && !!arquivo && !erroArquivo;

  async function salvar() {
    if (!demanda || !arquivo || !ok || salvando) return;
    if (!demanda.canal_id) {
      toast.error("Parceiro sem cadastro no Hub. Não é possível anexar o comprovante.");
      return;
    }
    setSalvando(true);
    let path: string | null = null;
    let basePath: string | null = null;
    let baseNome: string | null = null;
    try {
      path = await subir(arquivo, demanda.canal_id, demanda.ciclo_ano, demanda.ciclo_mes, "comprovante");

      // Base do repasse: mesmo arquivo da Relação interna do Fluxo Diário.
      try {
        const parceiro = demanda.chave_planilha || demanda.parceiro;
        const mm = String(demanda.ciclo_mes).padStart(2, "0");
        const r = await exportarRepasse({
          canal: parceiro,
          ano: demanda.ciclo_ano,
          mes: demanda.ciclo_mes,
          modo: "INTERNO",
          modoDados: "PROVISIONADO",
          situacaoRepasse: null,
          apenasGerar: true,
        });
        if (!r.buffer) throw new Error("Base não gerada.");
        baseNome = `relacao-interna-${sanitizar(parceiro).toLowerCase()}-${mm}-${demanda.ciclo_ano}.xlsx`;
        const caminho = `${demanda.canal_id}/${demanda.ciclo_ano}-${mm}/base/${Date.now()}-${baseNome}`;
        const { error: erroBase } = await supabase.storage.from(BUCKET).upload(
          caminho,
          new Blob([r.buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          { upsert: false },
        );
        if (erroBase) throw erroBase;
        basePath = caminho;
      } catch {
        basePath = null;
        baseNome = null;
      }

      const { data: r, error } = await supabase.rpc("rpc_canal_repasse_registrar_pagamento" as never, {
        p_demanda_id: demanda.demanda_id,
        p_data_pagamento: data,
        p_arquivo_path: path,
        p_arquivo_nome: arquivo.name,
        p_observacao: observacao.trim() || null,
        p_base_path: basePath,
        p_base_nome: baseNome,
      } as never);
      if (error) throw error;
      toast.success(primeira<{ mensagem?: string }>(r)?.mensagem ?? "Pagamento registrado.");
      if (!basePath) toast.warning("Pagamento registrado sem a base anexada");
      invalidarRepasse(qc);
      onFechar();
    } catch (e) {
      if (path) await remover(path);
      if (basePath) await remover(basePath);
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={demanda !== null} onOpenChange={(o) => (!o && !salvando ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] min-w-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription className="break-words">
            {demanda?.parceiro} · {BRL(demanda?.valor_total)}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <Label>Data do pagamento</Label>
            <Input type="date" max={hoje} className="w-full min-w-0" value={data} onChange={(e) => setData(e.target.value)} />
            {futura ? <p className="text-xs text-destructive">A data não pode ser futura.</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Comprovante (PDF, PNG ou JPG, até 20 MB)</Label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="w-full min-w-0"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {erroArquivo ? <p className="text-xs text-destructive">{erroArquivo}</p> : null}
          </div>
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={!ok || salvando}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------- estoque de documentos */

type Documento = {
  documento_id: string;
  demanda_id: string | null;
  ciclo_ano: number;
  ciclo_mes: number;
  tipo: "NOTA_FISCAL" | "COMPROVANTE";
  status: string;
  arquivo_nome: string | null;
  numero_nf: string | null;
  valor_nf: number | null;
  data_emissao: string | null;
  valor_autorizado: number | null;
  valor_diverge: boolean | null;
  data_pagamento: string | null;
  observacao: string | null;
  motivo_recusa: string | null;
  enviado_por_nome: string | null;
  enviado_em: string | null;
  conferido_por_nome: string | null;
  conferido_em: string | null;
};

const SELO_NF: Record<string, { rotulo: string; cls: string }> = {
  EM_CONFERENCIA: { rotulo: "Em conferência", cls: "bg-amber-100 text-amber-900" },
  APROVADA: { rotulo: "Aprovada", cls: "bg-emerald-100 text-emerald-800" },
  RECUSADA: { rotulo: "Recusada", cls: "bg-muted text-muted-foreground" },
};

export function DocumentosParceiroDialog({
  canalId,
  parceiro,
  onFechar,
}: {
  canalId: string | null;
  parceiro: string;
  onFechar: () => void;
}) {
  const docs = useQuery({
    queryKey: ["canal-parceiro-documentos", canalId],
    enabled: !!canalId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_canal_parceiro_documentos" as never, {
        p_canal_id: canalId,
        p_demanda_id: null,
      } as never);
      if (error) throw error;
      return (data || []) as Documento[];
    },
  });

  const ciclos = useMemo(() => {
    const m = new Map<string, { ano: number; mes: number; itens: Documento[] }>();
    for (const d of docs.data ?? []) {
      const k = `${d.ciclo_ano}-${String(d.ciclo_mes).padStart(2, "0")}`;
      if (!m.has(k)) m.set(k, { ano: d.ciclo_ano, mes: d.ciclo_mes, itens: [] });
      m.get(k)!.itens.push(d);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
  }, [docs.data]);

  return (
    <Dialog open={canalId !== null} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] min-w-0 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Documentos de {parceiro}</DialogTitle>
          <DialogDescription>Notas fiscais e comprovantes de pagamento, por ciclo.</DialogDescription>
        </DialogHeader>
        {docs.isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Carregando
          </p>
        ) : docs.error ? (
          <p className="text-sm text-destructive">{mensagemDeErro(docs.error)}</p>
        ) : ciclos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento deste parceiro ainda.</p>
        ) : (
          <div className="space-y-4">
            {ciclos.map((c) => (
              <section key={`${c.ano}-${c.mes}`} className="space-y-2 rounded-lg border p-3">
                <h3 className="text-sm font-semibold text-foreground">Ciclo de {cicloRotulo(c.ano, c.mes)}</h3>
                {c.itens.map((d) => {
                  const historico = d.status === "RECUSADA" || d.status === "SUBSTITUIDO";
                  return (
                    <div
                      key={d.documento_id}
                      className={cn(
                        "flex flex-wrap items-start justify-between gap-2 rounded-md bg-card p-2 text-sm",
                        historico && "opacity-60",
                      )}
                    >
                      {d.tipo === "NOTA_FISCAL" ? (
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium">
                            Nota fiscal {d.numero_nf ?? ""}{" "}
                            <Badge
                              variant="outline"
                              className={cn("ml-1 border-transparent", SELO_NF[d.status]?.cls)}
                            >
                              {SELO_NF[d.status]?.rotulo ?? d.status}
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Valor {BRL(d.valor_nf)}
                            {d.data_emissao ? ` · emitida em ${dataBR(d.data_emissao)}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Enviada por {d.enviado_por_nome ?? "não informado"} em {dataHoraBR(d.enviado_em)}
                          </p>
                          {d.conferido_por_nome ? (
                            <p className="text-xs text-muted-foreground">
                              Conferida por {d.conferido_por_nome} em {dataHoraBR(d.conferido_em)}
                            </p>
                          ) : null}
                          {d.status === "RECUSADA" && d.motivo_recusa ? (
                            <p className="text-xs text-destructive">Motivo: {d.motivo_recusa}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium">
                            Comprovante de pagamento
                            {d.status === "SUBSTITUIDO" ? (
                              <Badge variant="outline" className="ml-2 border-transparent bg-muted text-muted-foreground">
                                Substituído
                              </Badge>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pago em {dataBR(d.data_pagamento)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Anexado por {d.enviado_por_nome ?? "não informado"} em {dataHoraBR(d.enviado_em)}
                          </p>
                          {d.observacao ? <p className="text-xs">{d.observacao}</p> : null}
                        </div>
                      )}
                      <BotaoBaixarDocumento id={d.documento_id} nome={d.arquivo_nome} />
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
