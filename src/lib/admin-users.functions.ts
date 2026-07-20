import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");
}

// ------- Enviar e-mail: invite / magiclink / recovery -------
const SendEmailInput = z.object({
  user_id: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  tipo: z.enum(["invite", "magiclink", "recovery"]),
  redirect_to: z.string().url().optional(),
});

export const adminSendAuthEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SendEmailInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { lavoroAdmin: supabaseAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

    const redirectTo =
      data.redirect_to ??
      (process.env.PUBLIC_SITE_URL ? `${process.env.PUBLIC_SITE_URL}/auth` : undefined);

    if (data.tipo === "invite") {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo,
      });
      if (error) throw new Error(error.message);
    } else if (data.tipo === "magiclink") {
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
    } else if (data.tipo === "recovery") {
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
    }

    if (data.user_id) {
      await context.supabase.rpc("rpc_admin_log_convite" as never, {
        _user_id: data.user_id,
        _tipo: data.tipo,
      } as never);
    }

    return { ok: true };
  });
