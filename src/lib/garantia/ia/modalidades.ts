// CÓPIA DECLARADA dos ids do catálogo de modalidades de public/analise-limite/deepseek.js
// — o Worker só entende esses ids; mudar lá exige mudar aqui.
// Ids: chaves de SG_MODALIDADE_GUIDANCE / FL_MODALIDADE_GUIDANCE.
// Rótulos: SG_MODALIDADES_CATALOGO / FL_MODALIDADES_CATALOGO em public/analise-limite/app.js
// (onde a tela Operacional os exibe).

export type ProdutoModalidade = "seguro_garantia" | "fianca_locaticia";

export interface ModalidadeWorker {
  id: string;
  label: string;
  produto: ProdutoModalidade;
  /** Chave única de interface: "<produto>:<id>". O `id` é o que vai ao Worker. */
  chave: string;
}

export const SG_MODALIDADES: ModalidadeWorker[] = [
  { id: "licitante-proposta", label: "Garantia do Licitante / Garantia de Proposta" },
  { id: "execucao-fiel-cumprimento", label: "Garantia de Execução / Fiel Cumprimento" },
  { id: "adiantamento-pagamento", label: "Garantia de Adiantamento de Pagamento" },
  { id: "retencao-pagamento", label: "Garantia de Retenção de Pagamento" },
  { id: "manutencao-corretiva", label: "Garantia de Manutenção Corretiva / Perfeito Funcionamento" },
  { id: "trabalhista-previdenciaria", label: "Garantia Trabalhista e Previdenciária" },
  { id: "aduaneira", label: "Garantia Aduaneira" },
  { id: "judicial", label: "Garantia Judicial" },
  { id: "judicial-execucao-fiscal", label: "Garantia Judicial para Execução Fiscal" },
  { id: "recursal", label: "Garantia Recursal" },
  { id: "administrativa-creditos-tributarios", label: "Garantia Administrativa de Créditos Tributários" },
  { id: "parcelamento-administrativo-fiscal", label: "Garantia de Parcelamento Administrativo Fiscal" },
  { id: "imobiliaria", label: "Garantia Imobiliária" },
  { id: "concessoes", label: "Garantia para Concessões" },
  { id: "energia", label: "Garantia para o Setor de Energia" },
  { id: "completion", label: "Garantia de Completion / Conclusão de Projeto" },
  { id: "outra", label: "Outra modalidade" },
].map((m) => ({ ...m, produto: "seguro_garantia" as const, chave: `seguro_garantia:${m.id}` }));

export const FL_MODALIDADES: ModalidadeWorker[] = [
  { id: "residencial", label: "Locação Residencial" },
  { id: "comercial", label: "Locação Comercial" },
  { id: "nao-residencial", label: "Locação Não Residencial" },
  { id: "pessoa-juridica", label: "Locação por Pessoa Jurídica" },
  { id: "construcao-built-to-suit", label: "Imóvel em Construção / Built to Suit" },
  { id: "outra", label: "Outra modalidade" },
].map((m) => ({ ...m, produto: "fianca_locaticia" as const, chave: `fianca_locaticia:${m.id}` }));

/** Todos os ids aceitos (o "outra" existe nos dois produtos). */
export const IDS_MODALIDADE = [...new Set([...SG_MODALIDADES, ...FL_MODALIDADES].map((m) => m.id))];

/**
 * Resolve uma escolha: aceita a chave "<produto>:<id>" (o produto da opção
 * manda) ou o id sozinho (formato antigo, resolvido pelo produto informado).
 */
export function resolverModalidade(valor: string, produto?: ProdutoModalidade | null): ModalidadeWorker | null {
  if (valor.includes(":")) return [...SG_MODALIDADES, ...FL_MODALIDADES].find((m) => m.chave === valor) ?? null;
  return buscarModalidade(valor, produto);
}

export const modalidadeValida = (id: string | null | undefined): boolean =>
  !!id && (id.includes(":") ? !!resolverModalidade(id) : IDS_MODALIDADE.includes(id));

/**
 * Acha a modalidade no catálogo. "outra" é ambíguo: resolve pelo produto
 * informado e, sem ele, fica no seguro garantia.
 */
export function buscarModalidade(id: string, produto?: ProdutoModalidade | null): ModalidadeWorker | null {
  const lista = produto === "fianca_locaticia" ? [...FL_MODALIDADES, ...SG_MODALIDADES] : [...SG_MODALIDADES, ...FL_MODALIDADES];
  return lista.find((m) => m.id === id) ?? null;
}

/** Flow do Worker para a modalidade. */
export const flowDaModalidade = (m: ModalidadeWorker) => (m.produto === "fianca_locaticia" ? "fianca-locaticia" : "seguro-garantia");

/**
 * Códigos que o Hub grava em garantia_demandas.modalidade (MODALIDADES em
 * src/lib/garantia/formato.ts, mais "locaticia") → id do Worker.
 */
const HUB_PARA_WORKER: Record<string, { id: string; produto: ProdutoModalidade }> = {
  licitante: { id: "licitante-proposta", produto: "seguro_garantia" },
  executante: { id: "execucao-fiel-cumprimento", produto: "seguro_garantia" },
  judicial: { id: "judicial", produto: "seguro_garantia" },
  adiantamento: { id: "adiantamento-pagamento", produto: "seguro_garantia" },
  aduaneiro: { id: "aduaneira", produto: "seguro_garantia" },
  outras: { id: "outra", produto: "seguro_garantia" },
  locaticia: { id: "outra", produto: "fianca_locaticia" },
};

export function modalidadeDoHubParaWorker(codigo: string | null | undefined): ModalidadeWorker | null {
  const alvo = codigo ? HUB_PARA_WORKER[codigo] : undefined;
  return alvo ? buscarModalidade(alvo.id, alvo.produto) : null;
}

/** Inversa: id do Worker → código do Hub. Modalidades sem código próprio caem em "outras". */
export function modalidadeDoWorkerParaHub(id: string, produto?: ProdutoModalidade | null): string | null {
  const m = buscarModalidade(id, produto);
  if (!m) return null;
  if (m.produto === "fianca_locaticia") return "locaticia";
  const direto: Record<string, string> = {
    "licitante-proposta": "licitante",
    "execucao-fiel-cumprimento": "executante",
    judicial: "judicial",
    "judicial-execucao-fiscal": "judicial",
    recursal: "judicial",
    "adiantamento-pagamento": "adiantamento",
    aduaneira: "aduaneiro",
  };
  return direto[m.id] ?? "outras";
}
