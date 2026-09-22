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

export const ROTULO_ETAPA: Record<string, string> = {
  "1": "1 Triagem",
  "2": "2 Análise técnica",
  "3": "3 Consulta a mercado",
  "3b": "3b Documentos de cadastro",
  "4": "4 Cotação",
  "5": "5 Proposta",
};

export const rotuloEtapa = (etapa: string) => ROTULO_ETAPA[etapa] ?? `Etapa ${etapa}`;
