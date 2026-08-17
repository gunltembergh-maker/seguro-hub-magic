import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  perfil_id: z.string().uuid(),
  cpf: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  gestor: z.string().nullable().optional(),
  empresa: z.string().nullable().optional(),
  tipo_usuario: z.enum(["interno", "externo"]).default("interno"),
  times_receita: z.array(z.enum(["GARANTIA", "BENEFICIOS", "DEMAIS_RAMOS"])).default([]),
});

export const adminPrecadastrarUsuarioFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");

    const cpfDigits = (data.cpf ?? "").replace(/\D/g, "") || null;
    if (cpfDigits && cpfDigits.length !== 11) throw new Error("CPF inválido");

    const email = data.email.trim().toLowerCase();
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

    // 1) Create auth user (no password → user will set on first access via invite/magic link)
    const { data: created, error: createErr } = await lavoroAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário no Auth");
    }

    const authUserId = created.user.id;

    // 2) Upsert profile (a trigger may already have created a minimal row)
    const { error: upErr } = await lavoroAdmin
      .from("profiles")
      .upsert(
        {
          user_id: authUserId,
          email,
          full_name: data.full_name,
          perfil_id: data.perfil_id,
          cpf: cpfDigits,
          area: data.area ?? null,
          gestor: data.gestor ?? null,
          empresa: data.empresa ?? null,
          tipo_usuario: data.tipo_usuario,
          times_receita: data.times_receita ?? [],
          blocked: false,
          active: true,
          primeiro_acesso: true,
        },
        { onConflict: "user_id" },
      );
    if (upErr) {
      // rollback auth user to avoid orphans
      await lavoroAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      throw new Error(upErr.message);
    }

    return { ok: true, user_id: authUserId };
  });
