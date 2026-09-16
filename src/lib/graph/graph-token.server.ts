// Token de aplicativo do Microsoft Graph (client_credentials).
// Espelha a lógica da Edge Function do SharePoint, mas com process.env.
// `.server.ts` mantém este módulo fora do bundle do cliente.

const SCOPE = "https://graph.microsoft.com/.default";
/** Renova com folga: um token de ~1h é trocado quando faltam 5 min. */
const FOLGA_MS = 5 * 60 * 1000;

type Cache = { token: string; expiraEm: number };
let cache: Cache | undefined;

function carregarCredenciais() {
  const tenant_id = process.env.LAVORO_GRAPH_TENANT_ID;
  const client_id = process.env.LAVORO_GRAPH_CLIENT_ID;
  const client_secret = process.env.LAVORO_GRAPH_CLIENT_SECRET;
  const faltando = [
    !tenant_id && "LAVORO_GRAPH_TENANT_ID",
    !client_id && "LAVORO_GRAPH_CLIENT_ID",
    !client_secret && "LAVORO_GRAPH_CLIENT_SECRET",
  ].filter(Boolean);
  if (faltando.length) {
    throw new Error(`Configuração ausente do Microsoft Graph: ${faltando.join(", ")}`);
  }
  return { tenant_id: tenant_id!, client_id: client_id!, client_secret: client_secret! };
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
  cache = { token: dados.access_token as string, expiraEm: agora + validade * 1000 };
  return cache.token;
}

/** Descarta o token em memória (útil em teste/diagnóstico). */
export function limparCacheTokenGraph(): void {
  cache = undefined;
}
