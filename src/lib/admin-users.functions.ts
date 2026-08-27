import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminSendAuthEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid().nullable().optional(),
    email: z.string().email(),
    tipo: z.enum(["invite", "magiclink", "recovery"]),
    redirect_to: z.string().url().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { sendAdminAuthEmail } = await import("@/lib/admin-users-email.server");
    return sendAdminAuthEmail({
      userId: data.user_id,
      email: data.email,
      tipo: data.tipo,
      redirectTo: data.redirect_to,
    }, context);
  });
