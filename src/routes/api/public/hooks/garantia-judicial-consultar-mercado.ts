// Hook chamado pelo pg_cron. Pega a solicitação de Garantia Judicial mais
// antiga pendente e consulta o mercado pelo CNPJ do tomador, gravando o
// resultado cru. Normalização e XLSX são etapa separada.
//
// Autenticação: cabeçalho `apikey` deve ser igual ao SUPABASE_PUBLISHABLE_KEY.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/garantia-judicial-consultar-mercado")({
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

  const { consultarMercadoPendentes } = await import(
    "@/lib/garantia/garantia-judicial-mercado.server"
  );
  return json(await consultarMercadoPendentes(), 200);
}
