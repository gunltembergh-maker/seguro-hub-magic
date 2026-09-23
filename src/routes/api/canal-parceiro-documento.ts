// Entrega nota fiscal ou comprovante do repasse pelo domínio do Hub.
// Autorização pela RLS: só baixa quem enxerga a linha em canal_repasse_documentos.
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "canal-parceiros-documentos";

const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  xml: "application/xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const Route = createFileRoute("/api/canal-parceiro-documento")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request, new URL(request.url).searchParams.get("id")),
      POST: async ({ request }) => {
        let id: string | null = null;
        try {
          const body = (await request.json()) as { id?: unknown };
          id = typeof body?.id === "string" ? body.id : null;
        } catch {
          id = null;
        }
        return handle(request, id);
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

async function handle(req: Request, id: string | null): Promise<Response> {
  try {
    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
      return json({ error: "Sessão não encontrada. Entre novamente no Hub." }, 401);
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return json({ error: "Documento não informado." }, 400);
    }
    const usuario = comoUsuario(req);
    const { data: quem } = await usuario.auth.getUser();
    if (!quem?.user) return json({ error: "Sessão expirada. Entre novamente no Hub." }, 401);

    const { data: linha, error } = await usuario
      .from("canal_repasse_documentos" as never)
      .select("id, arquivo_path, arquivo_nome")
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    const reg = linha as { id: string; arquivo_path: string | null; arquivo_nome: string | null } | null;
    if (!reg?.arquivo_path) {
      return json({ error: "Você não tem acesso a este documento." }, 403);
    }

    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    const admin = lavoroAdmin as unknown as SupabaseClient;
    const { data: arquivo, error: erroDown } = await admin.storage
      .from(BUCKET)
      .download(reg.arquivo_path);
    if (erroDown || !arquivo) {
      return json({ error: "Não foi possível carregar o arquivo." }, 404);
    }

    const nome = (reg.arquivo_nome || "documento").replace(/["\r\n\\]/g, "_");
    const ext = (reg.arquivo_path.split(".").pop() || "").toLowerCase();
    return new Response(await arquivo.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": TIPOS[ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro ao baixar o documento." }, 500);
  }
}
