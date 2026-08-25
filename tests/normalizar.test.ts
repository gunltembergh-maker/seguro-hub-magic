// =====================================================================
// Testes dos normalizadores de payload de bureau.
//
// Rodar:  npx tsx --test tests/normalizar.test.ts
//
// Por que isto merece teste: um erro de nome de campo aqui não quebra
// nada — ele produz número errado. Valor de execução lido do campo
// trocado vira importância segurada errada, que vira prêmio errado, que
// vira uma ligação para o cliente com a proposta errada. Falha silenciosa
// e caríssima.
// =====================================================================

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  deDigesto, deEscavador, deJudit, normalizarPayload,
} from "../src/lib/ab/normalizar.ts";

const CNPJ = "11035301000177";
const NUMERO = "10023283620255020386"; // 20 dígitos, padrão CNJ

// ---------------------------------------------------------------------
describe("normalizador Judit", () => {
  const payload = {
    code: "1002328-36.2025.5.02.0386",
    area: "trabalhista",
    tribunal_acronym: "TRT2",
    state: "SP",
    judging_body: "86ª Vara do Trabalho de São Paulo",
    classification: "Cumprimento de Sentença",
    classification_code: "156",
    status: "Em execução",
    distribution_date: "2025-03-14T00:00:00Z",
    amount: 1_844_427.04,
    execution_amount: 2_100_000,
    subjects: ["Verbas rescisórias", { name: "Horas extras" }],
    parties: [
      { name: "JOSE DA SILVA", main_document: "12345678901", side: "ACTIVE" },
      { name: "DEMO CONSTRUTORA LTDA", main_document: "11.035.301/0001-77", side: "PASSIVE" },
    ],
    steps: [
      { step_date: "2026-06-02", step_type: "Decisão", step_code: "246",
        content: "Defiro a penhora de ativos financeiros via SISBAJUD." },
      { step_date: "2026-06-10", step_type: "Ato ordinatório", content: "Vista às partes." },
    ],
  };

  it("identifica o polo da parte consultada, não da primeira", () => {
    const p = deJudit(payload, CNPJ);
    assert.equal(p.polo, "PASSIVO", "o CNPJ consultado é o executado");
    assert.equal(p.razao_social, "DEMO CONSTRUTORA LTDA");
  });

  it("lê valor da causa e valor da execução em campos distintos", () => {
    const p = deJudit(payload, CNPJ);
    assert.equal(p.valor_causa, 1_844_427.04);
    assert.equal(p.valor_execucao, 2_100_000);
  });

  it("normaliza número, data e assuntos mistos", () => {
    const p = deJudit(payload, CNPJ);
    assert.equal(p.numero, NUMERO);
    assert.equal(p.distribuicao, "2025-03-14");
    assert.deepEqual(p.assuntos, ["Verbas rescisórias", "Horas extras"]);
  });

  it("preserva o texto do andamento — é o insumo do classificador", () => {
    const p = deJudit(payload, CNPJ);
    assert.equal(p.movimentacoes.length, 2);
    assert.match(p.movimentacoes[0].texto!, /SISBAJUD/);
    assert.equal(p.movimentacoes[0].codigo_tpu, "246");
    assert.equal(p.movimentacoes[1].codigo_tpu, null);
  });

  it("sem parte identificada, presume PASSIVO", () => {
    // quem precisa de garantia é quem está sendo executado; presumir ATIVO
    // esconderia o lead
    const p = deJudit({ ...payload, parties: [] }, CNPJ);
    assert.equal(p.polo, "PASSIVO");
  });
});

// ---------------------------------------------------------------------
describe("normalizador Digesto", () => {
  it("junta o texto do anexo ao do andamento", () => {
    // é o diferencial do fornecedor: a decisão de penhora costuma estar no
    // PDF, não na ementa
    const p = deDigesto({
      numero: "1002328-36.2025.5.02.0386",
      documento: CNPJ,
      nome: "DEMO CONSTRUTORA LTDA",
      polo: "EXECUTADO",
      valor: 500_000,
      movs: [
        { data: "2026-06-02", tipo: "Decisão", codigo: "246",
          texto: "Decisão proferida", anexoTexto: "Determino a penhora on line dos valores." },
        { data: "2026-06-03", tipo: "Juntada", texto: "Petição juntada" },
      ],
    }, CNPJ);

    assert.equal(p.polo, "PASSIVO", "EXECUTADO tem de virar PASSIVO");
    assert.equal(p.movimentacoes[0].texto, "Decisão proferida\nDetermino a penhora on line dos valores.");
    assert.equal(p.movimentacoes[1].texto, "Petição juntada");
  });

  it("andamento sem texto nenhum vira null, não string vazia", () => {
    const p = deDigesto({
      numero: NUMERO, documento: CNPJ,
      movs: [{ data: "2026-01-01", tipo: "X" }],
    }, CNPJ);
    assert.equal(p.movimentacoes[0].texto, null);
  });
});

// ---------------------------------------------------------------------
describe("normalizador Escavador", () => {
  it("lê a capa da fonte principal", () => {
    const p = deEscavador({
      numero_cnj: "1002328-36.2025.5.02.0386",
      estado_origem: { sigla: "SP" },
      data_inicio: "2025-03-14",
      fontes: [{
        sigla_tribunal: "TRT2",
        capa: {
          area: "Trabalho",
          orgao_julgador: "86ª VT de São Paulo",
          classe: "Execução",
          situacao: "Ativo",
          valor_causa: { valor: 750_000 },
          assuntos: ["Rescisão", { titulo: "FGTS" }],
        },
        movimentacoes: [
          { data: "2026-06-02", tipo: "Decisão", conteudo: "Deferido o arresto de bens." },
        ],
      }],
    }, CNPJ);

    assert.equal(p.numero, NUMERO);
    assert.equal(p.tribunal, "TRT2");
    assert.equal(p.uf, "SP");
    assert.equal(p.area, "TRABALHO");
    assert.equal(p.valor_causa, 750_000);
    assert.deepEqual(p.assuntos, ["Rescisão", "FGTS"]);
    assert.match(p.movimentacoes[0].texto!, /arresto/);
  });
});

// ---------------------------------------------------------------------
describe("normalizarPayload", () => {
  const bom = {
    code: "1002328-36.2025.5.02.0386",
    parties: [{ name: "X", main_document: CNPJ, side: "PASSIVE" }],
    steps: [],
  };

  it("aceita os envelopes que os fornecedores usam", () => {
    for (const env of [
      { search_key: CNPJ, lawsuits: [bom] },
      { search_key: CNPJ, response_data: [bom] },
      { search_key: CNPJ, page_data: [bom] },
      { documento: CNPJ, processos: [bom] },
      { document: CNPJ, data: [bom] },
      { search_key: CNPJ, items: [bom] },
      { search_key: CNPJ, lawsuit: bom },
    ]) {
      const r = normalizarPayload(env, "judit");
      assert.equal(r.length, 1, `envelope não reconhecido: ${Object.keys(env).join(",")}`);
      assert.equal(r[0].documento, CNPJ);
    }
  });

  it("aceita array cru no corpo", () => {
    assert.equal(normalizarPayload([{ ...bom }], "judit").length, 1);
  });

  it("descarta lixo sem quebrar", () => {
    for (const env of [null, undefined, {}, { lawsuits: [] }, { lawsuits: [{}] }]) {
      assert.equal(normalizarPayload(env, "judit").length, 0);
    }
  });

  it("descarta número curto demais, mas aceita numeração pré-CNJ", () => {
    // 20 dígitos é o padrão CNJ; execução trabalhista antiga ainda circula
    // com numeração mais curta, e exigir 20 perderia processo real
    const curto = { ...bom, code: "123456" };
    assert.equal(normalizarPayload({ search_key: CNPJ, lawsuits: [curto] }, "judit").length, 0);

    const antigo = { ...bom, code: "003874320105020" }; // 15 dígitos
    assert.equal(normalizarPayload({ search_key: CNPJ, lawsuits: [antigo] }, "judit").length, 1);
  });

  it("aceita CPF (11) e CNPJ (14), e rejeita o resto", () => {
    const comCpf = { ...bom, parties: [{ main_document: "12345678901", side: "PASSIVE" }] };
    assert.equal(normalizarPayload({ search_key: "12345678901", lawsuits: [comCpf] }, "judit").length, 1);

    const truncado = { ...bom, parties: [{ main_document: "1234", side: "PASSIVE" }] };
    assert.equal(normalizarPayload({ search_key: "1234", lawsuits: [truncado] }, "judit").length, 0);
  });

  it("provedor desconhecido cai no normalizador da Judit em vez de quebrar", () => {
    const r = normalizarPayload({ search_key: CNPJ, lawsuits: [bom] }, "fornecedor-que-nao-existe");
    assert.equal(r.length, 1);
  });
});
