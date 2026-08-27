// Hook chamado pelo gatilho de auditoria (pg_net) e pelo pg_cron a cada 5 min.
// Envia por e-mail as alterações administrativas ainda não notificadas.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/admin-audit-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!expected) return json({ error: "server_misconfigured" }, 500);
  const provided = request.headers.get("apikey") || request.headers.get("x-apikey");
  if (provided !== expected) return json({ error: "unauthorized" }, 401);

  try {
    const { notificarAuditoriaPendente } = await import("@/lib/admin-audit-notify.server");
    const result = await notificarAuditoriaPendente();
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
