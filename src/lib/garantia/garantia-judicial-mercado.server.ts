import type { Json } from "@/integrations/supabase/types";

const WORKER_URL = "https://lucky-hat-b241.kyuri887.workers.dev/v1/limits/query";

// As 10 seguradoras com consulta automática — mesma lista que a tela
// Garantia -> Análise de Limite usa (public/analise-limite/app.js, MKT_API_KEYS).
const SEGURADORAS = [
  "avla", "axa", "essor", "fator", "jns",
  "junto", "mitsui", "newe", "now", "sombrero",
] as const;

// Orçamento de tempo de UMA execução. O que não terminar agora fica com status
// `consultando_mercado` e é retomado na execução seguinte, porque o Worker
// retoma o job pelo CNPJ.
const ORCAMENTO_MS = 50_000;

// Acima disso a solicitação é considerada travada e marcada como erro, para
// não ficar sendo repescada para sempre.
const LIMITE_TENTATIVAS = 12;

// Uma solicitação em `consultando_mercado` só é repescada depois desse tempo,
// para não haver duas execuções trabalhando na mesma linha.
const RETOMAR_APOS_MS = 2 * 60 * 1000;

const ERRO_MAX_CHARS = 500;

function truncar(texto: unknown): string {
  const s = typeof texto === "string" ? texto : String(texto ?? "");
  return s.length > ERRO_MAX_CHARS ? `${s.slice(0, ERRO_MAX_CHARS)}… [truncado]` : s;
}

// Preserva a resposta como veio, só encurtando as mensagens de erro — algumas
// seguradoras devolvem uma página HTML inteira nesse campo.
function sanitizarResultado(resultado: unknown): unknown {
  if (!resultado || typeof resultado !== "object") return resultado;
  const r = resultado as Record<string, unknown>;
  if (!Array.isArray(r.resultados)) return resultado;
  return {
    ...r,
    resultados: r.resultados.map((item) => {
      if (!item || typeof item !== "object") return item;
      const i = item as Record<string, unknown>;
      return typeof i.erro === "string" ? { ...i, erro: truncar(i.erro) } : i;
    }),
  };
}

type ResultadoConsulta =
  | { tipo: "ok"; resultado: unknown }
  | { tipo: "em_andamento" }
  | { tipo: "erro_config" }
  | { tipo: "erro_rede" }
  | { tipo: "erro_json" }
  | { tipo: "erro_upstream"; status: number; corpo: string };

async function consultarWorker(cnpjDigits: string): Promise<ResultadoConsulta> {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { tipo: "erro_config" };

  const inicio = Date.now();
  const corpo = JSON.stringify({
    cnpj: cnpjDigits,
    seguradoras: SEGURADORAS,
    forceRefresh: false,
  });

  while (Date.now() - inicio < ORCAMENTO_MS) {
    let resp: Response;
    try {
      resp = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Access-Client-Id": clientId,
          "CF-Access-Client-Secret": clientSecret,
        },
        body: corpo,
      });
    } catch {
      return { tipo: "erro_rede" };
    }

    if (resp.status === 202) {
      let esperaMs = 2000;
      try {
        const pendente = (await resp.json()) as { retryAfterMs?: unknown };
        const r = Number(pendente?.retryAfterMs);
        if (Number.isFinite(r) && r > 0) esperaMs = Math.max(500, r);
      } catch {
        // mantém a espera padrão
      }
      await new Promise((r) => setTimeout(r, esperaMs));
      continue;
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      return { tipo: "erro_upstream", status: resp.status, corpo: truncar(texto) };
    }

    try {
      return { tipo: "ok", resultado: await resp.json() };
    } catch {
      return { tipo: "erro_json" };
    }
  }

  return { tipo: "em_andamento" };
}

export async function consultarMercadoPendentes() {
  const { lavoroAdmin: supabaseAdmin } = await import(
    "@/integrations/supabase/lavoro-admin.server"
  );

  const limiteRetomada = new Date(Date.now() - RETOMAR_APOS_MS).toISOString();

  // Solicitação mais antiga pendente de consulta: ou nunca consultada
  // (`recebida`), ou retomada de uma execução anterior que não coube no
  // orçamento de tempo (`consultando_mercado` e parada há tempo suficiente).
  const { data: candidatas, error: selErro } = await supabaseAdmin
    .from("garantia_judicial_solicitacoes")
    .select("id, status, cnpj_tomador, consulta_tentativas")
    .or(
      `status.eq.recebida,and(status.eq.consultando_mercado,consulta_iniciada_em.lt.${limiteRetomada})`,
    )
    .order("criado_em", { ascending: true })
    .limit(1);

  if (selErro) return { ok: false, erro: "falha_ao_buscar", detalhe: selErro.message };
  const candidata = candidatas?.[0];
  if (!candidata) return { ok: true, processadas: 0, motivo: "nada_pendente" };

  const tentativas = (candidata.consulta_tentativas ?? 0) + 1;

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
    return { ok: true, id: travada.id, processadas: 1, status: "mercado_consultado", tentativas };
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
