// Token de aplicativo do Microsoft Graph (client_credentials).
// Espelha a lógica da Edge Function do SharePoint, mas com process.env.
// `.server.ts` mantém este módulo fora do bundle do cliente.
//
// Precedência de credenciais:
// 1. Conjunto dedicado de e-mail: LAVORO_MAIL_GRAPH_TENANT_ID, LAVORO_MAIL_GRAPH_CLIENT_ID, LAVORO_MAIL_GRAPH_CLIENT_SECRET.
// 2. Conjunto compartilhado com SharePoint: LAVORO_GRAPH_TENANT_ID, LAVORO_GRAPH_CLIENT_ID, LAVORO_GRAPH_CLIENT_SECRET.
//
// Regras:
// - Se nenhuma variável do conjunto 1 existir, usamos o conjunto 2 (comportamento anterior).
// - Se todas as variáveis do conjunto 1 existirem, usamos o conjunto 1.
// - Se alguma variável do conjunto 1 existir e outra não, falhamos imediatamente com a lista das faltantes.
//   Nunca misturamos tenant/client/secret entre os dois conjuntos.
// - O cache do token guarda uma marca do conjunto que o gerou; se o conjunto ativo mudar, o cache é descartado.

const SCOPE = "https://graph.microsoft.com/.default";
/** Renova com folga: um token de ~1h é trocado quando faltam 5 min. */
const FOLGA_MS = 5 * 60 * 1000;

type Conjunto = "dedicado" | "compartilhado";
type Cache = { token: string; expiraEm: number; conjunto: Conjunto };
let cache: Cache | undefined;
let conjuntoJaLogado: Conjunto | undefined;

function listarFaltantes(prefixo: string): string[] {
  return ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET"]
    .map((sufixo) => `${prefixo}_${sufixo}`)
    .filter((nome) => !process.env[nome]);
}

function carregarCredenciais() {
  const faltantesDedicado = listarFaltantes("LAVORO_MAIL_GRAPH");
  const existeAlgumaDedicado = 3 - faltantesDedicado.length > 0;

  if (existeAlgumaDedicado && faltantesDedicado.length > 0) {
    throw new Error(
      `Configuração parcial do Microsoft Graph dedicado a e-mail. Faltam: ${faltantesDedicado.join(", ")}`
    );
  }

  let conjunto: Conjunto;
  let tenant_id: string | undefined;
  let client_id: string | undefined;
  let client_secret: string | undefined;

  if (faltantesDedicado.length === 0 && process.env.LAVORO_MAIL_GRAPH_TENANT_ID) {
    conjunto = "dedicado";
    tenant_id = process.env.LAVORO_MAIL_GRAPH_TENANT_ID;
    client_id = process.env.LAVORO_MAIL_GRAPH_CLIENT_ID;
    client_secret = process.env.LAVORO_MAIL_GRAPH_CLIENT_SECRET;
  } else {
    const faltantesCompartilhado = listarFaltantes("LAVORO_GRAPH");
    if (faltantesCompartilhado.length) {
      throw new Error(
        `Configuração ausente do Microsoft Graph: ${faltantesCompartilhado.join(", ")}`
      );
    }
    conjunto = "compartilhado";
    tenant_id = process.env.LAVORO_GRAPH_TENANT_ID;
    client_id = process.env.LAVORO_GRAPH_CLIENT_ID;
    client_secret = process.env.LAVORO_GRAPH_CLIENT_SECRET;
  }

  if (conjuntoJaLogado !== conjunto) {
    const nomeAmigavel =
      conjunto === "dedicado"
        ? "dedicado de e-mail (LAVORO_MAIL_GRAPH_*)"
        : "compartilhado com SharePoint (LAVORO_GRAPH_*)";
    console.log(`[graph-token] Conjunto de credenciais Graph em uso: ${nomeAmigavel}`);
    conjuntoJaLogado = conjunto;
  }

  return {
    tenant_id: tenant_id!,
    client_id: client_id!,
    client_secret: client_secret!,
    conjunto,
  };
}

/**
 * Devolve um token de aplicativo válido, reaproveitando o que está em memória
 * enquanto faltar mais que a folga de segurança para expirar.
 * Nunca registra segredo nem token em log.
 */
export async function obterTokenGraph(): Promise<string> {
  const agora = Date.now();
  if (cache && cache.expiraEm - FOLGA_MS > agora) return cache.token;

  const creds = carregarCredenciais();

  // Se o conjunto ativo mudou desde a última emissão, descarta o cache anterior.
  if (cache && cache.conjunto !== creds.conjunto) {
    cache = undefined;
  }

  const r = await fetch(`https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      scope: SCOPE,
    }),
  });

  let dados: any = null;
  try {
    dados = await r.json();
  } catch {
    dados = null;
  }

  if (!r.ok || !dados?.access_token) {
    // Só código do erro, nunca corpo completo nem credenciais.
    const codigo = typeof dados?.error === "string" ? dados.error : "resposta_invalida";
    throw new Error(`Falha ao obter token do Microsoft Graph [${r.status}]: ${codigo}`);
  }

  const expiresIn = Number(dados.expires_in);
  const validade = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  cache = { token: dados.access_token as string, expiraEm: agora + validade * 1000, conjunto: creds.conjunto };
  return cache.token;
}

/** Descarta o token em memória (útil em teste/diagnóstico). */
export function limparCacheTokenGraph(): void {
  cache = undefined;
}
