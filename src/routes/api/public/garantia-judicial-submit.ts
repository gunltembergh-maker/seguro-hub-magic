import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/garantia-judicial-submit")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
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
  const expected = process.env.HUB_WEBHOOK_SECRET;
  if (!expected) return json({ erro: "server_misconfigured" }, 500);
  const provided = request.headers.get("x-hub-webhook-secret");
  if (provided !== expected) return json({ erro: "segredo_invalido" }, 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ erro: "corpo_invalido" }, 400);
  }

  const { receberSolicitacaoGarantiaJudicial } = await import("@/lib/garantia/garantia-judicial-submit.server");
  const { status, body } = await receberSolicitacaoGarantiaJudicial(payload);
  return json(body, status);
}
