// =====================================================================
// Testes da lógica de negócio do módulo Análise Background.
//
// Rodar:  npx tsx --test tests/motor.test.ts
// Sem dependência nenhuma além do tsx — usa o test runner do Node.
//
// O teste que mais importa é o do classificador: é ele que substitui o
// campo "bloqueio judicial" que nenhum fornecedor vende. Sempre que
// alguém mexer no dicionário (src/lib/ab/nlp.ts ou na tabela ab_sinal),
// estes casos precisam continuar passando.
//
// ATENÇÃO AO CAMINHO DOS IMPORTS: eles apontam para `src/lib/ab/`, que é o
// código que roda em produção. Durante um tempo apontaram para
// `supabase/functions/_shared/`, cópia morta da versão Deno — e a suíte
// passou a testar arquivo que ninguém executa. Um teste verde sobre código
// morto é pior que teste nenhum: dá confiança sem dar cobertura. Foi assim
// que uma mudança em pricing.ts passou com 63 testes "passando".
// =====================================================================

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { analisar, analisarProcesso } from "../src/lib/ab/nlp.ts";
import {
  agregar, precificar, prioridade, probSubscricao, urgencia,
} from "../src/lib/ab/pricing.ts";
import { extrairExigenciaGarantia } from "../src/lib/ab/edital.ts";
import {
  brl, cnpjFmt, processoFmt, toNum,
} from "../src/lib/ab/format.ts";

// ---------------------------------------------------------------------
const CASOS_BLOQUEIO = [
  "Defiro a penhora de ativos financeiros. Expeça-se ordem via SISBAJUD.",
  "Cumprida a ordem de bloqueio. Valores tornados indisponíveis: R$ 84.320,11.",
  "Determino a penhora on line dos valores existentes em contas da executada.",
  "Deferido o arresto de bens da parte executada.",
  "Determinada a indisponibilidade de ativos financeiros até o limite do débito.",
  "Cumpra-se a ordem de bloqueio judicial das contas da ré.",
];

const CASOS_EXIGE_GARANTIA = [
  "Intime-se a executada para, no prazo de 15 dias, garantir o juízo, podendo apresentar seguro garantia judicial.",
  "Intime-se para prestar caução no valor de R$ 250.000,00.",
  "Apresente garantia no prazo legal, sob pena de penhora.",
];

const CASOS_RESOLVIDO = [
  "Defiro a substituição da penhora em dinheiro por seguro garantia judicial. Homologo a apólice apresentada e determino o levantamento da penhora.",
  "Deferido o desbloqueio de valores diante da carta de fiança aceita.",
  "Homologo o acordo. Extinção da execução.",
];

const CASOS_NEUTROS = [
  "Audiência inicial realizada. Ausente proposta de acordo.",
  "Juntada de petição pela parte autora. Vista à parte contrária.",
  "Redistribuído o feito por prevenção.",
  "Publicado o despacho de mero expediente.",
];

describe("classificador de andamentos", () => {
  it("detecta bloqueio de ativos em todas as formulações usuais", () => {
    for (const txt of CASOS_BLOQUEIO) {
      const a = analisar(txt);
      assert.ok(a.bloqueio, `não detectou bloqueio em: ${txt}`);
      assert.ok(a.confianca >= 0.85, `confiança baixa em: ${txt}`);
      assert.equal(a.fase, "EXECUCAO");
    }
  });

  it("detecta exigência de garantia", () => {
    for (const txt of CASOS_EXIGE_GARANTIA) {
      assert.ok(analisar(txt).exigeGarantia, `não detectou exigência em: ${txt}`);
    }
  });

  it("detecta garantia já prestada", () => {
    for (const txt of CASOS_RESOLVIDO) {
      assert.ok(analisar(txt).garantiaPrestada, `não detectou resolução em: ${txt}`);
    }
  });

  it("não gera falso positivo em movimentação neutra", () => {
    for (const txt of CASOS_NEUTROS) {
      const a = analisar(txt);
      assert.ok(!a.bloqueio && !a.exigeGarantia, `falso positivo em: ${txt}`);
    }
  });

  it("a ordem cronológica decide se ainda é lead", () => {
    const bloqueio = { tipo: "Decisão", texto: CASOS_BLOQUEIO[0], data: "2026-06-01" };
    const garantia = { tipo: "Decisão", texto: CASOS_RESOLVIDO[0], data: "2026-08-01" };

    // lista vem da mais recente para a mais antiga
    const resolvido = analisarProcesso([garantia, bloqueio]);
    assert.equal(resolvido.garantiaPrestada, true, "garantia recente deveria anular o lead");

    const reaberto = analisarProcesso([bloqueio, garantia]);
    assert.equal(reaberto.garantiaPrestada, false, "bloqueio recente deveria reabrir o lead");
    assert.equal(reaberto.bloqueio, true);
  });

  it("código TPU tem precedência sobre o texto", () => {
    const a = analisar("Movimento sem texto esclarecedor", "246");
    assert.ok(a.bloqueio);
    assert.ok(a.confianca >= 0.95);
  });

  it("extrai valores relevantes e descarta centavos de custas", () => {
    const a = analisar("Bloqueio de R$ 1.234.567,89 e custas de R$ 120,00");
    assert.equal(a.valorMaximo, 1_234_567.89);
    assert.ok(!a.valores.includes(120));
  });

  it("ignora texto vazio sem quebrar", () => {
    for (const v of [null, undefined, "", "   "]) {
      const a = analisar(v as string | null);
      assert.equal(a.sinais.length, 0);
      assert.equal(a.confianca, 0);
    }
  });
});


// --- sentença condenatória: plural e formas reais dos TRTs ------------
// O padrão original exigia fronteira de palavra depois de "procedente",
// então "julgo procedentes os pedidos" (plural, a forma mais comum) NÃO
// casava. Falso negativo silencioso no gatilho T2.
const SENTENCAS_QUE_CASAM = [
  "Julgo parcialmente procedentes os pedidos e condeno a reclamada ao pagamento de R$ 487.042,00",
  "Julgo procedente o pedido e condeno a ré ao pagamento das verbas rescisórias.",
  "JULGO PROCEDENTES EM PARTE os pedidos formulados na inicial.",
  "Acolho parcialmente os pedidos.",
  "Condenada a ré ao pagamento de honorários e verbas.",
  "Sentença de procedência parcial.",
];
const SENTENCAS_QUE_NAO_CASAM = [
  "Julgo improcedentes os pedidos e extingo o feito.",
  "Julgo IMPROCEDENTE a reclamação.",
  "Sem condenação em honorários sucumbenciais.",
  "Isento a parte de condenação em custas.",
  "Nego provimento ao recurso.",
];

describe("sentença condenatória (gatilho T2)", () => {
  it("reconhece plural e as formas usuais", () => {
    for (const txt of SENTENCAS_QUE_CASAM) {
      const a = analisar(txt);
      assert.ok(
        a.sinais.includes("SENTENCA_CONDENATORIA"),
        `não detectou sentença condenatória em: ${txt}`,
      );
      assert.equal(a.fase, "RECURSAL");
    }
  });

  it("não confunde improcedência nem ausência de condenação", () => {
    for (const txt of SENTENCAS_QUE_NAO_CASAM) {
      const a = analisar(txt);
      assert.ok(
        !a.sinais.includes("SENTENCA_CONDENATORIA"),
        `falso positivo de sentença condenatória em: ${txt}`,
      );
    }
  });

  it("extrai o valor da condenação para dimensionar a IS", () => {
    const a = analisar(SENTENCAS_QUE_CASAM[0]);
    assert.equal(a.valorMaximo, 487_042);
  });
});

// ---------------------------------------------------------------------
describe("precificação", () => {
  it("IS judicial tem acréscimo de 30% (CPC 835 §2º)", () => {
    const p = precificar(1_000_000, "JUDICIAL");
    assert.equal(p.importanciaSegurada, 1_300_000);
    assert.ok(p.premioMin < p.premioRef && p.premioRef < p.premioMax);
  });

  it("IS de performance é 5% do contrato (art. 98)", () => {
    assert.equal(precificar(10_000_000, "PERFORMANCE").importanciaSegurada, 500_000);
  });

  it("obra de grande vulto usa 30% (art. 99)", () => {
    const p = precificar(300_000_000, "PERFORMANCE", { grandeVulto: true });
    assert.equal(p.importanciaSegurada, 90_000_000);
  });

  it("licitação usa 1% do valor estimado (art. 58)", () => {
    const p = precificar(20_000_000, "LICITACAO", { fatorIs: 0.01 });
    assert.equal(p.importanciaSegurada, 200_000);
  });

  it("agregação fiscal não conta o mesmo débito duas vezes", () => {
    // dívida ativa e a execução fiscal que a cobra são o MESMO crédito
    assert.equal(agregar([28_400_000, 28_400_000], "FISCAL"), 28_400_000);
    // já em judicial, processos distintos somam
    assert.equal(agregar([1_000, 2_000], "JUDICIAL"), 3_000);
  });

  it("urgência decai em prazo muito vencido", () => {
    const hoje = new Date("2026-08-21T12:00:00Z");
    assert.equal(urgencia("2026-08-21", hoje), 1.0);
    assert.equal(urgencia("2026-08-26", hoje), 0.95);
    assert.equal(urgencia("2026-01-15", hoje), 0.3);
    assert.equal(urgencia(null, hoje), 0.45);
  });

  it("filtro negativo zera a prioridade", () => {
    assert.equal(prioridade(100_000, 1, 0.9, true), 0);
    assert.ok(prioridade(100_000, 1, 0.9, false) > 0);
  });

  it("probabilidade de subscrição penaliza sanção e recuperação judicial", () => {
    const base = {
      porte: "DEMAIS", capitalSocial: 10_000_000,
      situacaoCadastral: "ATIVA", cnaePrioritario: true,
    };
    const limpa = probSubscricao({ ...base, restritivos: [] });
    const sancionada = probSubscricao({ ...base, restritivos: ["CEIS"] });
    const emRj = probSubscricao({ ...base, restritivos: ["RJ"] });
    assert.ok(limpa > sancionada, "sanção deveria reduzir");
    assert.ok(sancionada > emRj, "RJ deveria reduzir mais que sanção");
    assert.ok(emRj >= 0.03 && limpa <= 0.97, "deve ficar dentro dos limites");
  });
});

// ---------------------------------------------------------------------
describe("extrator de edital", () => {
  it("lê garantia de proposta de 1% (art. 58)", () => {
    const ex = extrairExigenciaGarantia(
      "Será exigida garantia de participação correspondente a 1% do valor estimado da " +
      "contratação, nos termos do art. 58 da Lei 14.133/2021.",
    );
    assert.ok(ex.proposta);
    assert.equal(ex.percentual, 0.01);
    assert.ok(ex.trecho && ex.trecho.length > 10);
  });

  it("lê garantia contratual de 10% com cláusula de retomada", () => {
    const ex = extrairExigenciaGarantia(
      "Exigir-se-á seguro-garantia com cláusula de retomada no percentual de 10% do valor " +
      "do contrato.",
    );
    assert.ok(ex.contratual);
    assert.equal(ex.percentual, 0.10);
  });

  it("não inventa exigência onde não há", () => {
    const ex = extrairExigenciaGarantia("Registro de preços para aquisição de canetas.");
    assert.equal(ex.proposta, false);
    assert.equal(ex.contratual, false);
    assert.equal(ex.percentual, null);
  });
});

// ---------------------------------------------------------------------
describe("formatação", () => {
  it("moeda em pt-BR", () => {
    assert.equal(brl(1_234_567.891), "R$ 1.234.567,89");
    assert.equal(brl(0), "R$ 0,00");
    assert.equal(brl(-500), "-R$ 500,00");
    assert.equal(brl(null), "R$ 0,00");
  });

  it("CNPJ e número CNJ", () => {
    assert.equal(cnpjFmt("11035301000177"), "11.035.301/0001-77");
    assert.equal(processoFmt("10023283620255020386"), "1002328-36.2025.5.02.0386");
    assert.equal(processoFmt("123"), "123");
  });

  it("parse de número aceita formato brasileiro e americano", () => {
    assert.equal(toNum("1.234.567,89"), 1_234_567.89);
    assert.equal(toNum("1234567.89"), 1_234_567.89);
    assert.equal(toNum("R$ 1.500,00"), 1500);
    assert.equal(toNum(""), 0);
    assert.equal(toNum(null), 0);
  });
});

// ---------------------------------------------------------------------
// A confiança como fator da prioridade.
//
// Isto começou como um erro meu: a confiança existia por evento mas não
// chegava à prioridade. Para uma fila de VENDAS o efeito era o avesso do
// certo — uma hipótese com prêmio maior ficava na frente de um fato com
// prêmio menor, e o time gastava a primeira ligação do dia no lead mais
// incerto.
// ---------------------------------------------------------------------
describe("confiança pesa na ordem da fila", () => {
  it("fato com prêmio menor passa à frente de hipótese com prêmio maior", () => {
    // T9: contrato público assinado — garantia contratual é FACULTATIVA
    // (Lei 14.133/2021, art. 96), então é hipótese
    const hipotese = prioridade(1_500, 1, 0.62, false, 0.55);
    // T4: penhora encontrada no texto do andamento — é fato
    const fato = prioridade(1_200, 1, 0.62, false, 0.95);
    assert.ok(fato > hipotese, `fato ${fato} deveria vir antes de hipótese ${hipotese}`);
  });

  it("sem confiança informada, nada muda (retrocompatível)", () => {
    assert.equal(prioridade(100_000, 1, 0.9, false), prioridade(100_000, 1, 0.9, false, 1));
  });

  it("é proporcional e limitada a [0,1]", () => {
    const cheia = prioridade(1_000, 1, 1, false, 1);
    assert.equal(prioridade(1_000, 1, 1, false, 0.5), cheia / 2);
    assert.equal(prioridade(1_000, 1, 1, false, 5), cheia, "acima de 1 satura");
    assert.equal(prioridade(1_000, 1, 1, false, -2), 0, "abaixo de 0 satura");
  });

  it("filtro negativo continua zerando, mesmo com confiança máxima", () => {
    assert.equal(prioridade(100_000, 1, 0.9, true, 1), 0);
  });
});
