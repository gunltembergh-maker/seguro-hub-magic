// Reenvio manual do e-mail de Nova Demanda (Garantia → Formulário Admin).
//
// A permissão é verificada NO SERVIDOR, com a sessão do usuário, através de
// public.pode_ver_garantia_formulario(). Nada do que a interface manda é
// considerado. O envio reaproveita exatamente o mesmo template e o mesmo
// caminho do fluxo automático, e NÃO altera `email_enviado_em` — essa coluna
// continua marcando o primeiro envio automático.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ solicitacaoId: z.string().uuid() });

export const reenviarEmailNovaDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: pode, error: permErro } = await context.supabase.rpc(
      "pode_ver_garantia_formulario",
    );
    if (permErro || pode !== true) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { enviarEmailNovaDemanda } = await import("./garantia-judicial-email.server");
    const resultado = await enviarEmailNovaDemanda(data.solicitacaoId, undefined, {
      reenvioManual: true,
      disparadoPor: context.userId,
    });

    if (!resultado.ok) {
      return { ok: false as const, erro: resultado.erro, detalhe: resultado.detalhe ?? null };
    }
    return { ok: true as const, messageId: resultado.messageId };
  });
