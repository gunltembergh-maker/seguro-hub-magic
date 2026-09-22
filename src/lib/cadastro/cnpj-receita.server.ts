// =====================================================================
// Cartão CNPJ — módulo compartilhado do Hub.
//
// Extraído de src/lib/ab/enriquecer.server.ts sem alterar comportamento.
// A Análise de Background e a Entrada de Demandas consultam a MESMA
// fonte e usam o MESMO normalizador de propósito: dois normalizadores
// significariam duas verdades de cartão CNPJ dentro do Hub.
//
// ---------------------------------------------------------------------
// A FONTE
//
// Cadastro de CNPJ da Receita Federal, dado público de pessoa jurídica,
// lido por um espelho dos dados abertos (padrão minhareceita.org, que é
// software livre e pode ser auto-hospedado). É serviço público e
// comunitário: o ritmo (ESPACO_MS) é deliberadamente generoso, porque
// bater forte numa fonte comunitária é o jeito mais rápido de perdê-la.
//
// Cobertura medida na prática:
//   telefone            → boa cobertura
//   e-mail              → quase nunca vem preenchido
//   endereço completo   → presente
//   CNAE, porte, capital, situação, data de abertura → presentes
//   QSA com nome, qualificação e documento mascarado → presente
// =====================================================================

import { soDigitos } from "../ab/format.ts";

export const BASE = process.env.RFB_CNPJ_BASE ?? "https://minhareceita.org";

// Serviço público e gratuito: o ritmo é generoso de propósito. Bater forte
// numa fonte comunitária é o jeito mais rápido de perdê-la.
export const ESPACO_MS = 1_100;
export const TIMEOUT_MS = 12_000;

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Cadastro {
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

export const texto = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" || s === "null" ? null : s;
};

export const dataISO = (v: unknown): string | null => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/**
 * Junta DDD e número num telefone só. A Receita entrega
 * `ddd_telefone_1` já concatenado em alguns espelhos e separado em
 * outros; aceitar as duas formas custa três linhas.
 */
export function telefoneDe(x: any, n: 1 | 2): string | null {
  const junto = texto(x[`ddd_telefone_${n}`]);
  if (junto) return soDigitos(junto) || null;
  const ddd = texto(x[`ddd_${n}`]) ?? texto(x.ddd);
  const num = texto(x[`telefone_${n}`]);
  return num ? soDigitos(`${ddd ?? ""}${num}`) || null : null;
}

export function normalizarCadastro(x: any): Cadastro {
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

export async function buscarCadastro(cnpj: string): Promise<Cadastro | null> {
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
