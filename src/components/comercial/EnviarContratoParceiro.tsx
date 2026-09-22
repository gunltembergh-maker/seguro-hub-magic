// Envio do contrato de parceria (Canal Parceiros).
//
// Sobe o PDF para o bucket privado `canal-parceiros-contratos` e chama a
// server route autenticada /api/canal-parceiro-validar-contrato, que lê o
// documento e registra o resultado. O componente nunca decide situação:
// quem decide é a função do banco.
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Resposta {
  resultado?: Resultado | null;
  extracao?: Extracao | null;
  hash?: string | null;
  paginas?: number | null;
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

const dia = (v?: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default function EnviarContratoParceiro({
  canalId,
  canalNome,
  aberto,
  onFechar,
  onSucesso,
}: EnviarContratoParceiroProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  function limpar() {
    setArquivo(null);
    setErro(null);
    setResposta(null);
    setEnviando(false);
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
          arquivo_nome: arquivo.name,
          canal_id: canalId ?? null,
        }),
      });
      const corpo = (await r.json().catch(() => null)) as (Resposta & { erro?: string }) | null;
      if (!r.ok) throw new Error(corpo?.erro ?? `Falha ao ler o contrato (HTTP ${r.status}).`);
      setResposta(corpo ?? {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  const situacao = resposta?.resultado?.situacao ?? null;
  const motivo = resposta?.resultado?.motivo ?? null;
  const e = resposta?.extracao ?? null;

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar contrato de parceria</DialogTitle>
          <DialogDescription>
            {canalNome
              ? `Contrato de ${canalNome}. O sistema lê o PDF e confere assinatura, vigência, identidade e percentuais.`
              : "O sistema lê o PDF e confere assinatura, vigência, identidade e percentuais."}
          </DialogDescription>
        </DialogHeader>

        {!resposta && (
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

        {resposta && (
          <div className="space-y-3">
            {situacao === "ATIVO" && (
              <Alert className="border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Contrato validado, repasse liberado</AlertTitle>
                <AlertDescription>
                  Vigência de {dia(e?.vigencia_inicio)} a {dia(e?.vigencia_fim)}. Benefícios{" "}
                  {pct(e?.pct_beneficios)}, Garantia {pct(e?.pct_garantia)}, Demais ramos{" "}
                  {pct(e?.pct_demais)}.
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
          </div>
        )}

        <DialogFooter>
          {!resposta ? (
            <>
              <Button variant="outline" onClick={fechar} disabled={enviando}>
                Cancelar
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
          ) : (
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
