import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import React from "react";
import { AdminAuditEmail, type AuditEvento } from "@/lib/email-templates/admin-audit";
import { lavoroAdmin } from "@/integrations/supabase/lavoro-admin.server";

const DESTINATARIO = "alessandro.oliveira@lavoroseguros.com.br";
const SENDER_DOMAIN = "notify.hub.lavoroseguros.com.br";

const LABEL_ACAO: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

const LABEL_ENTIDADE: Record<string, string> = {
  profiles: "Usuário",
  user_roles: "Papel de usuário",
  perfis_acesso: "Perfil de acesso",
};

function fmtValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function notificarAuditoriaPendente() {
  const { data: rows, error } = await lavoroAdmin
    .from("admin_audit_log")
    .select("*")
    .is("notificado_em", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { enviados: 0 };

  const eventos: AuditEvento[] = (rows as any[]).map((r) => {
    const mudancas: AuditEvento["mudancas"] = [];
    if (r.mudancas && typeof r.mudancas === "object") {
      for (const [campo, val] of Object.entries(r.mudancas as Record<string, any>)) {
        mudancas.push({ campo, antes: fmtValor(val?.antes), depois: fmtValor(val?.depois) });
      }
    } else if (r.acao === "INSERT" && r.depois) {
      for (const [campo, val] of Object.entries(r.depois as Record<string, any>)) {
        if (["id", "created_at", "updated_at"].includes(campo)) continue;
        mudancas.push({ campo, antes: "—", depois: fmtValor(val) });
      }
    } else if (r.acao === "DELETE" && r.antes) {
      for (const [campo, val] of Object.entries(r.antes as Record<string, any>)) {
        if (["id", "created_at", "updated_at"].includes(campo)) continue;
        mudancas.push({ campo, antes: fmtValor(val), depois: "—" });
      }
    }
    return {
      id: r.id as string,
      ator: r.ator_email
        ? `${r.ator_nome ?? "—"} (${r.ator_email})`
        : "Sistema / processo automático",
      acao: LABEL_ACAO[r.acao as string] ?? r.acao,
      entidade: LABEL_ENTIDADE[r.entidade as string] ?? r.entidade,
      alvo: r.alvo_descricao ?? r.alvo_id ?? "—",
      quando: fmtData(r.created_at as string),
      mudancas,
    };
  });

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const element = React.createElement(AdminAuditEmail, { eventos });
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    eventos.length === 1
      ? `[Auditoria Hub] ${eventos[0]!.acao} em ${eventos[0]!.entidade} — ${eventos[0]!.alvo}`
      : `[Auditoria Hub] ${eventos.length} alterações administrativas`;

  const ids = (rows as any[]).map((r) => r.id as string);

  try {
    const result = await sendLovableEmail(
      {
        to: DESTINATARIO,
        from: `Hub Lavoro Seguros <noreply@${SENDER_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "admin:auditoria",
        idempotency_key: `audit-${ids[0]}-${ids.length}`,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );
    if (!result.success) throw new Error(`Envio recusado${result.status ? `: ${result.status}` : "."}`);

    await lavoroAdmin
      .from("admin_audit_log")
      .update({ notificado_em: new Date().toISOString(), notificacao_erro: null })
      .in("id", ids);

    await lavoroAdmin.from("email_send_log").insert({
      message_id: result.message_id ?? `audit-${ids[0]}`,
      template_name: "admin:auditoria",
      recipient_email: DESTINATARIO,
      status: result.status ?? "sent",
      metadata: { subject, eventos: ids.length },
    });

    return { enviados: ids.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await lavoroAdmin.from("admin_audit_log").update({ notificacao_erro: message }).in("id", ids);
    throw e;
  }
}
