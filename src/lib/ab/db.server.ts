// Utilitários compartilhados pelo motor (portados de supabase/functions/_shared/db.ts).
//
// Toda escrita no banco passa por aqui, com service_role (lavoroAdmin) — assim
// as policies de RLS do front continuam valendo só para leitura.
// Server-only: o sufixo `.server.ts` mantém isso fora do bundle do navegador.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lavoroAdmin } from "@/integrations/supabase/lavoro-admin.server";
import { soDigitos } from "./format.ts";
import { PARAMETROS_PADRAO, type Parametros } from "./pricing.ts";
import { carregarDicionario, type Sinal } from "./nlp.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: CORS }) : null;
}

/** Cliente com service_role. Ignora RLS — use só no servidor. */
export function admin(): SupabaseClient {
  return lavoroAdmin as unknown as SupabaseClient;
}

/** Cliente no contexto do usuário que chamou — respeita RLS. */
export function comoUsuario(req: Request): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
}

/**
 * Confere permissão usando o modelo que o Hub JÁ TEM:
 *   rpc_meu_perfil() → { permissoes: jsonb, roles: app_role[] }
 *
 * Espelha o hasPermission() do front (src/hooks/use-meu-perfil.ts):
 * ADMIN passa em tudo; qualquer outro papel depende da chave marcada em
 * perfis_acesso.permissoes. DIRETORIA_GERAL não entra por herança de cargo.
 *
 * `chaves` são as do módulo: ab_garantia | ab_compliance | ab_rh.
 */
export async function exigirPerfil(
  req: Request,
  chaves: string[],
): Promise<{ userId: string } | Response> {
  const sb = comoUsuario(req);
  const { data: user } = await sb.auth.getUser();
  if (!user?.user) return json({ erro: "nao_autenticado" }, 401);

  const { data, error } = await sb.rpc("rpc_meu_perfil");
  if (error) return json({ erro: "falha_perfil", detalhe: error.message }, 500);

  const row = Array.isArray(data) ? data[0] : data;
  const roles: string[] = row?.roles ?? [];
  const permissoes: Record<string, boolean> = row?.permissoes ?? {};

  const ok = roles.includes("ADMIN") || chaves.some((c) => permissoes[c] === true);
  if (!ok) {
    return json({
      erro: "sem_permissao",
      chaves_necessarias: chaves,
      detalhe: "Peça a um administrador para marcar a chave no seu perfil em /admin/perfis.",
    }, 403);
  }
  return { userId: user.user.id };
}

export interface ContextoUsuario {
  userId: string;
  /** profiles.area — é a noção de time do Hub, e a chave da cota de custo. */
  area: string | null;
  roles: string[];
  permissoes: Record<string, boolean>;
  /** Espelha hasPermission() do front: ADMIN passa em tudo. */
  pode: (...chaves: string[]) => boolean;
}

/**
 * Contexto completo do usuário que chamou: identidade, área e permissões.
 *
 * Existe além do exigirPerfil() porque algumas rotas precisam decidir com
 * mais de uma chave (ex.: `ab_solicitar` E a chave da finalidade) e
 * precisam da área para debitar a cota. Devolver o contexto e deixar a
 * rota decidir é mais honesto que multiplicar variações de exigirPerfil.
 */
export async function contextoUsuario(
  req: Request,
): Promise<ContextoUsuario | Response> {
  const sb = comoUsuario(req);
  const { data: user } = await sb.auth.getUser();
  if (!user?.user) return json({ erro: "nao_autenticado" }, 401);

  const { data, error } = await sb.rpc("rpc_meu_perfil");
  if (error) return json({ erro: "falha_perfil", detalhe: error.message }, 500);

  const row = (Array.isArray(data) ? data[0] : data) as
    { roles?: string[]; permissoes?: Record<string, boolean> } | null;
  const roles = row?.roles ?? [];
  const permissoes = row?.permissoes ?? {};

  // rpc_meu_perfil() não devolve profiles.area, e não vamos alterar uma
  // função existente do Hub — daí o helper ab_minha_area().
  const { data: area } = await sb.rpc("ab_minha_area");

  return {
    userId: user.user.id,
    area: (area as string | null) ?? null,
    roles,
    permissoes,
    pode: (...chaves: string[]) =>
      roles.includes("ADMIN") || chaves.some((c) => permissoes[c] === true),
  };
}

/**
 * Autenticação por segredo compartilhado, para rotas chamadas por máquina
 * (pg_cron e webhook do bureau). Aceita header ou query string, porque nem
 * todo fornecedor deixa configurar header customizado no callback.
 *
 * Devolve `null` quando está tudo certo, ou a Response de erro.
 */
export function conferirSegredo(req: Request, esperado: string | undefined): Response | null {
  if (!esperado) {
    return json({
      erro: "server_misconfigured",
      detalhe: "O segredo desta rota não está definido nos secrets do projeto.",
    }, 500);
  }
  const url = new URL(req.url);
  const recebido = req.headers.get("x-ab-secret")
    ?? req.headers.get("x-hub-secret")
    ?? url.searchParams.get("secret");
  if (recebido !== esperado) return json({ erro: "unauthorized" }, 401);
  return null;
}

/** Lê ab_parametro. Cai no padrão se a tabela estiver vazia. */
export async function carregarParametros(sb: SupabaseClient): Promise<Parametros> {
  const { data } = await sb.from("ab_parametro").select("chave, valor");
  const p = { ...PARAMETROS_PADRAO } as Record<string, number>;
  for (const row of (data ?? []) as { chave: string; valor: number }[]) p[row.chave] = Number(row.valor);
  return p as unknown as Parametros;
}

/** Lê ab_sinal e substitui o dicionário em memória, se houver linhas. */
export async function carregarSinais(sb: SupabaseClient): Promise<number> {
  const { data } = await sb
    .from("ab_sinal")
    .select("nome, padrao, peso, categoria")
    .eq("ativo", true);
  if (data?.length) {
    carregarDicionario(
      (data as Record<string, unknown>[]).map((s) => ({ ...s, peso: Number(s.peso) })) as unknown as Sinal[],
    );
    return data.length;
  }
  return 0;
}

/** Encontra ou cria a empresa. Devolve o id. */
export async function upsertEmpresa(
  sb: SupabaseClient,
  cnpj: string,
  campos: Record<string, unknown> = {},
): Promise<string> {
  const doc = soDigitos(cnpj).padStart(14, "0");
  const payload: Record<string, unknown> = {
    cnpj: doc,
    cnpj_raiz: doc.slice(0, 8),
    ...Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== null && v !== undefined && v !== ""),
    ),
  };
  if (!payload.razao_social) payload.razao_social = doc;

  const { data, error } = await sb
    .from("ab_empresa")
    .upsert(payload, { onConflict: "cnpj", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw new Error(`upsertEmpresa(${doc}): ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Versão em lote do upsertEmpresa. Existe por causa do runtime: no
 * Cloudflare Workers cada ida ao banco custa latência de rede, e uma
 * ingestão do PNCP com 2.000 itens fazendo um upsert por item estoura o
 * limite da borda muito antes de terminar. Aqui são 3 idas ao banco,
 * independentemente do tamanho da lista.
 *
 * Regra de nome: `razao_social` é NOT NULL, então empresa nova sem nome
 * entra com o próprio CNPJ como placeholder. Se depois chegar o nome de
 * verdade, ele substitui o placeholder — e só o placeholder. Nome já bom
 * na base nunca é sobrescrito por ingestão.
 */
export async function upsertEmpresasEmLote(
  sb: SupabaseClient,
  linhas: { cnpj: string; [campo: string]: unknown }[],
  chunk = 200,
): Promise<Map<string, string>> {
  const porCnpj = new Map<string, Record<string, unknown>>();
  for (const l of linhas) {
    const doc = soDigitos(l.cnpj).padStart(14, "0");
    if (doc.length !== 14) continue;
    const campos = Object.fromEntries(
      Object.entries(l).filter(
        ([k, v]) => k !== "cnpj" && v !== null && v !== undefined && v !== "",
      ),
    );
    porCnpj.set(doc, { ...(porCnpj.get(doc) ?? {}), ...campos });
  }

  const docs = [...porCnpj.keys()];
  const mapa = new Map<string, string>();
  if (!docs.length) return mapa;

  // 1. o que já existe
  const placeholder = new Set<string>();
  for (let i = 0; i < docs.length; i += chunk) {
    const { data, error } = await sb
      .from("ab_empresa")
      .select("id, cnpj, razao_social")
      .in("cnpj", docs.slice(i, i + chunk));
    if (error) throw new Error(`upsertEmpresasEmLote/select: ${error.message}`);
    for (const r of (data ?? []) as { id: string; cnpj: string; razao_social: string }[]) {
      mapa.set(r.cnpj, r.id);
      if (r.razao_social === r.cnpj) placeholder.add(r.cnpj);
    }
  }

  // 2. insere os que faltam
  const novos = docs.filter((d) => !mapa.has(d)).map((d) => ({
    razao_social: d,
    ...porCnpj.get(d)!,
    cnpj: d,
    cnpj_raiz: d.slice(0, 8),
  }));
  for (let i = 0; i < novos.length; i += chunk) {
    const { data, error } = await sb
      .from("ab_empresa")
      .upsert(novos.slice(i, i + chunk), { onConflict: "cnpj" })
      .select("id, cnpj");
    if (error) throw new Error(`upsertEmpresasEmLote/insert: ${error.message}`);
    for (const r of (data ?? []) as { id: string; cnpj: string }[]) mapa.set(r.cnpj, r.id);
  }

  // 3. troca o placeholder pelo nome real, quando ele chegou agora
  const renomear = [...placeholder]
    .filter((d) => typeof porCnpj.get(d)?.razao_social === "string")
    .map((d) => ({
      cnpj: d,
      cnpj_raiz: d.slice(0, 8),
      razao_social: porCnpj.get(d)!.razao_social,
    }));
  for (let i = 0; i < renomear.length; i += chunk) {
    await sb.from("ab_empresa").upsert(renomear.slice(i, i + chunk), { onConflict: "cnpj" });
  }

  return mapa;
}

/** Upsert em fatias, para não estourar o tamanho de payload da borda. */
export async function upsertEmLote(
  sb: SupabaseClient,
  tabela: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunk = 200,
): Promise<{ gravados: number; erros: string[] }> {
  let gravados = 0;
  const erros: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const fatia = rows.slice(i, i + chunk);
    const { error } = await sb.from(tabela).upsert(fatia, { onConflict });
    if (error) erros.push(`${tabela}[${i}]: ${error.message}`);
    else gravados += fatia.length;
  }
  return { gravados, erros };
}

export async function logIngest(
  sb: SupabaseClient,
  row: {
    fonte: string;
    status: string;
    recebidos?: number;
    gravados?: number;
    detalhe?: string;
    duracao_ms?: number;
  },
): Promise<void> {
  await sb.from("ab_ingest_log").insert(row);
}

/** Busca com timeout e mensagem de erro útil no log de ingestão. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": "HubLavoro/1.0 (+garantias@lavoroseguros.com.br)",
        ...(init.headers ?? {}),
      },
    });
    if (!r.ok) {
      const corpo = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} em ${url}${corpo ? ` — ${corpo.slice(0, 200)}` : ""}`);
    }
    const txt = await r.text();
    return (txt ? JSON.parse(txt) : null) as T;
  } finally {
    clearTimeout(t);
  }
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export function isoMaisDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function aaaammdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
