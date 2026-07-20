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
    const { render } = await import("@react-email/render");
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const React = await import("react");
    const { InviteEmail } = await import("@/lib/email-templates/invite");
    const { MagicLinkEmail } = await import("@/lib/email-templates/magic-link");
    const { RecoveryEmail } = await import("@/lib/email-templates/recovery");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY não configurada para envio de e-mail.");
    }

    const siteUrl = (process.env.PUBLIC_SITE_URL ?? "https://hub.lavoroseguros.com.br").replace(/\/$/, "");
    const siteName = "Hub Lavoro Seguros";
    const senderDomain = "notify.hub.lavoroseguros.com.br";
    const from = `${siteName} <noreply@${senderDomain}>`;

    const redirectTo =
      data.redirect_to ??
      `${siteUrl}/auth`;

    let effectiveTipo: "invite" | "magiclink" | "recovery" = data.tipo;
    let linkResp = await supabaseAdmin.auth.admin.generateLink({
      type: effectiveTipo,
      email: data.email,
      options: { redirectTo },
    });

    // Fallback: se o convite falhar por usuário já cadastrado, envia magic link automaticamente
    if (linkResp.error && effectiveTipo === "invite") {
      const msg = (linkResp.error.message || "").toLowerCase();
      if (msg.includes("already been registered") || msg.includes("already registered") || msg.includes("already exists")) {
        effectiveTipo = "magiclink";
        linkResp = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: data.email,
          options: { redirectTo },
        });
      }
    }

    const { data: linkData, error } = linkResp;
    if (error) {
      console.error(`[adminSendAuthEmail] ${effectiveTipo} link failed`, error);
      throw new Error(error.message || `Falha ao gerar link de ${effectiveTipo}`);
    }

    const confirmationUrl = linkData?.properties?.action_link;
    if (!confirmationUrl) {
      console.error("[adminSendAuthEmail] generateLink returned no action_link", linkData);
      throw new Error("O Supabase não retornou o link de autenticação.");
    }

    const emailConfig = {
      invite: {
        subject: "Você foi convidado — Hub Lavoro Seguros",
        element: React.createElement(InviteEmail, {
          siteName,
          siteUrl,
          confirmationUrl,
        }),
      },
      magiclink: {
        subject: "Seu link de acesso — Hub Lavoro Seguros",
        element: React.createElement(MagicLinkEmail, {
          siteName,
          confirmationUrl,
        }),
      },
      recovery: {
        subject: "Redefinição de senha — Hub Lavoro Seguros",
        element: React.createElement(RecoveryEmail, {
          siteName,
          confirmationUrl,
        }),
      },
    }[data.tipo];

    const html = await render(emailConfig.element);
    const text = await render(emailConfig.element, { plainText: true });

    await sendLovableEmail(
      {
        to: data.email,
        from,
        sender_domain: senderDomain,
        subject: emailConfig.subject,
        html,
        text,
        purpose: "transactional",
        label: `auth:${data.tipo}`,
        idempotency_key: `admin-auth-${data.tipo}-${data.email}-${crypto.randomUUID()}`,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );

    if (data.user_id) {
      await context.supabase.rpc("rpc_admin_log_convite" as never, {
        _user_id: data.user_id,
        _tipo: data.tipo,
      } as never);
    }

    return { ok: true };
  });
