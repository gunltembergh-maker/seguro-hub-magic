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
