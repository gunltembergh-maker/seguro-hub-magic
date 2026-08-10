import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileSearch,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { auditarApoliceAnp } from "@/lib/garantia/analise-limite.functions";
import type { AuditResult, RiskLabel } from "@/lib/garantia/anp-audit";

const NAVY = "#14405C";
const CYAN = "#00BAF2";

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
  CRITICO: "bg-red-100 text-red-800 border-red-200",
  ALTO: "bg-orange-100 text-orange-800 border-orange-200",
  REVISAR: "bg-amber-100 text-amber-900 border-amber-200",
  "AJUSTE REDACIONAL": "bg-sky-100 text-sky-800 border-sky-200",
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200",
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

function AnaliseLimitePage() {
  const [file, setFile] = useState<File | null>(null);
  const [usarIA, setUsarIA] = useState(true);
  const [result, setResult] = useState<AuditResult | null>(null);
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

  const total = result?.clauses.length ?? 0;
  const criticos = result?.clauses.filter((c) => c.risk === "CRITICO" || c.risk === "ALTO").length ?? 0;
  const redacional =
    result?.clauses.filter((c) => c.risk === "AJUSTE REDACIONAL" || c.risk === "OK").length ?? 0;

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-10" style={{ background: NAVY }}>
      <div className="mx-auto max-w-7xl">
        <Link
          to="/garantia"
          className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Garantia
        </Link>

        <div className="mt-4 flex items-start gap-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-xl text-white shadow-lg"
            style={{ background: CYAN }}
          >
            <FileSearch className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/15">
              Garantia
            </Badge>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Análise de Limite
            </h1>
            <p className="mt-1 max-w-3xl text-white/70">
              Envie a minuta ou apólice em PDF. O sistema compara o texto com os modelos padrão ANP
              (Standard e Alternativo), calcula a aderência a cada um e aponta divergências
              jurídicas, redacionais e ortográficas.
            </p>
          </div>
        </div>

        {/* Upload */}
        <Card className="mt-8 border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-lg" style={{ color: NAVY }}>
              Minuta / Apólice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#14405C]/30 bg-[#F8FAFC] p-8 text-center transition-colors hover:border-[#00BAF2]"
            >
              <Upload className="h-6 w-6 text-[#14405C]" />
              <span className="text-sm font-medium text-[#0E2E43]">
                {file ? file.name : "Clique ou arraste o PDF da apólice"}
              </span>
              <span className="text-xs text-[#4B6D88]">Somente arquivos PDF digitais (não escaneados)</span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Switch id="usar-ia" checked={usarIA} onCheckedChange={setUsarIA} />
                <Label htmlFor="usar-ia" className="flex items-center gap-1.5 text-sm text-[#0E2E43]">
                  <Sparkles className="h-3.5 w-3.5 text-[#00BAF2]" /> Análise jurídica com IA
                </Label>
              </div>

              <div className="flex items-center gap-2">
                {result && (
                  <Button variant="outline" onClick={() => baixarCsv(result)}>
                    <Download className="mr-2 h-4 w-4" /> Exportar CSV
                  </Button>
                )}
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={!file || mutation.isPending}
                  style={{ background: CYAN }}
                  className="text-white hover:brightness-105"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Auditando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Executar auditoria
                    </>
                  )}
                </Button>
              </div>
            </div>

            {mutation.isPending && (
              <div className="space-y-1">
                <Progress value={65} className="h-1.5" />
                <p className="text-xs text-[#4B6D88]">
                  Lendo o PDF, alinhando cláusulas e comparando com os modelos ANP...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Resumo */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Modelo predominante", value: result.selected_model.label },
                { label: "Aderência escolhida", value: `${result.selected_model.similarity.toFixed(1)}%` },
                { label: "Crítico / Alto", value: String(criticos) },
                { label: "Redacional / OK", value: String(redacional) },
              ].map((kpi) => (
                <Card key={kpi.label} className="border-gray-200 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-[#4B6D88]">{kpi.label}</p>
                    <p className="mt-1 font-display text-xl font-semibold" style={{ color: NAVY }}>
                      {kpi.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Card className="border-gray-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-[#4B6D88]">Cláusulas</p>
                  <p className="mt-1 font-display text-xl font-semibold" style={{ color: NAVY }}>
                    {total}
                  </p>
                </CardContent>
              </Card>
              {result.candidate_models.map((m) => (
                <Card key={m.key} className="border-gray-200 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-[#4B6D88]">
                      Erro vs {m.label.replace("Modelo ", "").replace(" ANP", "")}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold" style={{ color: NAVY }}>
                      {m.difference_percentage.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="mt-3 text-sm text-white/70">
              {result.match_summary}
              {result.ai_used ? " · Análise semântica assistida por IA." : " · Análise semântica local."}
            </p>

            {/* Resultado */}
            <Card className="mt-6 border-gray-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-lg" style={{ color: NAVY }}>
                  Resultado da auditoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {total === 0 ? (
                  <p className="text-sm text-gray-600">Nenhuma cláusula foi encontrada no documento.</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {result.clauses.map((c) => (
                      <AccordionItem key={c.clause} value={c.clause}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full flex-wrap items-center gap-3 pr-3 text-left">
                            <span className="font-medium" style={{ color: NAVY }}>
                              {clauseLabel(c.clause)}
                            </span>
                            <Badge variant="outline" className={RISK_STYLES[c.risk]}>
                              {c.risk}
                            </Badge>
                            <span className="text-xs text-[#4B6D88]">
                              Similaridade {c.similarity.toFixed(1)}%
                            </span>
                            <div className="ml-auto hidden w-40 md:block">
                              <Progress value={c.similarity} className="h-1.5" />
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          <div className="grid gap-2 text-sm md:grid-cols-2">
                            <p className="text-gray-700">
                              <strong style={{ color: NAVY }}>Diagnóstico:</strong> {c.diagnostico}
                            </p>
                            <p className="text-gray-700">
                              <strong style={{ color: NAVY }}>Ajuste recomendado:</strong>{" "}
                              {c.acao_recomendada}
                            </p>
                          </div>
                          <p className="text-xs text-[#4B6D88]">
                            Semântica: {c.semantic_analysis} · Modelo de referência: {c.reference_model}
                          </p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase text-[#4B6D88]">Modelo</p>
                              <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-[#F8FAFC] p-3 text-xs text-gray-700">
                                {c.model_text || "—"}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase text-[#4B6D88]">Apólice</p>
                              <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-[#F8FAFC] p-3 text-xs text-gray-700">
                                {c.policy_text || "—"}
                              </div>
                            </div>
                          </div>
                          {c.diff && (
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase text-[#4B6D88]">Diferenças</p>
                              <pre className="max-h-40 overflow-auto rounded-md bg-[#0E2E43] p-3 text-xs text-[#DDECF3]">
                                {c.diff.slice(0, 1200)}
                              </pre>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
