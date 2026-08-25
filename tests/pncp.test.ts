// =====================================================================
// Testes do controle de orçamento da ingestão do PNCP.
//
// Rodar:  npx tsx --test tests/pncp.test.ts
//
// O que está sendo protegido aqui não é a leitura do PNCP — é a decisão
// de PARAR. O runtime é Cloudflare Workers: se a rotina insistir em
// paginar, a borda derruba a resposta e a ingestão morre sem registrar
// onde parou. Estes testes garantem que ela desiste na hora certa e que
// uma página grande demais é refeita menor antes de virar erro.
// =====================================================================

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  buscarPagina, classificarFalha, criarPrazo, deslocamento, ehAbort,
  ehRateLimit, esperaSugerida, mesmoTrecho,
} from "../src/lib/ab/orcamento.ts";

// ---------------------------------------------------------------------
describe("prazo da rotina", () => {
  it("com orçamento cheio, o teto do fetch é 20 s", () => {
    const p = criarPrazo(45_000);
    assert.equal(p.timeoutParaFetch(), 20_000);
    assert.equal(p.cabeOutraPagina(), true);
  });

  it("reserva tempo para gravar no banco", () => {
    // 20 s restantes − 8 s de reserva = 12 s para o fetch
    const p = criarPrazo(20_000);
    assert.equal(p.timeoutParaFetch(), 12_000);
  });

  it("nega outra página quando não cabe fetch + gravação", () => {
    // precisa de mais de 8 s (reserva) + 6 s (mínimo por página)
    assert.equal(criarPrazo(15_000).cabeOutraPagina(), true);
    assert.equal(criarPrazo(14_000).cabeOutraPagina(), false);
    assert.equal(criarPrazo(3_000).cabeOutraPagina(), false);
  });

  it("nunca devolve timeout negativo", () => {
    assert.ok(criarPrazo(1_000).timeoutParaFetch() >= 6_000);
    assert.ok(criarPrazo(0).timeoutParaFetch() >= 6_000);
  });
});

// ---------------------------------------------------------------------
describe("classificação de erro", () => {
  it("reconhece abort em todas as formas que o runtime usa", () => {
    const comNome = new Error("qualquer coisa");
    comNome.name = "AbortError";
    assert.ok(ehAbort(comNome), "name = AbortError");

    const porTimeout = new Error("qualquer coisa");
    porTimeout.name = "TimeoutError";
    assert.ok(ehAbort(porTimeout), "name = TimeoutError");

    // esta é a mensagem exata que o PNCP produziu no smoke test
    assert.ok(ehAbort(new Error("This operation was aborted")), "aborted");
    // e as três grafias de timeout que aparecem na prática
    assert.ok(ehAbort(new Error("The operation timed out")), "timed out");
    assert.ok(ehAbort(new Error("Request timeout")), "timeout");
    assert.ok(ehAbort(new Error("socket time out")), "time out");
  });

  it("enxerga o motivo real embrulhado pelo undici em `cause`", () => {
    // o fetch do Node devolve "fetch failed" por fora e o motivo em cause
    const fora = new Error("fetch failed") as Error & { cause?: unknown };
    fora.cause = Object.assign(new Error("Connect Timeout Error"), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    });
    assert.ok(ehAbort(fora), "cause com código de timeout do undici");

    const outro = new Error("fetch failed") as Error & { cause?: unknown };
    outro.cause = Object.assign(new Error("getaddrinfo ENOTFOUND pncp.gov.br"), {
      code: "ENOTFOUND",
    });
    assert.ok(!ehAbort(outro), "DNS não é lentidão — não vale repetir menor");
  });

  it("não confunde erro de negócio com abort", () => {
    assert.ok(!ehAbort(new Error("HTTP 400 — dataFinal é obrigatório")));
    assert.ok(!ehAbort(new Error("Unexpected token < in JSON")));
    assert.ok(!ehAbort(null));
  });
});

// ---------------------------------------------------------------------
/** Substitui o fetch global e devolve as URLs pedidas, em ordem. */
function comFetchFalso(
  responder: (url: string, tentativa: number) => Promise<Response>,
): { urls: string[]; restaurar: () => void } {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = String(entrada);
    urls.push(url);
    return responder(url, urls.length);
  }) as typeof fetch;
  return { urls, restaurar: () => { globalThis.fetch = original; } };
}

const ok = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status: 200 });

const abortou = () => {
  const e = new Error("This operation was aborted");
  e.name = "AbortError";
  return Promise.reject(e);
};

const tamanhoDaUrl = (u: string) => Number(new URL(u).searchParams.get("tamanhoPagina"));
const paginaDaUrl = (u: string) => Number(new URL(u).searchParams.get("pagina"));
const url = (p: { pagina: number; tamanho: number }) =>
  `https://x/?pagina=${p.pagina}&tamanhoPagina=${p.tamanho}`;

describe("buscarPagina", () => {
  it("devolve o envelope e o tamanho usado quando dá certo", async () => {
    const f = comFetchFalso(() => Promise.resolve(ok({ data: [{ a: 1 }], totalPaginas: 3 })));
    try {
      const r = await buscarPagina<{ a: number }>(
        url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000),
      );
      assert.equal(r.env?.totalPaginas, 3);
      assert.equal(r.usado.tamanho, 100);
      assert.equal(f.urls.length, 1);
    } finally { f.restaurar(); }
  });

  it("em abort, refaz a MESMA página com metade do tamanho", async () => {
    const f = comFetchFalso((_u, n) =>
      n === 1 ? abortou() : Promise.resolve(ok({ data: [], totalPaginas: 1 })));
    try {
      const r = await buscarPagina(url, { pagina: 7, tamanho: 100 }, criarPrazo(45_000));
      assert.equal(f.urls.length, 2);
      assert.equal(tamanhoDaUrl(f.urls[0]), 100);
      assert.equal(tamanhoDaUrl(f.urls[1]), 50, "deveria ter caído para metade");
      // e o TRECHO tem de ser o mesmo: página 7 de 100 = registros 601–700,
      // que com tamanho 50 é a página 13 — não a 7
      assert.equal(paginaDaUrl(f.urls[0]), 7);
      assert.equal(paginaDaUrl(f.urls[1]), 13, "o deslocamento tem de ser preservado");
      assert.equal(r.usado.pagina, 13);
      assert.equal(r.usado.tamanho, 50);
    } finally { f.restaurar(); }
  });

  it("desiste depois de uma tentativa e diz o tamanho e o limite", async () => {
    const f = comFetchFalso(() => abortou());
    try {
      await assert.rejects(
        buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000)),
        (e: Error) => {
          assert.match(e.message, /aborted/i);
          assert.match(e.message, /tamanhoPagina=50/);
          assert.match(e.message, /limite=\d+ms/);
          return true;
        },
      );
      assert.equal(f.urls.length, 2, "duas tentativas, não mais");
    } finally { f.restaurar(); }
  });

  it("não insiste em erro de negócio — 400 falha de primeira", async () => {
    const f = comFetchFalso(() =>
      Promise.resolve(new Response("dataFinal é obrigatório", { status: 400 })));
    try {
      await assert.rejects(
        buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000)),
        /HTTP 400/,
      );
      assert.equal(f.urls.length, 1, "400 não é para repetir");
    } finally { f.restaurar(); }
  });

  it("não desce abaixo do tamanho mínimo", async () => {
    const f = comFetchFalso(() => abortou());
    try {
      await assert.rejects(
        buscarPagina(url, { pagina: 1, tamanho: 25 }, criarPrazo(45_000)),
        /tamanhoPagina=25/,
      );
      assert.equal(f.urls.length, 1, "já no mínimo, não vale repetir");
    } finally { f.restaurar(); }
  });

  it("204 sem corpo não quebra", async () => {
    const f = comFetchFalso(() => Promise.resolve(new Response(null, { status: 204 })));
    try {
      const r = await buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000));
      assert.equal(r.env, null);
    } finally { f.restaurar(); }
  });
});

// ---------------------------------------------------------------------
// Limite de taxa. O PNCP devolve 429 com facilidade — duas rodadas
// seguidas bastam. Página menor NÃO resolve limite de taxa, então o
// comportamento certo é parar, não insistir: insistir renova a punição e
// queima a janela da próxima execução.
// ---------------------------------------------------------------------
const res429 = (headers: Record<string, string> = {}) =>
  new Response("Too Many Requests", { status: 429, headers });

describe("limite de taxa (429)", () => {
  it("reconhece 429 por status e por mensagem", () => {
    assert.ok(ehRateLimit(Object.assign(new Error("x"), { status: 429 })));
    assert.ok(ehRateLimit(new Error("HTTP 429 — Too Many Requests")));
    assert.ok(ehRateLimit(new Error("too many requests")));
    assert.ok(!ehRateLimit(new Error("HTTP 500")));
    assert.ok(!ehRateLimit(new Error("This operation was aborted")));
  });

  it("429 NÃO é tratado como abort — não se resolve com página menor", () => {
    assert.ok(!ehAbort(Object.assign(new Error("HTTP 429"), { status: 429 })));
  });

  it("falha de primeira em 429, sem tentar página menor", async () => {
    const f = comFetchFalso(() => Promise.resolve(res429()));
    try {
      await assert.rejects(
        buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000)),
        /HTTP 429/,
      );
      assert.equal(f.urls.length, 1, "insistir em 429 só renova a punição");
    } finally { f.restaurar(); }
  });

  it("preserva o Retry-After ao reembrulhar o erro", async () => {
    // o reembrulho acrescenta contexto à mensagem; se perdesse as
    // propriedades, o back-off cairia no padrão e a rotina voltaria cedo
    const f = comFetchFalso(() => Promise.resolve(res429({ "retry-after": "240" })));
    try {
      await buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000));
      assert.fail("deveria ter rejeitado");
    } catch (err) {
      assert.ok(ehRateLimit(err));
      assert.equal(esperaSugerida(err), 240, "Retry-After em segundos");
      assert.match((err as Error).message, /tamanhoPagina=100/);
    } finally { f.restaurar(); }
  });

  it("aceita Retry-After como data HTTP", async () => {
    const daqui90s = new Date(Date.now() + 90_000).toUTCString();
    const f = comFetchFalso(() => Promise.resolve(res429({ "retry-after": daqui90s })));
    try {
      await buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000));
      assert.fail("deveria ter rejeitado");
    } catch (err) {
      const seg = esperaSugerida(err);
      assert.ok(seg >= 80 && seg <= 95, `esperado ~90s, veio ${seg}`);
    } finally { f.restaurar(); }
  });

  it("sem Retry-After, cai num padrão conservador", async () => {
    const f = comFetchFalso(() => Promise.resolve(res429()));
    try {
      await buscarPagina(url, { pagina: 1, tamanho: 100 }, criarPrazo(45_000));
      assert.fail("deveria ter rejeitado");
    } catch (err) {
      assert.equal(esperaSugerida(err), 180);
    } finally { f.restaurar(); }
  });
});

// ---------------------------------------------------------------------
// Preservação do deslocamento — o bug mais perigoso desta rotina.
//
// Encolher a página mantendo o NÚMERO da página muda o trecho lido: com
// tamanho 100 a página 11 são os registros 1001–1100; com tamanho 50, são
// os 501–550, já lidos. O trecho que faltava nunca era buscado, e a
// varredura ficava com um buraco que nada denunciava — nem erro, nem log.
// ---------------------------------------------------------------------
describe("preservação do trecho ao encolher a página", () => {
  it("deslocamento é (pagina-1) × tamanho", () => {
    assert.equal(deslocamento({ pagina: 1, tamanho: 100 }), 0);
    assert.equal(deslocamento({ pagina: 11, tamanho: 100 }), 1000);
    assert.equal(deslocamento({ pagina: 118, tamanho: 100 }), 11_700);
  });

  it("o caso real: página 11 de 100 vira página 21 de 50", () => {
    const base = { pagina: 11, tamanho: 100 };
    const menor = mesmoTrecho(base, 50);
    assert.equal(menor.pagina, 21);
    assert.equal(menor.tamanho, 50);
    assert.equal(deslocamento(menor), deslocamento(base), "mesmo ponto de partida");
  });

  it("encolhimentos sucessivos continuam no mesmo ponto", () => {
    let p = { pagina: 11, tamanho: 100 };
    const alvo = deslocamento(p);
    for (const t of [50, 25]) {
      p = mesmoTrecho(p, t);
      assert.equal(deslocamento(p), alvo, `perdeu o ponto ao cair para ${t}`);
    }
    assert.deepEqual(p, { pagina: 41, tamanho: 25 });
  });

  it("a primeira página é imune — deslocamento zero", () => {
    assert.deepEqual(mesmoTrecho({ pagina: 1, tamanho: 100 }, 50), { pagina: 1, tamanho: 50 });
  });

  it("mensagem de erro diz o registro, não só a página", async () => {
    // "abortou na página 11" é ambíguo quando o tamanho variou; o número do
    // registro é o que identifica o trecho sem ambiguidade
    const f = comFetchFalso(() => abortou());
    try {
      await buscarPagina(url, { pagina: 11, tamanho: 100 }, criarPrazo(45_000));
      assert.fail("deveria ter rejeitado");
    } catch (err) {
      assert.match((err as Error).message, /pagina=21/);
      assert.match((err as Error).message, /registro=1001/);
    } finally { f.restaurar(); }
  });
});

// ---------------------------------------------------------------------
// "Esta página é ruim" vs. "a fonte caiu".
//
// Nasceu de um episódio real: o PNCP degradou inteiro no meio da tarde e o
// teto de tentativas passou a trabalhar contra nós — marcava página após
// página como abandonada, andando o cursor por uma janela que nunca foi
// lida. Em algumas horas de cron horário a rotina teria "concluído" a
// varredura sem ter lido nada, com ciclos+1 e o log arrumado.
//
// A regra: só é possível culpar a página se ALGUMA página tiver sido lida
// recentemente. Esperar é reversível; andar o cursor não é.
// ---------------------------------------------------------------------
const agora = new Date("2026-08-25T18:00:00Z");
const hMenos = (h: number) => new Date(agora.getTime() - h * 3_600_000).toISOString();

describe("falha de página vs. fonte fora do ar", () => {
  it("fonte lida há pouco: conta as tentativas e pula no teto", () => {
    const base = { teto: 3, leituraOkEm: hMenos(0.5), agora };
    assert.equal(classificarFalha({ ...base, falhas: 1 }), "tentar_de_novo");
    assert.equal(classificarFalha({ ...base, falhas: 2 }), "tentar_de_novo");
    assert.equal(classificarFalha({ ...base, falhas: 3 }), "pular_pagina");
    assert.equal(classificarFalha({ ...base, falhas: 9 }), "pular_pagina");
  });

  it("sem leitura recente, NUNCA pula — é a fonte, não a página", () => {
    for (const falhas of [1, 3, 50]) {
      assert.equal(
        classificarFalha({ falhas, teto: 3, leituraOkEm: hMenos(9), agora }),
        "fonte_indisponivel",
        `com ${falhas} falhas e leitura de 9h atrás, não pode pular`,
      );
    }
  });

  it("fonte nunca lida também não autoriza pular", () => {
    // primeira execução da vida: se a página 1 falha, esperar é seguro;
    // andar o cursor seria varrer no escuro
    assert.equal(
      classificarFalha({ falhas: 5, teto: 3, leituraOkEm: null, agora }),
      "fonte_indisponivel",
    );
  });

  it("a fronteira da janela é respeitada", () => {
    const args = { falhas: 3, teto: 3, agora, janelaHoras: 6 };
    assert.equal(classificarFalha({ ...args, leituraOkEm: hMenos(5.9) }), "pular_pagina");
    assert.equal(classificarFalha({ ...args, leituraOkEm: hMenos(6.1) }), "fonte_indisponivel");
  });

  it("reproduz o episódio: 10 páginas lidas, depois a fonte cai", () => {
    // 14:57 — leu 10 páginas; 15:36 em diante — tudo falha
    const durante = classificarFalha({ falhas: 3, teto: 3, leituraOkEm: hMenos(2.5), agora });
    assert.equal(durante, "pular_pagina", "com leitura de 2,5h atrás ainda se culpa a página");
    // horas depois, sem nenhuma leitura nova, o diagnóstico muda
    const depois = classificarFalha({ falhas: 3, teto: 3, leituraOkEm: hMenos(7), agora });
    assert.equal(depois, "fonte_indisponivel", "sem leitura há 7h, é a fonte");
  });
});
