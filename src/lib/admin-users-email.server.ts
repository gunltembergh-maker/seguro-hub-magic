import { render } from "@react-email/render";
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import React from "react";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { lavoroAdmin } from "@/integrations/supabase/lavoro-admin.server";

type AuthEmailType = "invite" | "magiclink" | "recovery";

interface SendAdminAuthEmailInput {
  userId?: string | null;
  email: string;
  tipo: AuthEmailType;
  redirectTo?: string;
}

interface AuthContext {
  supabase: any;
  userId: string;
}

export async function sendAdminAuthEmail(data: SendAdminAuthEmailInput, context: AuthContext) {
  const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (roleError) throw new Error(roleError.message);
  if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada para envio de e-mail.");

  const siteUrl = (process.env.PUBLIC_SITE_URL ?? "https://hub.lavoroseguros.com.br").replace(/\/$/, "");
  const siteName = "Hub Lavoro Seguros";
  const senderDomain = "notify.hub.lavoroseguros.com.br";
  const redirectTo = data.redirectTo ?? `${siteUrl}/auth`;

  let linkResp = await lavoroAdmin.auth.admin.generateLink({
    type: data.tipo,
    email: data.email,
    options: { redirectTo },
  });

  if (linkResp.error && data.tipo === "invite") {
    const message = linkResp.error.message.toLowerCase();
    if (message.includes("already been registered") || message.includes("already registered") || message.includes("already exists")) {
      linkResp = await lavoroAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
        options: { redirectTo },
      });
    }
  }

  if (linkResp.error) throw new Error(linkResp.error.message || `Falha ao gerar link de ${data.tipo}`);
  const confirmationUrl = linkResp.data?.properties?.action_link;
  if (!confirmationUrl) throw new Error("O Supabase não retornou o link de autenticação.");

  const { data: profile } = await lavoroAdmin
    .from("profiles")
    .select("full_name")
    .ilike("email", data.email)
    .maybeSingle();
  const userName = profile?.full_name ?? null;
  const subjectName = userName?.trim() || "Você";
  const emailConfig = {
    invite: {
      subject: `${subjectName}, seu acesso ao Hub Lavoro Seguros está pronto`,
      element: React.createElement(InviteEmail, { siteName, siteUrl, confirmationUrl, userName, userEmail: data.email }),
    },
    magiclink: {
      subject: `${subjectName}, seu acesso ao Hub Lavoro Seguros está pronto`,
      element: React.createElement(MagicLinkEmail, { siteName, confirmationUrl, userName, userEmail: data.email }),
    },
    recovery: {
      subject: `${subjectName}, redefinição de senha do Hub Lavoro Seguros`,
      element: React.createElement(RecoveryEmail, { siteName, confirmationUrl, userName, userEmail: data.email }),
    },
  }[data.tipo];

  const messageId = `admin-auth-${data.tipo}-${data.email}-${crypto.randomUUID()}`;
  const html = await render(emailConfig.element);
  const text = await render(emailConfig.element, { plainText: true });

  try {
    const result = await sendLovableEmail({
      to: data.email,
      from: `${siteName} <noreply@${senderDomain}>`,
      sender_domain: senderDomain,
      subject: emailConfig.subject,
      html,
      text,
      purpose: "transactional",
      label: `auth:${data.tipo}`,
      idempotency_key: messageId,
    }, { apiKey, sendUrl: process.env.LOVABLE_SEND_URL });

    if (!result.success) {
      throw new Error(`O serviço de e-mail não aceitou o envio${result.status ? `: ${result.status}` : "."}`);
    }

    await lavoroAdmin.from("email_send_log").insert({
      message_id: result.message_id ?? messageId,
      template_name: `auth:${data.tipo}`,
      recipient_email: data.email,
      status: result.status ?? "sent",
      metadata: { subject: emailConfig.subject, workflow_id: result.workflow_id ?? null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof EmailAPIError && error.status === 429 ? "rate_limited" : "failed";
    await lavoroAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: `auth:${data.tipo}`,
      recipient_email: data.email,
      status,
      error_message: message,
      metadata: { subject: emailConfig.subject },
    });
    throw error;
  }

  if (data.userId) {
    await context.supabase.rpc("rpc_admin_log_convite", { _user_id: data.userId, _tipo: data.tipo });
  }

  return { ok: true, accepted: true };
}