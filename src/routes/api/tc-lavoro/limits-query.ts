// Proxy server-side DEDICADO a um único endpoint do Worker T&C (Cloudflare Access):
//   POST https://lucky-hat-b241.kyuri887.workers.dev/v1/limits/query
// Usado exclusivamente por Garantia -> Operacional (Análise de Limite).
// As credenciais CF-Access existem apenas aqui (server-side) e nunca no browser.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const TARGET_URL = "https://lucky-hat-b241.kyuri887.workers.dev/v1/limits/query";

const ALLOWED_ORIGINS = [
  "https://hub.lavoroseguros.com.br",
  "https://hub-lavoro-seguros-interno.lovable.app",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Domínios de preview do Lovable (desenvolvimento), declarados explicitamente.
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (isAllowedOrigin(origin)) h["Access-Control-Allow-Origin"] = origin!;
  return h;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export const Route = createFileRoute("/api/tc-lavoro/limits-query")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) {
          return new Response(null, { status: 403 });
        }
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      },

      POST: async ({ request }) => {
        const started = Date.now();
        const origin = request.headers.get("origin");

        // Requisições cross-origin só de origens permitidas (same-origin não envia Origin).
        if (origin && !isAllowedOrigin(origin)) {
          return json({ error: "Origem não permitida." }, 403, origin);
        }

        // 1) Autenticação: valida o token da sessão do Hub (Microsoft SSO via Supabase).
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (!token) {
          return json({ error: "Não autenticado." }, 401, origin);
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          console.error("[tc-lavoro/limits-query] configuração Supabase ausente");
          return json({ error: "Serviço indisponível." }, 503, origin);
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

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) {
          return json({ error: "Sessão inválida ou expirada." }, 401, origin);
        }

        // 2) Credenciais Cloudflare Access (somente server-side).
        const clientId = process.env["CF_ACCESS_CLIENT_ID"];
        const clientSecret = process.env["CF_ACCESS_CLIENT_SECRET"];
        if (!clientId || !clientSecret) {
          console.error("[tc-lavoro/limits-query] credenciais CF-Access não configuradas");
          return json({ error: "Serviço indisponível." }, 503, origin);
        }

        // 3) Payload recebido da tela (encaminhado sem alteração).
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Payload inválido." }, 400, origin);
        }

        // 4) Encaminhamento ao Worker.
        let upstream: Response;
        try {
          upstream = await fetch(TARGET_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "CF-Access-Client-Id": clientId,
              "CF-Access-Client-Secret": clientSecret,
            },
            body: JSON.stringify(payload),
          });
        } catch {
          console.error(
            `[tc-lavoro/limits-query] falha de rede ao chamar upstream (${Date.now() - started}ms)`,
          );
          return json({ error: "Serviço temporariamente indisponível." }, 502, origin);
        }

        const contentType = upstream.headers.get("content-type") ?? "application/json";
        const body = await upstream.text();

        console.info(
          `[tc-lavoro/limits-query] ${new Date().toISOString()} status=${upstream.status} dur=${Date.now() - started}ms endpoint=/v1/limits/query`,
        );

        if (!upstream.ok && upstream.status !== 202) {
          const mensagens: Record<number, string> = {
            400: "Requisição inválida para a consulta de limites.",
            401: "Falha de autenticação com o serviço de limites.",
            403: "Acesso negado pelo serviço de limites.",
            404: "Consulta não encontrada no serviço de limites.",
            429: "Muitas consultas em sequência. Tente novamente em instantes.",
            500: "Erro interno no serviço de limites.",
            502: "Serviço de limites indisponível no momento.",
            503: "Serviço de limites indisponível no momento.",
          };
          const mensagem = mensagens[upstream.status] ?? "Não foi possível concluir a consulta.";
          // Repassa o corpo original quando for JSON (a tela já sabe interpretá-lo),
          // senão devolve mensagem genérica sem detalhes internos.
          if (contentType.includes("application/json")) {
            return new Response(body, {
              status: upstream.status,
              headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
            });
          }
          return json({ error: mensagem }, upstream.status, origin);
        }

        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": contentType, ...corsHeaders(origin) },
        });
      },
    },
  },
});
