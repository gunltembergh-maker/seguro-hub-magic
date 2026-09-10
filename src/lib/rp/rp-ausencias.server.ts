// Server-only: processa as reservas expiradas e envia os e-mails de ausência.
// Idempotente: marca `ausencia_notificada = true` após o disparo.
import { dataBR, hhmm } from "./rp-tipos";
import { aplicarVariaveis, enviarHtml } from "./rp-email.server";

export async function processarAusenciasPendentes(): Promise<{
  processadas: number;
  enviados: number;
}> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const { data: reservas, error } = await lavoroAdmin
    .from("rp_reservas")
    .select("id, data, hora_inicio, hora_fim, user_id, rp_posicoes(numero)")
    .eq("status", "expirada")
    .eq("ausencia_notificada", false)
    .limit(50);
  if (error) throw error;
  if (!reservas?.length) return { processadas: 0, enviados: 0 };

  const [{ data: tpls }, { data: settings }] = await Promise.all([
    lavoroAdmin
      .from("rp_email_templates")
      .select("tipo, assunto, corpo_html, ativo")
      .in("tipo", ["ausencia", "rh_ausencia"]),
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
  const tplColab = lista.find((t) => t.tipo === "ausencia");
  const tplRh = lista.find((t) => t.tipo === "rh_ausencia");

  const cfg = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const enviarUsuario = cfg.get("rp_enviar_email_usuario") !== false;
  const emailsRh = Array.isArray(cfg.get("rp_emails_rh")) ? (cfg.get("rp_emails_rh") as string[]) : [];
  const tolerancia = String(cfg.get("rp_tolerancia_checkin_min") ?? 15);
  const checkinAntes = String(cfg.get("rp_checkin_liberado_antes_min") ?? 30);

  const userIds = [...new Set(reservas.map((r) => r.user_id))];
  const { data: perfis } = await lavoroAdmin
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  const perfilPorUser = new Map((perfis ?? []).map((p) => [p.user_id, p]));

  let enviados = 0;

  for (const r of reservas) {
    const perfil = perfilPorUser.get(r.user_id);
    const posicao = (r as { rp_posicoes?: { numero: number } | null }).rp_posicoes?.numero ?? "";
    const vars = {
      nome: perfil?.full_name ?? "",
      posicao: String(posicao),
      data: dataBR(r.data),
      hora_inicio: hhmm(r.hora_inicio),
      hora_fim: hhmm(r.hora_fim),
      tolerancia_min: tolerancia,
      checkin_antes_min: checkinAntes,
    };

    const destinos: { to: string; tipoTpl: string; assunto: string; html: string }[] = [];
    const vistos = new Set<string>();

    if (enviarUsuario && perfil?.email && tplColab && tplColab.ativo !== false) {
      vistos.add(perfil.email.toLowerCase());
      destinos.push({
        to: perfil.email,
        tipoTpl: "ausencia",
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
        destinos.push({ to: e, tipoTpl: "rh_ausencia", assunto: assuntoRh, html: htmlRh });
      }
    }

    const resultados = await Promise.all(
      destinos.map((d, i) =>
        enviarHtml({
          to: d.to,
          subject: d.assunto,
          html: d.html,
          templateName: `rp-${d.tipoTpl}`,
          idempotencyKey: `rp-${d.tipoTpl}-${r.id}-${i}`,
        }),
      ),
    );
    enviados += resultados.filter((x) => x.ok).length;

    await lavoroAdmin.from("rp_reservas").update({ ausencia_notificada: true }).eq("id", r.id);
  }

  return { processadas: reservas.length, enviados };
}
