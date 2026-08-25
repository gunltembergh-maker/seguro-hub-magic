// Proxy server-side: GET /api/tc-lavoro/analysis-jobs/:jobId -> GET /v1/analysis-jobs/:jobId
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tc-lavoro/analysis-jobs/$jobId")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { isAllowedOrigin, corsHeaders } = await import("@/lib/tc-lavoro/analysis-jobs.server");
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin, "GET") });
      },

      GET: async ({ request, params }) => {
        const { isAllowedOrigin, json, autenticar, encaminhar, isValidJobId } = await import(
          "@/lib/tc-lavoro/analysis-jobs.server"
        );
        const origin = request.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) return json({ error: "Origem não permitida." }, 403, origin, "GET");

        const auth = await autenticar(request);
        if (!auth.ok) return json({ error: auth.error }, auth.status, origin, "GET");

        const jobId = (params as { jobId?: string }).jobId;
        if (!isValidJobId(jobId)) return json({ error: "jobId inválido." }, 400, origin, "GET");

        return encaminhar(`/${encodeURIComponent(jobId)}`, "GET", null, origin, "GET");
      },
    },
  },
});
