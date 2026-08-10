/**
 * Porte TypeScript do motor de auditoria juridica ANP:
 * limpeza do PDF, segmentacao de clausulas, comparacao textual,
 * analise semantica local e classificacao de risco.
 */

export type SemanticLabel = "OK" | "REVISAO JURIDICA" | "ALTERACAO SEMANTICA";
export type RiskLabel = "OK" | "AJUSTE REDACIONAL" | "REVISAR" | "ALTO" | "CRITICO";

export interface ClauseComparison {
  clause: string;
  similarity: number;
  diff: string;
  model_text: string;
  policy_text: string;
  semantic_analysis: SemanticLabel;
  diagnostico: string;
  acao_recomendada: string;
  risk: RiskLabel;
  reference_model: string;
}

export interface CandidateModel {
  key: string;
  label: string;
  similarity: number;
  difference_percentage: number;
  clause_count: number;
}

export interface AuditResult {
  policy_name: string;
  selected_model: CandidateModel;
  candidate_models: CandidateModel[];
  match_summary: string;
  clauses: ClauseComparison[];
  ai_used: boolean;
}

/* ------------------------------------------------------------------ */
/* Limpeza do texto do PDF                                             */
/* ------------------------------------------------------------------ */

const HEADER_PATTERNS = [/^\d{1,2}\/\d{1,2}\/\d{2,4},/, /^\d+\s*\/\s*\d+$/];

export function cleanPdfText(text: string): string {
  const lines: string[] = [];
  for (const rawLine of (text || "").split(/\r?\n/)) {
    let cleaned = rawLine.trim();
    if (!cleaned) continue;
    cleaned = cleaned.replace(/https?:\/\/\S+/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    if (cleaned.includes("LegisWeb")) continue;
    if (HEADER_PATTERNS.some((p) => p.test(cleaned))) continue;
    lines.push(cleaned);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const ANNEX_MARKERS = ["ANEXO III", '"ANEXO III'];

export function extractReferenceSection(text: string): string {
  const source = (text || "").trim();
  if (!source) return "";
  const upper = source.toUpperCase();
  for (const marker of ANNEX_MARKERS) {
    const pos = upper.indexOf(marker.toUpperCase());
    if (pos >= 0) return source.slice(pos).trim();
  }
  return source;
}

/* ------------------------------------------------------------------ */
/* Segmentacao de clausulas                                            */
/* ------------------------------------------------------------------ */

const CLAUSE_MARKER_RE =
  /(?<!Art\. )(?<!art\. )(?<!\d)((?:\d+\.\d+(?:\.\d+){0,3}\.?|\d+\.))(?=\s+(?:\[|\(|"|[A-ZÀ-Ý]))/g;

const INLINE_CLAUSE_RE =
  /(?<!Art\. )(?<!art\. )(?<!\d)(\d+\.\d+(?:\.\d+){0,3})\.?(?=\s+(?:\[|\(|"|[A-ZÀ-Ý]))/g;

const LEADING_INLINE_NUMBER_RE = /^\s*\d+(?:\.\d+){0,4}\.?\s*(?:(?:-|:|;|,)\s*)?/;

const SECTION_HINTS = [
  "condicoes contratuais",
  "condicoes gerais",
  "clausulas contratuais",
  "clausulas gerais",
];

function naturalKey(name: string): (string | number)[] {
  return (name.match(/\d+|\D+/g) || []).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

function compareNatural(a: string, b: string): number {
  const ka = naturalKey(a);
  const kb = naturalKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i];
    const y = kb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else {
      const sx = String(x);
      const sy = String(y);
      if (sx !== sy) return sx < sy ? -1 : 1;
    }
  }
  return 0;
}

function normalizeForParsing(text: string): string {
  let source = (text || "").trim();
  if (!source) return "";
  source = source.replace(/\r/g, "\n").replace(/[ \t]+/g, " ");
  source = source.replace(INLINE_CLAUSE_RE, (m) => "\n" + m);
  return source.replace(/\n{3,}/g, "\n\n");
}

function stripLeadingInlineNumber(body: string, clauseNumber: string): string {
  const cleaned = (body || "").trim();
  if (!cleaned) return cleaned;
  const match = LEADING_INLINE_NUMBER_RE.exec(cleaned);
  if (!match) return cleaned;
  const leading = match[0].replace(/^[\s.:;,-]+|[\s.:;,-]+$/g, "");
  if (leading !== clauseNumber && leading !== `${clauseNumber}.1`) return cleaned;
  return cleaned.slice(match[0].length).trim() || cleaned;
}

function looksLikeClauseBody(body: string): boolean {
  const value = (body || "").trim();
  if (value.length < 3) return false;
  const lowered = value.toLowerCase();
  if (lowered.startsWith("inc.") || lowered.startsWith("inciso ")) return false;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(value)) return false;
  if (/^\d[\d.,/-]{5,}$/.test(value)) return false;
  return true;
}

function findBestStart(source: string, matches: RegExpMatchArray[]): number {
  const lowered = source.toLowerCase();
  const hintPositions = SECTION_HINTS.map((h) => lowered.lastIndexOf(h)).filter((p) => p !== -1);
  if (hintPositions.length) {
    const hintPosition = Math.max(...hintPositions);
    for (let i = 0; i < matches.length; i++) {
      if ((matches[i].index ?? 0) >= hintPosition) return i;
    }
  }

  let bestIndex = 0;
  let bestScore = -1;
  matches.slice(0, 25).forEach((match, index) => {
    let score = 0;
    const start = match.index ?? 0;
    const context = lowered.slice(Math.max(0, start - 200), start);
    if (SECTION_HINTS.some((h) => context.includes(h))) score += 3;
    const number = match[1];
    if (number === "1" || number === "1.1") score += 2;
    if (start < source.length * 0.35) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function extractClauses(text: string): Record<string, string> {
  const source = normalizeForParsing(text);
  if (!source) return {};

  const matches = [...source.matchAll(CLAUSE_MARKER_RE)];
  if (!matches.length) return { clause_1: source };

  const sliced = matches.slice(findBestStart(source, matches));
  const clauses: Record<string, string> = {};
  const preamble = source.slice(0, sliced[0].index ?? 0).trim();

  sliced.forEach((match, idx) => {
    const number = match[1].replace(/\.+$/, "");
    const start = (match.index ?? 0) + match[0].length;
    const end = idx + 1 < sliced.length ? sliced[idx + 1].index ?? source.length : source.length;
    let body = source.slice(start, end).replace(/^[\s\n.:;-]+|[\s\n.:;-]+$/g, "");
    body = stripLeadingInlineNumber(body, number);
    if (!looksLikeClauseBody(body)) return;
    clauses[`clause_${number}`] = body;
  });

  const ordered: Record<string, string> = {};
  if (preamble) ordered["preamble"] = preamble;
  Object.keys(clauses)
    .sort(compareNatural)
    .forEach((key) => {
      ordered[key] = clauses[key];
    });
  return ordered;
}

/* ------------------------------------------------------------------ */
/* Comparacao textual                                                  */
/* ------------------------------------------------------------------ */

const MAX_COMPARE_CHARS = 4000;

function normalizeWhitespace(text: string): string {
  return (text || "").trim().replace(/\s+/g, " ");
}

function tokenize(text: string): string[] {
  return (text || "").match(/\d+(?:\.\d+)*\.?|[A-Za-zÀ-ÿ0-9_-]+|[^\w\s]/g) || [];
}

/** Similaridade indel normalizada (equivalente ao fuzz.ratio do rapidfuzz). */
function ratio(a: string, b: string): number {
  const s1 = a.slice(0, MAX_COMPARE_CHARS);
  const s2 = b.slice(0, MAX_COMPARE_CHARS);
  if (!s1.length && !s2.length) return 100;
  if (!s1.length || !s2.length) return 0;
  const lcs = lcsLength([...s1], [...s2]);
  return (200 * lcs) / (s1.length + s2.length);
}

function lcsLength<T>(a: T[], b: T[]): number {
  let prev = new Uint32Array(b.length + 1);
  let cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
    cur.fill(0);
  }
  return prev[b.length];
}

interface Opcode {
  tag: "equal" | "replace" | "delete" | "insert";
  i1: number;
  i2: number;
  j1: number;
  j2: number;
}

/** Opcodes estilo difflib.SequenceMatcher via LCS. */
function opcodes(a: string[], b: string[]): Opcode[] {
  const n = Math.min(a.length, 1500);
  const m = Math.min(b.length, 1500);
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const raw: Opcode[] = [];
  let i = 0;
  let j = 0;
  const push = (tag: Opcode["tag"], i1: number, i2: number, j1: number, j2: number) => {
    const last = raw[raw.length - 1];
    if (last && last.tag === tag) {
      last.i2 = i2;
      last.j2 = j2;
    } else raw.push({ tag, i1, i2, j1, j2 });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", i, i + 1, j, j + 1);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", i, i + 1, j, j);
      i++;
    } else {
      push("insert", i, i, j, j + 1);
      j++;
    }
  }
  if (i < n) push("delete", i, n, j, j);
  if (j < m) push("insert", i, i, j, m);

  // Junta delete seguido de insert em replace, como o difflib faz.
  const merged: Opcode[] = [];
  for (const op of raw) {
    const last = merged[merged.length - 1];
    if (last && last.tag === "delete" && op.tag === "insert") {
      merged[merged.length - 1] = { tag: "replace", i1: last.i1, i2: last.i2, j1: op.j1, j2: op.j2 };
    } else merged.push({ ...op });
  }
  return merged;
}

function buildDiff(modelText: string, policyText: string): string {
  const a = tokenize(modelText);
  const b = tokenize(policyText);
  const parts: string[] = [];
  for (const op of opcodes(a, b)) {
    if (op.tag === "equal") continue;
    for (const token of a.slice(op.i1, op.i2)) parts.push(`-${token}`);
    for (const token of b.slice(op.j1, op.j2)) parts.push(`+${token}`);
  }
  return parts.join(" ");
}

export interface RawComparison {
  clause: string;
  similarity: number;
  diff: string;
  model_text: string;
  policy_text: string;
}

export function compare(
  modelClauses: Record<string, string>,
  policyClauses: Record<string, string>,
): RawComparison[] {
  const keys = [...new Set([...Object.keys(modelClauses), ...Object.keys(policyClauses)])].sort(
    compareNatural,
  );

  return keys.map((clause) => {
    const modelText = modelClauses[clause] || "";
    const policyText = policyClauses[clause] || "";
    const modelNorm = normalizeWhitespace(modelText);
    const policyNorm = normalizeWhitespace(policyText);

    if (modelNorm === policyNorm) {
      return { clause, similarity: 100, diff: "", model_text: modelText, policy_text: policyText };
    }
    return {
      clause,
      similarity: Math.round(ratio(modelNorm, policyNorm) * 100) / 100,
      diff: buildDiff(modelNorm, policyNorm),
      model_text: modelText,
      policy_text: policyText,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Analise semantica local (fallback sem IA)                           */
/* ------------------------------------------------------------------ */

const MATERIAL_NUMBER_CONTEXT_RE =
  /\b(r\$|reais?|valor(?:es)?|importancia|limite|lmg|premio|indenizacao|multa|percentual|%|prazo|dias?|mes(?:es)?|anos?|vigencia|termino|inicio|data|parcelas?|cobertura|franquia|capital|garantia)\b/i;

const PURE_STRUCTURE_NUMBER_RE = /^\d+(?:\.\d+){1,4}\.?$/;

function normalizeStructureNumbers(text: string): string {
  return tokenize((text || "").toLowerCase())
    .filter((t) => !PURE_STRUCTURE_NUMBER_RE.test(t))
    .join(" ");
}

function extractMaterialNumbers(text: string): string[] {
  const source = text || "";
  const found: string[] = [];
  for (const match of source.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const start = Math.max(0, (match.index ?? 0) - 24);
    const end = Math.min(source.length, (match.index ?? 0) + match[0].length + 24);
    if (MATERIAL_NUMBER_CONTEXT_RE.test(source.slice(start, end))) found.push(match[0]);
  }
  return found;
}

function similarityScore(modelText: string, policyText: string): number {
  const left = normalizeStructureNumbers(modelText).trim();
  const right = normalizeStructureNumbers(policyText).trim();
  if (!left && !right) return 1;
  return ratio(left, right) / 100;
}

function findWordDifferences(modelText: string, policyText: string, limit = 3): [string, string][] {
  const a = tokenize((modelText || "").toLowerCase());
  const b = tokenize((policyText || "").toLowerCase());
  const changes: [string, string][] = [];
  for (const op of opcodes(a, b)) {
    if (op.tag === "equal") continue;
    const left = a.slice(op.i1, op.i2);
    const right = b.slice(op.j1, op.j2);
    for (let k = 0; k < Math.max(left.length, right.length); k++) {
      const lw = left[k] ?? "(ausente)";
      const rw = right[k] ?? "(ausente)";
      if (lw === rw) continue;
      changes.push([lw, rw]);
      if (changes.length >= limit) return changes;
    }
  }
  return changes;
}

function describeTextualIssue(changes: [string, string][]): string {
  if (!changes.length) return "";
  const closeWordChange = changes.every(
    ([l, r]) =>
      l !== "(ausente)" &&
      r !== "(ausente)" &&
      /^[A-Za-zÀ-ÿ]+$/.test(l) &&
      /^[A-Za-zÀ-ÿ]+$/.test(r) &&
      ratio(l, r) / 100 >= 0.72,
  );
  if (closeWordChange) return "Possivel erro ortografico ou troca de termo identificado";

  const punctuationOnly = changes.every(
    ([l, r]) => /\d/.test(l + r) || /^[^\w\s]+$/.test(l) || /^[^\w\s]+$/.test(r),
  );
  if (punctuationOnly) return "Diferenca de pontuacao ou formatacao identificada";
  return "Diferenca textual identificada";
}

interface Analysis {
  semantic_analysis: SemanticLabel;
  diagnostico: string;
  acao_recomendada: string;
}

function applyExplicitDifference(result: Analysis, modelText: string, policyText: string): Analysis {
  const changes = findWordDifferences(modelText, policyText, 3);
  if (!changes.length) return result;

  const summary = changes.map(([m, p]) => `'${m}' vs '${p}'`).join("; ");
  const label: SemanticLabel =
    result.semantic_analysis === "OK" ? "REVISAO JURIDICA" : result.semantic_analysis;

  return {
    semantic_analysis: label,
    diagnostico: `${describeTextualIssue(changes)}: ${summary}.`.slice(0, 220),
    acao_recomendada:
      "Corrigir os termos divergentes na apolice para reproduzir exatamente o texto do modelo ANP.".slice(
        0,
        220,
      ),
  };
}

function localClassification(modelText: string, policyText: string): SemanticLabel {
  const modelNumbers = extractMaterialNumbers(modelText);
  const policyNumbers = extractMaterialNumbers(policyText);
  if (modelNumbers.join("|") !== policyNumbers.join("|")) return "ALTERACAO SEMANTICA";

  const paddedModel = ` ${modelText.toLowerCase()} `;
  const paddedPolicy = ` ${policyText.toLowerCase()} `;
  for (const marker of [" nao ", " não ", " sem ", " exceto ", " salvo "]) {
    if (paddedModel.includes(marker) !== paddedPolicy.includes(marker)) return "ALTERACAO SEMANTICA";
  }

  const score = similarityScore(modelText, policyText);
  if (score < 0.85) return "ALTERACAO SEMANTICA";
  if (score < 0.96) return "REVISAO JURIDICA";
  return "OK";
}

export function localAnalysis(modelText: string, policyText: string): Analysis {
  const label = localClassification(modelText, policyText);
  if (label === "OK") {
    return applyExplicitDifference(
      {
        semantic_analysis: "OK",
        diagnostico: "Nao foi encontrada divergencia juridica relevante entre os textos.",
        acao_recomendada: "Nenhum ajuste obrigatorio. Manter clausula como esta.",
      },
      modelText,
      policyText,
    );
  }

  const modelNumbers = extractMaterialNumbers(modelText);
  const policyNumbers = extractMaterialNumbers(policyText);
  if (modelNumbers.join("|") !== policyNumbers.join("|")) {
    return {
      semantic_analysis: "ALTERACAO SEMANTICA",
      diagnostico:
        "Ha divergencia numerica material entre modelo e apolice (prazo, valor, limite ou vigencia).",
      acao_recomendada:
        "Ajustar na apolice os numeros materiais para ficarem identicos ao modelo ANP.",
    };
  }

  return applyExplicitDifference(
    {
      semantic_analysis: label,
      diagnostico: "Foi identificada diferenca de redacao com impacto juridico potencial.",
      acao_recomendada: "Reescrever a clausula da apolice para espelhar o texto do modelo ANP.",
    },
    modelText,
    policyText,
  );
}

export function analyzeClauseLocally(modelText: string, policyText: string): Analysis {
  const model = (modelText || "").trim();
  const policy = (policyText || "").trim();

  if (!model && !policy) {
    return {
      semantic_analysis: "OK",
      diagnostico: "Ambos os textos estao vazios para esta clausula.",
      acao_recomendada: "Validar se a clausula deveria existir. Se nao, manter sem alteracao.",
    };
  }
  if (!model || !policy) {
    return {
      semantic_analysis: "ALTERACAO SEMANTICA",
      diagnostico: "A clausula existe em apenas um dos documentos.",
      acao_recomendada: "Incluir a clausula faltante na apolice para alinhar ao modelo ANP.",
    };
  }
  return localAnalysis(model, policy);
}

export function exactMatchAnalysis(): Analysis {
  return {
    semantic_analysis: "OK",
    diagnostico:
      "Os textos da clausula estao equivalentes. Nenhuma divergencia material foi encontrada.",
    acao_recomendada: "Nenhum ajuste obrigatorio.",
  };
}

/* ------------------------------------------------------------------ */
/* Risco                                                               */
/* ------------------------------------------------------------------ */

export function classifyRisk(
  diff: string,
  semanticFlag: SemanticLabel,
  diagnostico = "",
): RiskLabel {
  const loweredDiff = (diff || "").toLowerCase();
  const loweredDiag = (diagnostico || "").toLowerCase();

  if (semanticFlag === "ALTERACAO SEMANTICA") return "CRITICO";
  if (/\bn[aã]o\b/.test(loweredDiff)) return "ALTO";
  if (!loweredDiff.trim()) return "OK";

  const punctuationOnly = [...loweredDiff].every(
    (c) => ";,.:!?-()[]{}'\"+/=_<>|`~".includes(c) || /\s/.test(c),
  );
  if (punctuationOnly) return "AJUSTE REDACIONAL";

  const editorialMarkers = [
    "diferenca textual identificada",
    "diferenca de pontuacao ou formatacao identificada",
    "possivel erro ortografico ou troca de termo identificado",
  ];
  if (editorialMarkers.some((m) => loweredDiag.includes(m))) return "AJUSTE REDACIONAL";
  return "REVISAR";
}

/* ------------------------------------------------------------------ */
/* Reconciliacao de conjuntos de clausulas                             */
/* ------------------------------------------------------------------ */

function backfillMissingClauses(
  base: Record<string, string>,
  reference: Record<string, string>,
): Record<string, string> {
  const orderedKeys = Object.keys(reference)
    .filter((k) => k !== "preamble")
    .sort(compareNatural);

  orderedKeys.forEach((key, index) => {
    if (base[key] || index === 0) return;
    const previousKey = orderedKeys[index - 1];
    const previousText = base[previousKey] || "";
    const targetText = reference[key] || "";
    if (!previousText || !targetText) return;

    const anchor = targetText.slice(0, 80).trim();
    const splitAt = previousText.indexOf(anchor);
    if (splitAt <= 0) return;

    const left = previousText.slice(0, splitAt).trim();
    const right = previousText.slice(splitAt).trim();
    if (!left || !right) return;
    base[previousKey] = left;
    base[key] = right;
  });
  return base;
}

export function reconcileClauseSets(
  modelClauses: Record<string, string>,
  policyClauses: Record<string, string>,
): [Record<string, string>, Record<string, string>] {
  const model = { ...modelClauses };
  const policy = { ...policyClauses };
  return [backfillMissingClauses(model, policy), backfillMissingClauses(policy, model)];
}

export function summarizeMatch(label: string, similarity: number): string {
  if (similarity >= 95) return `A apolice segue predominantemente o ${label}.`;
  if (similarity >= 85)
    return `A apolice esta mais aderente ao ${label}, mas possui divergencias relevantes.`;
  return "A apolice apresenta baixa aderencia aos dois modelos padrao e exige revisao juridica/redacional detalhada.";
}

export function scoreComparisons(comparisons: RawComparison[]): number {
  if (!comparisons.length) return 0;
  return (
    Math.round((comparisons.reduce((acc, c) => acc + c.similarity, 0) / comparisons.length) * 100) /
    100
  );
}
