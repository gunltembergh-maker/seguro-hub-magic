import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const enviarCodigoSenhaAprovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { enviarCodigoRedefinicao } = await import("@/lib/confirmar-senha.server");
    return enviarCodigoRedefinicao(context as never);
  });
