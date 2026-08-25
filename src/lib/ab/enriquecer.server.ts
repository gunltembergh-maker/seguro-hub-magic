// =====================================================================
// Enriquecimento cadastral por CNPJ.
//
// É o que transforma "lead" em "alguém para ligar". Sem telefone e
// endereço, a fila entrega CNPJ e razão social, e o comercial gasta o
// tempo dele procurando contato em vez de vendendo.
//
// Traz também três coisas que o motor JÁ usa e vinha estimando no escuro:
// porte e capital social (peso na probabilidade de subscrição), CNAE
// (define se é setor prioritário) e situação cadastral (filtro negativo).
// Enriquecer não é cosmético — melhora a precificação.
//
// ---------------------------------------------------------------------
// A FONTE
//
// Cadastro de CNPJ da Receita Federal, dado público de pessoa jurídica.
// O caminho prático é um espelho dos dados abertos que exponha consulta
// por CNPJ; o padrão aponta para minhareceita.org, que é software livre e
// pode ser auto-hospedado se a Lavoro preferir não depender de terceiro.
//
// Medido na API antes de escrever este arquivo, com um CNPJ real:
//   telefone            → presente
//   e-mail              → null (a Receita raramente preenche)
//   endereço completo   → presente
//   CNAE, porte, capital, situação, data de abertura → presentes
//   QSA com nome, qualificação e documento do sócio  → presente
//
// Ou seja: telefone sim, e-mail quase nunca. Prometer e-mail para o time
// comercial seria prometer o que a fonte não dá.
//
// ---------------------------------------------------------------------
// O QUE ESTE ARQUIVO NÃO FAZ
//
// Não consulta fornecedor pago. Quando houver um contratado para
// enriquecimento (BigDataCorp, Direct Data), ele entra como provedor em
// ab_provedor e é chamado APÓS a Receita, só para o que ficou vazio — é
// mais barato completar lacuna que comprar o que já é público.
// =====================================================================

import { admin, logIngest } from "./db.server.ts";
import { soDigitos } from "./format.ts";
import { criarPrazo, ehRateLimit, esperaSugerida } from "./orcamento.ts";

const BASE = process.env.RFB_CNPJ_BASE ?? "https://minhareceita.org";

// Serviço público e gratuito: o ritmo é generoso de propósito. Bater forte
// numa fonte comunitária é o jeito mais rápido de perdê-la.
const ESPACO_MS = 1_100;
const LOTE_PADRAO = 20;
const TIMEOUT_MS = 12_000;
// Cadastro de CNPJ muda pouco. Reenriquecer todo dia é desperdício.
const VALIDADE_DIAS = 45;

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Cadastro {
  telefone: string | null;
  telefone_2: string | null;
  email: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  cnae: string | null;
  cnae_descricao: string | null;
  cnaes_secundarios: string[] | null;
  porte: string | null;
  capital_social: number | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  natureza_juridica: string | null;
  matriz_filial: string | null;
  socios: {
    nome: string;
    qualificacao: string | null;
    documento_mascarado: string | null;
    tipo: string | null;
    desde: string | null;
    faixa_etaria: string | null;
    representante_nome: string | null;
    representante_qualif: string | null;
  }[];
}

const texto = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" || s === "null" ? null : s;
};

const dataISO = (v: unknown): string | null => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/**
 * Junta DDD e número num telefone só. A Receita entrega
 * `ddd_telefone_1` já concatenado em alguns espelhos e separado em
 * outros; aceitar as duas formas custa três linhas.
 */
function telefoneDe(x: any, n: 1 | 2): string | null {
  const junto = texto(x[`ddd_telefone_${n}`]);
  if (junto) return soDigitos(junto) || null;
  const ddd = texto(x[`ddd_${n}`]) ?? texto(x.ddd);
  const num = texto(x[`telefone_${n}`]);
  return num ? soDigitos(`${ddd ?? ""}${num}`) || null : null;
}

function normalizarCadastro(x: any): Cadastro {
  const qsa: any[] = Array.isArray(x.qsa) ? x.qsa : [];
  return {
    telefone: telefoneDe(x, 1),
    telefone_2: telefoneDe(x, 2),
    // `correio_eletronico` é o nome no arquivo original da Receita;
    // `email` é o nome nos espelhos. Os dois aparecem na prática.
    email: texto(x.email) ?? texto(x.correio_eletronico),
    razao_social: texto(x.razao_social),
    nome_fantasia: texto(x.nome_fantasia),
    logradouro: [texto(x.descricao_tipo_de_logradouro), texto(x.logradouro)]
      .filter(Boolean).join(" ") || null,
    numero: texto(x.numero),
    complemento: texto(x.complemento),
    bairro: texto(x.bairro),
    cep: texto(x.cep) ? soDigitos(x.cep) : null,
    municipio: texto(x.municipio),
    uf: texto(x.uf)?.slice(0, 2) ?? null,
    cnae: texto(x.cnae_fiscal),
    cnae_descricao: texto(x.cnae_fiscal_descricao),
    cnaes_secundarios: Array.isArray(x.cnaes_secundarios)
      ? x.cnaes_secundarios
          .map((c: any) => texto(c?.codigo ?? c))
          .filter(Boolean) as string[]
      : null,
    porte: texto(x.porte),
    capital_social: Number.isFinite(Number(x.capital_social))
      ? Number(x.capital_social)
      : null,
    situacao_cadastral: texto(x.descricao_situacao_cadastral) ?? texto(x.situacao_cadastral),
    data_abertura: dataISO(x.data_inicio_atividade),
    natureza_juridica: texto(x.natureza_juridica),
    matriz_filial: texto(x.descricao_identificador_matriz_filial),
    socios: qsa.map((s) => ({
      nome: texto(s.nome_socio) ?? texto(s.nome) ?? "(sem nome)",
      qualificacao: texto(s.qualificacao_socio),
      // CPF de sócio já vem mascarado da Receita, e continua mascarado
      // aqui. Nunca desmascare: é dado pessoal sem finalidade no módulo.
      documento_mascarado: texto(s.cnpj_cpf_do_socio),
      tipo: texto(s.identificador_de_socio),
      desde: dataISO(s.data_entrada_sociedade),
      faixa_etaria: texto(s.faixa_etaria),
      representante_nome: texto(s.nome_representante_legal),
      representante_qualif: texto(s.qualificacao_representante_legal),
    })),
  };
}

async function buscarCadastro(cnpj: string): Promise<Cadastro | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}/${soDigitos(cnpj)}`, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HubLavoro/1.0 (+garantias@lavoroseguros.com.br)",
      },
    });
    // 404 é resposta legítima: CNPJ que não está na base da Receita.
    if (r.status === 404) return null;
    if (!r.ok) {
      const corpo = await r.text().catch(() => "");
      const erro = Object.assign(
        new Error(`HTTP ${r.status}${corpo ? ` — ${corpo.slice(0, 160)}` : ""}`),
        { status: r.status },
      ) as Error & { status: number; retryAfterSeg?: number };
      if (r.status === 429) {
        const ra = Number(r.headers.get("retry-after") ?? "");
        if (Number.isFinite(ra) && ra > 0) erro.retryAfterSeg = Math.ceil(ra);
      }
      throw erro;
    }
    const txt = await r.text();
    return txt ? normalizarCadastro(JSON.parse(txt)) : null;
  } finally {
    clearTimeout(t);
  }
}

export interface CorpoEnriquecer {
  cnpjs?: string[];
  limite?: number;
  /** Reenriquece mesmo quem já foi consultado recentemente. */
  forcar?: boolean;
  orcamentoMs?: number;
}

export async function enriquecerCadastro(
  cfg: CorpoEnriquecer = {},
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();
  const prazo = criarPrazo(Math.min(cfg.orcamentoMs ?? 45_000, 55_000));
  const limite = Math.min(cfg.limite ?? LOTE_PADRAO, 60);

  let alvos = (cfg.cnpjs ?? []).map(soDigitos).filter((c) => c.length === 14);

  if (!alvos.length) {
    // Rodízio: nunca enriquecidos primeiro, depois os mais antigos. Mesma
    // lógica da Transparência, e pelo mesmo motivo — um lote não cobre a
    // base, então sem rodízio o cron reconsulta sempre os mesmos.
    const corte = new Date(Date.now() - VALIDADE_DIAS * 86_400_000).toISOString();
    let q = sb.from("ab_empresa").select("cnpj, cadastro_atualizado_em");
    if (!cfg.forcar) q = q.or(`cadastro_atualizado_em.is.null,cadastro_atualizado_em.lt.${corte}`);
    const { data } = await q
      .order("cadastro_atualizado_em", { ascending: true, nullsFirst: true })
      .limit(limite);
    alvos = (data ?? []).map((e: { cnpj: string }) => e.cnpj);
  }

  const stats = {
    consultados: 0, atualizados: 0, com_telefone: 0, com_email: 0,
    socios: 0, nao_encontrados: 0,
  };
  const avisos: string[] = [];
  let rateLimitSeg = 0;

  if (!alvos.length) {
    return {
      status: 200,
      body: {
        ok: true,
        aviso: `nenhuma empresa com cadastro vencido (validade ${VALIDADE_DIAS} dias). ` +
          `Use {"forcar":true} para reenriquecer.`,
        stats,
      },
    };
  }

  try {
    let proximoEm = 0;
    for (const cnpj of alvos) {
      if (!prazo.cabeOutraPagina()) {
        avisos.push(`prazo: parou após ${stats.consultados} de ${alvos.length}`);
        break;
      }
      // ritmo: nunca dois pedidos em menos de ESPACO_MS
      const espera = proximoEm - Date.now();
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      proximoEm = Date.now() + ESPACO_MS;

      let cad: Cadastro | null;
      try {
        cad = await buscarCadastro(cnpj);
        stats.consultados++;
      } catch (err) {
        if (ehRateLimit(err)) {
          rateLimitSeg = esperaSugerida(err, 300);
          avisos.push(`limite de taxa na Receita — parando, back-off de ${rateLimitSeg}s`);
          break;
        }
        avisos.push(`${cnpj}: ${(err as Error).message.slice(0, 120)}`);
        continue;
      }

      if (!cad) {
        stats.nao_encontrados++;
        // Carimba mesmo assim: senão o rodízio volta neste CNPJ para sempre.
        await sb.from("ab_empresa")
          .update({
            cadastro_atualizado_em: new Date().toISOString(),
            cadastro_fonte: "rfb:nao_encontrado",
          })
          .eq("cnpj", cnpj);
        continue;
      }

      // Só sobrescreve o que veio preenchido: razão social boa na base não
      // pode ser trocada por null porque a fonte veio incompleta.
      const campos: Record<string, unknown> = {
        cadastro_atualizado_em: new Date().toISOString(),
        cadastro_fonte: "rfb",
      };
      for (const [k, v] of Object.entries({
        telefone: cad.telefone, telefone_2: cad.telefone_2, email: cad.email,
        razao_social: cad.razao_social, nome_fantasia: cad.nome_fantasia,
        logradouro: cad.logradouro, numero: cad.numero, complemento: cad.complemento,
        bairro: cad.bairro, cep: cad.cep, municipio: cad.municipio, uf: cad.uf,
        cnae: cad.cnae, cnae_descricao: cad.cnae_descricao,
        cnaes_secundarios: cad.cnaes_secundarios, porte: cad.porte,
        capital_social: cad.capital_social, situacao_cadastral: cad.situacao_cadastral,
        data_abertura: cad.data_abertura, natureza_juridica: cad.natureza_juridica,
        matriz_filial: cad.matriz_filial,
      })) {
        if (v !== null && v !== undefined) campos[k] = v;
      }

      const { data: emp, error } = await sb.from("ab_empresa")
        .update(campos).eq("cnpj", cnpj).select("id").maybeSingle();
      if (error) { avisos.push(`${cnpj}: ${error.message}`); continue; }

      stats.atualizados++;
      if (cad.telefone) stats.com_telefone++;
      if (cad.email) stats.com_email++;

      if (emp && cad.socios.length) {
        const empresaId = (emp as { id: string }).id;
        const { error: eSoc } = await sb.from("ab_socio").upsert(
          cad.socios.map((s) => ({
            empresa_id: empresaId,
            nome: s.nome,
            qualificacao: s.qualificacao ?? "",
            documento_mascarado: s.documento_mascarado,
            tipo: s.tipo,
            desde: s.desde,
            faixa_etaria: s.faixa_etaria,
            representante_nome: s.representante_nome,
            representante_qualif: s.representante_qualif,
            fonte: "rfb",
          })),
          { onConflict: "empresa_id,nome,qualificacao" },
        );
        if (eSoc) avisos.push(`QSA ${cnpj}: ${eSoc.message}`);
        else stats.socios += cad.socios.length;
      }
    }

    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "rfb_cadastro",
      status: avisos.length ? "parcial" : "ok",
      recebidos: stats.consultados,
      gravados: stats.atualizados,
      detalhe: `${stats.atualizados}/${stats.consultados} atualizados · ` +
        `${stats.com_telefone} com telefone · ${stats.com_email} com e-mail · ` +
        `${stats.socios} sócio(s) · ${stats.nao_encontrados} fora da base da Receita` +
        (avisos.length ? ` · ${avisos.slice(0, 3).join("; ")}` : ""),
      duracao_ms: ms,
    });

    return {
      status: 200,
      body: {
        ok: true,
        rate_limited: rateLimitSeg > 0,
        alvos: alvos.length,
        stats,
        // Dito na resposta porque é a expectativa que mais decepciona:
        // a Receita entrega telefone, quase nunca e-mail.
        nota_cobertura:
          "Telefone tem boa cobertura no cadastro da Receita; e-mail raramente " +
          "é preenchido. Para e-mail, o caminho é fornecedor de enriquecimento.",
        avisos,
        duracao_ms: ms,
      },
    };
  } catch (err) {
    await logIngest(sb, {
      fonte: "rfb_cadastro", status: "erro",
      detalhe: (err as Error).message, duracao_ms: Date.now() - t0,
    });
    return { status: 500, body: { ok: false, erro: (err as Error).message, stats } };
  }
}
