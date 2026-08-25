// Helper server-side compartilhado pelas rotas de proxy dos analysis-jobs do
// Worker T&C (protegido por Cloudflare Access). Mesmo padrão de segurança de
// src/routes/api/tc-lavoro/limits-query.ts: valida a sessão Supabase do Hub e
// só então encaminha, injetando as credenciais CF-Access apenas no servidor.
import { createClient } from "@supabase/supabase-js";

const WORKER_BASE = "https://lucky-hat-b241.kyuri887.workers.dev/v1/analysis-jobs";

const ALLOWED_ORIGINS = [
  "https://hub.lavoroseguros.com.br",
  "https://hub-lavoro-seguros-interno.lovable.app",
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return (
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  );
}

export function corsHeaders(origin: string | null, methods: string): Record<string, string> {
  const h: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (isAllowedOrigin(origin)) h["Access-Control-Allow-Origin"] = origin!;
  return h;
}

export function json(body: unknown, status: number, origin: string | null, methods: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin, methods) },
  });
}

/** jobId: apenas identificadores simples, nunca path arbitrário. */
export function isValidJobId(jobId: string | undefined): jobId is string {
  return !!jobId && /^[A-Za-z0-9_-]{1,128}$/.test(jobId);
}

/** Valida o Bearer token da sessão do Hub (Microsoft SSO via Supabase). */
export async function autenticar(request: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Não autenticado." };

  const supabaseUrl = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !publishableKey) {
    console.error("[tc-lavoro/analysis-jobs] configuração Supabase ausente");
    return { ok: false, status: 503, error: "Serviço indisponível." };
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", publishableKey);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Sessão inválida ou expirada." };
  return { ok: true };
}

/** Encaminha ao Worker preservando status e corpo. `path` é montado só aqui. */
export async function encaminhar(
  path: string,
  method: "GET" | "POST",
  body: unknown,
  origin: string | null,
  methods: string,
): Promise<Response> {
  const clientId = process.env["CF_ACCESS_CLIENT_ID"];
  const clientSecret = process.env["CF_ACCESS_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    console.error("[tc-lavoro/analysis-jobs] credenciais CF-Access não configuradas");
    return json({ error: "Serviço indisponível." }, 503, origin, methods);
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
    console.error(`[tc-lavoro/analysis-jobs] falha de rede (${Date.now() - started}ms) path=${path}`);
    return json({ error: "Serviço temporariamente indisponível." }, 502, origin, methods);
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const text = await upstream.text();

  console.info(
    `[tc-lavoro/analysis-jobs] status=${upstream.status} dur=${Date.now() - started}ms path=/v1/analysis-jobs${path}`,
  );

  if (!upstream.ok && upstream.status !== 202 && !contentType.includes("application/json")) {
    return json({ error: "Não foi possível concluir a análise." }, upstream.status, origin, methods);
  }

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType, ...corsHeaders(origin, methods) },
  });
}
