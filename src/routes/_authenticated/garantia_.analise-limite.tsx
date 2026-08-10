import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSearch,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import { auditarApoliceAnp } from "@/lib/garantia/analise-limite.functions";
import { ANP_REFERENCE_MODELS } from "@/lib/garantia/anp-reference-models";
import type { AuditResult, RiskLabel } from "@/lib/garantia/anp-audit";

const BG = "radial-gradient(circle at top right, #163654 0%, #0f1722 55%)";
const SURFACE = "linear-gradient(180deg, #131f2e 0%, #1a2b3d 100%)";
const BORDER = "#27445f";
const PRIMARY = "#00b8d9";
const TEXT = "#e9f2fb";
const MUTED = "#a4bdd4";

export const Route = createFileRoute("/_authenticated/garantia_/analise-limite")({
  component: AnaliseLimitePage,
  head: () => ({
    meta: [
      { title: "Análise de Limite ANP | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Auditoria jurídica de minutas e apólices ANP: compara o documento com os modelos Standard e Alternativo e aponta divergências e riscos.",
      },
      { property: "og:title", content: "Análise de Limite ANP | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content:
          "Compare apólices ANP com os modelos oficiais, veja aderência por cláusula e riscos jurídicos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const RISK_STYLES: Record<RiskLabel, string> = {
  CRITICO: "border-red-400/40 bg-red-500/15 text-red-200",
  ALTO: "border-orange-400/40 bg-orange-500/15 text-orange-200",
  REVISAR: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  "AJUSTE REDACIONAL": "border-sky-400/40 bg-sky-500/15 text-sky-200",
  OK: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
};

function clauseLabel(key: string) {
  if (key === "preamble") return "Preâmbulo";
  return `Cláusula ${key.replace("clause_", "")}`;
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function baixarCsv(result: AuditResult) {
  const header = [
    "clausula",
    "similaridade",
    "semantica",
    "risco",
    "diagnostico",
    "acao_recomendada",
    "modelo_referencia",
  ];
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = result.clauses.map((c) =>
    [
      clauseLabel(c.clause),
      c.similarity.toFixed(2),
      c.semantic_analysis,
      c.risk,
      c.diagnostico,
      c.acao_recomendada,
      c.reference_model,
    ]
      .map(escape)
      .join(";"),
  );
  const blob = new Blob(["\uFEFF" + [header.join(";"), ...linhas].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analise-limite-${result.policy_name.replace(/\.pdf$/i, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Painel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Painel>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold" style={{ color: TEXT }}>
        {value}
      </p>
    </Painel>
  );
}

function AnaliseLimitePage() {
  const [file, setFile] = useState<File | null>(null);
  const [usarIA, setUsarIA] = useState(true);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const auditar = useServerFn(auditarApoliceAnp);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um PDF da minuta ou apólice.");
      const fileBase64 = toBase64(await file.arrayBuffer());
      return auditar({ data: { fileName: file.name, fileBase64, usarIA } });
    },
    onSuccess: (data) => {
      setResult(data as AuditResult);
      toast.success("Auditoria concluída");
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao executar a auditoria"),
  });

  useEffect(() => {
    if (!mutation.isPending) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mutation.isPending]);

  const cronometro = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  const total = result?.clauses.length ?? 0;
  const criticos =
    result?.clauses.filter((c) => c.risk === "CRITICO" || c.risk === "ALTO").length ?? 0;
  const redacional =
    result?.clauses.filter((c) => c.risk === "AJUSTE REDACIONAL" || c.risk === "OK").length ?? 0;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
      <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[300px_1fr]">
        {/* Menu lateral do módulo */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <Painel className="space-y-4">
            <img src={logoBranca.url} alt="Lavoro Seguros" className="h-8 w-auto object-contain" />
            <div>
              <h2 className="font-display text-lg font-semibold" style={{ color: TEXT }}>
                Lavoro ANP Audit
              </h2>
              <p className="text-xs" style={{ color: MUTED }}>
                Auditoria jurídica ANP com IA
              </p>
            </div>

            <div className="h-px" style={{ background: BORDER }} />

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Status
              </p>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: MUTED }}>Motor de IA</span>
                <span className="inline-flex items-center gap-1" style={{ color: PRIMARY }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {usarIA ? "Ativo" : "Local"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: MUTED }}>Modelo</span>
                <span style={{ color: TEXT }}>gemini-2.5-flash</span>
              </div>
            </div>

            <div className="h-px" style={{ background: BORDER }} />

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Modelos ANP fixos
              </p>
              {ANP_REFERENCE_MODELS.map((m) => (
                <div key={m.key} className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
                  <FileText className="h-3.5 w-3.5" style={{ color: PRIMARY }} />
                  {m.label}
                </div>
              ))}
            </div>

            <div className="h-px" style={{ background: BORDER }} />

            {/* Upload */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Upload minuta / apólice
              </p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped?.type === "application/pdf") setFile(dropped);
                }}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors"
                style={{ borderColor: BORDER, background: "rgba(19,31,46,0.8)" }}
              >
                <Upload className="h-5 w-5" style={{ color: PRIMARY }} />
                <span className="text-xs font-medium" style={{ color: TEXT }}>
                  {file ? file.name : "Clique ou arraste o PDF"}
                </span>
                <span className="text-[11px]" style={{ color: MUTED }}>
                  PDF digital (não escaneado)
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="usar-ia" checked={usarIA} onCheckedChange={setUsarIA} />
                <Label htmlFor="usar-ia" className="flex items-center gap-1.5 text-xs" style={{ color: TEXT }}>
                  <Sparkles className="h-3.5 w-3.5" style={{ color: PRIMARY }} /> Análise jurídica com IA
                </Label>
              </div>

              <Button
                onClick={() => mutation.mutate()}
                disabled={!file || mutation.isPending}
                className="w-full font-semibold text-white hover:brightness-105"
                style={{ background: `linear-gradient(180deg, ${PRIMARY} 0%, #009ab6 100%)` }}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Auditando... {cronometro}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Executar auditoria
                  </>
                )}
              </Button>

              {result && (
                <Button
                  variant="outline"
                  onClick={() => baixarCsv(result)}
                  className="w-full border-white/20 bg-transparent hover:bg-white/10"
                  style={{ color: TEXT }}
                >
                  <Download className="mr-2 h-4 w-4" /> Exportar relatório
                </Button>
              )}
            </div>

            <div className="h-px" style={{ background: BORDER }} />

            <Link
              to="/garantia"
              className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-white"
              style={{ color: MUTED }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Garantia
            </Link>
          </Painel>
        </aside>

        {/* Conteúdo */}
        <main className="space-y-6">
          <div className="flex items-start gap-4">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-lg"
              style={{ background: PRIMARY }}
            >
              <FileSearch className="h-6 w-6" />
            </div>
            <div>
              <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
                Garantia
              </Badge>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight" style={{ color: TEXT }}>
                Análise de Limite — Lavoro ANP Audit
              </h1>
              <p className="mt-1 max-w-3xl text-sm" style={{ color: MUTED }}>
                Envie a minuta ou apólice em PDF. O sistema compara automaticamente o texto com os
                modelos padrão ANP Standard e Alternativo, calcula a aderência aos dois e aponta
                divergências jurídicas, redacionais e ortográficas.
              </p>
            </div>
          </div>

          {mutation.isPending && (
            <Painel>
              <Progress value={70} className="h-1.5" />
              <p className="mt-2 text-xs" style={{ color: MUTED }}>
                Lendo o PDF, alinhando cláusulas e comparando com os modelos ANP... ({cronometro})
              </p>
            </Painel>
          )}

          {!result && !mutation.isPending && (
            <Painel>
              <p className="text-sm" style={{ color: MUTED }}>
                Envie a minuta ou apólice no menu lateral para iniciar.
              </p>
            </Painel>
          )}

          {result && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Modelo predominante" value={result.selected_model.label} />
                <Metric
                  label="Aderência escolhida"
                  value={`${result.selected_model.similarity.toFixed(1)}%`}
                />
                <Metric label="Crítico / Alto" value={String(criticos)} />
                <Metric label="Redacional / OK" value={String(redacional)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Cláusulas" value={String(total)} />
                {result.candidate_models.map((m) => (
                  <Metric
                    key={m.key}
                    label={`Erro vs ${m.label.replace("Modelo ", "").replace(" ANP", "")}`}
                    value={`${m.difference_percentage.toFixed(1)}%`}
                  />
                ))}
              </div>

              <p className="text-sm" style={{ color: MUTED }}>
                {result.match_summary}
                {result.ai_used ? " · Análise semântica assistida por IA." : " · Análise semântica local."}
              </p>

              <Painel className="!p-0">
                <div className="border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <h2 className="font-display text-lg font-semibold" style={{ color: TEXT }}>
                    Resultado da auditoria
                  </h2>
                </div>
                <div className="p-4">
                  {total === 0 ? (
                    <p className="text-sm" style={{ color: MUTED }}>
                      Nenhuma cláusula foi encontrada no documento.
                    </p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {result.clauses.map((c) => (
                        <AccordionItem
                          key={c.clause}
                          value={c.clause}
                          className="border-b"
                          style={{ borderColor: BORDER }}
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex w-full flex-wrap items-center gap-3 pr-3 text-left">
                              <span className="font-medium" style={{ color: TEXT }}>
                                {clauseLabel(c.clause)}
                              </span>
                              <Badge variant="outline" className={RISK_STYLES[c.risk]}>
                                {c.risk}
                              </Badge>
                              <span className="text-xs" style={{ color: MUTED }}>
                                Similaridade {c.similarity.toFixed(1)}%
                              </span>
                              <div className="ml-auto hidden w-40 md:block">
                                <Progress value={c.similarity} className="h-1.5" />
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <div className="grid gap-2 text-sm md:grid-cols-2">
                              <p style={{ color: MUTED }}>
                                <strong style={{ color: TEXT }}>Diagnóstico:</strong> {c.diagnostico}
                              </p>
                              <p style={{ color: MUTED }}>
                                <strong style={{ color: TEXT }}>Ajuste recomendado:</strong>{" "}
                                {c.acao_recomendada}
                              </p>
                            </div>
                            <p className="text-xs" style={{ color: MUTED }}>
                              Semântica: {c.semantic_analysis} · Modelo de referência: {c.reference_model}
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase" style={{ color: MUTED }}>
                                  Modelo
                                </p>
                                <div
                                  className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-3 text-xs"
                                  style={{ background: "rgba(15,23,34,0.7)", border: `1px solid ${BORDER}`, color: TEXT }}
                                >
                                  {c.model_text || "—"}
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase" style={{ color: MUTED }}>
                                  Apólice
                                </p>
                                <div
                                  className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-3 text-xs"
                                  style={{ background: "rgba(15,23,34,0.7)", border: `1px solid ${BORDER}`, color: TEXT }}
                                >
                                  {c.policy_text || "—"}
                                </div>
                              </div>
                            </div>
                            {c.diff && (
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase" style={{ color: MUTED }}>
                                  Diferenças
                                </p>
                                <pre
                                  className="max-h-40 overflow-auto rounded-md p-3 text-xs"
                                  style={{ background: "#0b1621", border: `1px solid ${BORDER}`, color: "#DDECF3" }}
                                >
                                  {c.diff.slice(0, 1200)}
                                </pre>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              </Painel>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
