// E-mail de "Nova Demanda" da Garantia Judicial — última etapa do fluxo.
//
// Anexos: a API de e-mail gerenciada do Hub (`sendLovableEmail`, usada pelas
// newsletters e pelo módulo Reserva de Posições) NÃO aceita anexo — o contrato
// do pacote só tem to/from/subject/html/text. Para não alterar nada do envio em
// produção, este módulo tem caminho próprio:
//   1) se RESEND_API_KEY estiver configurada, envia pela API do Resend com os
//      dois arquivos anexados de verdade (base64);
//   2) senão, envia pelo caminho padrão do Hub com links assinados de 7 dias
//      para os mesmos dois arquivos.
// Em ambos os casos os arquivos precisam existir no Storage: se faltar um, o
// e-mail NÃO é enviado e a solicitação vai para `erro`.

import { render } from "@react-email/render";
import * as React from "react";
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import {
  GarantiaJudicialNovaDemandaEmail,
  type NovaDemandaProps,
} from "@/lib/email-templates/garantia-judicial-nova-demanda";
import { resumirResultadoMercado } from "./garantia-judicial-normalizar.server";

const BUCKET = "garantia-judicial-anexos";
const DESTINATARIO = "operacoes@lavoroseguros.com.br";
const TEMPLATE_NAME = "garantia-judicial-nova-demanda";

const SITE_NAME = "Hub Lavoro Seguros";
const SENDER_DOMAIN = "notify.hub.lavoroseguros.com.br";
const FROM_DOMAIN = "notify.hub.lavoroseguros.com.br";

const TOP_CAPACIDADES = 5;
const LINK_SEGUNDOS = 7 * 24 * 60 * 60;
const PRAZO_HORAS = 48;

type Any = Record<string, any>;

function brlCentavos(centavos: unknown): string {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return "—";
  return (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cnpjFmt(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 14) return String(v ?? "—");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** gerado_em + 48h, apresentado em horário de Brasília. */
export function calcularPrazoLimite(geradoEm: string | null | undefined): {
  iso: string | null;
  texto: string;
} {
  const base = geradoEm ? new Date(geradoEm) : null;
  if (!base || Number.isNaN(base.getTime())) return { iso: null, texto: "—" };
  const limite = new Date(base.getTime() + PRAZO_HORAS * 60 * 60 * 1000);
  const data = limite.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = limite.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { iso: limite.toISOString(), texto: `${data} às ${hora} (horário de Brasília)` };
}

async function bytesBase64(bytes: ArrayBuffer): Promise<string> {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function logEnvio(
  messageId: string,
  status: string,
  errorMessage: string | null,
  subject: string,
  via: string,
) {
  try {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    await lavoroAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: DESTINATARIO,
      status,
      error_message: errorMessage,
      metadata: { subject, via },
    });
  } catch (e) {
    console.warn("[garantia-judicial-email] falha ao registrar log", e);
  }
}

export async function enviarEmailNovaDemanda(solicitacaoId: string): Promise<
  | { ok: true; via: "resend_anexo" | "hub_link"; messageId: string }
  | { ok: false; erro: string; detalhe?: string; fatal?: boolean }
> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const { data: sol, error: selErro } = await lavoroAdmin
    .from("garantia_judicial_solicitacoes")
    .select(
      "id, protocolo, gerado_em, cnpj_tomador, nome_tomador, numero_processo, dados_formulario, resultado_mercado, pdf_path, xlsx_path",
    )
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (selErro) return { ok: false, erro: "falha_ao_buscar", detalhe: selErro.message };
  if (!sol) return { ok: false, erro: "solicitacao_nao_encontrada", fatal: true };

  // Anexo faltando é erro definitivo: e-mail de nova demanda sem o formulário
  // é pior do que nenhum e-mail.
  if (!sol.pdf_path) return { ok: false, erro: "sem_pdf_path", fatal: true };
  if (!sol.xlsx_path) return { ok: false, erro: "sem_xlsx_path", fatal: true };

  const [pdfRes, xlsxRes] = await Promise.all([
    lavoroAdmin.storage.from(BUCKET).download(sol.pdf_path),
    lavoroAdmin.storage.from(BUCKET).download(sol.xlsx_path),
  ]);
  if (pdfRes.error || !pdfRes.data)
    return { ok: false, erro: "pdf_ausente_no_storage", detalhe: pdfRes.error?.message, fatal: true };
  if (xlsxRes.error || !xlsxRes.data)
    return { ok: false, erro: "xlsx_ausente_no_storage", detalhe: xlsxRes.error?.message, fatal: true };

  const form = (sol.dados_formulario || {}) as Any;
  const resumo = resumirResultadoMercado(sol.resultado_mercado);

  const protocolo = sol.protocolo || sol.id;
  const tomador = sol.nome_tomador || resumo.nomeTomadorSugerido || "—";
  const cnpj = cnpjFmt(sol.cnpj_tomador || resumo.cnpj);
  const adv = (form.advogado || {}) as Any;
  const advogado = adv.nome
    ? `${adv.nome}${adv.oab ? ` · OAB ${adv.oab}` : ""}${adv.uf ? `/${adv.uf}` : ""}`
    : "—";

  const topCapacidades = [...resumo.com_limite]
    .sort((a, b) => b.capacidade - a.capacidade)
    .slice(0, TOP_CAPACIDADES)
    .map((s) => ({ seguradora: s.label, capacidade: s.capacidadeFmt || "—" }));

  const houveResposta = resumo.com_limite.length + resumo.sem_limite.length > 0;
  const prazo = calcularPrazoLimite(sol.gerado_em);

  const nomePdf = `Formulario_${protocolo}.pdf`;
  const nomeXlsx = `Consulta_Mercado_${protocolo}.xlsx`;

  const usarResend = Boolean(process.env.RESEND_API_KEY);

  let linkPdf: string | undefined;
  let linkXlsx: string | undefined;
  if (!usarResend) {
    const [a, b] = await Promise.all([
      lavoroAdmin.storage.from(BUCKET).createSignedUrl(sol.pdf_path, LINK_SEGUNDOS),
      lavoroAdmin.storage.from(BUCKET).createSignedUrl(sol.xlsx_path, LINK_SEGUNDOS),
    ]);
    if (a.error || !a.data?.signedUrl || b.error || !b.data?.signedUrl)
      return { ok: false, erro: "falha_ao_gerar_links", detalhe: a.error?.message || b.error?.message };
    linkPdf = a.data.signedUrl;
    linkXlsx = b.data.signedUrl;
  }

  const props: NovaDemandaProps = {
    tomador,
    cnpj,
    protocolo,
    numeroProcesso: sol.numero_processo || (form.processo as Any)?.numero || "—",
    natureza: String(form.naturezaRotulo || form.natureza || "—"),
    importanciaSegurada: brlCentavos((form.garantia as Any)?.importanciaSegurada),
    advogado,
    prazoLimite: prazo.texto,
    comLimite: resumo.com_limite.length,
    semLimite: resumo.sem_limite.length,
    naoConsultado: resumo.nao_consultado.length,
    topCapacidades,
    nenhumComLimite: houveResposta && resumo.com_limite.length === 0,
    nenhumaResposta: !houveResposta,
    anexos: [
      { nome: nomePdf, url: linkPdf },
      { nome: nomeXlsx, url: linkXlsx },
    ],
    anexosComoLink: !usarResend,
  };

  const element = React.createElement(GarantiaJudicialNovaDemandaEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = `Nova Demanda · Garantia Judicial · ${tomador} (${cnpj})`;
  const messageId = `gj-nova-demanda-${sol.id}`;
  const from = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`;

  try {
    if (usarResend) {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: [DESTINATARIO],
          subject,
          html,
          text,
          attachments: [
            { filename: nomePdf, content: await bytesBase64(await pdfRes.data.arrayBuffer()) },
            { filename: nomeXlsx, content: await bytesBase64(await xlsxRes.data.arrayBuffer()) },
          ],
        }),
      });
      if (!resp.ok) {
        const corpo = await resp.text().catch(() => "");
        throw new Error(`Resend [${resp.status}]: ${corpo.slice(0, 400)}`);
      }
    } else {
      await sendLovableEmail(
        {
          to: DESTINATARIO,
          from,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: TEMPLATE_NAME,
          idempotency_key: messageId,
        },
        { apiKey: process.env.LOVABLE_API_KEY!, sendUrl: process.env.LOVABLE_SEND_URL },
      );
    }
  } catch (error) {
    const suprimido = error instanceof EmailAPIError && error.code === "recipient_suppressed";
    const status = suprimido
      ? "suppressed"
      : error instanceof EmailAPIError && error.status === 429
        ? "rate_limited"
        : "failed";
    const msg = error instanceof Error ? error.message : String(error);
    await logEnvio(messageId, status, msg, subject, usarResend ? "resend_anexo" : "hub_link");
    return { ok: false, erro: "falha_no_envio", detalhe: msg };
  }

  await logEnvio(messageId, "sent", null, subject, usarResend ? "resend_anexo" : "hub_link");
  return { ok: true, via: usarResend ? "resend_anexo" : "hub_link", messageId };
}
