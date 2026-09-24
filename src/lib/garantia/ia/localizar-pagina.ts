// Página exata de cada citação — determinístico, sem IA.
// Procura o valor/trecho no texto por página (extrair-texto → paginas),
// primeiro no intervalo citado na fonte ("Pag. 52-60"), depois no documento todo.

export interface PaginaTexto { pagina: number; texto: string }

export function normalizar(s: string): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

const soDigitos = (s: string) => String(s ?? "").replace(/\D/g, "");

/** "Pag. 1-7", "Pagina 5", "Paginas 52-60", "p. 3" → [ini, fim]. */
export function intervaloDaFonte(fonte: string | null | undefined): [number, number] | null {
  if (!fonte) return null;
  const m = normalizar(fonte).match(/(?:pag(?:ina)?s?|p)\.?\s*(\d+)(?:\s*(?:-|a|ate)\s*(\d+))?/);
  if (!m) return null;
  const ini = Number(m[1]);
  const fim = m[2] ? Number(m[2]) : ini;
  return [Math.min(ini, fim), Math.max(ini, fim)];
}

/** 3611721.3 → "3.611.721,30" */
export function numeroBr(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function agulhas(valor: unknown): { textos: string[]; digitos: string | null } {
  if (typeof valor === "number") {
    const br = numeroBr(valor);
    const inteiro = Number.isInteger(valor) ? [valor.toLocaleString("pt-BR"), String(valor)] : [];
    return { textos: [br, br.replace(/,00$/, ""), ...inteiro].map(normalizar), digitos: null };
  }
  const s = String(valor ?? "");
  const dig = soDigitos(s);
  // CNPJ / CPF: compara só dígitos.
  if ((dig.length === 14 || dig.length === 11) && dig.length >= s.replace(/[\s./-]/g, "").length) return { textos: [], digitos: dig };
  const n = normalizar(s);
  return { textos: n ? [n.slice(0, 80)] : [], digitos: null };
}

function contem(pagina: PaginaTexto, a: { textos: string[]; digitos: string | null }): boolean {
  if (a.digitos) return soDigitos(pagina.texto).includes(a.digitos);
  const t = normalizar(pagina.texto);
  return a.textos.some((x) => x.length >= 2 && t.includes(x));
}

/** Página exata; senão a 1ª do intervalo citado; senão null. */
export function localizarPagina(valor: unknown, fonte: string | null | undefined, paginas: PaginaTexto[]): number | null {
  const intervalo = intervaloDaFonte(fonte);
  const a = agulhas(valor);
  if (a.textos.length || a.digitos) {
    if (intervalo) {
      const achada = paginas.find((p) => p.pagina >= intervalo[0] && p.pagina <= intervalo[1] && contem(p, a));
      if (achada) return achada.pagina;
    }
    const achada = paginas.find((p) => contem(p, a));
    if (achada) return achada.pagina;
  }
  return intervalo ? intervalo[0] : null;
}

type ComFonte = { valor?: unknown; fonte?: string | null; pagina?: number | null; [k: string]: unknown };

const CAMPOS = ["segurado", "tomador", "importancia_segurada", "percentual_garantia", "vigencia_exigida", "objeto", "numero_processo", "numero_contrato", "data_limite"];

/** Acrescenta `pagina` em cada campo sugerido (e nos das modalidades). Não remove `fonte`. */
export function anotarPaginasCampos<T extends Record<string, unknown>>(campos: T, paginas: PaginaTexto[]): T {
  const c = campos as Record<string, unknown>;
  for (const chave of CAMPOS) {
    const campo = c[chave] as ComFonte | undefined;
    if (!campo || typeof campo !== "object") continue;
    // Vigência vem montada ("Início: x · Fim: y"): procura só a primeira data.
    const alvo = chave === "vigencia_exigida" ? String(campo.valor ?? "").replace(/^In[ií]cio:\s*/i, "").split(" · ")[0] : chave === "segurado" || chave === "tomador" ? (campo.valor ?? campo.cnpj) : campo.valor;
    campo.pagina = localizarPagina(alvo, campo.fonte, paginas);
  }
  const mods = c.modalidades as Array<{ campos?: Record<string, unknown> }> | undefined;
  if (Array.isArray(mods)) for (const m of mods) if (m?.campos) anotarPaginasCampos(m.campos, paginas);
  return campos;
}

/** Acrescenta `pagina` em cada item de trechos_relevantes do resultado. */
export function anotarPaginasTrechos(resultado: Record<string, unknown>, paginas: PaginaTexto[]): void {
  const trechos = resultado.trechos_relevantes as Array<{ trecho?: string; pagina_ou_localizacao?: string; pagina?: number | null }> | undefined;
  if (!Array.isArray(trechos)) return;
  for (const t of trechos) if (t && typeof t === "object") t.pagina = localizarPagina(t.trecho ?? "", t.pagina_ou_localizacao, paginas);
}
