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

const MAX_PDF_BYTES = 15 * 1024 * 1024;

async function handle(request: Request): Promise<Response> {
  const expected = process.env.HUB_WEBHOOK_SECRET;
  if (!expected) return json({ erro: "server_misconfigured" }, 500);

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ erro: "nao_autorizado" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (token !== expected) {
    return json({ erro: "nao_autorizado" }, 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json({ erro: "content_type_invalido" }, 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ erro: "multipart_invalido" }, 400);
  }

  const payloadRaw = form.get("payload");
  const pdfFile = form.get("pdf");

  if (typeof payloadRaw !== "string") {
    return json({ erro: "payload_ausente" }, 400);
  }
  if (!(pdfFile instanceof File)) {
    return json({ erro: "pdf_ausente" }, 400);
  }
  if (pdfFile.size === 0) {
    return json({ erro: "pdf_vazio" }, 400);
  }
  if (pdfFile.size > MAX_PDF_BYTES) {
    return json({ erro: "arquivo_grande_demais" }, 413);
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(payloadRaw);
  } catch {
    return json({ erro: "payload_json_invalido" }, 400);
  }

  const pdfBuffer = new Uint8Array(await pdfFile.arrayBuffer());

  const { receberSolicitacaoGarantiaJudicial } = await import("@/lib/garantia/garantia-judicial-submit.server");
  const { status, body } = await receberSolicitacaoGarantiaJudicial(payloadJson, pdfBuffer);
  return json(body, status);
}
