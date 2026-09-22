import type { Json } from "@/integrations/supabase/types";
import {
  consultarWorkerLimites,
  sanitizarResultado,
  truncar,
  type ResultadoConsulta,
} from "./garantia-mercado-worker.server";

// O long-poll do Worker (lista das 10 seguradoras com API, orçamento de 50s,
// tratamento do 202 com retryAfterMs) vive em garantia-mercado-worker.server.ts.
// O comportamento deste motor não mudou: só a implementação foi extraída para
// ser compartilhada com o pipeline de Negociação.

// Acima disso a solicitação é considerada travada e marcada como erro, para
// não ficar sendo repescada para sempre.
const LIMITE_TENTATIVAS = 12;

// Uma solicitação em `consultando_mercado` só é repescada depois desse tempo,
// para não haver duas execuções trabalhando na mesma linha.
const RETOMAR_APOS_MS = 2 * 60 * 1000;

async function consultarWorker(cnpjDigits: string): Promise<ResultadoConsulta> {
  return consultarWorkerLimites({ cnpjDigits, forceRefresh: false });
}


// A planilha nunca derruba a execução: se falhar, a linha fica em
// `mercado_consultado` com `xlsx_path` nulo e a execução seguinte tenta de novo,
// sem refazer a consulta de mercado.
async function gerarPlanilha(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { gerarXlsxConsultaMercado } = await import("./garantia-judicial-xlsx.server");
    const r = await gerarXlsxConsultaMercado(id);
    return r.ok ? { ok: true } : { ok: false, erro: truncar(r.erro) };
  } catch (e) {
    return { ok: false, erro: truncar(e instanceof Error ? e.message : e) };
  }
}

/**
 * Ponto de entrada do job. A verificação de alertas roda ANTES do
 * processamento e em toda execução, haja ou não solicitação pendente — o caso
 * mais grave é justamente quando nada está sendo processado. Ela nunca lança,
 * e um erro no processamento não impede o aviso de sair.
 */
export async function consultarMercadoPendentes() {
  const { alertarSolicitacoesTravadas } = await import("./garantia-judicial-alerta.server");
  const alertas = await alertarSolicitacoesTravadas();
  const processamento = await processarPendentes();
  return { ...processamento, alertas };
}

async function processarPendentes() {
  const { lavoroAdmin: supabaseAdmin } = await import(
    "@/integrations/supabase/lavoro-admin.server"
  );

  const limiteRetomada = new Date(Date.now() - RETOMAR_APOS_MS).toISOString();

  // Solicitação mais antiga pendente: nunca consultada (`recebida`), retomada de
  // uma execução anterior que não coube no orçamento (`consultando_mercado`
  // parada há tempo suficiente), já consultada mas ainda sem planilha
  // (`mercado_consultado` com `xlsx_path` nulo) — nesse caso só gera o arquivo,
  // sem reconsultar o mercado —, ou com planilha pronta e e-mail ainda não
  // enviado (`email_enviado_em` nulo).
  const { data: candidatas, error: selErro } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .select("id, status, cnpj_tomador, consulta_tentativas, xlsx_path, email_enviado_em")
    .or(
      `status.eq.recebida,` +
        `and(status.eq.consultando_mercado,consulta_iniciada_em.lt.${limiteRetomada}),` +
        `and(status.eq.mercado_consultado,xlsx_path.is.null,consulta_tentativas.lt.${LIMITE_TENTATIVAS},or(consulta_iniciada_em.is.null,consulta_iniciada_em.lt.${limiteRetomada})),` +
        `and(status.eq.mercado_consultado,xlsx_path.not.is.null,email_enviado_em.is.null,consulta_tentativas.lt.${LIMITE_TENTATIVAS},or(consulta_iniciada_em.is.null,consulta_iniciada_em.lt.${limiteRetomada}))`,
    )
    .order("criado_em", { ascending: true })
    .limit(1);

  if (selErro) return { ok: false, erro: "falha_ao_buscar", detalhe: selErro.message };
  const candidata = candidatas?.[0];
  if (!candidata) return { ok: true, processadas: 0, motivo: "nada_pendente" };

  const tentativas = (candidata.consulta_tentativas ?? 0) + 1;

  // Caso "só e-mail": consulta feita e planilha pronta, falta avisar operações.
  // A trava é a mesma dos outros casos (data + tentativas) e ainda exige
  // `email_enviado_em` nulo no próprio UPDATE: na dúvida, não envia de novo.
  if (
    candidata.status === "mercado_consultado" &&
    candidata.xlsx_path &&
    !candidata.email_enviado_em
  ) {
    const { data: travadaEmail, error: lockEmailErro } = await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({ consulta_iniciada_em: new Date().toISOString(), consulta_tentativas: tentativas })
      .eq("id", candidata.id)
      .eq("status", "mercado_consultado")
      .not("xlsx_path", "is", null)
      .is("email_enviado_em", null)
      .select("id")
      .maybeSingle();
    if (lockEmailErro) return { ok: false, erro: "falha_ao_travar", detalhe: lockEmailErro.message };
    if (!travadaEmail) return { ok: true, processadas: 0, motivo: "ja_assumida_por_outra_execucao" };

    const { enviarEmailNovaDemanda } = await import("./garantia-judicial-email.server");
    const envio = await enviarEmailNovaDemanda(candidata.id);

    if (envio.ok) {
      const { error: upErro } = await supabaseAdmin
        .from("garantia_judicial_solicitacoes")
        .update({
          email_enviado_em: new Date().toISOString(),
          status: "email_enviado",
          erro_mensagem: null,
        })
        .eq("id", candidata.id)
        .is("email_enviado_em", null);
      if (upErro)
        return { ok: false, id: candidata.id, erro: "falha_ao_gravar_envio", detalhe: upErro.message };
      return { ok: true, id: candidata.id, processadas: 1, status: "email_enviado", via: envio.via, tentativas };
    }

    // Anexo faltando (ou linha inconsistente) não melhora tentando de novo.
    if (envio.fatal) {
      const qual =
        envio.erro === "sem_xlsx_path" || envio.erro === "xlsx_ausente_no_storage"
          ? "a planilha da consulta de mercado"
          : "o PDF do formulário";
      await supabaseAdmin
        .from("garantia_judicial_solicitacoes")
        .update({
          status: "erro",
          erro_mensagem: `E-mail de nova demanda não enviado: ${qual} não foi encontrado no armazenamento (${envio.erro}).`,
        })
        .eq("id", candidata.id);
      return { ok: false, id: candidata.id, erro: envio.erro, detalhe: envio.detalhe };
    }

    if (tentativas >= LIMITE_TENTATIVAS) {
      await supabaseAdmin
        .from("garantia_judicial_solicitacoes")
        .update({
          status: "erro",
          erro_mensagem: `Falha ao enviar o e-mail de nova demanda após várias tentativas (${envio.erro}).`,
        })
        .eq("id", candidata.id);
      return { ok: false, id: candidata.id, erro: "limite_tentativas", detalhe: envio.detalhe, tentativas };
    }

    return { ok: false, id: candidata.id, erro: envio.erro, detalhe: envio.detalhe, tentativas };
  }

  // Caso "só planilha": a consulta já terminou, o status permanece
  // `mercado_consultado` (a restrição da tabela não admite status novo) e o
  // `consulta_tentativas` serve de proteção contra tentativa infinita.
  if (candidata.status === "mercado_consultado") {
    const { data: travadaXlsx, error: lockXlsxErro } = await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({ consulta_iniciada_em: new Date().toISOString(), consulta_tentativas: tentativas })
      .eq("id", candidata.id)
      .eq("status", "mercado_consultado")
      .is("xlsx_path", null)
      .select("id")
      .maybeSingle();
    if (lockXlsxErro) return { ok: false, erro: "falha_ao_travar", detalhe: lockXlsxErro.message };
    if (!travadaXlsx) return { ok: true, processadas: 0, motivo: "ja_assumida_por_outra_execucao" };

    const planilha = await gerarPlanilha(candidata.id);
    return planilha.ok
      ? { ok: true, id: candidata.id, processadas: 1, status: "mercado_consultado", xlsx: "gerado", tentativas }
      : { ok: false, id: candidata.id, erro: "falha_ao_gerar_xlsx", detalhe: planilha.erro, tentativas };
  }

  // Trava otimista: só assume a linha se ninguém mudou o status no meio.
  const { data: travada, error: lockErro } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .update({
      status: "consultando_mercado",
      consulta_iniciada_em: new Date().toISOString(),
      consulta_tentativas: tentativas,
    })
    .eq("id", candidata.id)
    .eq("status", candidata.status)
    .select("id, cnpj_tomador")
    .maybeSingle();

  if (lockErro) return { ok: false, erro: "falha_ao_travar", detalhe: lockErro.message };
  if (!travada) return { ok: true, processadas: 0, motivo: "ja_assumida_por_outra_execucao" };

  const cnpjDigits = String(travada.cnpj_tomador ?? "").replace(/\D/g, "");
  if (cnpjDigits.length !== 14) {
    await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({ status: "erro", erro_mensagem: "CNPJ do tomador inválido para consulta de mercado." })
      .eq("id", travada.id);
    return { ok: false, id: travada.id, erro: "cnpj_invalido" };
  }

  const resultado = await consultarWorker(cnpjDigits);

  if (resultado.tipo === "ok") {
    const { error: upErro } = await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({
        resultado_mercado: sanitizarResultado(resultado.resultado) as unknown as Json,
        status: "mercado_consultado",
        erro_mensagem: null,
      })
      .eq("id", travada.id);
    if (upErro) return { ok: false, id: travada.id, erro: "falha_ao_gravar", detalhe: upErro.message };
    // Só depois de o resultado estar gravado é que a planilha é gerada.
    const planilha = await gerarPlanilha(travada.id);
    return {
      ok: true,
      id: travada.id,
      processadas: 1,
      status: "mercado_consultado",
      xlsx: planilha.ok ? "gerado" : `pendente: ${planilha.erro}`,
      tentativas,
    };
  }

  // Erro de configuração não melhora tentando de novo.
  if (resultado.tipo === "erro_config") {
    await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({ status: "erro", erro_mensagem: "Credenciais de acesso ao serviço de limites não configuradas." })
      .eq("id", travada.id);
    return { ok: false, id: travada.id, erro: "erro_config" };
  }

  // Ainda em andamento ou falha passageira: fica em `consultando_mercado` para a
  // próxima execução retomar, até estourar o limite de tentativas.
  if (tentativas >= LIMITE_TENTATIVAS) {
    const motivo =
      resultado.tipo === "em_andamento"
        ? "A consulta de mercado não concluiu dentro do número máximo de tentativas."
        : `Falha ao consultar o mercado (${resultado.tipo}).`;
    await supabaseAdmin
      .from("garantia_judicial_solicitacoes")
      .update({ status: "erro", erro_mensagem: motivo })
      .eq("id", travada.id);
    return { ok: false, id: travada.id, erro: "limite_tentativas", tipo: resultado.tipo, tentativas };
  }

  return { ok: true, id: travada.id, processadas: 0, status: "consultando_mercado", tipo: resultado.tipo, tentativas };
}
