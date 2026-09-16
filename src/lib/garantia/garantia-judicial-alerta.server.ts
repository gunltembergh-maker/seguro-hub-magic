// Alerta técnico do fluxo de Garantia Judicial.
//
// Objetivo: avisar o time TÉCNICO (Operações) quando uma solicitação falha
// ou simplesmente para de andar. Não é a demanda; é um aviso de incidente.
//
// Dois casos, sempre com `alerta_enviado_em` nulo:
//   1. Falha declarada  — status `erro`.
//   2. Parada silenciosa — status diferente de `email_enviado` e `erro`,
//      com `criado_em` mais antigo que 30 minutos. O fluxo normal termina em
//      menos de 4 minutos, então 30 é margem larga contra alarme falso.
//
// Envio pelo Microsoft Graph, reaproveitando o helper de token. Sem anexos.
// `alerta_enviado_em` só é carimbado depois de um envio bem-sucedido: se o
// alerta falhar, a linha continua elegível e tenta de novo no próximo ciclo.

import { obterTokenGraph } from "@/lib/graph/graph-token.server";

/**
 * Time TÉCNICO — quem constrói e mantém o sistema.
 * Recebe os alertas de erro/travamento. Endereço permanente.
 */
export const DESTINATARIO_ALERTA_TECNICO = "operacoes@lavoroseguros.com.br";

const REMETENTE = "naoresponda@lavoroseguros.com.br";
const TEMPLATE_NAME = "garantia-judicial-alerta";
const VIA = "graph_alerta";

/** Máximo de alertas por execução, para não gerar rajada. */
const MAX_POR_EXECUCAO = 3;

/** Tempo sem concluir a partir do qual a solicitação é considerada travada. */
const TRAVADA_APOS_MS = 30 * 60 * 1000;

const ERRO_MAX_CHARS = 600;

type Any = Record<string, any>;

const AMBAR = "#B45309";
const VERMELHO = "#B91C1C";
const FUNDO_ALERTA = "#FEF3C7";
const BORDA = "#E5E7EB";
const TEXTO = "#1F2937";
const MUTED = "#6B7280";

function escapar(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remove qualquer HTML e trunca — mensagens de erro chegam com página inteira às vezes. */
function limparErro(texto: unknown): string {
  const s = String(texto ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > ERRO_MAX_CHARS ? `${s.slice(0, ERRO_MAX_CHARS)}… [truncado]` : s;
}

function cnpjFmt(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 14) return String(v ?? "—");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function dataHoraBrt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const data = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora} (horário de Brasília)`;
}

function tempoParado(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return `${h}h${rest ? ` ${rest}min` : ""}`;
  const dias = Math.floor(h / 24);
  return `${dias}d ${h % 24}h`;
}

/** Em que etapa a solicitação parou, a partir do status. */
export function etapaDoStatus(status: string, xlsxPath: string | null | undefined): string {
  switch (status) {
    case "recebida":
      return "recebida — aguardando o início da consulta de mercado";
    case "consultando_mercado":
      return "consulta de mercado em andamento (sem conclusão)";
    case "mercado_consultado":
      return xlsxPath
        ? "planilha pronta — aguardando o envio do e-mail de nova demanda"
        : "consulta concluída — aguardando a geração da planilha";
    case "erro":
      return "interrompida com falha declarada";
    default:
      return `status "${status}"`;
  }
}

function contatoSolicitante(sol: Any): {
  empresa: string;
  nome: string;
  email: string;
  telefone: string;
} {
  const validado = (sol.dados_formulario as Any)?.responsavel;
  const bruto = ((sol.payload_bruto as Any)?.formulario as Any)?.responsavel;
  const r = (validado && typeof validado === "object" ? validado : bruto) as Any | undefined;
  const v = (x: unknown) => String(x ?? "").trim() || "não informado";
  return {
    empresa: v(r?.empresa),
    nome: v(r?.nome),
    email: v(r?.email),
    telefone: v(r?.telefone),
  };
}

function linha(rotulo: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top">${escapar(rotulo)}</td>
    <td style="padding:6px 0;color:${TEXTO};font-size:13px;font-weight:600">${escapar(valor)}</td>
  </tr>`;
}

function montarHtml(opts: {
  caso: string;
  etapa: string;
  protocolo: string;
  tomador: string;
  cnpj: string;
  processo: string;
  chegouEm: string;
  parado: string;
  erro: string;
  contato: { empresa: string; nome: string; email: string; telefone: string };
}): string {
  const c = opts.contato;
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:32px 0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${BORDA};border-radius:12px;overflow:hidden">
<tr><td style="background:${VERMELHO};padding:16px 24px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">⚠ Alerta técnico · Garantia Judicial</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:${VERMELHO}">Uma solicitação não concluiu o fluxo</p>
<div style="background:${FUNDO_ALERTA};border-left:4px solid ${AMBAR};padding:12px 16px;border-radius:6px;margin:0 0 20px;color:${TEXTO};font-size:14px;line-height:21px">
  <strong style="color:${AMBAR}">${escapar(opts.caso)}</strong><br/>Etapa: ${escapar(opts.etapa)}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">
${linha("Protocolo", opts.protocolo)}
${linha("Tomador", opts.tomador)}
${linha("CNPJ", opts.cnpj)}
${linha("Processo", opts.processo)}
${linha("Chegou em", opts.chegouEm)}
${linha("Parada há", opts.parado)}
</table>
${
  opts.erro
    ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">Mensagem de erro</p>
<div style="background:#F9FAFB;border:1px solid ${BORDA};border-radius:6px;padding:12px 14px;margin:0 0 20px;font-family:Courier,monospace;font-size:12px;color:${TEXTO};line-height:18px;word-break:break-word">${escapar(opts.erro)}</div>`
    : ""
}
<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">Solicitante</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">
${linha("Empresa", c.empresa)}
${linha("Nome", c.nome)}
${linha("E-mail", c.email)}
${linha("Telefone", c.telefone)}
</table>
<p style="margin:0;font-size:13px;color:${TEXTO};line-height:20px">O que fazer: verifique a solicitação no banco pelo protocolo <strong>${escapar(opts.protocolo)}</strong> (tabela <code>garantia_judicial_solicitacoes</code>) e confirme em que ponto o fluxo parou antes de reprocessar.</p>
</td></tr>
<tr><td style="padding:0 24px 22px;font-size:11px;color:${MUTED};line-height:17px">Hub Lavoro Seguros · aviso automático do monitoramento de Garantia Judicial. Sem anexos: este e-mail não é a demanda.</td></tr>
</table></td></tr></table></body></html>`;
}

async function logEnvio(
  messageId: string,
  status: string,
  errorMessage: string | null,
  subject: string,
) {
  try {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    await lavoroAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: DESTINATARIO_ALERTA_TECNICO,
      status,
      error_message: errorMessage,
      metadata: { subject, via: VIA },
    });
  } catch (e) {
    console.warn("[garantia-judicial-alerta] falha ao registrar log", e);
  }
}

async function enviarAlerta(sol: Any): Promise<{ ok: boolean; erro?: string }> {
  const protocolo = sol.protocolo || sol.id;
  const tomador = sol.nome_tomador || "—";
  const caso =
    sol.status === "erro"
      ? "Falha declarada: o processamento registrou erro e foi interrompido."
      : "Parada sem conclusão: a solicitação não avançou dentro do tempo esperado.";

  const html = montarHtml({
    caso,
    etapa: etapaDoStatus(String(sol.status), sol.xlsx_path),
    protocolo: String(protocolo),
    tomador: String(tomador),
    cnpj: cnpjFmt(sol.cnpj_tomador),
    processo: String(sol.numero_processo || "—"),
    chegouEm: dataHoraBrt(sol.criado_em),
    parado: tempoParado(sol.criado_em),
    erro: limparErro(sol.erro_mensagem),
    contato: contatoSolicitante(sol),
  });

  const subject = `[ATENÇÃO] Garantia Judicial travada · ${protocolo} · ${tomador}`;
  const messageId = `gj-alerta-${sol.id}`;

  try {
    const token = await obterTokenGraph();
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(REMETENTE)}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            from: { emailAddress: { address: REMETENTE } },
            toRecipients: [{ emailAddress: { address: DESTINATARIO_ALERTA_TECNICO } }],
          },
          saveToSentItems: true,
        }),
      },
    );
    if (!resp.ok) {
      let codigo = "erro_desconhecido";
      try {
        const corpo: any = await resp.json();
        codigo = String(corpo?.error?.code || corpo?.error?.message || codigo).slice(0, 120);
      } catch {
        /* resposta sem JSON */
      }
      throw new Error(`Graph sendMail [${resp.status}]: ${codigo}`);
    }
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await logEnvio(messageId, "failed", msg, subject);
    return { ok: false, erro: msg };
  }

  await logEnvio(messageId, "sent", null, subject);
  return { ok: true };
}

/**
 * Varre as solicitações elegíveis e envia no máximo MAX_POR_EXECUCAO alertas.
 * Nunca lança: o job chama isto antes do processamento normal.
 */
export async function alertarSolicitacoesTravadas() {
  try {
    const { lavoroAdmin: supabaseAdmin } = await import(
      "@/integrations/supabase/lavoro-admin.server"
    );

    const limiteTravada = new Date(Date.now() - TRAVADA_APOS_MS).toISOString();

    const { data: candidatas, error: selErro } = await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .select(
        "id, protocolo, status, cnpj_tomador, nome_tomador, numero_processo, erro_mensagem, xlsx_path, criado_em, dados_formulario, payload_bruto",
      )
      .is("alerta_enviado_em", null)
      .or(
        `status.eq.erro,` +
          `and(status.neq.email_enviado,status.neq.erro,criado_em.lt.${limiteTravada})`,
      )
      .order("criado_em", { ascending: true })
      .limit(MAX_POR_EXECUCAO);

    if (selErro) return { ok: false, erro: "falha_ao_buscar", detalhe: selErro.message };
    if (!candidatas?.length) return { ok: true, alertadas: 0 };

    let enviados = 0;
    const falhas: Array<{ id: string; erro?: string }> = [];

    for (const sol of candidatas) {
      const r = await enviarAlerta(sol as Any);
      if (!r.ok) {
        // Sem carimbo: continua elegível e tenta de novo no próximo ciclo.
        falhas.push({ id: sol.id, erro: r.erro });
        continue;
      }
      const { error: upErro } = await supabaseAdmin
        .from("garantia_judicial_solicitacoes")
        .update({ alerta_enviado_em: new Date().toISOString() })
        .eq("id", sol.id);
      if (upErro) falhas.push({ id: sol.id, erro: `carimbo: ${upErro.message}` });
      enviados += 1;
    }

    return { ok: falhas.length === 0, alertadas: enviados, falhas };
  } catch (e) {
    return { ok: false, erro: "excecao", detalhe: e instanceof Error ? e.message : String(e) };
  }
}
