export type TimeReceita = "GARANTIA" | "BENEFICIOS" | "DEMAIS_RAMOS";

export const TIME_LABEL: Record<TimeReceita, string> = {
  GARANTIA: "Garantia",
  BENEFICIOS: "Benefícios",
  DEMAIS_RAMOS: "Demais Ramos",
};

/** Mensagem exibida a quem não tem nenhum canal de receita liberado. */
export const SEM_ACESSO_RECEITA_MSG = "Você não tem acesso aos dados de receita.";

/** 'TODOS' no array = acesso completo. */
export function temTodos(times?: string[] | null): boolean {
  return (times ?? []).includes("TODOS");
}

/** Vazio/NULL (e sem 'TODOS') = não vê receita nenhuma. */
export function semAcessoReceita(times?: string[] | null): boolean {
  if (temTodos(times)) return false;
  return normalizeTimes(times).length === 0;
}

/** Remove valores inválidos e "TODOS" (que significa sem restrição). */
export function normalizeTimes(times?: string[] | null): TimeReceita[] {
  const out = (times ?? []).filter(
    (t): t is TimeReceita => t === "GARANTIA" || t === "BENEFICIOS" || t === "DEMAIS_RAMOS",
  );
  return Array.from(new Set(out));
}

/** true quando o usuário tem restrição de time (e não é admin — checado por quem chama). */
export function isRestrito(times?: string[] | null): boolean {
  return normalizeTimes(times).length > 0;
}


/** "Garantia e Demais Ramos" */
export function escopoLabel(times?: string[] | null): string {
  const t = normalizeTimes(times).map((x) => TIME_LABEL[x]);
  if (t.length === 0) return "";
  if (t.length === 1) return t[0];
  return `${t.slice(0, -1).join(", ")} e ${t[t.length - 1]}`;
}

/** Sufixo para títulos de card: " — Garantia e Demais Ramos" (vazio se sem restrição). */
export function escopoSufixo(times?: string[] | null): string {
  const l = escopoLabel(times);
  return l ? ` — ${l}` : "";
}

/** Frase de disclaimer (vazia se sem restrição). */
export function escopoFrase(times?: string[] | null): string {
  const l = escopoLabel(times);
  if (!l) return "";
  const plural = normalizeTimes(times).length > 1;
  return plural
    ? `Você está visualizando dados de receita apenas dos seus times: ${l}.`
    : `Você está visualizando dados de receita apenas do seu time: ${l}.`;
}

/** Canais visíveis ("Garantia" | "Benefícios" | "Demais Ramos"); vazio = todos. */
export function canaisVisiveis(times?: string[] | null): string[] {
  return normalizeTimes(times).map((t) => TIME_LABEL[t]);
}

/** Filtra linhas de breakdown por canal permitido. Sem restrição, devolve tudo. */
export function filtrarBreakdown<T extends { label: string }>(
  rows: T[],
  times?: string[] | null,
): T[] {
  const canais = canaisVisiveis(times);
  if (canais.length === 0) return rows;
  return rows.filter((r) => canais.includes(r.label));
}
