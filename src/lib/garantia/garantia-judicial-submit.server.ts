import { z } from "zod";

const PayloadSchema = z.object({
  cnpj_tomador: z.string().regex(/^\d{14}$/, "cnpj_tomador deve ter 14 dígitos"),
  nome_tomador: z.string().max(300).optional().nullable(),
  numero_processo: z.string().max(30).optional().nullable(),
  dados_formulario: z.record(z.unknown()),
  pdf_base64: z.string().min(100),
});

const MAX_PDF_BYTES = 15 * 1024 * 1024;

export async function receberSolicitacaoGarantiaJudicial(payload: unknown) {
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { erro: "payload_invalido", detalhes: parsed.error.flatten() } };
  }
  const { cnpj_tomador, nome_tomador, numero_processo, dados_formulario, pdf_base64 } = parsed.data;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
  } catch {
    return { status: 400, body: { erro: "pdf_base64_invalido" } };
  }
  if (pdfBytes.byteLength === 0 || pdfBytes.byteLength > MAX_PDF_BYTES) {
    return { status: 400, body: { erro: "pdf_tamanho_invalido" } };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .insert({
      cnpj_tomador,
      nome_tomador: nome_tomador ?? null,
      numero_processo: numero_processo ?? null,
      dados_formulario,
      status: "recebida",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { status: 500, body: { erro: "falha_ao_gravar", detalhes: insertError?.message } };
  }

  const pdfPath = `${inserted.id}/formulario.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("garantia-judicial-anexos")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({ status: "erro", erro_mensagem: `Falha ao salvar PDF: ${uploadError.message}` })
      .eq("id", inserted.id);
    return { status: 500, body: { erro: "falha_ao_salvar_pdf" } };
  }

  await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .update({ pdf_path: pdfPath })
    .eq("id", inserted.id);

  return { status: 201, body: { ok: true, id: inserted.id } };
}
