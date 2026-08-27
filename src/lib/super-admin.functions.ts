import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const verifySuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        area: z.string().min(1),
        senha: z.string().min(1),
        tentativas: z.number().int().min(1).default(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Apenas administradores podem acessar esta área.");

    const { verifySuperAdminPassword } = await import("@/lib/super-admin.server");
    return verifySuperAdminPassword(data, context as never);
  });
