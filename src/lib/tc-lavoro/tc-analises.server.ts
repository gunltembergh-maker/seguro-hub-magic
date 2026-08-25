// Helper server-side dedicado ao histórico T&C do Worker (Cloudflare Access).
// Mesmo padrão de segurança de limits-query / analysis-jobs: valida a sessão
// Supabase do Hub e só então encaminha, injetando CF-Access apenas no servidor.
export { isAllowedOrigin, corsHeaders, json, autenticar } from "./analysis-jobs.server";

const WORKER_BASE = "https://lucky-hat-b241.kyuri887.workers.dev/v1/tc/analises";

/** id: apenas identificadores simples, nunca path arbitrário. */
export function isValidAnaliseId(id: string | undefined): id is string {
  return !!id && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

import { corsHeaders as cors, json as jsonResp } from "./analysis-jobs.server";

/** Encaminha ao Worker preservando status e corpo. `path` é montado só aqui. */
export async function encaminharTc(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body: unknown,
  origin: string | null,
  methods: string,
): Promise<Response> {
  const clientId = process.env["CF_ACCESS_CLIENT_ID"];
  const clientSecret = process.env["CF_ACCESS_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    console.error("[tc-lavoro/tc-analises] credenciais CF-Access não configuradas");
    return jsonResp({ error: "Serviço indisponível." }, 503, origin, methods);
  }

  const started = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(`${WORKER_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Id": clientId,
        "CF-Access-Client-Secret": clientSecret,
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    console.error(`[tc-lavoro/tc-analises] falha de rede (${Date.now() - started}ms) path=${path}`);
    return jsonResp({ error: "Serviço temporariamente indisponível." }, 502, origin, methods);
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const text = await upstream.text();

  console.info(
    `[tc-lavoro/tc-analises] status=${upstream.status} dur=${Date.now() - started}ms path=/v1/tc/analises${path}`,
  );

  if (!upstream.ok && !contentType.includes("application/json")) {
    return jsonResp({ error: "Não foi possível concluir a operação." }, upstream.status, origin, methods);
  }

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType, ...cors(origin, methods) },
  });
}
