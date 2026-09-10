import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dataBR, hhmm } from "./rp-tipos";

const InputSchema = z.object({
  tipo: z.enum(["confirmacao", "cancelamento"]),
  /** Cancelamento feito por administrador: o e-mail do chamador não é o do dono da reserva. */
  apenas_rh: z.boolean().optional(),
  reserva: z.object({
    id: z.string(),
    nome: z.string().optional().nullable(),
    posicao_numero: z.union([z.number(), z.string()]),
    data: z.string(),
    hora_inicio: z.string(),
    hora_fim: z.string(),
  }),
});

const hhmm = (h: string) => (h ?? "").slice(0, 5);
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Dispara os e-mails de confirmação/cancelamento de reserva de posição.
 * Nunca lança: falha de e-mail não pode desfazer a reserva.
 */
export const enviarEmailReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
      const { enviarHtml, aplicarVariaveis } = await import("./rp-email.server");

      const [{ data: tpl }, { data: settings }] = await Promise.all([
        lavoroAdmin
          .from("rp_email_templates")
          .select("assunto, corpo_html, ativo")
          .eq("tipo", data.tipo)
          .maybeSingle(),
        lavoroAdmin
          .from("hub_admin_settings")
          .select("key, value")
          .in("key", ["rp_enviar_email_usuario", "rp_emails_rh", "rp_tolerancia_checkin_min"]),
      ]);

      if (!tpl || tpl.ativo === false) return { ok: false, motivo: "template_inativo" };

      const cfg = new Map((settings ?? []).map((s: any) => [s.key, s.value]));
      const enviarUsuario = cfg.get("rp_enviar_email_usuario") !== false;
      const emailsRh = Array.isArray(cfg.get("rp_emails_rh")) ? (cfg.get("rp_emails_rh") as string[]) : [];
      const tolerancia = String(cfg.get("rp_tolerancia_checkin_min") ?? 15);

      const vars = {
        nome: data.reserva.nome ?? "",
        posicao: String(data.reserva.posicao_numero),
        data: dataBR(data.reserva.data),
        hora_inicio: hhmm(data.reserva.hora_inicio),
        hora_fim: hhmm(data.reserva.hora_fim),
        tolerancia_min: tolerancia,
      };

      const assunto = aplicarVariaveis(tpl.assunto, vars);
      const html = aplicarVariaveis(tpl.corpo_html, vars);

      const destinatarios = new Set<string>();
      const emailUsuario = (context.claims?.email as string | undefined) ?? undefined;
      if (!data.apenas_rh && enviarUsuario && emailUsuario) destinatarios.add(emailUsuario);
      emailsRh.filter(Boolean).forEach((e) => destinatarios.add(e));

      const resultados = await Promise.all(
        [...destinatarios].map((to, i) =>
          enviarHtml({
            to,
            subject: assunto,
            html,
            templateName: `rp-${data.tipo}`,
            idempotencyKey: `rp-${data.tipo}-${data.reserva.id}-${i}`,
          }),
        ),
      );

      return {
        ok: true,
        enviados: resultados.filter((r) => r.ok).length,
        falhas: resultados.filter((r) => !r.ok).length,
      };
    } catch (error) {
      console.error("[rp-email] falha no disparo", error);
      return { ok: false, motivo: error instanceof Error ? error.message : "erro" };
    }
  });
