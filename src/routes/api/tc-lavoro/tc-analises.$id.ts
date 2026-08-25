// Proxy server-side: /api/tc-lavoro/tc-analises/:id -> GET|DELETE /v1/tc/analises/:id
import { createFileRoute } from "@tanstack/react-router";

const METHODS = "GET, DELETE";

export const Route = createFileRoute("/api/tc-lavoro/tc-analises/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { isAllowedOrigin, corsHeaders } = await import("@/lib/tc-lavoro/tc-analises.server");
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin, METHODS) });
      },

      GET: async ({ request, params }) => {
        const { isAllowedOrigin, json, autenticar, encaminharTc, isValidAnaliseId } = await import(
          "@/lib/tc-lavoro/tc-analises.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, METHODS);

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, METHODS);

        const id = (params as { id?: string }).id;
        if (!isValidAnaliseId(id)) return json({ error: "id inválido." }, 400, origin, METHODS);

        return encaminharTc(`/${encodeURIComponent(id)}`, "GET", null, origin, METHODS);
      },

      DELETE: async ({ request, params }) => {
        const { isAllowedOrigin, json, autenticar, encaminharTc, isValidAnaliseId } = await import(
          "@/lib/tc-lavoro/tc-analises.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, METHODS);

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, METHODS);

        const id = (params as { id?: string }).id;
        if (!isValidAnaliseId(id)) return json({ error: "id inválido." }, 400, origin, METHODS);

        return encaminharTc(`/${encodeURIComponent(id)}`, "DELETE", null, origin, METHODS);
      },
    },
  },
});
