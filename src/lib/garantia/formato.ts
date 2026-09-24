// Formatações compartilhadas pelo pipeline de Garantia.

export const A_DEFINIR = "a definir";

export function moeda(v: number | null | undefined): string {
  if (v == null) return A_DEFINIR;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataCurta(v: string | null | undefined): string {
  if (!v) return A_DEFINIR;
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v);
  if (Number.isNaN(d.getTime())) return A_DEFINIR;
  return d.toLocaleDateString("pt-BR");
}

export function dataHora(v: string | null | undefined): string {
  if (!v) return A_DEFINIR;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return A_DEFINIR;
  return d.toLocaleString("pt-BR");
}

/** Duração legível a partir de segundos. Só é exibida a quem vê o Painel. */
export function duracaoLegivel(segundos: number | null | undefined): string {
  if (segundos == null) return A_DEFINIR;
  const horas = Math.floor(segundos / 3600);
  if (horas < 1) return `${Math.max(1, Math.floor(segundos / 60))} min`;
  if (horas < 48) return `${horas} h`;
  return `${Math.floor(horas / 24)} dias`;
}

export function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

/** Quantos dias faltam para a data limite (negativo = vencida). */
export function diasAte(data: string | null): number | null {
  if (!data) return null;
  const alvo = new Date(`${data.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - Date.now()) / 86_400_000);
}

export const ROTULO_PRODUTO: Record<string, string> = {
  seguro_garantia: "Seguro Garantia",
  fianca_locaticia: "Fiança Locatícia",
};

export const MODALIDADES: { valor: string; rotulo: string }[] = [
  { valor: "licitante", rotulo: "Licitante" },
  { valor: "executante", rotulo: "Executante" },
  { valor: "judicial", rotulo: "Judicial" },
  { valor: "adiantamento", rotulo: "Adiantamento" },
  { valor: "aduaneiro", rotulo: "Aduaneiro" },
  { valor: "outras", rotulo: "Outras" },
];

export const rotuloModalidade = (v: string | null) =>
  v === "locaticia"
    ? "Locatícia"
    : (MODALIDADES.find((m) => m.valor === v)?.rotulo ?? (v ? v : A_DEFINIR));

export const TIPOS_MOVIMENTO = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "renovacao", rotulo: "Renovação" },
  { valor: "endosso", rotulo: "Endosso" },
];

export const TIPOS_ALTERACAO = [
  { valor: "aumento_is", rotulo: "Aumento de IS" },
  { valor: "prorrogacao_prazo", rotulo: "Prorrogação de prazo" },
  { valor: "outro", rotulo: "Outro" },
];

/** Nome de cada etapa. O NÚMERO mostrado é a posição no catálogo, não o código. */
export const NOME_ETAPA: Record<string, string> = {
  "1": "Análise da demanda",
  // "2" foi fundida com a "1"; fica só para ler histórico antigo.
  "2": "Análise da demanda",
  "3": "Consulta a mercado",
  "3b": "Cadastro",
  "4": "Cotação",
  "5": "Proposta",
  "6": "Curadoria",
  "7": "Minuta",
  "8": "Emissão",
  "9": "Financeiro",
};

/** Posição padrão (ordem atual do catálogo), usada quando não há colunas à mão. */
const POSICAO_PADRAO: Record<string, number> = {
  "1": 1, "2": 1, "3": 2, "3b": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

export const ROTULO_ETAPA: Record<string, string> = Object.fromEntries(
  Object.entries(NOME_ETAPA).map(([k, v]) => [k, `${POSICAO_PADRAO[k]} ${v}`]),
);

/**
 * Rótulo da etapa. Com as colunas do catálogo (colunasDoCatalogo), o número é a
 * posição da etapa ali; sem elas, a posição padrão da ordem atual.
 */
export const rotuloEtapa = (
  etapa: string,
  colunas?: { etapa: string; posicao: number }[],
) => {
  const nome = NOME_ETAPA[etapa] ?? `Etapa ${etapa}`;
  const pos = colunas?.find((c) => c.etapa === (etapa === "2" ? "1" : etapa))?.posicao;
  if (pos != null) return `${pos} ${nome}`;
  return ROTULO_ETAPA[etapa] ?? nome;
};

/** De quem é a espera, lido de garantia_status_catalogo.com_quem. */
export const rotuloComQuem = (comQuem: string) => `com ${comQuem.replace(/_/g, " ")}`;
