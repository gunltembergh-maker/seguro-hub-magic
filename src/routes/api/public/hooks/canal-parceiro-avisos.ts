// Hook chamado pelo pg_cron a cada 5 minutos. Drena as três filas de aviso do
// Canal Parceiros: repasse, conferência de contrato e alteração de percentual.
//
// Autenticação: cabeçalho `apikey` deve ser igual ao SUPABASE_PUBLISHABLE_KEY.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/canal-parceiro-avisos")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request), // permite ping manual
    },
  },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handle(request: Request): Promise<Response> {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!expected) return json({ erro: "server_misconfigured" }, 500);

  const provided = request.headers.get("apikey") ?? request.headers.get("x-apikey");
  if (provided !== expected) return json({ erro: "nao_autorizado" }, 401);

  const { enviarAvisosCanalParceiro } = await import("@/lib/canal-parceiro/avisos-email.server");
  return json(await enviarAvisosCanalParceiro(), 200);
}
