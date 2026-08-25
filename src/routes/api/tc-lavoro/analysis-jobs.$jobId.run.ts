// Proxy server-side: POST /api/tc-lavoro/analysis-jobs/:jobId/run -> POST /v1/analysis-jobs/:jobId/run
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tc-lavoro/analysis-jobs/$jobId/run")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { isAllowedOrigin, corsHeaders } = await import("@/lib/tc-lavoro/analysis-jobs.server");
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin, "POST") });
      },

      POST: async ({ request, params }) => {
        const { isAllowedOrigin, json, autenticar, encaminhar, isValidJobId } = await import(
          "@/lib/tc-lavoro/analysis-jobs.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, "POST");

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, "POST");

        const jobId = (params as { jobId?: string }).jobId;
        if (!isValidJobId(jobId)) return json({ error: "jobId inválido." }, 400, origin, "POST");

        let payload: unknown = {};
        try {
          payload = await request.json();
        } catch {
          payload = {};
        }

        return encaminhar(`/${encodeURIComponent(jobId)}/run`, "POST", payload, origin, "POST");
      },
    },
  },
});
