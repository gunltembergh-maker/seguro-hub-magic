// E-mail de "Nova Demanda" da Garantia Judicial — última etapa do fluxo.
//
// Transporte: Microsoft Graph (`sendMail`) com a caixa naoresponda@lavoroseguros.com.br,
// usando o mesmo registro de aplicativo já utilizado pela integração SharePoint.
// Os dois arquivos vão como anexo real (`#microsoft.graph.fileAttachment`).
// Não existe caminho alternativo: se faltar arquivo no Storage ou o envio falhar,
// a solicitação vai para `erro` e nada é enviado pela metade.

import { render } from "@react-email/render";
import * as React from "react";
import {
  GarantiaJudicialNovaDemandaEmail,
  type NovaDemandaProps,
} from "@/lib/email-templates/garantia-judicial-nova-demanda";
import { resumirResultadoMercado } from "./garantia-judicial-normalizar.server";
import { obterTokenGraph } from "@/lib/graph/graph-token.server";

const BUCKET = "garantia-judicial-anexos";
const REMETENTE = "naoresponda@lavoroseguros.com.br";
const DESTINATARIO_PADRAO = "operacoes@lavoroseguros.com.br";
const TEMPLATE_NAME = "garantia-judicial-nova-demanda";
const VIA = "graph_anexo";

const TOP_CAPACIDADES = 5;
const PRAZO_HORAS = 48;

// O `sendMail` do Graph aceita uma requisição de no máximo ~4 MB.
// Adotamos 3 MB para a soma dos anexos já em base64, deixando ~1 MB de folga
// para corpo HTML, cabeçalhos e o restante do JSON. Acima disso seria preciso
// sessão de upload, que deliberadamente não implementamos.
const LIMITE_ANEXOS_BASE64 = 3 * 1024 * 1024;

const MIME_PDF = "application/pdf";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

function kb(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

async function logEnvio(
  messageId: string,
  status: string,
  errorMessage: string | null,
  subject: string,
  destinatario: string,
) {
  try {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    await lavoroAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: destinatario,
      status,
      error_message: errorMessage,
      metadata: { subject, via: VIA },
    });
  } catch (e) {
    console.warn("[garantia-judicial-email] falha ao registrar log", e);
  }
}

/**
 * Envia o e-mail de Nova Demanda.
 * `destinatarioOverride` existe apenas para disparos de teste explícitos;
 * o job agendado nunca passa esse parâmetro (mantém operacoes@).
 */
export async function enviarEmailNovaDemanda(
  solicitacaoId: string,
  destinatarioOverride?: string,
): Promise<
  | { ok: true; via: typeof VIA; messageId: string }
  | { ok: false; erro: string; detalhe?: string; fatal?: boolean }
> {
  const destinatario = (destinatarioOverride || "").trim() || DESTINATARIO_PADRAO;
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

  const pdfB64 = await bytesBase64(await pdfRes.data.arrayBuffer());
  const xlsxB64 = await bytesBase64(await xlsxRes.data.arrayBuffer());
  const total = pdfB64.length + xlsxB64.length;
  if (total > LIMITE_ANEXOS_BASE64) {
    const maior = pdfB64.length >= xlsxB64.length ? nomePdf : nomeXlsx;
    return {
      ok: false,
      erro: "anexos_excedem_limite",
      detalhe: `Anexos somam ${kb(total)} em base64 (limite ${kb(LIMITE_ANEXOS_BASE64)}). Maior anexo: ${maior} com ${kb(Math.max(pdfB64.length, xlsxB64.length))}.`,
      fatal: true,
    };
  }

  const resp0 = (form.responsavel || {}) as Any;
  const props: NovaDemandaProps = {
    solicitante: {
      empresa: String(resp0.empresa ?? ""),
      nome: String(resp0.nome ?? ""),
      email: String(resp0.email ?? ""),
      telefone: String(resp0.telefone ?? ""),
    },
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
    anexos: [{ nome: nomePdf }, { nome: nomeXlsx }],
    anexosComoLink: false,
  };

  const element = React.createElement(GarantiaJudicialNovaDemandaEmail, props);
  const html = await render(element);
  const subject = `Nova Demanda · Garantia Judicial · ${tomador} (${cnpj})`;
  const messageId = `gj-nova-demanda-${sol.id}`;

  try {
    const token = await obterTokenGraph();
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(REMETENTE)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            from: { emailAddress: { address: REMETENTE } },
            toRecipients: [{ emailAddress: { address: destinatario } }],
            attachments: [
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: nomePdf,
                contentType: MIME_PDF,
                contentBytes: pdfB64,
              },
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: nomeXlsx,
                contentType: MIME_XLSX,
                contentBytes: xlsxB64,
              },
            ],
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!resp.ok) {
      // Só status e mensagem curta: nunca corpo inteiro, token ou anexo.
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
    await logEnvio(messageId, "failed", msg, subject, destinatario);
    return { ok: false, erro: "falha_no_envio", detalhe: msg };
  }

  await logEnvio(messageId, "sent", null, subject, destinatario);
  return { ok: true, via: VIA, messageId };
}
