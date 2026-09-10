// Server-only: envio dos e-mails do módulo Reserva de Posições.
// Usa os modelos gravados em `rp_email_templates` e registra em `email_send_log`.
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";

const SITE_NAME = "Hub Lavoro Seguros";
const SENDER_DOMAIN = "notify.hub.lavoroseguros.com.br";
const FROM_DOMAIN = "notify.hub.lavoroseguros.com.br";

export interface ReservaEmailDados {
  nome: string;
  posicao: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tolerancia_min: string;
}

export function aplicarVariaveis(texto: string, dados: ReservaEmailDados): string {
  return Object.entries(dados).reduce(
    (acc, [chave, valor]) => acc.replaceAll(`{{${chave}}}`, valor ?? ""),
    texto,
  );
}

async function logEnvio(
  messageId: string,
  templateName: string,
  recipient: string,
  status: string,
  errorMessage: string | null,
  subject: string,
) {
  try {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    await lavoroAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: recipient,
      status,
      error_message: errorMessage,
      metadata: { subject },
    });
  } catch (e) {
    console.warn("[rp-email] falha ao registrar log", e);
  }
}

/** Envia um e-mail HTML avulso. Nunca lança: devolve ok/erro. */
export async function enviarHtml(opts: {
  to: string;
  subject: string;
  html: string;
  templateName: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, erro: "LOVABLE_API_KEY não configurada" };

  try {
    await sendLovableEmail(
      {
        to: opts.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: opts.subject,
        html: opts.html,
        text: opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        purpose: "transactional",
        label: opts.templateName,
        idempotency_key: opts.idempotencyKey,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );
  } catch (error) {
    const suprimido = error instanceof EmailAPIError && error.code === "recipient_suppressed";
    const status = suprimido
      ? "suppressed"
      : error instanceof EmailAPIError && error.status === 429
        ? "rate_limited"
        : "failed";
    const msg = error instanceof Error ? error.message : String(error);
    await logEnvio(opts.idempotencyKey, opts.templateName, opts.to, status, msg, opts.subject);
    return { ok: false, erro: msg };
  }

  await logEnvio(opts.idempotencyKey, opts.templateName, opts.to, "sent", null, opts.subject);
  return { ok: true };
}
