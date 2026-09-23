// Entrega o PDF do contrato pelo domínio do Hub (evita bloqueadores que derrubam o domínio do storage).
// Autorização pela RLS: só baixa quem enxerga a linha em canal_contratos.
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "canal-parceiros-contratos";

export const Route = createFileRoute("/api/canal-parceiro-contrato")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request, new URL(request.url).searchParams.get("path")),
      POST: async ({ request }) => {
        let path: string | null = null;
        try {
          const body = (await request.json()) as { path?: unknown };
          path = typeof body?.path === "string" ? body.path : null;
        } catch {
          path = null;
        }
        return handle(request, path);
      },
    },
  },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function comoUsuario(req: Request): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
  const anon =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function handle(req: Request, pathPedido: string | null): Promise<Response> {
  try {
    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
      return json({ error: "Sessão não encontrada. Entre novamente no Hub." }, 401);
    }
    if (!pathPedido || pathPedido.length > 500) {
      return json({ error: "Arquivo não informado." }, 400);
    }
    const usuario = comoUsuario(req);
    const { data: quem } = await usuario.auth.getUser();
    if (!quem?.user) return json({ error: "Sessão expirada. Entre novamente no Hub." }, 401);

    const { data: linha, error } = await usuario
      .from("canal_contratos" as never)
      .select("id, arquivo_path, arquivo_nome")
      .eq("arquivo_path", pathPedido)
      .limit(1)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    const reg = linha as { id: string; arquivo_path: string | null; arquivo_nome: string | null } | null;
    if (!reg?.arquivo_path) {
      return json({ error: "Você não tem acesso a este contrato." }, 403);
    }

    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    const admin = lavoroAdmin as unknown as SupabaseClient;
    const { data: arquivo, error: erroDown } = await admin.storage
      .from(BUCKET)
      .download(reg.arquivo_path);
    if (erroDown || !arquivo) {
      return json({ error: "Não foi possível carregar o arquivo do contrato." }, 404);
    }

    const nome = (reg.arquivo_nome || "contrato.pdf").replace(/["\r\n\\]/g, "_");
    return new Response(await arquivo.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro ao abrir o contrato." }, 500);
  }
}
