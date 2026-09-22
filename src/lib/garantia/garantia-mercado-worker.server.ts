// Long-poll do Worker de limites (Cloudflare Access), EXTRAÍDO de
// garantia-judicial-mercado.server.ts sem nenhuma mudança de comportamento:
// mesmo orçamento de tempo, mesma leitura de `retryAfterMs` no 202, mesmos
// tipos de retorno. O motor judicial roda no pg_cron a cada minuto e importa
// daqui — extração, não redesenho.
//
// As credenciais CF-Access continuam existindo só no servidor. O browser nunca
// fala com o Worker: a tela chama a server function, que chama este módulo.

const WORKER_URL = "https://lucky-hat-b241.kyuri887.workers.dev/v1/limits/query";

// As 10 seguradoras com consulta automática — mesma lista que a tela
// Garantia -> Análise de Limite usa (public/analise-limite/app.js, MKT_API_KEYS).
export const SEGURADORAS_API = [
  "avla", "axa", "essor", "fator", "jns",
  "junto", "mitsui", "newe", "now", "sombrero",
] as const;

// Orçamento de tempo de UMA execução. O que não terminar agora fica em aberto
// e é retomado depois, porque o Worker retoma o job pelo CNPJ.
export const ORCAMENTO_MS = 50_000;

const ERRO_MAX_CHARS = 500;

export function truncar(texto: unknown): string {
  const s = typeof texto === "string" ? texto : String(texto ?? "");
  return s.length > ERRO_MAX_CHARS ? `${s.slice(0, ERRO_MAX_CHARS)}… [truncado]` : s;
}

// Preserva a resposta como veio, só encurtando as mensagens de erro — algumas
// seguradoras devolvem uma página HTML inteira nesse campo.
export function sanitizarResultado(resultado: unknown): unknown {
  if (!resultado || typeof resultado !== "object") return resultado;
  const r = resultado as Record<string, unknown>;
  if (!Array.isArray(r.resultados)) return resultado;
  return {
    ...r,
    resultados: r.resultados.map((item) => {
      if (!item || typeof item !== "object") return item;
      const i = item as Record<string, unknown>;
      return typeof i.erro === "string" ? { ...i, erro: truncar(i.erro) } : i;
    }),
  };
}

export type ResultadoConsulta =
  | { tipo: "ok"; resultado: unknown }
  | { tipo: "em_andamento" }
  | { tipo: "erro_config" }
  | { tipo: "erro_rede" }
  | { tipo: "erro_json" }
  | { tipo: "erro_upstream"; status: number; corpo: string };

export async function consultarWorkerLimites(opcoes: {
  cnpjDigits: string;
  seguradoras?: readonly string[];
  forceRefresh?: boolean;
  orcamentoMs?: number;
}): Promise<ResultadoConsulta> {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { tipo: "erro_config" };

  const orcamento = opcoes.orcamentoMs ?? ORCAMENTO_MS;
  const inicio = Date.now();
  const corpo = JSON.stringify({
    cnpj: opcoes.cnpjDigits,
    seguradoras: opcoes.seguradoras ?? SEGURADORAS_API,
    forceRefresh: !!opcoes.forceRefresh,
  });

  while (Date.now() - inicio < orcamento) {
    let resp: Response;
    try {
      resp = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Access-Client-Id": clientId,
          "CF-Access-Client-Secret": clientSecret,
        },
        body: corpo,
      });
    } catch {
      return { tipo: "erro_rede" };
    }

    if (resp.status === 202) {
      let esperaMs = 2000;
      try {
        const pendente = (await resp.json()) as { retryAfterMs?: unknown };
        const r = Number(pendente?.retryAfterMs);
        if (Number.isFinite(r) && r > 0) esperaMs = Math.max(500, r);
      } catch {
        // mantém a espera padrão
      }
      await new Promise((r) => setTimeout(r, esperaMs));
      continue;
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      return { tipo: "erro_upstream", status: resp.status, corpo: truncar(texto) };
    }

    try {
      return { tipo: "ok", resultado: await resp.json() };
    } catch {
      return { tipo: "erro_json" };
    }
  }

  return { tipo: "em_andamento" };
}
