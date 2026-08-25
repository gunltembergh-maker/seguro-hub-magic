// =====================================================================
// Solicitação de pesquisa de processos.
//
// É a tela equivalente à busca da Tratum: alguém digita um CNPJ (ou CPF) e
// pede os processos. A diferença é que aqui o pedido é um REGISTRO, com
// finalidade, custo e responsável — e não uma consulta anônima.
//
// Três travas, em ordem, antes de qualquer dinheiro sair:
//
//  1. FINALIDADE — GARANTIA é prospecção comercial, JURIDICO é instrução
//     de caso, COMPLIANCE e RH são due diligence. A finalidade define
//     quem enxerga a solicitação depois (RLS) e é o que torna o uso do
//     dado defensável. Sem finalidade declarada não há minimização.
//  2. DADO PESSOAL — CPF exige base legal REGISTRADA em ab_consentimento.
//     Consentimento (LGPD art. 7º I) para RH e Compliance; exercício
//     regular de direitos em processo (art. 7º VI) para o Jurídico. São
//     bases diferentes, mas a exigência de registro é a mesma: sem linha
//     na tabela, responde 403.
//  3. CUSTO — consulta em bureau é tarifada. A cota mensal da área é
//     debitada ANTES da chamada, de forma atômica, e devolvida se a
//     chamada falhar. Sem isso, o teto é decorativo.
// =====================================================================

import { admin } from "./db.server.ts";
import { cpfMask, soDigitos } from "./format.ts";
import { persistirProcessos } from "./persistir.server.ts";
import { provedorAtivo } from "./provedores.server.ts";
import { rodarMotor } from "./motor.server.ts";

export type Finalidade = "GARANTIA" | "JURIDICO" | "COMPLIANCE" | "RH";
export type Escopo = "PROCESSOS" | "MONITORAMENTO" | "COMPLETO";

export interface CorpoSolicitacao {
  documento: string;
  finalidade?: Finalidade;
  escopo?: Escopo;
  nome?: string;
}

export interface ContextoSolicitante {
  userId: string;
  area: string | null;
}

/** Chave de permissão exigida por finalidade, além de `ab_solicitar`. */
export const CHAVE_POR_FINALIDADE: Record<Finalidade, string> = {
  GARANTIA: "ab_garantia",
  JURIDICO: "ab_juridico",
  COMPLIANCE: "ab_compliance",
  RH: "ab_rh",
};

const TIMEOUT_BUSCA_MS = 25_000;

export async function criarSolicitacao(
  corpo: CorpoSolicitacao,
  ctx: ContextoSolicitante,
): Promise<{ status: number; body: unknown }> {
  const sb = admin();
  const doc = soDigitos(corpo.documento);
  const finalidade = (corpo.finalidade ?? "GARANTIA") as Finalidade;
  const escopo = (corpo.escopo ?? "PROCESSOS") as Escopo;

  if (doc.length !== 11 && doc.length !== 14) {
    return {
      status: 400,
      body: {
        erro: "documento_invalido",
        detalhe: "Informe CNPJ (14) ou CPF (11 dígitos).",
      },
    };
  }
  const tipo = doc.length === 14 ? "CNPJ" : "CPF";
  const chaveDoc = doc.padStart(14, "0");
  const area = ctx.area?.trim() || "(sem area)";

  // ---- registra o pedido antes de qualquer chamada externa ----------
  // Assim, mesmo que a consulta falhe, existe rastro de quem pediu o quê.
  const { data: criada, error: erroCriar } = await sb.from("ab_solicitacao").insert({
    tipo_documento: tipo,
    documento: chaveDoc,
    nome: corpo.nome ?? null,
    finalidade,
    escopo,
    status: "PENDENTE",
    solicitante: ctx.userId,
    area,
  }).select("id").single();

  if (erroCriar || !criada) {
    return {
      status: 500,
      body: { erro: "falha_registro", detalhe: erroCriar?.message ?? "sem id" },
    };
  }
  const id = (criada as { id: string }).id;

  /**
   * Fecha a solicitação e responde.
   *
   * `colunas` e `resposta` são separados de propósito: só o primeiro vai
   * para o UPDATE. Misturar os dois é como se escreve um 500 gratuito —
   * um campo de resposta que não existe como coluna derruba a gravação
   * justamente no caminho de erro, onde ninguém está olhando.
   */
  const encerrar = async (
    status: string,
    detalhe: string,
    colunas: Record<string, unknown> = {},
    resposta: Record<string, unknown> = {},
    http = 200,
  ) => {
    const { error } = await sb.from("ab_solicitacao").update({
      status, detalhe, concluido_em: new Date().toISOString(), ...colunas,
    }).eq("id", id);
    return {
      status: http,
      body: {
        ok: http === 200,
        solicitacao_id: id,
        status,
        detalhe,
        ...colunas,
        ...resposta,
        ...(error ? { aviso_gravacao: error.message } : {}),
      },
    };
  };

  // ---- trava 2: dado pessoal ---------------------------------------
  if (tipo === "CPF") {
    const { data: bases } = await sb
      .from("ab_consentimento")
      .select("id, base_legal, validade, created_at")
      .eq("documento", doc)
      .is("revogado_em", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const base = (bases ?? [])[0] as
      { id: string; base_legal: string | null; validade: string | null } | undefined;
    const valido = base &&
      (!base.validade || base.validade >= new Date().toISOString().slice(0, 10));

    if (!valido) {
      return encerrar(
        "SEM_CONSENTIMENTO",
        `Consulta de dado pessoal bloqueada: não há base legal registrada e vigente ` +
        `para o CPF ${cpfMask(doc)}. Registre o termo antes de prosseguir — ` +
        `consentimento (LGPD art. 7º I) ou, no Jurídico, exercício regular de ` +
        `direitos em processo (art. 7º VI).`,
        {},
        { documento_mascarado: cpfMask(doc) },
        403,
      );
    }
  }

  // ---- provedor ----------------------------------------------------
  const { cfg, impl, erro } = await provedorAtivo(sb);

  if (erro) {
    return encerrar("ERRO", erro, { provedor: cfg.chave }, {}, 500);
  }

  if (!cfg.capacidades.processos_por_documento || !impl.buscar) {
    // Sem bureau, o que existe é o que as fontes gratuitas já trouxeram.
    // Responder isso com honestidade vale mais que responder vazio.
    const { data: emp } = await sb
      .from("ab_empresa").select("id").eq("cnpj", chaveDoc).maybeSingle();
    const empresaId = emp ? (emp as { id: string }).id : null;
    const { count } = empresaId
      ? await sb.from("ab_processo").select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
      : { count: 0 };

    return encerrar(
      "SEM_PROVEDOR",
      `Nenhum bureau judicial contratado (BUREAU_PROVIDER=${cfg.chave}). ` +
      `A base tem ${count ?? 0} processo(s) deste documento, vindos das fontes ` +
      `gratuitas. Processo por documento com texto de andamento — o que alimenta ` +
      `os gatilhos T1, T2, T4 e T13 — não existe de graça.`,
      { provedor: cfg.chave, empresa_id: empresaId },
      { processos_na_base: count ?? 0 },
    );
  }

  if (tipo === "CPF" && !cfg.capacidades.aceita_cpf) {
    return encerrar(
      "RECUSADA",
      `O provedor ${cfg.nome} não atende busca por CPF.`,
      { provedor: cfg.chave },
    );
  }

  // ---- trava 3: cota ------------------------------------------------
  const custo = Number(cfg.custo_consulta ?? 0);
  let cotaConsumida = false;

  if (custo > 0) {
    const { data: cota, error: erroCota } = await sb.rpc("rpc_ab_consumir_cota", {
      p_area: area, p_consultas: 1, p_valor: custo,
    });
    if (erroCota) {
      return encerrar("ERRO", `cota: ${erroCota.message}`, { provedor: cfg.chave }, {}, 500);
    }
    const r = (cota ?? {}) as Record<string, unknown>;
    if (r.ok !== true) {
      return encerrar(
        "BLOQUEADA_COTA",
        `Teto de consulta paga da área "${area}" atingido ` +
        `(${r.motivo === "limite_valor" ? "limite de valor" : "limite de consultas"}: ` +
        `${r.consumido} de ${r.limite}). Um gestor com a chave ab_cota_gerir pode ` +
        `elevar o teto do mês em Fontes › Cotas e custos.`,
        { provedor: cfg.chave },
        { custo_estimado: custo, cota: r },
      );
    }
    cotaConsumida = true;
  }

  // ---- execução ----------------------------------------------------
  await sb.from("ab_solicitacao").update({
    status: "EM_ANDAMENTO", provedor: cfg.chave, custo,
    iniciado_em: new Date().toISOString(),
  }).eq("id", id);

  try {
    const processos = escopo === "MONITORAMENTO"
      ? []
      : await impl.buscar(cfg, doc, TIMEOUT_BUSCA_MS);

    const persistido = processos.length
      ? await persistirProcessos(sb, processos, cfg.chave)
      : { processos: 0, movimentacoes: 0, com_sinal: 0, empresas: [], avisos: [] };

    if ((escopo === "MONITORAMENTO" || escopo === "COMPLETO") && impl.monitorar) {
      try {
        await impl.monitorar(cfg, doc);
      } catch (err) {
        persistido.avisos.push(`monitoramento: ${(err as Error).message}`);
      }
    }

    // Reavalia o motor só para este documento — é o que transforma
    // processo em lead com valor, prazo e argumento.
    let leads = 0;
    if (persistido.processos) {
      const r = await rodarMotor({ cnpj: chaveDoc });
      const corpoMotor = (r.body ?? {}) as { stats?: { leads?: number } };
      leads = corpoMotor.stats?.leads ?? 0;
    }

    const { data: emp } = await sb
      .from("ab_empresa").select("id, razao_social").eq("cnpj", chaveDoc).maybeSingle();

    // A consulta aconteceu: cobra, mesmo que o retorno tenha vindo vazio.
    // Empresa sem processo é resposta legítima e o fornecedor tarifa igual.
    if (custo > 0) {
      await sb.from("ab_consumo").insert({
        solicitacao_id: id,
        provedor: cfg.chave,
        tipo: escopo === "MONITORAMENTO" ? "MONITORAMENTO" : "CONSULTA",
        documento: chaveDoc,
        area,
        usuario: ctx.userId,
        custo,
        detalhe: `${persistido.processos} processo(s), ${persistido.movimentacoes} andamento(s)`,
      });
    }

    return encerrar(
      "CONCLUIDA",
      persistido.processos
        ? `${persistido.processos} processo(s), ${persistido.movimentacoes} andamento(s) ` +
          `novo(s), ${persistido.com_sinal} com sinal de constrição.`
        : escopo === "MONITORAMENTO"
          ? "Monitoramento registrado. Os andamentos chegarão por webhook."
          : "O provedor não encontrou processo para este documento.",
      {
        provedor: cfg.chave,
        custo,
        empresa_id: emp ? (emp as { id: string }).id : null,
        processos_encontrados: persistido.processos,
        movimentacoes_novas: persistido.movimentacoes,
        leads_gerados: leads,
      },
      {
        razao_social: emp ? (emp as { razao_social: string }).razao_social : null,
        com_sinal: persistido.com_sinal,
        avisos: persistido.avisos,
      },
    );
  } catch (err) {
    // A chamada falhou: o fornecedor não entregou nada, então a cota volta.
    if (cotaConsumida) {
      await sb.rpc("rpc_ab_devolver_cota", {
        p_area: area, p_consultas: 1, p_valor: custo,
      });
    }
    return encerrar(
      "ERRO",
      `${cfg.nome}: ${(err as Error).message}`,
      { provedor: cfg.chave },
      { cota_devolvida: cotaConsumida },
      502,
    );
  }
}
