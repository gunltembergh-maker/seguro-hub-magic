// =====================================================================
// Camada de provedor de dados processuais.
//
// O objetivo deste arquivo é que contratar, trocar ou acumular fornecedor
// pago seja CONFIGURAÇÃO, não refatoração. Concretamente:
//
//   * o preço e as capacidades vivem na tabela ab_provedor;
//   * a credencial vive nos secrets (BUREAU_API_KEY) — nunca no banco,
//     nunca com prefixo VITE_;
//   * o formato da resposta vive em normalizar.ts;
//   * o que fica aqui é só COMO se fala com cada um.
//
// Adicionar um fornecedor = uma entrada em IMPLEMENTACOES + um
// normalizador. Nada no motor, nada nas telas.
//
// Sobre o que o dinheiro compra, dito sem rodeio: o campo que decide a
// escolha não é o preço, é `capacidades.filtro_termos` — filtro nativo de
// palavra-chave no ANDAMENTO. Com ele, o gatilho T4 (penhora/bloqueio) é
// uma configuração. Sem ele, é varredura do acervo inteiro, e o custo
// cresce com o tamanho da carteira em vez de com o número de eventos.
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { soDigitos } from "./format.ts";
import { TERMOS_CONSTRICAO } from "./nlp.ts";
import { normalizarPayload, type ProcNorm } from "./normalizar.ts";

export interface Capacidades {
  processos_por_documento: boolean;
  texto_andamento: boolean;
  anexo_texto: boolean;
  monitoramento: boolean;
  filtro_termos: boolean;
  aceita_cpf: boolean;
  callback?: boolean;
  certidoes?: boolean;
  cadastral?: boolean;
}

export interface ProvedorConfig {
  chave: string;
  nome: string;
  ativo: boolean;
  base_url: string | null;
  auth_tipo: string | null;
  auth_header: string | null;
  custo_consulta: number;
  custo_monitoramento_mes: number;
  capacidades: Capacidades;
  observacao: string | null;
  doc_url: string | null;
}

export interface Implementacao {
  /** Consulta sob demanda: devolve os processos do documento. */
  buscar?: (cfg: ProvedorConfig, documento: string, timeoutMs: number) => Promise<ProcNorm[]>;
  /** Registra monitoramento contínuo; a resposta chega pelo webhook. */
  monitorar?: (cfg: ProvedorConfig, documento: string) => Promise<unknown>;
}

const CAPACIDADES_VAZIAS: Capacidades = {
  processos_por_documento: false,
  texto_andamento: false,
  anexo_texto: false,
  monitoramento: false,
  filtro_termos: false,
  aceita_cpf: false,
};

// ---------------------------------------------------------------------
async function pedir(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}${txt ? ` — ${txt.slice(0, 250)}` : ""}`);
    return txt ? JSON.parse(txt) : null;
  } finally {
    clearTimeout(t);
  }
}

function cabecalhos(cfg: ProvedorConfig): Record<string, string> {
  const chave = process.env.BUREAU_API_KEY ?? "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (!chave) return h;
  if (cfg.auth_tipo === "bearer") h["Authorization"] = `Bearer ${chave}`;
  else if (cfg.auth_tipo === "header") h[cfg.auth_header || "api-key"] = chave;
  return h;
}

// ---------------------------------------------------------------------
// Implementações por fornecedor
// ---------------------------------------------------------------------
export const IMPLEMENTACOES: Record<string, Implementacao> = {
  judit: {
    async buscar(cfg, documento, timeoutMs) {
      const doc = soDigitos(documento);
      const base = process.env.BUREAU_REQUEST_BASE ?? "https://requests.production.judit.io";
      const payload = await pedir(`${base}/requests`, {
        method: "POST",
        headers: cabecalhos(cfg),
        body: JSON.stringify({
          search: {
            search_type: doc.length === 14 ? "cnpj" : "cpf",
            search_key: doc,
            response_type: "lawsuits",
            // atalho pago que vale a pena: pedir o anexo já resolvido
            with_attachments: cfg.capacidades.anexo_texto,
          },
        }),
      }, timeoutMs);
      return normalizarPayload({ ...(payload as object), search_key: doc }, "judit");
    },
    async monitorar(cfg, documento) {
      const doc = soDigitos(documento);
      const base = process.env.BUREAU_TRACKING_BASE ?? "https://tracking.production.judit.io";
      const callback = process.env.BUREAU_CALLBACK_URL ?? "";
      const segredo = process.env.BUREAU_WEBHOOK_SECRET ?? "";
      return pedir(`${base}/tracking`, {
        method: "POST",
        headers: cabecalhos(cfg),
        body: JSON.stringify({
          search_type: doc.length === 14 ? "cnpj" : "cpf",
          search_key: doc,
          recurrence: 1,
          with_attachments: true,
          callback_url: segredo
            ? `${callback}?secret=${encodeURIComponent(segredo)}`
            : callback,
          // ESTE é o campo que justifica a escolha do fornecedor
          notification_filters: { step_terms: TERMOS_CONSTRICAO },
        }),
      }, 20_000);
    },
  },

  digesto: {
    async buscar(cfg, documento, timeoutMs) {
      const doc = soDigitos(documento);
      const base = cfg.base_url ?? "https://op.digesto.com.br/api";
      const campo = doc.length === 14 ? "cnpj" : "cpf";
      const payload = await pedir(
        `${base}/tribunal/search?${campo}=${doc}`,
        { method: "GET", headers: cabecalhos(cfg) },
        timeoutMs,
      );
      return normalizarPayload({ ...(payload as object), documento: doc }, "digesto");
    },
    async monitorar(cfg, documento) {
      const doc = soDigitos(documento);
      const base = cfg.base_url ?? "https://op.digesto.com.br/api";
      const campo = doc.length === 14 ? "cnpj" : "cpf";
      return pedir(`${base}/monitored_person`, {
        method: "POST",
        headers: cabecalhos(cfg),
        body: JSON.stringify({
          [campo]: doc,
          callback_url: process.env.BUREAU_CALLBACK_URL ?? "",
        }),
      }, 20_000);
    },
  },

  // Escavador e Predictus: o normalizador do Escavador já está escrito a
  // partir da documentação, mas o endpoint de busca varia por contrato
  // (síncrono x assíncrono com callback). Preencher `buscar` quando houver
  // uma resposta real na mão é trabalho de minutos; escrever no escuro é
  // como se coloca número errado na fila de vendas.
  escavador: {},
  predictus: {},
  infosimples: {},
  bigdatacorp: {},
  nenhum: {},
};

// ---------------------------------------------------------------------
/**
 * Lê o provedor que está de fato em uso: o secret BUREAU_PROVIDER manda,
 * e a linha de ab_provedor complementa com preço e capacidades.
 *
 * Se o secret aponta para um fornecedor que não está no catálogo, isso é
 * erro de configuração e aparece como tal — não silenciosamente como
 * "nenhum".
 */
export async function provedorAtivo(
  sb: SupabaseClient,
): Promise<{ cfg: ProvedorConfig; impl: Implementacao; erro?: string }> {
  const chave = (process.env.BUREAU_PROVIDER ?? "nenhum").toLowerCase();
  const { data } = await sb.from("ab_provedor").select("*").eq("chave", chave).maybeSingle();

  const nenhum: ProvedorConfig = {
    chave: "nenhum", nome: "Somente fontes gratuitas", ativo: true,
    base_url: null, auth_tipo: null, auth_header: null,
    custo_consulta: 0, custo_monitoramento_mes: 0,
    capacidades: CAPACIDADES_VAZIAS, observacao: null, doc_url: null,
  };

  if (chave === "nenhum") return { cfg: nenhum, impl: {} };

  if (!data) {
    return {
      cfg: nenhum,
      impl: {},
      erro: `BUREAU_PROVIDER=${chave} não existe em ab_provedor. ` +
        `Cadastre o fornecedor antes de usar, ou volte o secret para "nenhum".`,
    };
  }

  const bruto = data as Record<string, unknown>;
  const cfg: ProvedorConfig = {
    chave: String(bruto.chave),
    nome: String(bruto.nome),
    ativo: Boolean(bruto.ativo),
    base_url: (bruto.base_url as string) ?? null,
    auth_tipo: (bruto.auth_tipo as string) ?? null,
    auth_header: (bruto.auth_header as string) ?? null,
    custo_consulta: Number(bruto.custo_consulta ?? 0),
    custo_monitoramento_mes: Number(bruto.custo_monitoramento_mes ?? 0),
    capacidades: { ...CAPACIDADES_VAZIAS, ...(bruto.capacidades as object ?? {}) },
    observacao: (bruto.observacao as string) ?? null,
    doc_url: (bruto.doc_url as string) ?? null,
  };

  if (!process.env.BUREAU_API_KEY) {
    return {
      cfg, impl: {},
      erro: `Provedor ${cfg.nome} selecionado, mas o secret BUREAU_API_KEY não está definido.`,
    };
  }
  if (!cfg.ativo) {
    return { cfg, impl: {}, erro: `Provedor ${cfg.nome} está inativo em ab_provedor.` };
  }

  return { cfg, impl: IMPLEMENTACOES[cfg.chave] ?? {} };
}
