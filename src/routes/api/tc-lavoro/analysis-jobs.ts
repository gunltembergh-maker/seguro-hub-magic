// Proxy server-side: POST /api/tc-lavoro/analysis-jobs -> POST /v1/analysis-jobs
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tc-lavoro/analysis-jobs")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { isAllowedOrigin, corsHeaders } = await import("@/lib/tc-lavoro/analysis-jobs.server");
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin, "POST") });
      },

      POST: async ({ request }) => {
        const { isAllowedOrigin, json, autenticar, encaminhar } = await import(
          "@/lib/tc-lavoro/analysis-jobs.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, "POST");

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, "POST");

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Payload inválido." }, 400, origin, "POST");
        }

        return encaminhar("", "POST", payload, origin, "POST");
      },
    },
  },
});
