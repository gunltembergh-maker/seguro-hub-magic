// Canal Parceiros — fila de verificação humana dos contratos.
//
// Mostra os contratos parados (EM_VALIDACAO, VINCULO_A_CONFIRMAR, RECUSADO),
// abre o PDF por link temporário de 5 minutos e chama a RPC de correção.
// Quem pode corrigir e quem pode atestar assinatura é decidido pelo banco:
// aqui só escondemos o que a pessoa não pode usar e mostramos o erro do banco.
import { mensagemDeErro } from "@/lib/erro";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { hasRole } from "@/hooks/use-meu-perfil";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const BUCKET = "canal-parceiros-contratos";

export interface Pendencia {
  contrato_id: string;
  canal_id: string | null;
  parceiro: string | null;
  arquivo_nome: string | null;
  arquivo_path: string | null;
  situacao: string | null;
  motivo_bloqueio: string | null;
  origem_leitura: string | null;
  declarado_assinado: boolean | null;
  assinatura_lida: boolean | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  minimo_repasse?: number | null;
  tentativas?: number | null;
  enviado_por_nome: string | null;
  enviado_em: string | null;
  repasse_acumulado: number | null;
  ja_avisado_em: string | null;
}

/* --------------------------------------------------------------- formatos */

const dia = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const pctTexto = (v?: number | null) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const reais = (v?: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const rotuloOrigemLeitura: Record<string, string> = {
  TEXTO: "Texto do PDF",
  OCR: "OCR",
  MANUAL: "Informado manualmente",
};

const simNao = (v?: boolean | null) => (v === true ? "Sim" : "Não");

/* ----------------------------------------------------------- abrir o PDF */

/** Baixa o PDF pela rota do próprio Hub (nenhum bloqueador derruba o domínio do Hub). */
async function baixarContrato(path: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente no Hub.");
  const resp = await fetch("/api/canal-parceiro-contrato", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path }),
  });
  if (!resp.ok) {
    let msg = "Não foi possível abrir o contrato.";
    try {
      const j = (await resp.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* resposta sem corpo */
    }
    throw new Error(msg);
  }
  return resp.blob();
}

export function useAbrirContrato() {
  const [ocupado, setOcupado] = useState(false);

  async function abrir(path?: string | null, baixarComo?: string | null) {
    if (!path) {
      toast.error("Este contrato não tem arquivo guardado.");
      return;
    }
    setOcupado(true);
    // Abre a aba já no clique para não cair no bloqueio de pop-up.
    const aba = baixarComo ? null : window.open("", "_blank");
    try {
      const blob = await baixarContrato(path);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (baixarComo) {
        const a = document.createElement("a");
        a.href = url;
        a.download = baixarComo;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (aba) {
        aba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      aba?.close();
      toast.error(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return { abrir, ocupado };
}

/* ------------------------------------------------------------------ dados */

export function usePendenciasVerificacao() {
  return useQuery({
    queryKey: ["canal-parceiro-pendencias-verificacao"],
    queryFn: async (): Promise<Pendencia[]> => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_pendencias_verificacao" as never,
      );
      if (error) throw error;
      return (data ?? []) as unknown as Pendencia[];
    },
    staleTime: 60_000,
  });
}

/** O usuário é o aprovador designado? Só ele vê a atestação de assinatura. */
function useSouAprovador() {
  return useQuery({
    queryKey: ["canal-parceiro-sou-aprovador"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_liberacoes" as never,
        {
          p_status: null,
        } as never,
      );
      if (error) throw error;
      const linhas = (data ?? []) as Array<{ sou_o_aprovador?: boolean | null }>;
      return linhas.some((l) => l?.sou_o_aprovador === true);
    },
    staleTime: 5 * 60_000,
  });
}

/* -------------------------------------------------------------- o bloco */

export function FilaVerificacaoContratos({ semCard = false }: { semCard?: boolean } = {}) {
  const pendencias = usePendenciasVerificacao();
  const aprovador = useSouAprovador();
  const { abrir, ocupado } = useAbrirContrato();
  const [conferindo, setConferindo] = useState<Pendencia | null>(null);
  const meuPerfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(meuPerfil, "ADMIN");

  const linhas = pendencias.data ?? [];
  if (!isAdmin || pendencias.isLoading || linhas.length === 0) return null;

  const conteudo = (
    <div className="space-y-3">
      {linhas.map((p) => (
        <div key={p.contrato_id} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{p.parceiro ?? "Parceiro sem nome"}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{p.arquivo_nome ?? "Contrato"}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => abrir(p.arquivo_path)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir contrato
              </Button>
              <Button size="sm" onClick={() => setConferindo(p)}>
                Conferir e liberar
              </Button>
            </div>
          </div>

          <p className="mt-2 rounded-md border border-amber-600/40 bg-amber-50 p-2 text-sm font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            {p.motivo_bloqueio ?? "Sem motivo informado."}
          </p>

          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <Dado rotulo="Declarado como assinado" valor={simNao(p.declarado_assinado)} />
            <Dado rotulo="Assinatura encontrada no arquivo" valor={simNao(p.assinatura_lida)} />
            <Dado
              rotulo="Origem da leitura"
              valor={rotuloOrigemLeitura[p.origem_leitura ?? ""] ?? "—"}
            />
          </div>

          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
            <Dado
              rotulo="Vigência lida"
              valor={
                p.vigencia_inicio || p.vigencia_fim
                  ? `${dia(p.vigencia_inicio)} a ${dia(p.vigencia_fim)}`
                  : "—"
              }
            />
            <Dado rotulo="Benefícios" valor={pctTexto(p.pct_beneficios)} />
            <Dado rotulo="Garantia" valor={pctTexto(p.pct_garantia)} />
            <Dado rotulo="Demais ramos" valor={pctTexto(p.pct_demais)} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Enviado por {p.enviado_por_nome ?? "—"} em {dataHora(p.enviado_em)}
            </span>
            <Badge variant="outline">Repasse acumulado travado: {reais(p.repasse_acumulado)}</Badge>
            {p.ja_avisado_em ? <span>Avisado em {dataHora(p.ja_avisado_em)}</span> : null}
            {(p.tentativas ?? 0) > 1 ? (
              <span>{p.tentativas} envios deste parceiro. Vale o mais recente.</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {semCard ? (
        conteudo
      ) : (
        <Card className="border-amber-600/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Aguardando conferência
            </CardTitle>
            <CardDescription>
              Contratos parados esperando alguém abrir o documento e confirmar o que o Hub não
              conseguiu concluir sozinho.
            </CardDescription>
          </CardHeader>
          <CardContent>{conteudo}</CardContent>
        </Card>
      )}

      <ConferirDialog
        pendencia={conferindo}
        souAprovador={aprovador.data === true}
        onFechar={() => setConferindo(null)}
      />
    </>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-muted-foreground">{rotulo}</div>
      <div className="font-medium text-foreground">{valor}</div>
    </div>
  );
}

/* ---------------------------------------------------- conferir e liberar */

/** Percentual digitado como 25 vira 0,25 na RPC. Vazio vira null: não muda. */
function paraFracao(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Number((n / 100).toFixed(4)) : null;
}

function paraTexto(v?: number | null): string {
  return v == null ? "" : String(Number((v * 100).toFixed(2)));
}

function ConferirDialog({
  pendencia,
  souAprovador,
  onFechar,
}: {
  pendencia: Pendencia | null;
  souAprovador: boolean;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const { abrir, ocupado } = useAbrirContrato();

  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [beneficios, setBeneficios] = useState("");
  const [garantia, setGarantia] = useState("");
  const [demais, setDemais] = useState("");
  const [minimo, setMinimo] = useState("");
  const [atestar, setAtestar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{
    situacao?: string | null;
    motivo?: string | null;
    pode_exportar?: boolean | null;
  } | null>(null);

  useEffect(() => {
    if (!pendencia) return;
    setInicio(pendencia.vigencia_inicio?.slice(0, 10) ?? "");
    setFim(pendencia.vigencia_fim?.slice(0, 10) ?? "");
    setBeneficios(paraTexto(pendencia.pct_beneficios));
    setGarantia(paraTexto(pendencia.pct_garantia));
    setDemais(paraTexto(pendencia.pct_demais));
    setMinimo(pendencia.minimo_repasse == null ? "" : String(pendencia.minimo_repasse));
    setAtestar(false);
    setMotivo("");
    setResultado(null);
  }, [pendencia]);

  if (!pendencia) return null;

  /** Campo intocado vira null: a RPC não mexe no que não foi mandado. */
  const mudou = (atual: string, original: string | null) =>
    atual.trim() === (original ?? "").trim() ? null : atual.trim() || null;

  async function confirmar() {
    if (!pendencia || !motivo.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_corrigir_contrato" as never,
        {
          p_contrato_id: pendencia.contrato_id,
          p_motivo: motivo.trim(),
          p_vigencia_inicio: mudou(inicio, pendencia.vigencia_inicio?.slice(0, 10) ?? ""),
          p_vigencia_fim: mudou(fim, pendencia.vigencia_fim?.slice(0, 10) ?? ""),
          p_pct_beneficios:
            beneficios.trim() === paraTexto(pendencia.pct_beneficios)
              ? null
              : paraFracao(beneficios),
          p_pct_garantia:
            garantia.trim() === paraTexto(pendencia.pct_garantia) ? null : paraFracao(garantia),
          p_pct_demais:
            demais.trim() === paraTexto(pendencia.pct_demais) ? null : paraFracao(demais),
          p_minimo:
            minimo.trim() ===
            (pendencia.minimo_repasse == null ? "" : String(pendencia.minimo_repasse))
              ? null
              : Number(minimo.trim().replace(",", ".")) || null,
          p_confirmar_assinatura: souAprovador && atestar ? true : null,
        } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as {
        situacao?: string | null;
        motivo?: string | null;
        pode_exportar?: boolean | null;
      } | null;
      setResultado(r ?? {});
      toast.success(
        r?.motivo ??
          (r?.situacao === "ATIVO"
            ? "Contrato ativo. O repasse deste parceiro foi liberado."
            : `Situação: ${r?.situacao ?? "—"}.`),
      );
      onFechar();
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-pendencias-verificacao"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-contratos"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-lista"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-vigencias"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !salvando && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Conferir e liberar</DialogTitle>
          <DialogDescription>
            {pendencia.parceiro ?? "Parceiro"} · {pendencia.arquivo_nome ?? "Contrato"}
          </DialogDescription>
        </DialogHeader>

        {/* 1. o documento */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <Button
            className="w-full"
            size="lg"
            disabled={ocupado}
            onClick={() => abrir(pendencia.arquivo_path)}
          >
            {ocupado ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Abrir o contrato
          </Button>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Confira o documento antes de liberar.</p>
            <Button
              variant="ghost"
              size="sm"
              disabled={ocupado}
              onClick={() =>
                abrir(pendencia.arquivo_path, pendencia.arquivo_nome ?? "contrato.pdf")
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </Button>
          </div>
        </div>

        <Separator />

        {/* 2. correções */}
        <div className="space-y-3">
          <p className="text-sm font-medium">O que precisa ser corrigido</p>
          <p className="text-xs text-muted-foreground">
            Confira o que foi lido e corrija só o que estiver diferente do documento.
          </p>
          <p className="text-xs text-muted-foreground">
            Só o que você alterar é gravado. Campo intocado continua como está.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cv-inicio">Vigência — início</Label>
              <Input
                id="cv-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-fim">Vigência — fim</Label>
              <Input id="cv-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-benef">Benefícios (%)</Label>
              <Input
                id="cv-benef"
                inputMode="decimal"
                value={beneficios}
                onChange={(e) => setBeneficios(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-gar">Garantia (%)</Label>
              <Input
                id="cv-gar"
                inputMode="decimal"
                value={garantia}
                onChange={(e) => setGarantia(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-demais">Demais ramos (%)</Label>
              <Input
                id="cv-demais"
                inputMode="decimal"
                value={demais}
                onChange={(e) => setDemais(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-min">Mínimo por ciclo (R$)</Label>
              <Input
                id="cv-min"
                inputMode="decimal"
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 3. atestação — só o aprovador */}
        {souAprovador ? (
          <>
            <Separator />
            <div className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="cv-atestar"
                  checked={atestar}
                  onCheckedChange={(v) => setAtestar(v === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="cv-atestar" className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Confirmo que abri o documento e ele está assinado
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use isto quando a assinatura existe no documento mas o Hub não conseguiu lê-la,
                    por exemplo assinatura em papel digitalizada. Fica registrado no seu nome.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="cv-motivo">Motivo</Label>
          <Textarea
            id="cv-motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Obrigatório. Explique o que foi conferido e corrigido."
          />
        </div>

        {resultado ? (
          resultado.situacao === "ATIVO" ? (
            <Alert className="border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              <AlertDescription>
                Contrato ativo. O repasse deste parceiro foi liberado.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertDescription>
                {resultado.motivo ?? `Situação: ${resultado.situacao ?? "—"}.`}
              </AlertDescription>
            </Alert>
          )
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            {resultado ? "Fechar" : "Cancelar"}
          </Button>
          <Button onClick={confirmar} disabled={!motivo.trim() || salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
