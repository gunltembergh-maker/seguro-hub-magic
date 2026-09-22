/** Mensagem legível de qualquer erro: Error, PostgrestError, string ou objeto solto. */
export function mensagemDeErro(
  e: unknown,
  padrao = "Não foi possível concluir a ação",
): string {
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    for (const chave of ["message", "details", "hint", "error_description", "error"]) {
      const v = o[chave];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return padrao;
}
