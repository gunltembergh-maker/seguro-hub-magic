import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { buscarModalidade, flowDaModalidade, modalidadeValida } from "./modalidades";
import type { CamposSugeridosComFonteIA, ModalidadeSeguroGarantiaIA, ResultadoDocumentoIA, ResultadoFiancaIA, ResultadoSeguroGarantiaIA, ValorComFonte } from "./tipos";

const MAX_JOB_ITERATIONS = 1200;
/** Fluxo gravado na análise → leitura do motor (o mesmo da tela Operacional). */
const FLUXOS: Record<string, string> = {
  seguro_garantia: "seguro-garantia",
  fianca_locaticia: "fianca-locaticia",
  financeiro: "analise-financeira",
};
const entrada = z.object({
  analiseId: z.string().uuid(),
  // Opcional: sem ela o comportamento é o de antes (análise de todas as modalidades).
  modalidadeId: z.string().refine((v) => modalidadeValida(v), "modalidade_invalida").optional(),
});

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
    const segurado = resultado.segurado as { valor?: string | null; cnpj?: string | null; fonte?: string | null } | undefined;
    if (segurado?.valor && segurado.fonte?.trim()) {
      gerais.segurado = { valor: String(segurado.valor), fonte: segurado.fonte, cnpj: segurado.cnpj ?? null };
    }
    const tomador = resultado.tomador as { valor?: string | null; cnpj?: string | null; fonte?: string | null } | undefined;
    if (tomador?.valor && tomador.fonte?.trim()) {
      gerais.tomador = { valor: String(tomador.valor), fonte: tomador.fonte, cnpj: tomador.cnpj ?? null };
    }
    // O prompt não pede `fonte` para os números do edital nem para o prazo de
    // apresentação. A citação diz isso com todas as letras, em vez de omitir.
    const semPagina = "dados do edital/contrato (a leitura não indicou a página)";
    if (dados?.numero_processo) gerais.numero_processo = { valor: String(dados.numero_processo), fonte: semPagina };
    if (dados?.numero_contrato) gerais.numero_contrato = { valor: String(dados.numero_contrato), fonte: semPagina };
    const prazo = (resultado.prazo_e_forma_de_apresentacao as { prazo?: string | null } | undefined)?.prazo;
    const iso = dataIso(prazo);
    if (iso) gerais.data_limite = { valor: iso, fonte: `prazo de apresentação da garantia: "${prazo}" (a leitura não indicou a página)` };
    return { ...gerais, modalidades: modalidades.map((m) => ({ nome: m.nome, campos: camposModalidade(m) })) };
  }
  const fianca = resultado as ResultadoFiancaIA;
  const gerais = fianca.dados_gerais ?? {};
  const inicio = gerais.vigencia_inicio;
  const fim = gerais.vigencia_fim;
  const vigenciaPartes = [inicio?.valor && `Início: ${inicio.valor}`, fim?.valor && `Fim: ${fim.valor}`].filter(Boolean);
  const vigenciaFontes = [inicio?.fonte, fim?.fonte].filter(Boolean);
  const locador = gerais.locador;
  return {
    ...(temFonte(locador) ? { segurado: { valor: String(locador.valor), fonte: locador.fonte } } : {}),
    ...(temFonte(fianca.objeto_apolice) ? { objeto: { valor: String(fianca.objeto_apolice.valor), fonte: fianca.objeto_apolice.fonte } } : {}),
    ...(temFonte(gerais.valor_garantia) && typeof gerais.valor_garantia.valor === "number" ? { importancia_segurada: { valor: gerais.valor_garantia.valor, fonte: gerais.valor_garantia.fonte } } : {}),
    ...(vigenciaPartes.length && vigenciaFontes.length ? { vigencia_exigida: { valor: vigenciaPartes.join(" · "), fonte: [...new Set(vigenciaFontes)].join(" · ") } } : {}),
  };
}

/** DD/MM/AAAA ou AAAA-MM-DD no texto → AAAA-MM-DD; qualquer outra coisa é descartada. */
function dataIso(texto?: string | null): string | null {
  if (!texto) return null;
  const br = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
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
      .select("id, demanda_id, documento_id, documentos_ids, fluxo, situacao, resultado, resumo, campos_sugeridos")
      .eq("id", data.analiseId).maybeSingle();
    if (erroBusca || !existente) return { ok: false, erro: "analise_nao_encontrada" };
    if (existente.situacao === "processando" || existente.situacao === "concluida") {
      return { ok: true, situacao: existente.situacao, analiseId: existente.id, resultado: existente.resultado, resumo: existente.resumo, campos_sugeridos: existente.campos_sugeridos };
    }
    if (!["solicitada", "erro"].includes(existente.situacao)) return { ok: false, erro: "estado_invalido" };
    const ids = (existente.documentos_ids?.length ? existente.documentos_ids : existente.documento_id ? [existente.documento_id] : []) as string[];
    const modalidade = data.modalidadeId
      ? buscarModalidade(data.modalidadeId, existente.fluxo === "fianca_locaticia" ? "fianca_locaticia" : "seguro_garantia")
      : null;
    if (data.modalidadeId && !modalidade) return { ok: false, erro: "modalidade_invalida" };
    if (modalidade && existente.fluxo === "financeiro") return { ok: false, erro: "fluxo_nao_suportado" };
    const fluxoFinal = modalidade ? modalidade.produto : existente.fluxo;
    if (!ids.length || !FLUXOS[fluxoFinal]) return { ok: false, erro: "documento_invalido" };

    const { data: travada, error: erroTrava } = await sb.from("garantia_analises_ia")
      .update({ situacao: "processando", erro_mensagem: null })
      .eq("id", existente.id).in("situacao", ["solicitada", "erro"])
      .select("id").maybeSingle();
    if (erroTrava) return { ok: false, erro: "nao_foi_possivel_iniciar" };
    if (!travada) return { ok: true, situacao: "processando", analiseId: existente.id };

    try {
      const { baixarEExtrair } = await import("./documentos-analise.server");
      const { mapArquivosParaJob } = await import("./extrair-texto");
      const extraidos = await baixarEExtrair(sb, ids);
      const paginas = extraidos.flatMap((e) => e.paginas ?? []);
      let payload: Record<string, unknown> = { flow: FLUXOS[existente.fluxo], files: mapArquivosParaJob(extraidos) };
      if (modalidade) {
        const ajuste: { modalidade_id: string; modalidade_rotulo: string; fluxo?: string } = { modalidade_id: modalidade.id, modalidade_rotulo: modalidade.label };
        if (existente.fluxo !== modalidade.produto) ajuste.fluxo = modalidade.produto;
        await sb.from("garantia_analises_ia").update(ajuste).eq("id", existente.id);
        // Mesmo formato de executarAnaliseEmLotes (public/analise-limite/deepseek.js).
        payload = {
          flow: flowDaModalidade(modalidade),
          files: mapArquivosParaJob(extraidos),
          context: { modalidade: { id: modalidade.id, label: modalidade.label }, consideracoes: "" },
        };
      }
      const inicio = await postJob("", payload);
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
      const r = resultado as unknown as Record<string, unknown>;
      const resumo = existente.fluxo === "financeiro"
        ? String(r.resumo ?? r.resumo_executivo ?? "")
        : resultado.tipo === "Seguro Garantia" ? (resultado as ResultadoSeguroGarantiaIA).resumo_executivo : (resultado as ResultadoFiancaIA).resumo;
      // A leitura financeira não preenche campos da demanda: é só leitura.
      const campos = existente.fluxo === "financeiro" ? {} : mapearCampos(resultado);
      if (existente.fluxo !== "financeiro" && paginas.length) {
        const { anotarPaginasCampos, anotarPaginasTrechos } = await import("./localizar-pagina");
        anotarPaginasCampos(campos as Record<string, unknown>, paginas);
        anotarPaginasTrechos(resultado as unknown as Record<string, unknown>, paginas);
      }
      const { error: erroSalvar } = await sb.from("garantia_analises_ia").update({ situacao: "concluida", resultado: resultado as unknown as Json, resumo: resumo || null, campos_sugeridos: campos as unknown as Json, erro_mensagem: null }).eq("id", existente.id);
      if (erroSalvar) throw erroSalvar;
      return { ok: true, situacao: "concluida", analiseId: existente.id, resultado: resultado as unknown as Json, resumo: resumo || null, campos_sugeridos: campos as unknown as Json };
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      console.error("[garantia/ia] análise não concluída", {
        analiseId: existente.id,
        erro: detalhe,
        stack: erro instanceof Error ? erro.stack : undefined,
      });
      // Só mensagens já escritas para o usuário neste fluxo chegam à tela.
      const { mensagemParaUsuario } = await import("./documentos-analise.server");
      const mensagem = mensagemParaUsuario(detalhe, "Não foi possível concluir a análise deste documento. Tente novamente.");
      await sb.from("garantia_analises_ia").update({ situacao: "erro", erro_mensagem: mensagem }).eq("id", existente.id);
      return { ok: false, erro: "analise_falhou", mensagem };
    }
  });
