import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const AutorSchema = z.object({
  tipo: z.string(),
  documento: z.string(),
  nome: z.string(),
  endereco: z.string(),
});

const MenorIdadeSchema = z.union([z.null(), z.literal(""), z.literal("sim"), z.literal("não")]);

const RepresentanteSchema = z.union([
  z.null(),
  z.object({ nome: z.string(), cpf: z.string() }),
]);

const ReuSchema = z.object({
  documento: z.string().min(1),
  nome: z.string(),
  endereco: z.string(),
});

const ProcessoSchema = z.object({
  numero: z.string(),
  digitoConfere: z.boolean().nullable(),
  ramo: z.string(),
  tribunal: z.string(),
  ano: z.string(),
  juizo: z.string(),
  numeroAdministrativo: z.string(),
  tribunalRegional: z.string(),
});

const GarantiaPadraoSchema = z.object({
  valorCausa: z.number().int(),
  add30: z.boolean(),
  importanciaSegurada: z.number().int(),
  autoInfracao: z.string(),
  linhaDefesa: z.string(),
  historico: z.string(),
});

const GarantiaRecursalSchema = z.object({
  tipoRecurso: z.string(),
  depositoTabela: z.number().int().nullable(),
  dispensaSumular: z.boolean(),
  enquadramento: z.string(),
  vara: z.string(),
  add30: z.boolean(),
  ajusteManual: z.number().int().nullable(),
  importanciaSegurada: z.number().int(),
  fonte: z.object({
    ato: z.string(),
    vigencia: z.string(),
    url: z.string(),
    confirmado: z.boolean(),
  }),
});

const VigenciaSchema = z.object({
  inicio: z.string(),
  anos: z.number().nullable(),
  fim: z.string(),
});

const EntregaSchema = z.object({
  prazo: z.string(),
  diasRestantes: z.number().nullable(),
});

const AdvogadoSchema = z.object({
  nome: z.string(),
  oab: z.string(),
  uf: z.string(),
});

// Quem preencheu o formulário. Tolerante de propósito: ausente, nulo ou objeto.
// Nunca obrigatório — falta de contato não pode derrubar a proposta do cliente.
const ResponsavelSchema = z
  .object({
    nome: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    empresa: z.string().optional().nullable(),
    telefone: z.string().optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const FormularioCommonBase = z.object({
  naturezaRotulo: z.string(),
  responsavel: ResponsavelSchema,
  autor: AutorSchema,
  menorIdade: MenorIdadeSchema,
  representante: RepresentanteSchema,
  reu: ReuSchema,
  processo: ProcessoSchema,
  indice: z.string(),
  objetivo: z.string(),
  vigencia: VigenciaSchema,
  entrega: EntregaSchema,
  exito: z.string(),
  advogado: AdvogadoSchema,
  assinatura: z.string(),
});

const FormularioPadraoSchema = FormularioCommonBase.extend({
  natureza: z.enum(["civel", "trabalhista", "tributario"]),
  garantia: GarantiaPadraoSchema,
});

const FormularioRecursalSchema = FormularioCommonBase.extend({
  natureza: z.literal("recursal"),
  garantia: GarantiaRecursalSchema,
});

const FormularioSchema = z.union([FormularioPadraoSchema, FormularioRecursalSchema]);

const EnvelopeSchema = z.object({
  protocolo: z.string().min(1),
  geradoEm: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "geradoEm deve ser uma data válida"),
  formulario: FormularioSchema,
});

const PDF_SIGNATURE = "%PDF-";

export async function receberSolicitacaoGarantiaJudicial(payload: unknown, pdfBytes: Uint8Array) {
  const parsed = EnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { erro: "payload_invalido", detalhes: parsed.error.flatten() } };
  }

  const { protocolo, geradoEm, formulario } = parsed.data;

  const cnpjNormalizado = formulario.reu.documento.replace(/\D/g, "");
  if (cnpjNormalizado.length !== 14) {
    return { status: 400, body: { erro: "cnpj_invalido" } };
  }

  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (header !== PDF_SIGNATURE) {
    return { status: 400, body: { erro: "pdf_assinatura_invalida" } };
  }

  const { lavoroAdmin: supabaseAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  // Proteção contra duplicidade. A demanda já registrada vale como confirmação:
  // devolvemos 200 com o id existente (o Worker trata fora de 2xx como erro para o cliente).

  // Checagem A: mesmo protocolo.
  const { data: existenteProtocolo } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .select("id, protocolo")
    .eq("protocolo", protocolo)
    .maybeSingle();

  if (existenteProtocolo) {
    console.log(`[garantia-judicial] duplicata barrada por protocolo: ${protocolo}`);
    return { status: 200, body: { id: existenteProtocolo.id, protocolo: existenteProtocolo.protocolo, duplicada: true } };
  }

  // Checagem B: mesmo CNPJ + número de processo nos últimos 10 minutos.
  const janelaInicio = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existenteJanela } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .select("id, protocolo")
    .eq("cnpj_tomador", formulario.reu.documento)
    .eq("numero_processo", formulario.processo.numero)
    .gte("criado_em", janelaInicio)
    .maybeSingle();

  if (existenteJanela) {
    console.log(`[garantia-judicial] duplicata barrada por janela: ${protocolo} (existente ${existenteJanela.protocolo})`);
    return { status: 200, body: { id: existenteJanela.id, protocolo: existenteJanela.protocolo, duplicada: true } };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .insert({
      protocolo,
      gerado_em: geradoEm,
      cnpj_tomador: formulario.reu.documento,
      nome_tomador: formulario.reu.nome,
      numero_processo: formulario.processo.numero,
      payload_bruto: payload as unknown as Json,
      dados_formulario: formulario as unknown as Json,
      status: "recebida",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // Corrida: outro request inseriu o mesmo protocolo entre a checagem e o insert.
    if (insertError?.code === "23505") {
      const { data: existente } = await supabaseAdmin
        .from("garantia_judicial_solicitacoes")
        .select("id, protocolo")
        .eq("protocolo", protocolo)
        .maybeSingle();
      if (existente) {
        console.log(`[garantia-judicial] duplicata barrada por unicidade (corrida): ${protocolo}`);
        return { status: 200, body: { id: existente.id, protocolo: existente.protocolo, duplicada: true } };
      }
    }
    return { status: 500, body: { erro: "falha_ao_gravar" } };
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

  return { status: 201, body: { id: inserted.id, protocolo } };
}
