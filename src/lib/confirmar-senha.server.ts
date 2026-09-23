import { lavoroAdmin } from "@/integrations/supabase/lavoro-admin.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

interface Contexto {
  userId: string;
  claims?: { email?: string } | Record<string, unknown>;
}

function mascarar(email: string) {
  const [local, dominio] = email.split("@");
  return `${local.slice(0, 2)}***@${dominio ?? ""}`;
}

/** Gera o código de redefinição da senha de aprovação e envia por e-mail. Nunca devolve o código. */
export async function enviarCodigoRedefinicao(context: Contexto) {
  let email = (context.claims as { email?: string } | undefined)?.email ?? null;
  if (!email) {
    const { data: u } = await lavoroAdmin.auth.admin.getUserById(context.userId);
    email = u?.user?.email ?? null;
  }
  if (!email) throw new Error("Não encontramos o seu e-mail para enviar o código.");

  const { data: codigo, error } = await lavoroAdmin.rpc("senha_aprovacao_gerar_codigo" as never, {
    p_user_id: context.userId,
  } as never);
  if (error) throw new Error((error as { message?: string }).message || "Não foi possível gerar o código.");

  await sendTemplateEmail("senha-aprovacao-codigo", email, {
    templateData: { codigo: String(codigo) },
  });

  return { ok: true as const, email_mascarado: mascarar(email) };
}
