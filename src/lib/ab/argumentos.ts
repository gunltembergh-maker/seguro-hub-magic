// =====================================================================
// Peça jurídica e argumento comercial pré-montados.
//
// Metade do valor do produto: o corretor recebe o lead com a base legal e
// a conta já feita. Os textos são MODELOS DE APOIO — a peça que vai aos
// autos deve ser revisada pelo advogado do cliente.
// =====================================================================

import { brl, cnpjFmt, pct, processoFmt } from "./format.ts";
import type { Preco, Parametros } from "./pricing.ts";

export const FUNDAMENTO: Record<string, string> = {
  T1:
    "CLT art. 899, §11 (Lei 13.467/2017) e Ato Conjunto TST/CSJT/CGJT nº 1/2019; " +
    "entendimento do CNJ e precedentes do TRT-18 e da 2ª Turma do TST quanto ao resgate " +
    "de depósito recursal já efetuado em dinheiro.",
  T2:
    "CLT art. 899, §11 — substituição do depósito recursal por seguro garantia judicial. " +
    "Importância segurada: débito e encargos acrescidos de 30% na fase de execução; na fase " +
    "recursal discute-se o teto do depósito recursal aplicável.",
  T3:
    "CLT art. 899, §11 e Ato Conjunto TST/CSJT/CGJT nº 1/2019 — prazo mínimo de vigência de " +
    "3 anos, uma apólice por processo, seguradora com registro na SUSEP.",
  T4:
    "CPC art. 835, §2º — a fiança bancária e o seguro garantia judicial equiparam-se a " +
    "dinheiro para fins de substituição da penhora, em valor não inferior ao do débito " +
    "acrescido de 30%; CPC art. 848, parágrafo único. STJ, 3ª Turma (jun/2023): a oposição " +
    "do credor não impede a substituição. Tema Repetitivo 1.385 pendente de julgamento.",
  T5:
    "Lei 6.830/80, art. 9º, II e §3º — seguro garantia equiparado a depósito em dinheiro. " +
    "Lei 14.689/2023 — vedada a liquidação antecipada antes do trânsito em julgado. " +
    "Portaria PGFN/MF nº 2.044/2024 — vigência mínima de 5 anos, renovação e atualização " +
    "automáticas, apresentação via Regularize.",
  T6:
    "Portaria PGFN/MF nº 2.044/2024 — admite seguro garantia para débitos ainda NÃO " +
    "inscritos em dívida ativa, permitindo antecipar a discussão judicial. STJ Tema 1.263 " +
    "(pendente): efeitos do seguro garantia sobre protesto da CDA e inscrição no CADIN.",
  T7:
    "Modalidade administrativo de créditos tributários (SUSEP). Lei 14.689/2023 e Portaria " +
    "PGFN/MF nº 2.044/2024 aplicáveis ao pré-contencioso.",
  T8:
    "Lei 14.133/2021, art. 58 — garantia de proposta em valor não superior a 1% do valor " +
    "estimado da contratação. Modalidade licitante.",
  T9:
    "Lei 14.133/2021, art. 96, §1º (modalidades admitidas) e art. 98 — até 5% do valor " +
    "inicial do contrato, majorável a 10% mediante justificativa técnica. Modalidade executante.",
  T10:
    "Lei 14.133/2021, art. 99 — obras e serviços de engenharia de grande vulto (acima de " +
    "R$ 200 milhões): garantia de até 30% na modalidade seguro-garantia com cláusula de " +
    "retomada (art. 102).",
  T13:
    "CPC art. 835, §2º e art. 848 — substituição de constrição por seguro garantia. Em " +
    "improbidade, avaliar a natureza da indisponibilidade pleiteada.",
  T16:
    "Produto de carteira. Fiança locatícia comercial e demais coberturas — sem gatilho legal " +
    "automático; oportunidade de cross-sell a confirmar em contato.",
};

const MINUTA = `EXCELENTÍSSIMO(A) SENHOR(A) JUIZ(ÍZA) DA {orgao}

Processo nº {processo}

{razaoSocial}, CNPJ {cnpj}, já qualificada nos autos, por seu advogado que
subscreve, vem respeitosamente à presença de Vossa Excelência requerer a
SUBSTITUIÇÃO DA GARANTIA / APRESENTAÇÃO DE SEGURO GARANTIA JUDICIAL, pelas
razões a seguir.

1. FUNDAMENTO
{fundamento}

2. DA IDONEIDADE DA GARANTIA OFERECIDA
A apólice a ser apresentada observa os requisitos legais e regulamentares
aplicáveis, notadamente: (i) importância segurada de {isValor}, correspondente
ao débito atualizado acrescido de 30% (trinta por cento); (ii) prazo de vigência
mínimo exigido para a modalidade; (iii) emissão por seguradora com registro
regular na SUSEP; (iv) apólice específica para este processo.

3. DA AUSÊNCIA DE PREJUÍZO AO CREDOR
O seguro garantia judicial é equiparado a dinheiro pela lei processual, de modo
que a substituição não acarreta prejuízo à satisfação do crédito, ao tempo que
preserva a atividade econômica da requerente — em linha com o princípio da menor
onerosidade da execução.

4. PEDIDO
Requer-se o deferimento da substituição / aceitação da garantia ofertada, com a
consequente liberação dos valores constritos, se houver.

Termos em que pede deferimento.

_______________, ____ de ______________ de ______.

[advogado — OAB]

--
MODELO DE APOIO gerado pelo Hub Lavoro. Revisar com o advogado do cliente antes
do protocolo. Não constitui parecer jurídico.`;

export function montarArgumento(args: {
  gatilho: string;
  empresaNome: string;
  cnpj: string;
  referencia: string;
  orgao: string | null;
  preco: Preco;
  params: Parametros;
}): string {
  const { gatilho, empresaNome, cnpj, referencia, orgao, preco, params } = args;
  const fund = FUNDAMENTO[gatilho] ?? "Base legal a definir conforme a modalidade.";
  const ehProcesso = /^\d/.test(referencia);

  const minuta = MINUTA
    .replace("{orgao}", (orgao ?? "VARA COMPETENTE").toUpperCase())
    .replace("{processo}", ehProcesso ? processoFmt(referencia) : referencia)
    .replace("{razaoSocial}", empresaNome.toUpperCase())
    .replace("{cnpj}", cnpjFmt(cnpj))
    .replace("{fundamento}", fund)
    .replace("{isValor}", brl(preco.importanciaSegurada));

  return [
    `### Argumento comercial — gatilho ${gatilho}`,
    "",
    `**Importância segurada necessária:** ${brl(preco.importanciaSegurada)}`,
    `**Faixa de prêmio de mercado:** ${brl(preco.premioMin)} a ${brl(preco.premioMax)} ` +
      `ao ano (taxa de ${pct(params.taxa_min, 2)} a ${pct(params.taxa_max, 2)}). ` +
      `Referência de ordem de grandeza — a taxa real varia por seguradora, prazo, ` +
      `limite de crédito e apetite, e a cotação é que manda.`,
    `**Comissão:** simular na tela com o percentual acordado com a seguradora. ` +
      `Não há percentual único que sirva para todas.`,
    "",
    "**Base legal:**",
    fund,
    "",
    "---",
    "### Minuta de apoio",
    "",
    "```",
    minuta,
    "```",
  ].join("\n");
}
