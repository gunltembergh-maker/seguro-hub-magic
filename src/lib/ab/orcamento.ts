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

/**
 * GET de uma página, com timeout derivado do prazo. Em caso de abort,
 * repete a MESMA página com metade do tamanho — página grande é a causa
 * usual da lentidão, e mudar de página perderia registros. Erro de
 * negócio (4xx, JSON inválido) falha de primeira: repetir não ajuda.
 */
export async function buscarPagina<T>(
  montarUrl: (tamanho: number) => string,
  tamanho: number,
  prazo: Prazo,
): Promise<{ env: Envelope<T> | null; ms: number; tamanhoUsado: number }> {
  let tamanhoAtual = tamanho;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const limite = prazo.timeoutParaFetch();
    const t = setTimeout(() => ctrl.abort(), limite);
    try {
      const r = await fetch(montarUrl(tamanhoAtual), {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "HubLavoro/1.0 (+garantias@lavoroseguros.com.br)",
          Accept: "application/json",
        },
      });
      if (r.status === 204) return { env: null, ms: Date.now() - t0, tamanhoUsado: tamanhoAtual };
      if (!r.ok) {
        const corpo = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}${corpo ? ` — ${corpo.slice(0, 200)}` : ""}`);
      }
      const txt = await r.text();
      return {
        env: (txt ? JSON.parse(txt) : null) as Envelope<T> | null,
        ms: Date.now() - t0,
        tamanhoUsado: tamanhoAtual,
      };
    } catch (err) {
      const ultima = tentativa === 1 || tamanhoAtual <= TAMANHO_MINIMO || !ehAbort(err);
      if (ultima) {
        throw new Error(
          `${(err as Error).message} (tamanhoPagina=${tamanhoAtual}, limite=${limite}ms)`,
        );
      }
      tamanhoAtual = Math.max(TAMANHO_MINIMO, Math.floor(tamanhoAtual / 2));
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("buscarPagina: inalcançável");
}

/** Resumo de latência para o ab_ingest_log — é o que permite calibrar. */
export function latencia(amostras: number[]): { media: number; pico: number } {
  if (!amostras.length) return { media: 0, pico: 0 };
  return {
    media: Math.round(amostras.reduce((a, b) => a + b, 0) / amostras.length),
    pico: Math.max(...amostras),
  };
}
