// Prazo lido do andamento, e a simulação de campo aberto.
//
// Estes dois testes existem por motivos opostos. O do prazo protege uma
// afirmação que vai para a tela como fato ("vence dia 20"); o da simulação
// protege o contrário — que nada seja afirmado quando o comercial não
// informou a taxa.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { analisar, analisarProcesso } from "../src/lib/ab/nlp.ts";
import { simular, prioridade, precificar, PARAMETROS_PADRAO } from "../src/lib/ab/pricing.ts";

// ---------------------------------------------------------------------
// PRAZO NO TEXTO
// ---------------------------------------------------------------------
test("prazo em algarismo", () => {
  assert.equal(analisar("Intime-se para, no prazo de 15 dias, indicar bens.").prazoDias, 15);
});

test("prazo com o número entre parênteses", () => {
  assert.equal(
    analisar("Concedo o prazo de 5 (cinco) dias para apresentar garantia.").prazoDias,
    5,
  );
});

test("prazo por extenso", () => {
  assert.equal(analisar("No prazo legal de quinze dias, manifeste-se.").prazoDias, 15);
});

test("prazo na forma 'N dias para apresentar'", () => {
  assert.equal(
    analisar("Fica o executado intimado a 30 dias para apresentar seguro garantia.").prazoDias,
    30,
  );
});

test("'cite-se para pagar em 5 dias' — a fórmula do art. 8º da LEF", () => {
  // Este é o caso que eu tinha deixado passar: o número vem DEPOIS do
  // verbo. Achei rodando o classificador contra os andamentos reais da
  // base, onde a execução fiscal usa exatamente esta redação.
  assert.equal(
    analisar(
      "Distribuída execução fiscal com base na CDA nº 80.6.26.000123-45, " +
      "no valor de R$ 4.820.000,00. Cite-se para pagar em 5 dias ou garantir a execução.",
    ).prazoDias,
    5,
  );
});

test("'em 15 dias, sob pena de penhora, garantir o juízo' — ordem inversa", () => {
  assert.equal(
    analisar("Intime-se para, em 15 dias, sob pena de penhora, garantir o juízo.").prazoDias,
    15,
  );
});

test("prazo não atravessa frase", () => {
  // "Aguarde-se em 30 dias." é uma determinação; "garantir o juízo" é
  // outra. Sem a barreira de pontuação, o prazo de uma viraria prazo da
  // outra — e a data na tela seria de um ato que não gera oportunidade.
  assert.equal(
    analisar("Aguarde-se em 30 dias. Após, intime-se a executada.").prazoDias,
    null,
  );
});

test("prazo improrrogável também conta", () => {
  assert.equal(analisar("prazo improrrogavel de 10 dias").prazoDias, 10);
});

test("sem prazo declarado devolve null, não um palpite", () => {
  assert.equal(analisar("Penhora deferida. Expeça-se mandado.").prazoDias, null);
});

test("prazo absurdo é recusado — não é prazo processual", () => {
  // 360 dias é parcelamento, prescrição ou vigência. Aceitar isso viraria
  // um vencimento de um ano na tela do comercial.
  assert.equal(analisar("parcelamento no prazo de 360 dias").prazoDias, null);
});

// ---------------------------------------------------------------------
// QUAL prazo vale, quando há vários
// ---------------------------------------------------------------------
test("vale o prazo do andamento mais recente que fala do assunto", () => {
  const a = analisarProcesso([
    { data: "2026-08-20", texto: "Penhora deferida. Prazo de 15 dias para substituir." },
    { data: "2024-01-10", texto: "Cite-se no prazo de 5 dias para pagar." },
  ]);
  assert.equal(a.prazoDias, 15);
  assert.equal(a.prazoBase, "2026-08-20");
});

test("prazo em andamento sem relação com garantia é ignorado", () => {
  // "Vista à parte pelo prazo de 10 dias" não é prazo de garantia. Se
  // entrasse, a data na tela seria de um ato que não gera oportunidade.
  const a = analisarProcesso([
    { data: "2026-08-20", texto: "Vista dos autos a parte contraria pelo prazo de 10 dias." },
    { data: "2026-07-01", texto: "Bloqueio de valores via SISBAJUD. Prazo de 5 dias." },
  ]);
  assert.equal(a.prazoDias, 5);
  assert.equal(a.prazoBase, "2026-07-01");
});

test("processo sem prazo nenhum deixa prazoBase nulo", () => {
  const a = analisarProcesso([{ data: "2026-08-20", texto: "Arresto determinado." }]);
  assert.equal(a.prazoDias, null);
  assert.equal(a.prazoBase, null);
});

// ---------------------------------------------------------------------
// SIMULAÇÃO
// ---------------------------------------------------------------------
test("sem taxa de comissão informada, comissão é zero — não há padrão a inventar", () => {
  const s = simular({ importanciaSegurada: 1_000_000, taxaPremio: 0.015 });
  assert.equal(s.premio, 15_000);
  assert.equal(s.comissao, 0);
});

test("comissão sai da taxa que o comercial digitou", () => {
  const s = simular({ importanciaSegurada: 1_000_000, taxaPremio: 0.015, taxaComissao: 0.175 });
  assert.equal(s.premio, 15_000);
  assert.equal(s.comissao, 2_625);
});

test("prêmio cotado pela seguradora ganha da taxa de referência", () => {
  const s = simular({
    importanciaSegurada: 1_000_000,
    taxaPremio: 0.015,
    premio: 22_000,
    taxaComissao: 0.2,
  });
  assert.equal(s.premio, 22_000);
  assert.equal(s.comissao, 4_400);
});

test("economia usa o valor imobilizado, não a IS com os 30% legais", () => {
  // O cliente imobilizaria o débito; os 30% são exigência da garantia, não
  // dinheiro que ele deixaria parado no juízo.
  const s = simular({
    importanciaSegurada: 1_300_000,
    valorImobilizado: 1_000_000,
    taxaPremio: 0.01,
    selicAa: 0.15,
  });
  assert.equal(s.premio, 13_000);
  assert.equal(s.economiaCliente, 150_000 - 13_000);
});

test("simulação nunca devolve número negativo", () => {
  const s = simular({ importanciaSegurada: 1_000, taxaPremio: 5, selicAa: 0.15 });
  assert.equal(s.economiaCliente, 0);
});

// ---------------------------------------------------------------------
// A TROCA DE PRÊMIO POR IS NÃO MUDA A FILA
//
// Este é o teste que sustenta a decisão. `taxa_ref` é um valor único, então
// prêmio = IS × constante. Ordenar por um ou por outro tem de dar a mesma
// fila; se um dia alguém tornar a taxa variável por modalidade, este teste
// avisa.
// ---------------------------------------------------------------------
test("ranquear por IS dá a mesma ordem que ranquear por prêmio", () => {
  const casos = [
    { valor: 487_042, mod: "JUDICIAL" as const },
    { valor: 6_266_000, mod: "FISCAL" as const },
    { valor: 290_155, mod: "JUDICIAL" as const },
    { valor: 40_000_000, mod: "PERFORMANCE" as const },
    { valor: 1_400_000, mod: "JUDICIAL" as const },
  ];
  const p = PARAMETROS_PADRAO;
  const linhas = casos.map((c) => {
    const preco = precificar(c.valor, c.mod, { params: p });
    return {
      porIs: prioridade(preco.importanciaSegurada, 0.7, 0.62, false, 0.9),
      porPremio: prioridade(preco.premioRef, 0.7, 0.62, false, 0.9),
    };
  });
  const ordemIs = [...linhas].sort((a, b) => b.porIs - a.porIs).map((l) => l.porIs);
  const ordemPremio = [...linhas].sort((a, b) => b.porPremio - a.porPremio).map((l) => l.porPremio);
  // as duas listas têm de estar na mesma posição relativa
  assert.deepEqual(
    ordemIs.map((v) => linhas.findIndex((l) => l.porIs === v)),
    ordemPremio.map((v) => linhas.findIndex((l) => l.porPremio === v)),
  );
});

test("lead bloqueado tem prioridade zero, venha por IS ou por prêmio", () => {
  assert.equal(prioridade(10_000_000, 1, 1, true, 1), 0);
});
