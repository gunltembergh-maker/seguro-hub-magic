import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dataBR, hhmm } from "./rp-tipos";

const InputSchema = z.object({
  tipo: z.enum(["confirmacao", "cancelamento"]),
  /** Cancelamento feito por administrador: o e-mail do chamador não é o do dono da reserva. */
  apenas_rh: z.boolean().optional(),
  /** Cancelamento feito por RH/Admin sobre a reserva de outra pessoa. */
  por_terceiro: z.boolean().optional(),
  /** Dono da reserva (usado quando o cancelamento veio do RH/Admin). */
  dono_user_id: z.string().optional().nullable(),
  /** Justificativa obrigatória do cancelamento por terceiro. */
  motivo: z.string().optional().nullable(),
  reserva: z.object({
    id: z.string(),
    nome: z.string().optional().nullable(),
    posicao_numero: z.union([z.number(), z.string()]),
    data: z.string(),
    hora_inicio: z.string(),
    hora_fim: z.string(),
  }),
});



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

      // Cancelamento feito por RH/Admin usa o modelo próprio, com a justificativa.
      const porTerceiro = data.tipo === "cancelamento" && data.por_terceiro === true;
      const tipoColab = porTerceiro ? "cancelamento_admin" : data.tipo;
      const tipoRh = `rh_${data.tipo}`;

      const [{ data: tpls }, { data: settings }] = await Promise.all([
        lavoroAdmin
          .from("rp_email_templates")
          .select("tipo, assunto, corpo_html, ativo")
          .in("tipo", [tipoColab, tipoRh]),
        lavoroAdmin
          .from("hub_admin_settings")
          .select("key, value")
          .in("key", [
            "rp_enviar_email_usuario",
            "rp_emails_rh",
            "rp_tolerancia_checkin_min",
            "rp_checkin_liberado_antes_min",
          ]),
      ]);

      const lista = tpls ?? [];
      const tplColab = lista.find((t: any) => t.tipo === tipoColab);
      const tplRh = lista.find((t: any) => t.tipo === tipoRh);
      if ((!tplColab || tplColab.ativo === false) && (!tplRh || tplRh.ativo === false)) {
        return { ok: false, motivo: "template_inativo" };
      }


      const cfg = new Map((settings ?? []).map((s: any) => [s.key, s.value]));
      const enviarUsuario = cfg.get("rp_enviar_email_usuario") !== false;
      const emailsRh = Array.isArray(cfg.get("rp_emails_rh")) ? (cfg.get("rp_emails_rh") as string[]) : [];
      const tolerancia = String(cfg.get("rp_tolerancia_checkin_min") ?? 15);
      const checkinAntes = String(cfg.get("rp_checkin_liberado_antes_min") ?? 30);

      // Quando o cancelamento vem do RH/Admin, o destinatário é o dono da reserva.
      let emailDono: string | undefined;
      let nomeDono: string | undefined;
      if (porTerceiro && data.dono_user_id) {
        const { data: perfil } = await lavoroAdmin
          .from("profiles")
          .select("email, nome")
          .eq("user_id", data.dono_user_id)
          .maybeSingle();
        emailDono = (perfil as any)?.email ?? undefined;
        nomeDono = (perfil as any)?.nome ?? undefined;
      }

      const vars = {
        nome: nomeDono ?? data.reserva.nome ?? "",
        posicao: String(data.reserva.posicao_numero),
        data: dataBR(data.reserva.data),
        hora_inicio: hhmm(data.reserva.hora_inicio),
        hora_fim: hhmm(data.reserva.hora_fim),
        tolerancia_min: tolerancia,
        checkin_antes_min: checkinAntes,
        motivo: data.motivo ?? "",
      };

      // Envios: colaborador recebe o template padrão; o RH recebe o template rh_*.
      type Envio = { to: string; tipoTpl: string; assunto: string; html: string };
      const envios: Envio[] = [];
      const vistos = new Set<string>();

      const emailColab = porTerceiro
        ? emailDono
        : ((context.claims?.email as string | undefined) ?? undefined);
      const podeColab = porTerceiro ? true : !data.apenas_rh;
      if (podeColab && enviarUsuario && emailColab && tplColab && tplColab.ativo !== false) {
        vistos.add(emailColab.toLowerCase());
        envios.push({
          to: emailColab,
          tipoTpl: tipoColab,
          assunto: aplicarVariaveis(tplColab.assunto, vars),
          html: aplicarVariaveis(tplColab.corpo_html, vars),
        });
      }

      if (tplRh && tplRh.ativo !== false) {
        const assuntoRh = aplicarVariaveis(tplRh.assunto, vars);
        const htmlRh = aplicarVariaveis(tplRh.corpo_html, vars);
        for (const e of emailsRh.filter(Boolean)) {
          if (vistos.has(e.toLowerCase())) continue;
          vistos.add(e.toLowerCase());
          envios.push({ to: e, tipoTpl: tipoRh, assunto: assuntoRh, html: htmlRh });
        }
      }


      const resultados = await Promise.all(
        envios.map((e, i) =>
          enviarHtml({
            to: e.to,
            subject: e.assunto,
            html: e.html,
            templateName: `rp-${e.tipoTpl}`,
            idempotencyKey: `rp-${e.tipoTpl}-${data.reserva.id}-${i}`,
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
