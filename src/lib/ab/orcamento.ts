// =====================================================================
// Controle de orçamento de tempo para as ingestões.
//
// O runtime do Hub é Cloudflare Workers: ~30 s de CPU por requisição e a
// borda derrubando a resposta perto de 60 s. Fonte pública brasileira é
// lenta e volumosa — o PNCP devolve ~9 mil contratos por dia, e o
// endpoint de propostas abertas não tem piso de data.
//
// A tentação é subir o timeout do fetch. Não resolve: um fetch de 30 s
// consome o orçamento inteiro, e a rotina morre no meio sem registrar
// onde parou. O que resolve é a rotina saber a hora de DESISTIR, gravar o
// que já leu e devolver o ponto de retomada para a próxima execução.
//
// Sem dependência de banco de propósito: é isto que os testes exercitam.
// =====================================================================

/** Margem reservada para gravar no banco depois de parar de paginar. */
export const RESERVA_GRAVACAO_MS = 8_000;
/** Abaixo disto não vale começar outra página. */
export const MINIMO_POR_PAGINA_MS = 6_000;
/** Nenhum fetch individual passa disto, mesmo com orçamento sobrando. */
export const TETO_FETCH_MS = 20_000;
/** Piso do encolhimento de página. */
export const TAMANHO_MINIMO = 25;

export interface Prazo {
  restanteMs: () => number;
  cabeOutraPagina: () => boolean;
  timeoutParaFetch: () => number;
}

/** Prazo compartilhado por toda a rotina. */
export function criarPrazo(orcamentoMs: number): Prazo {
  const fim = Date.now() + orcamentoMs;
  return {
    restanteMs: () => fim - Date.now(),
    cabeOutraPagina: () => fim - Date.now() > RESERVA_GRAVACAO_MS + MINIMO_POR_PAGINA_MS,
    timeoutParaFetch: () =>
      Math.max(
        MINIMO_POR_PAGINA_MS,
        Math.min(TETO_FETCH_MS, fim - Date.now() - RESERVA_GRAVACAO_MS),
      ),
  };
}

/**
 * HTTP 429. Separado do abort de propósito: página menor não resolve
 * limite de taxa — só esperar resolve. Insistir renova a punição.
 */
export function ehRateLimit(err: unknown): boolean {
  const e = err as (Error & { status?: number }) | null;
  if (e?.status === 429) return true;
  return /\b429\b/.test(e?.message ?? "") || /too many requests/i.test(e?.message ?? "");
}

/** Segundos a esperar, lidos do Retry-After quando o servidor manda. */
export function esperaSugerida(err: unknown, padraoSeg = 180): number {
  const e = err as (Error & { retryAfterSeg?: number }) | null;
  return e?.retryAfterSeg && e.retryAfterSeg > 0 ? e.retryAfterSeg : padraoSeg;
}

/**
 * Distingue "a fonte é lenta" de "a fonte recusou". A diferença decide se
 * vale repetir: abort/timeout, sim; HTTP 400, não.
 */
export function ehAbort(err: unknown): boolean {
  const e = err as (Error & { cause?: unknown }) | null;
  // `timed?\s*out` cobre as três grafias que aparecem na prática:
  // "timeout", "timed out" e "time out". Testar só /timeout/ deixa
  // "The operation timed out" passar como erro de negócio — e aí a
  // rotina desiste em vez de refazer a página menor.
  const lento = (t: string) => /abort/i.test(t) || /timed?\s*out/i.test(t);
  const nome = e?.name ?? "";
  if (nome === "AbortError" || nome === "TimeoutError") return true;
  if (lento(e?.message ?? "")) return true;
  // undici embrulha o motivo real em `cause` ("fetch failed" por fora)
  const causa = e?.cause as { name?: string; message?: string; code?: string } | undefined;
  if (!causa) return false;
  return causa.name === "AbortError" || causa.name === "TimeoutError" ||
    causa.code === "UND_ERR_CONNECT_TIMEOUT" || causa.code === "UND_ERR_HEADERS_TIMEOUT" ||
    causa.code === "ETIMEDOUT" || lento(causa.message ?? "");
}

export interface Envelope<T> {
  data?: T[];
  items?: T[];
  totalPaginas?: number;
  totalRegistros?: number;
  paginasRestantes?: number;
  empty?: boolean;
}

/** Aceita `{data}` e `{items}` — o PNCP já usou as duas formas. */
export function itens<T>(env: Envelope<T> | null): T[] {
  if (!env) return [];
  return env.data ?? env.items ?? [];
}

/** Um ponto de leitura: qual página, de que tamanho. */
export interface Pagina {
  pagina: number;
  tamanho: number;
}

/**
 * Onde a leitura começa, em registros. É este número — não a página — que
 * precisa ser preservado quando o tamanho muda.
 */
export const deslocamento = (p: Pagina): number => (p.pagina - 1) * p.tamanho;

/**
 * Recalcula a página para preservar o MESMO deslocamento com outro tamanho.
 *
 * Isto existe por causa de um bug real: ao abortar, o código encolhia a
 * página pela metade e repetia "a mesma página". Mas página 11 de 100 são
 * os registros 1001–1100, e página 11 de 50 são os registros 501–550 —
 * trecho já lido. O que faltava nunca era buscado, e a varredura ficava
 * com um buraco que nada denunciava.
 */
export function mesmoTrecho(base: Pagina, novoTamanho: number): Pagina {
  return { pagina: Math.floor(deslocamento(base) / novoTamanho) + 1, tamanho: novoTamanho };
}

/**
 * GET de uma página, com timeout derivado do prazo.
 *
 * Em caso de abort, repete o MESMO TRECHO com metade do tamanho — página
 * grande é a causa usual da lentidão. Erro de negócio (4xx, JSON inválido)
 * e limite de taxa falham de primeira: repetir não ajuda.
 */
export async function buscarPagina<T>(
  montarUrl: (p: Pagina) => string,
  inicial: Pagina,
  prazo: Prazo,
): Promise<{ env: Envelope<T> | null; ms: number; usado: Pagina }> {
  let atual = inicial;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const limite = prazo.timeoutParaFetch();
    const t = setTimeout(() => ctrl.abort(), limite);
    try {
      const r = await fetch(montarUrl(atual), {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "HubLavoro/1.0 (+garantias@lavoroseguros.com.br)",
          Accept: "application/json",
        },
      });
      if (r.status === 204) return { env: null, ms: Date.now() - t0, usado: atual };
      if (!r.ok) {
        const corpo = await r.text().catch(() => "");
        const erro = Object.assign(
          new Error(`HTTP ${r.status}${corpo ? ` — ${corpo.slice(0, 200)}` : ""}`),
          { status: r.status },
        ) as Error & { status: number; retryAfterSeg?: number };
        if (r.status === 429) {
          // Retry-After vem em segundos ou como data HTTP; aceitamos os dois
          const ra = r.headers.get("retry-after") ?? "";
          const seg = Number(ra);
          if (Number.isFinite(seg) && seg > 0) erro.retryAfterSeg = Math.ceil(seg);
          else if (ra) {
            const quando = Date.parse(ra);
            if (!Number.isNaN(quando)) {
              erro.retryAfterSeg = Math.max(1, Math.ceil((quando - Date.now()) / 1000));
            }
          }
        }
        throw erro;
      }
      const txt = await r.text();
      return {
        env: (txt ? JSON.parse(txt) : null) as Envelope<T> | null,
        ms: Date.now() - t0,
        usado: atual,
      };
    } catch (err) {
      const ultima = tentativa === 1 || atual.tamanho <= TAMANHO_MINIMO
        || ehRateLimit(err) || !ehAbort(err);
      if (ultima) {
        // Reembrulhar para acrescentar o contexto, PRESERVANDO status e
        // retryAfterSeg: sem isso o back-off do 429 se perderia justamente
        // no caminho em que ele é usado.
        const orig = err as Error & { status?: number; retryAfterSeg?: number };
        throw Object.assign(
          new Error(
            `${orig.message} (pagina=${atual.pagina}, tamanhoPagina=${atual.tamanho}, ` +
            `registro=${deslocamento(atual) + 1}, limite=${limite}ms)`,
          ),
          orig.status !== undefined ? { status: orig.status } : {},
          orig.retryAfterSeg !== undefined ? { retryAfterSeg: orig.retryAfterSeg } : {},
        );
      }
      atual = mesmoTrecho(atual, Math.max(TAMANHO_MINIMO, Math.floor(atual.tamanho / 2)));
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("buscarPagina: inalcançável");
}

/**
 * O que fazer quando uma página falha.
 *
 * A distinção que importa: "esta página é ruim" só é um diagnóstico
 * possível se ALGUMA página tiver sido lida recentemente. Sem leitura
 * recente, falha em página é sintoma de fonte fora do ar — e aí avançar o
 * cursor é destruir a varredura em silêncio.
 *
 * Foi o que a operação mostrou: o PNCP degradou inteiro no meio da tarde e
 * o teto de tentativas passou a trabalhar contra nós, marcando página após
 * página como abandonada numa janela que nunca foi lida. Em algumas horas a
 * rotina teria "concluído" o ciclo sem ler nada, com o log arrumado.
 */
export type VereditoFalha = "tentar_de_novo" | "pular_pagina" | "fonte_indisponivel";

export function classificarFalha(args: {
  /** Falhas consecutivas nesta página, incluindo a atual. */
  falhas: number;
  teto: number;
  /** Última leitura bem-sucedida desta fonte. */
  leituraOkEm?: string | Date | null;
  janelaHoras?: number;
  agora?: Date;
}): VereditoFalha {
  const agora = args.agora ?? new Date();
  const janela = (args.janelaHoras ?? 6) * 3_600_000;
  const ok = args.leituraOkEm
    ? new Date(args.leituraOkEm).getTime()
    : null;
  const fonteViva = ok !== null && agora.getTime() - ok <= janela;

  // Sem leitura recente, não há como culpar a página. Esperar é seguro;
  // andar o cursor não é reversível.
  if (!fonteViva) return "fonte_indisponivel";
  return args.falhas >= args.teto ? "pular_pagina" : "tentar_de_novo";
}

/** Resumo de latência para o ab_ingest_log — é o que permite calibrar. */
export function latencia(amostras: number[]): { media: number; pico: number } {
  if (!amostras.length) return { media: 0, pico: 0 };
  return {
    media: Math.round(amostras.reduce((a, b) => a + b, 0) / amostras.length),
    pico: Math.max(...amostras),
  };
}
