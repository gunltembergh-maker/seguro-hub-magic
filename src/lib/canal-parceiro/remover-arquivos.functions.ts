import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "canal-parceiros-contratos";

/** Remove do bucket arquivos de contrato que não são mais usados por nenhum contrato. Só ADMIN. */
export const removerArquivosContratoSemUso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paths: z.array(z.string().min(1)).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: eRole } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (eRole || !isAdmin) throw new Error("Somente administrador pode remover arquivos.");

    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    const { data: emUso, error } = await lavoroAdmin
      .from("canal_contratos")
      .select("arquivo_path")
      .in("arquivo_path", data.paths);
    if (error) throw new Error(error.message);
    const usados = new Set((emUso ?? []).map((r) => (r as { arquivo_path: string | null }).arquivo_path));
    const remover = data.paths.filter((p) => !usados.has(p));
    if (remover.length === 0) return { removidos: 0 };

    const { error: eRm } = await lavoroAdmin.storage.from(BUCKET).remove(remover);
    if (eRm) throw new Error(eRm.message);
    return { removidos: remover.length };
  });
