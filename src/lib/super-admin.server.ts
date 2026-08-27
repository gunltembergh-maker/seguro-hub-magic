import React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { SuperAdminAlertEmail } from "@/lib/email-templates/super-admin-alert";
import { lavoroAdmin } from "@/integrations/supabase/lavoro-admin.server";

const ALERT_TO = "alessandro.oliveira@lavoroseguros.com.br";
const SENDER_DOMAIN = "notify.hub.lavoroseguros.com.br";

export const AREA_LABELS: Record<string, string> = {
  uso: "Admin › Relatório de Uso",
  emails_schedules: "Admin › E-mails › Agendamento",
  perfis: "Admin › Perfis de Acesso",
  usuarios: "Admin › Usuários",
};

interface VerifyInput {
  area: string;
  senha: string;
  tentativas: number;
}

interface AuthContext {
  supabase: {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  userId: string;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySuperAdminPassword(data: VerifyInput, context: AuthContext) {
  const expected = process.env["SUPER_ADMIN_PASSWORD"];
  if (!expected) {
    throw new Error("Senha de super administrador não configurada. Contate o responsável pelo Hub.");
  }

  const area = AREA_LABELS[data.area] ?? data.area;

  if (safeEqual(data.senha, expected)) {
    await lavoroAdmin.from("user_activity_log").insert({
      user_id: context.userId,
      acao: "super_admin_desbloqueio",
      detalhes: { area, resultado: "sucesso" },
    });
    return { ok: true as const };
  }

  const { data: profile } = await lavoroAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", context.userId)
    .maybeSingle();

  await lavoroAdmin.from("user_activity_log").insert({
    user_id: context.userId,
    acao: "super_admin_senha_incorreta",
    detalhes: { area, tentativas: data.tentativas },
  });

  const quando = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (apiKey) {
    const element = React.createElement(SuperAdminAlertEmail, {
      area,
      tentativas: data.tentativas,
      usuarioNome: profile?.full_name ?? null,
      usuarioEmail: profile?.email ?? null,
      quando,
      origem: null,
    });
    const html = await render(element);
    const texto = await render(element, { plainText: true });
    const messageId = `super-admin-alert-${crypto.randomUUID()}`;

    try {
      const result = await sendLovableEmail(
        {
          to: ALERT_TO,
          from: `Hub Lavoro Seguros <noreply@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `⚠️ Senha de super administrador incorreta — ${area}`,
          html,
          text: texto,
          purpose: "transactional",
          label: "security:super-admin",
          idempotency_key: messageId,
        },
        { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
      await lavoroAdmin.from("email_send_log").insert({
        message_id: result.message_id ?? messageId,
        template_name: "security:super-admin",
        recipient_email: ALERT_TO,
        status: result.success ? (result.status ?? "sent") : "failed",
        metadata: { area, tentativas: data.tentativas },
      });
    } catch (error) {
      await lavoroAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "security:super-admin",
        recipient_email: ALERT_TO,
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
        metadata: { area },
      });
    }
  }

  return { ok: false as const };
}
