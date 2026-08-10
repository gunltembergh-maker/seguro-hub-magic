/**
 * Pipeline server-side da auditoria ANP: leitura do PDF, comparacao com os
 * modelos fixos e analise juridica (IA quando disponivel, heuristica local caso contrario).
 */
import { extractText, getDocumentProxy } from "unpdf";
import { ANP_REFERENCE_MODELS } from "./anp-reference-models";
import {
  analyzeClauseLocally,
  classifyRisk,
  cleanPdfText,
  compare,
  exactMatchAnalysis,
  extractClauses,
  extractReferenceSection,
  reconcileClauseSets,
  scoreComparisons,
  summarizeMatch,
  type AuditResult,
  type CandidateModel,
  type ClauseComparison,
  type RawComparison,
  type SemanticLabel,
} from "./anp-audit";

const AI_MAX_CLAUSES = 24;
const AI_CONCURRENCY = 4;

async function readPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return cleanPdfText(Array.isArray(text) ? text.join("\n") : String(text ?? ""));
}

function normalizeLabel(answer: string): SemanticLabel | "" {
  const normalized = (answer || "").trim().toUpperCase();
  if (normalized.includes("ALTERACAO") || normalized.includes("SEMANTICA"))
    return "ALTERACAO SEMANTICA";
  if (normalized.includes("REVISAO") || normalized.includes("JURIDICA")) return "REVISAO JURIDICA";
  if (normalized.includes("OK")) return "OK";
  return "";
}

function extractJson(raw: string): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function analyzeWithAI(
  apiKey: string,
  modelText: string,
  policyText: string,
): Promise<{
  semantic_analysis: SemanticLabel;
  diagnostico: string;
  acao_recomendada: string;
} | null> {
  const prompt =
    "Voce e um auditor juridico especialista em apolices ANP.\n" +
    "Compare os dois textos e retorne APENAS um JSON valido com esta estrutura:\n" +
    '{"classificacao":"OK|REVISAO JURIDICA|ALTERACAO SEMANTICA","diagnostico":"texto curto e objetivo","acao_recomendada":"passo objetivo para ajuste"}\n\n' +
    `MODELO ANP:\n${modelText.slice(0, 4000)}\n\nAPOLICE:\n${policyText.slice(0, 4000)}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error(`[anp-audit] AI gateway ${res.status}: ${await res.text()}`);
      return null;
    }
    const payload = await res.json();
    const parsed = extractJson(payload?.choices?.[0]?.message?.content ?? "");
    if (!parsed) return null;
    const label = normalizeLabel(String(parsed.classificacao ?? ""));
    if (!label) return null;
    return {
      semantic_analysis: label,
      diagnostico: String(parsed.diagnostico ?? "").slice(0, 400),
      acao_recomendada: String(parsed.acao_recomendada ?? "").slice(0, 400),
    };
  } catch (err: any) {
    console.error("[anp-audit] Falha na analise por IA:", err?.message ?? String(err));
    return null;
  }
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    }),
  );
}

interface ModelComparison extends CandidateModel {
  comparisons: RawComparison[];
}

function buildModelComparison(
  reference: (typeof ANP_REFERENCE_MODELS)[number],
  policyClauses: Record<string, string>,
): ModelComparison {
  const modelClauses = extractClauses(extractReferenceSection(cleanPdfText(reference.text)));
  const [aligned, alignedPolicy] = reconcileClauseSets(modelClauses, policyClauses);
  const comparisons = compare(aligned, alignedPolicy);
  const similarity = scoreComparisons(comparisons);

  return {
    key: reference.key,
    label: reference.label,
    similarity,
    difference_percentage: Math.round((100 - similarity) * 100) / 100,
    clause_count: comparisons.length,
    comparisons,
  };
}

export async function runAnpAudit(
  bytes: Uint8Array,
  fileName: string,
  usarIA: boolean,
): Promise<AuditResult> {
  const policyText = await readPdf(bytes);
  if (!policyText.trim()) {
    throw new Error("Nao foi possivel ler texto do PDF enviado. Verifique se o arquivo é digital (não escaneado).");
  }
  const policyClauses = extractClauses(policyText);

  const ranked = ANP_REFERENCE_MODELS.map((model) => buildModelComparison(model, policyClauses)).sort(
    (a, b) => b.similarity - a.similarity || a.label.localeCompare(b.label),
  );
  const selected = ranked[0];

  const clauses: ClauseComparison[] = selected.comparisons.map((item) => ({
    ...item,
    semantic_analysis: "OK",
    diagnostico: "",
    acao_recomendada: "",
    risk: "OK",
    reference_model: selected.label,
  }));

  // Clausulas identicas nao consomem analise adicional.
  const divergentes = clauses.filter((c) => !(c.similarity === 100 && !c.diff));
  for (const clause of clauses) {
    if (clause.similarity === 100 && !clause.diff) {
      Object.assign(clause, exactMatchAnalysis());
    } else {
      Object.assign(clause, analyzeClauseLocally(clause.model_text, clause.policy_text));
    }
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  let aiUsed = false;

  if (usarIA && apiKey && divergentes.length) {
    // Prioriza as clausulas mais divergentes dentro do orcamento de chamadas.
    const alvo = [...divergentes].sort((a, b) => a.similarity - b.similarity).slice(0, AI_MAX_CLAUSES);
    await runWithConcurrency(alvo, AI_CONCURRENCY, async (clause) => {
      if (!clause.model_text.trim() || !clause.policy_text.trim()) return;
      const result = await analyzeWithAI(apiKey, clause.model_text, clause.policy_text);
      if (result) {
        aiUsed = true;
        Object.assign(clause, result);
      }
    });
  }

  for (const clause of clauses) {
    clause.risk = classifyRisk(clause.diff, clause.semantic_analysis, clause.diagnostico);
  }

  const candidates: CandidateModel[] = ranked.map(({ comparisons: _c, ...rest }) => rest);

  return {
    policy_name: fileName,
    selected_model: {
      key: selected.key,
      label: selected.label,
      similarity: selected.similarity,
      difference_percentage: selected.difference_percentage,
      clause_count: selected.clause_count,
    },
    candidate_models: candidates,
    match_summary: summarizeMatch(selected.label, selected.similarity),
    clauses,
    ai_used: aiUsed,
  };
}
