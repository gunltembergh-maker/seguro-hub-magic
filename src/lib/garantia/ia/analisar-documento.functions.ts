import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { CamposSugeridosComFonteIA, ModalidadeSeguroGarantiaIA, ResultadoDocumentoIA, ResultadoFiancaIA, ResultadoSeguroGarantiaIA, ValorComFonte } from "./tipos";

const MAX_JOB_ITERATIONS = 1200;
const entrada = z.object({ analiseId: z.string().uuid() });

export type RetornoAnaliseDocumento =
  | { ok: true; situacao: string; analiseId: string; resultado?: Json | null; resumo?: string | null; campos_sugeridos?: Json | null }
  | { ok: false; erro: string; mensagem?: string };

const temFonte = <T>(campo: ValorComFonte<T> | undefined | null): campo is ValorComFonte<T> & { fonte: string } =>
  !!campo?.fonte?.trim() && campo.valor !== null && campo.valor !== undefined && campo.valor !== "";

function vigencia(modalidade: ModalidadeSeguroGarantiaIA) {
  const partes = [modalidade.vigencia_inicio?.valor && `Início: ${modalidade.vigencia_inicio.valor}`, modalidade.vigencia_fim?.valor && `Fim: ${modalidade.vigencia_fim.valor}`, modalidade.vigencia_obs?.valor].filter(Boolean);
  const fontes = [modalidade.vigencia_inicio?.fonte, modalidade.vigencia_fim?.fonte, modalidade.vigencia_obs?.fonte].filter(Boolean);
  return partes.length && fontes.length ? { valor: partes.join(" · "), fonte: [...new Set(fontes)].join(" · ") } : undefined;
}

function percentualExplicito(modalidade: ModalidadeSeguroGarantiaIA) {
  if (!temFonte(modalidade.base_calculo)) return undefined;
  const achado = String(modalidade.base_calculo.valor).match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*%/);
  if (!achado) return undefined;
  return { valor: Number(achado[1].replace(",", ".")), fonte: modalidade.base_calculo.fonte };
}

function camposModalidade(modalidade: ModalidadeSeguroGarantiaIA): CamposSugeridosComFonteIA {
  return {
    ...(temFonte(modalidade.objeto_apolice) ? { objeto: { valor: String(modalidade.objeto_apolice.valor), fonte: modalidade.objeto_apolice.fonte } } : {}),
    ...(temFonte(modalidade.importancia_segurada) && typeof modalidade.importancia_segurada.valor === "number" ? { importancia_segurada: { valor: modalidade.importancia_segurada.valor, fonte: modalidade.importancia_segurada.fonte } } : {}),
    ...(vigencia(modalidade) ? { vigencia_exigida: vigencia(modalidade) } : {}),
    ...(percentualExplicito(modalidade) ? { percentual_garantia: percentualExplicito(modalidade) } : {}),
  };
}

function mapearCampos(resultado: ResultadoDocumentoIA): CamposSugeridosComFonteIA {
  if (resultado.tipo === "Seguro Garantia") {
    const modalidades = resultado.modalidades ?? [];
    const gerais: CamposSugeridosComFonteIA = {};
    const dados = resultado.dados_licitacao_contrato;
    // O JSON legado não traz `fonte` nesses três campos de dados gerais. Pela
    // regra deste fluxo, valor sem fonte não é oferecido para preenchimento.
    return { ...gerais, modalidades: modalidades.map((m) => ({ nome: m.nome, campos: camposModalidade(m) })) };
  }
  const fianca = resultado as ResultadoFiancaIA;
  const gerais = fianca.dados_gerais ?? {};
  const inicio = gerais.vigencia_inicio;
  const fim = gerais.vigencia_fim;
  const vigenciaPartes = [inicio?.valor && `Início: ${inicio.valor}`, fim?.valor && `Fim: ${fim.valor}`].filter(Boolean);
  const vigenciaFontes = [inicio?.fonte, fim?.fonte].filter(Boolean);
  return {
    ...(temFonte(fianca.objeto_apolice) ? { objeto: { valor: String(fianca.objeto_apolice.valor), fonte: fianca.objeto_apolice.fonte } } : {}),
    ...(temFonte(gerais.valor_garantia) && typeof gerais.valor_garantia.valor === "number" ? { importancia_segurada: { valor: gerais.valor_garantia.valor, fonte: gerais.valor_garantia.fonte } } : {}),
    ...(vigenciaPartes.length && vigenciaFontes.length ? { vigencia_exigida: { valor: vigenciaPartes.join(" · "), fonte: [...new Set(vigenciaFontes)].join(" · ") } } : {}),
  };
}

function parseResultado(valor: unknown): ResultadoDocumentoIA {
  if (typeof valor === "string") {
    const limpo = valor.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(limpo) as ResultadoDocumentoIA;
  }
  return valor as ResultadoDocumentoIA;
}

async function postJob(path: string, body: unknown): Promise<Record<string, unknown>> {
  const { encaminhar } = await import("@/lib/tc-lavoro/analysis-jobs.server");
  const resposta = await encaminhar(path, "POST", body, null, "POST");
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`analysis-jobs status ${resposta.status}: ${texto.slice(0, 1000)}`);
  return JSON.parse(texto) as Record<string, unknown>;
}

export const analisarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }): Promise<RetornoAnaliseDocumento> => {
    const sb = context.supabase;
    const { data: pode } = await sb.rpc("pode_garantia_pipeline");
    if (!pode) return { ok: false, erro: "sem_permissao" };

    const { data: existente, error: erroBusca } = await sb.from("garantia_analises_ia")
      .select("id, demanda_id, documento_id, fluxo, situacao, resultado, resumo, campos_sugeridos")
      .eq("id", data.analiseId).maybeSingle();
    if (erroBusca || !existente) return { ok: false, erro: "analise_nao_encontrada" };
    if (existente.situacao === "processando" || existente.situacao === "concluida") {
      return { ok: true, situacao: existente.situacao, analiseId: existente.id, resultado: existente.resultado, resumo: existente.resumo, campos_sugeridos: existente.campos_sugeridos };
    }
    if (!["solicitada", "erro"].includes(existente.situacao)) return { ok: false, erro: "estado_invalido" };
    if (!existente.documento_id || !["seguro_garantia", "fianca_locaticia"].includes(existente.fluxo)) return { ok: false, erro: "documento_invalido" };

    const { data: travada, error: erroTrava } = await sb.from("garantia_analises_ia")
      .update({ situacao: "processando", erro_mensagem: null })
      .eq("id", existente.id).in("situacao", ["solicitada", "erro"])
      .select("id").maybeSingle();
    if (erroTrava) return { ok: false, erro: "nao_foi_possivel_iniciar" };
    if (!travada) return { ok: true, situacao: "processando", analiseId: existente.id };

    try {
      const { data: documento, error: erroDoc } = await sb.from("garantia_documentos")
        .select("id, caminho, nome_arquivo, mime_type, externo")
        .eq("id", existente.documento_id).maybeSingle();
      if (erroDoc || !documento?.caminho || documento.externo) throw new Error("Documento interno não encontrado.");
      const { data: arquivo, error: erroDownload } = await sb.storage
        .from("garantia-pipeline-anexos")
        .download(documento.caminho);
      if (erroDownload || !arquivo) throw new Error(`Falha ao baixar documento: ${erroDownload?.message ?? "arquivo vazio"}`);
      if (arquivo.size === 0) throw new Error("O documento armazenado está vazio.");
      const { extrairConteudoArquivo, mapArquivosParaJob } = await import("./extrair-texto");
      const extraido = await extrairConteudoArquivo(new File([arquivo], documento.nome_arquivo, {
        type: documento.mime_type ?? "application/pdf",
      }));
      if (!extraido.partes.length && !extraido.conteudo.trim()) throw new Error("O documento não possui texto legível.");
      const flow = existente.fluxo === "seguro_garantia" ? "seguro-garantia" : "fianca-locaticia";
      const inicio = await postJob("", { flow, files: mapArquivosParaJob([extraido]) });
      const jobId = typeof inicio.jobId === "string" ? inicio.jobId : null;
      if (!jobId || !/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) throw new Error("O serviço não retornou um identificador válido.");
      await sb.from("garantia_analises_ia").update({ job_id: jobId }).eq("id", existente.id);

      let bruto: unknown;
      for (let i = 0; i < MAX_JOB_ITERATIONS; i++) {
        const passo = await postJob(`/${encodeURIComponent(jobId)}/run`, {});
        if (passo.status === "completed") { bruto = passo.result; break; }
        if (passo.status === "failed") throw new Error(`Job falhou: ${String(passo.error ?? "sem detalhe")}`);
        await new Promise((resolve) => setTimeout(resolve, typeof passo.retryAfterMs === "number" ? passo.retryAfterMs : 250));
      }
      if (bruto === undefined) throw new Error("A análise excedeu o número máximo de etapas.");
      const resultado = parseResultado(bruto);
      const resumo = resultado.tipo === "Seguro Garantia" ? (resultado as ResultadoSeguroGarantiaIA).resumo_executivo : (resultado as ResultadoFiancaIA).resumo;
      const campos = mapearCampos(resultado);
      const { error: erroSalvar } = await sb.from("garantia_analises_ia").update({ situacao: "concluida", resultado: resultado as unknown as Json, resumo: resumo || null, campos_sugeridos: campos as unknown as Json, erro_mensagem: null }).eq("id", existente.id);
      if (erroSalvar) throw erroSalvar;
      return { ok: true, situacao: "concluida", analiseId: existente.id, resultado: resultado as unknown as Json, resumo: resumo || null, campos_sugeridos: campos as unknown as Json };
    } catch (erro) {
      console.error("[garantia/ia] análise não concluída", { analiseId: existente.id, erro });
      await sb.from("garantia_analises_ia").update({ situacao: "erro", erro_mensagem: "Não foi possível concluir a análise deste documento. Tente novamente." }).eq("id", existente.id);
      return { ok: false, erro: "analise_falhou", mensagem: "Não foi possível concluir a análise deste documento. Tente novamente." };
    }
  });
