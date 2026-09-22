// Envio do contrato de parceria (Canal Parceiros).
//
// Três camadas, nesta ordem:
//   1. leitura da camada de texto do PDF, feita pelo servidor;
//   2. OCR das páginas no navegador, quando a camada de texto vem corrompida;
//   3. preenchimento manual, quando nem o OCR resolve.
//
// A pessoa declara se o contrato está assinado; quem constata a assinatura é
// sempre o servidor, lendo o arquivo. O componente nunca decide situação:
// quem decide é a função do banco.
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, ScanLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OCR_MAX_PAGINAS, PdfLongoDemais, type ProgressoOcr } from "@/lib/canal-parceiro/ocr-pdf";

const BUCKET = "canal-parceiros-contratos";
const TAMANHO_MAXIMO = 20 * 1024 * 1024; // 20 MB

interface Extracao {
  nomes?: string[] | null;
  cnpj?: string | null;
  pct_beneficios?: number | null;
  pct_garantia?: number | null;
  pct_demais?: number | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  assinado?: boolean | null;
  assinado_em?: string | null;
  signatarios?: number | null;
  minimo?: number | null;
  tipo?: string | null;
}

interface Resultado {
  situacao?: string | null;
  motivo?: string | null;
  [k: string]: unknown;
}

interface DadosManuais {
  razao_social?: string;
  cnpj?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  pct_beneficios?: number;
  pct_garantia?: number;
  pct_demais?: number;
  minimo?: number;
}

interface Resposta {
  resultado?: Resultado | null;
  extracao?: Extracao | null;
  hash?: string | null;
  paginas?: number | null;
  origem_leitura?: string | null;
  precisa_ocr?: boolean;
  motivo?: string | null;
}

export interface EnviarContratoParceiroProps {
  canalId?: string | null;
  canalNome?: string;
  aberto: boolean;
  onFechar: () => void;
  onSucesso?: () => void;
}

const pct = (v?: number | null) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function PctDemais({
  pctDemais,
  pctGarantia,
}: {
  pctDemais?: number | null;
  pctGarantia?: number | null;
}) {
  if (pctDemais != null) return <>{pct(pctDemais)}</>;
  if (pctGarantia != null) {
    return (
      <>
        {pct(pctGarantia)}{" "}
        <span className="text-muted-foreground">(herdado de Garantia)</span>
      </>
    );
  }
  return <>—</>;
}

const dia = (v?: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

type Passo = "pergunta" | "sem-assinatura" | "arquivo" | "ocr" | "manual" | "resultado";

export default function EnviarContratoParceiro({
  canalId,
  canalNome,
  aberto,
  onFechar,
  onSucesso,
}: EnviarContratoParceiroProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState<Passo>("pergunta");
  const [declarado, setDeclarado] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [caminhoArquivo, setCaminhoArquivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [progresso, setProgresso] = useState<ProgressoOcr | null>(null);

  // cadastro manual do parceiro (contrato ainda não assinado)
  const [semAss, setSemAss] = useState({ nome: "", razao_social: "", cnpj: "", motivo: "" });
  // dados do contrato digitados à mão (última camada)
  const [manual, setManual] = useState({
    razao_social: "",
    cnpj: "",
    vigencia_inicio: "",
    vigencia_fim: "",
    pct_beneficios: "",
    pct_garantia: "",
    pct_demais: "",
    minimo: "",
  });

  function limpar() {
    setPasso("pergunta");
    setDeclarado(false);
    setArquivo(null);
    setCaminhoArquivo(null);
    setErro(null);
    setResposta(null);
    setEnviando(false);
    setProgresso(null);
    setSemAss({ nome: "", razao_social: "", cnpj: "", motivo: "" });
    setManual({
      razao_social: "",
      cnpj: "",
      vigencia_inicio: "",
      vigencia_fim: "",
      pct_beneficios: "",
      pct_garantia: "",
      pct_demais: "",
      minimo: "",
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function fechar() {
    limpar();
    onFechar();
  }

  function escolher(f: File | null) {
    setErro(null);
    setResposta(null);
    if (!f) return setArquivo(null);
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setArquivo(null);
      setErro("Envie o contrato em PDF.");
      return;
    }
    if (f.size > TAMANHO_MAXIMO) {
      setArquivo(null);
      setErro("O arquivo passa de 20 MB.");
      return;
    }
    setArquivo(f);
  }

  /** Chama a rota do servidor. `extra` leva `texto_ocr` ou `dados_manuais`. */
  async function chamarRota(
    path: string,
    nomeArquivo: string,
    extra: { texto_ocr?: string; dados_manuais?: DadosManuais } = {},
  ): Promise<Resposta> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessão expirada. Entre de novo.");

    const r = await fetch("/api/canal-parceiro-validar-contrato", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        path,
        arquivo_nome: nomeArquivo,
        canal_id: canalId ?? null,
        declarado_assinado: declarado,
        ...extra,
      }),
    });
    const corpo = (await r.json().catch(() => null)) as (Resposta & { erro?: string }) | null;
    if (!r.ok) throw new Error(corpo?.erro ?? `Falha ao ler o contrato (HTTP ${r.status}).`);
    return corpo ?? {};
  }

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setResposta(null);
    try {
      const path = `${crypto.randomUUID()}/${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(path, arquivo, { upsert: false, contentType: "application/pdf" });
      if (erroUpload) throw new Error(erroUpload.message);
      setCaminhoArquivo(path);

      const corpo = await chamarRota(path, arquivo.name);
      if (corpo.precisa_ocr) {
        setEnviando(false);
        await rodarOcr(path, arquivo);
        return;
      }
      setResposta(corpo);
      setPasso("resultado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  /** OCR no navegador e reenvio para a mesma rota. */
  async function rodarOcr(path: string, f: File) {
    setPasso("ocr");
    setProgresso(null);
    setErro(null);
    try {
      const { ocrPdf } = await import("@/lib/canal-parceiro/ocr-pdf");
      const texto = await ocrPdf(f, setProgresso);
      const corpo = await chamarRota(path, f.name, { texto_ocr: texto });
      setResposta(corpo);
      setPasso("resultado");
    } catch (e) {
      if (e instanceof PdfLongoDemais) {
        setErro(
          `Este PDF tem ${e.paginas} páginas, acima do limite de ${OCR_MAX_PAGINAS} para o reconhecimento por imagem. Informe os dados à mão.`,
        );
      } else {
        setErro(e instanceof Error ? e.message : String(e));
      }
      setPasso("manual");
    } finally {
      setProgresso(null);
    }
  }

  const numero = (v: string): number | undefined => {
    const n = Number(v.replace("%", "").replace(",", ".").trim());
    return Number.isFinite(n) && v.trim() !== "" ? n : undefined;
  };
  const percentual = (v: string): number | undefined => {
    const n = numero(v);
    return n == null ? undefined : n > 1 ? Number((n / 100).toFixed(4)) : n;
  };

  async function enviarManual() {
    if (!caminhoArquivo || !arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const corpo = await chamarRota(caminhoArquivo, arquivo.name, {
        dados_manuais: {
          razao_social: manual.razao_social.trim() || undefined,
          cnpj: manual.cnpj.trim() || undefined,
          vigencia_inicio: manual.vigencia_inicio || undefined,
          vigencia_fim: manual.vigencia_fim || undefined,
          pct_beneficios: percentual(manual.pct_beneficios),
          pct_garantia: percentual(manual.pct_garantia),
          pct_demais: percentual(manual.pct_demais),
          minimo: numero(manual.minimo),
        },
      });
      setResposta(corpo);
      setPasso("resultado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  async function cadastrarSemAssinatura() {
    if (!semAss.nome.trim() || !semAss.motivo.trim() || enviando) return;
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("rpc_canal_parceiro_cadastrar_manual" as never, {
        p_canal_id: canalId ?? null,
        p_nome: semAss.nome.trim(),
        p_razao_social: semAss.razao_social.trim() || null,
        p_cnpj: semAss.cnpj.trim() || null,
        p_contato_nome: null,
        p_contato_email: null,
        p_email_financeiro: null,
        p_motivo: semAss.motivo.trim(),
      } as never);
      if (error) throw error;
      toast.success("Parceiro registrado. O repasse segue travado até o contrato assinado.");
      onSucesso?.();
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  const situacao = resposta?.resultado?.situacao ?? null;
  const motivo = resposta?.resultado?.motivo ?? null;
  const e = resposta?.extracao ?? null;
  const origem = resposta?.origem_leitura ?? null;
  const faltaDado =
    !e?.vigencia_fim || (e.pct_beneficios == null && e.pct_garantia == null && e.pct_demais == null);
  const podeTentarManual =
    passo === "resultado" &&
    (situacao === "RECUSADO" || situacao === "EM_VALIDACAO") &&
    faltaDado &&
    !!caminhoArquivo;

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar contrato de parceria</DialogTitle>
          <DialogDescription>
            {canalNome
              ? `Contrato de ${canalNome}. O sistema lê o PDF e confere assinatura, vigência, identidade e percentuais.`
              : "O sistema lê o PDF e confere assinatura, vigência, identidade e percentuais."}
          </DialogDescription>
        </DialogHeader>

        {/* 1 — a pergunta */}
        {passo === "pergunta" && (
          <div className="space-y-3">
            <p className="font-medium">Este contrato já está assinado?</p>
            <button
              type="button"
              onClick={() => { setDeclarado(true); setPasso("arquivo"); }}
              className="w-full rounded-lg border border-emerald-600/40 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
            >
              <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                Sim, está assinado
              </div>
              <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
                Envie o PDF assinado. O Hub confere a assinatura no próprio arquivo.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setDeclarado(false); setPasso("sem-assinatura"); }}
              className="w-full rounded-lg border p-4 text-left transition hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" />
                Não, ainda não foi assinado
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Registra o parceiro agora, sem liberar repasse.
              </p>
            </button>
          </div>
        )}

        {/* 1b — sem assinatura: cadastro manual do parceiro */}
        {passo === "sem-assinatura" && (
          <div className="space-y-3">
            <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sem assinatura não libera repasse</AlertTitle>
              <AlertDescription>
                Contrato sem assinatura não libera repasse. Registre o parceiro agora e envie o
                contrato assinado quando ele sair.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sa-nome">Nome do parceiro</Label>
                <Input
                  id="sa-nome"
                  value={semAss.nome}
                  onChange={(ev) => setSemAss((s) => ({ ...s, nome: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-razao">Razão social</Label>
                <Input
                  id="sa-razao"
                  value={semAss.razao_social}
                  onChange={(ev) => setSemAss((s) => ({ ...s, razao_social: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sa-cnpj">CNPJ</Label>
                <Input
                  id="sa-cnpj"
                  value={semAss.cnpj}
                  onChange={(ev) => setSemAss((s) => ({ ...s, cnpj: ev.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sa-motivo">Motivo do cadastro sem contrato</Label>
              <Textarea
                id="sa-motivo"
                rows={3}
                value={semAss.motivo}
                onChange={(ev) => setSemAss((s) => ({ ...s, motivo: ev.target.value }))}
                placeholder="Obrigatório. Explique por que o parceiro está sendo registrado antes da assinatura."
              />
            </div>
          </div>
        )}

        {/* 2 — arquivo */}
        {passo === "arquivo" && (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              disabled={enviando}
              onChange={(ev) => escolher(ev.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">Somente PDF, até 20 MB.</p>

            {arquivo && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{arquivo.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  {(arquivo.size / 1024 / 1024).toFixed(1)} MB
                </Badge>
              </div>
            )}

            {enviando && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lendo o contrato
                </div>
                <Progress value={undefined} className="h-1.5" />
              </div>
            )}

            {erro && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Não deu certo</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 3 — OCR */}
        {passo === "ocr" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <ScanLine className="h-4 w-4 text-muted-foreground" />
              A camada de texto deste PDF está corrompida. Reconhecendo as páginas por imagem, isso
              leva alguns segundos.
            </div>
            <Progress
              value={progresso ? (progresso.pagina / progresso.paginas) * 100 : undefined}
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground">
              {progresso
                ? `Página ${progresso.pagina} de ${progresso.paginas}`
                : "Preparando o reconhecimento"}
            </p>
          </div>
        )}

        {/* 4 — manual */}
        {passo === "manual" && (
          <div className="space-y-3">
            <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Não consegui ler este documento</AlertTitle>
              <AlertDescription>
                O arquivo está num formato que não permite leitura automática. Informe os dados do
                contrato abaixo. O cadastro fica pendente e só libera repasse depois que um
                administrador confirmar.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mn-ini">Início da vigência</Label>
                <Input
                  id="mn-ini"
                  type="date"
                  value={manual.vigencia_inicio}
                  onChange={(ev) => setManual((m) => ({ ...m, vigencia_inicio: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-fim">Fim da vigência</Label>
                <Input
                  id="mn-fim"
                  type="date"
                  value={manual.vigencia_fim}
                  onChange={(ev) => setManual((m) => ({ ...m, vigencia_fim: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-ben">Benefícios (%)</Label>
                <Input
                  id="mn-ben"
                  inputMode="decimal"
                  placeholder="30"
                  value={manual.pct_beneficios}
                  onChange={(ev) => setManual((m) => ({ ...m, pct_beneficios: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-gar">Garantia (%)</Label>
                <Input
                  id="mn-gar"
                  inputMode="decimal"
                  placeholder="30"
                  value={manual.pct_garantia}
                  onChange={(ev) => setManual((m) => ({ ...m, pct_garantia: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-dem">Demais ramos (%)</Label>
                <Input
                  id="mn-dem"
                  inputMode="decimal"
                  placeholder="em branco segue Garantia"
                  value={manual.pct_demais}
                  onChange={(ev) => setManual((m) => ({ ...m, pct_demais: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-min">Mínimo por ciclo (R$)</Label>
                <Input
                  id="mn-min"
                  inputMode="decimal"
                  placeholder="100"
                  value={manual.minimo}
                  onChange={(ev) => setManual((m) => ({ ...m, minimo: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-cnpj">CNPJ</Label>
                <Input
                  id="mn-cnpj"
                  value={manual.cnpj}
                  onChange={(ev) => setManual((m) => ({ ...m, cnpj: ev.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mn-razao">Razão social</Label>
                <Input
                  id="mn-razao"
                  value={manual.razao_social}
                  onChange={(ev) => setManual((m) => ({ ...m, razao_social: ev.target.value }))}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Os percentuais informados serão conferidos contra o contrato anexado por um
              administrador.
            </p>

            {erro && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Não deu certo</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 5 — resultado */}
        {passo === "resultado" && resposta && (
          <div className="space-y-3">
            {situacao === "ATIVO" && (
              <Alert className="border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Contrato validado, repasse liberado</AlertTitle>
              <AlertDescription>
                Vigência de {dia(e?.vigencia_inicio)} a {dia(e?.vigencia_fim)}. Benefícios{" "}
                {pct(e?.pct_beneficios)}, Garantia {pct(e?.pct_garantia)}, Demais ramos{" "}
                <PctDemais pctDemais={e?.pct_demais} pctGarantia={e?.pct_garantia} />.
              </AlertDescription>
            </Alert>
          )}

            {situacao === "VINCULO_A_CONFIRMAR" && (
              <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Vínculo a confirmar</AlertTitle>
                <AlertDescription>
                  {motivo ? `${motivo} ` : ""}
                  Um administrador precisa confirmar a qual parceiro este contrato pertence.
                </AlertDescription>
              </Alert>
            )}

            {(situacao === "RECUSADO" || situacao === "VENCIDO" || situacao === "EM_VALIDACAO") && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>
                  {situacao === "VENCIDO"
                    ? "Contrato vencido"
                    : situacao === "EM_VALIDACAO"
                      ? "Contrato em validação"
                      : "Contrato recusado"}
                </AlertTitle>
                <AlertDescription>{motivo ?? "Sem detalhe informado."}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">O que foi lido no documento</p>
              <p>
                Leitura:{" "}
                {origem === "OCR"
                  ? "reconhecimento por imagem"
                  : origem === "MANUAL"
                    ? "informada à mão"
                    : "camada de texto do PDF"}
              </p>
              <p>Nomes: {e?.nomes?.length ? e.nomes.join(" · ") : "—"}</p>
              <p>CNPJ: {e?.cnpj ?? "—"}</p>
              <p>Vigência: {dia(e?.vigencia_inicio)} a {dia(e?.vigencia_fim)}</p>
              <p>
                Percentuais: Benefícios {pct(e?.pct_beneficios)}, Garantia {pct(e?.pct_garantia)},
                Demais ramos {pct(e?.pct_demais)}
              </p>
              <p>
                Assinatura: {e?.assinado ? "encontrada" : "não encontrada"}
                {e?.assinado_em ? ` em ${new Date(e.assinado_em).toLocaleString("pt-BR")}` : ""}
              </p>
              <p>Signatários: {e?.signatarios ?? "—"}</p>
              {resposta.paginas != null && <p>Páginas: {resposta.paginas}</p>}
            </div>

            {podeTentarManual && (
              <Button variant="outline" className="w-full" onClick={() => { setErro(null); setPasso("manual"); }}>
                Informar os dados à mão
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {passo === "pergunta" && (
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
          )}

          {passo === "sem-assinatura" && (
            <>
              <Button variant="outline" onClick={() => setPasso("pergunta")} disabled={enviando}>
                Voltar
              </Button>
              <Button
                onClick={cadastrarSemAssinatura}
                disabled={!semAss.nome.trim() || !semAss.motivo.trim() || enviando}
              >
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar parceiro
              </Button>
            </>
          )}

          {passo === "arquivo" && (
            <>
              <Button variant="outline" onClick={() => setPasso("pergunta")} disabled={enviando}>
                Voltar
              </Button>
              <Button onClick={enviar} disabled={!arquivo || enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Lendo o contrato
                  </>
                ) : (
                  "Enviar contrato"
                )}
              </Button>
            </>
          )}

          {passo === "manual" && (
            <>
              <Button variant="outline" onClick={fechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button onClick={enviarManual} disabled={enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar dados do contrato
              </Button>
            </>
          )}

          {passo === "resultado" && (
            <Button
              onClick={() => {
                if (situacao === "ATIVO") onSucesso?.();
                fechar();
              }}
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
