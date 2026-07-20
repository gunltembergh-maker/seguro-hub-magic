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

    // effectiveTipo controla apenas qual template/assunto será enviado.
    // Mantemos o tipo escolhido pelo admin (ex.: "invite") mesmo quando o
    // usuário já existe, para permitir reenvio e validação do layout.
    const effectiveTipo: "invite" | "magiclink" | "recovery" = data.tipo;

    let linkResp = await supabaseAdmin.auth.admin.generateLink({
      type: data.tipo,
      email: data.email,
      options: { redirectTo },
    });

    // Fallback: se "invite" falhar porque o e-mail já está cadastrado,
    // gera um magiclink válido e ainda assim envia o template de convite.
    if (linkResp.error && data.tipo === "invite") {
      const msg = (linkResp.error.message || "").toLowerCase();
      if (
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already exists")
      ) {
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

    // Busca nome do usuário para personalizar a saudação.
    let userName: string | null = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles" as never)
        .select("nome_completo,nome" as never)
        .eq("email" as never, data.email as never)
        .maybeSingle();
      const p = profile as { nome_completo?: string | null; nome?: string | null } | null;
      userName = p?.nome_completo ?? p?.nome ?? null;
    } catch (e) {
      console.warn("[adminSendAuthEmail] profile lookup failed", e);
    }

    const subjectName = (userName ?? "").trim() || "Você";
    const emailConfig = {
      invite: {
        subject: `${subjectName}, seu acesso ao Hub Lavoro Seguros está pronto`,
        element: React.createElement(InviteEmail, {
          siteName,
          siteUrl,
          confirmationUrl,
          userName,
          userEmail: data.email,
        }),
      },
      magiclink: {
        subject: `${subjectName}, seu acesso ao Hub Lavoro Seguros está pronto`,
        element: React.createElement(MagicLinkEmail, {
          siteName,
          confirmationUrl,
          userName,
          userEmail: data.email,
        }),
      },
      recovery: {
        subject: `${subjectName}, redefinição de senha do Hub Lavoro Seguros`,
        element: React.createElement(RecoveryEmail, {
          siteName,
          confirmationUrl,
          userName,
          userEmail: data.email,
        }),
      },
    }[effectiveTipo];

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
        label: `auth:${effectiveTipo}`,
        idempotency_key: `admin-auth-${effectiveTipo}-${data.email}-${crypto.randomUUID()}`,
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
