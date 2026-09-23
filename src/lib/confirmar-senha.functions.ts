import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const confirmarSenhaPropria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        area: z.string().min(1).max(100),
        senha: z.string().min(1).max(200),
        alvo: z.string().max(200).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { confirmarSenhaDoUsuario } = await import("@/lib/confirmar-senha.server");
    return confirmarSenhaDoUsuario(data, context as never);
  });
