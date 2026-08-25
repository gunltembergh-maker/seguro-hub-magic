// Proxy server-side: /api/tc-lavoro/tc-analises -> POST|GET /v1/tc/analises
import { createFileRoute } from "@tanstack/react-router";

const METHODS = "GET, POST";

export const Route = createFileRoute("/api/tc-lavoro/tc-analises")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { isAllowedOrigin, corsHeaders } = await import("@/lib/tc-lavoro/tc-analises.server");
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin, METHODS) });
      },

      GET: async ({ request }) => {
        const { isAllowedOrigin, json, autenticar, encaminharTc } = await import(
          "@/lib/tc-lavoro/tc-analises.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, METHODS);

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, METHODS);

        const url = new URL(request.url);
        const params = new URLSearchParams();
        const cnpj = url.searchParams.get("cnpj");
        const nome = url.searchParams.get("nome");
        if (cnpj) params.set("cnpj", cnpj.slice(0, 64));
        if (nome) params.set("nome", nome.slice(0, 200));
        const qs = params.toString();

        return encaminharTc(qs ? `?${qs}` : "", "GET", null, origin, METHODS);
      },

      POST: async ({ request }) => {
        const { isAllowedOrigin, json, autenticar, encaminharTc } = await import(
          "@/lib/tc-lavoro/tc-analises.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, METHODS);

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, METHODS);

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Payload inválido." }, 400, origin, METHODS);
        }

        return encaminharTc("", "POST", payload, origin, METHODS);
      },
    },
  },
});
