// ============================================================================
// sync-lavoro-bases
//
// Sincroniza as bases Lavoro no SharePoint via Microsoft Graph Workbook API em
// ranges pequenos. Isso evita o estouro de memória do runtime ao baixar/parsear
// o .xlsx inteiro, mantendo a conversão de datas no parser compartilhado.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  uuidv4,
  convertGerencialRawRow,
  convertRamoRawRow,
  convertCaixaRawRow,
  isCaixaComissaoConvertedRow,
} from "../_shared/lavoro-parser.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<void>): void };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RAW_SHAREPOINT_HOSTNAME = Deno.env.get("LAVORO_SHAREPOINT_HOSTNAME") ?? "seguroslavoro.sharepoint.com";
const RAW_SHAREPOINT_SITE_PATH = Deno.env.get("LAVORO_SHAREPOINT_SITE_PATH") ?? "";
const GERENCIAL_FILE_PATH = "Financeiro/NF's e Extratos/Controle Gerencial - Financeiro.xlsx";
const CAIXA_FOLDER_PATH = "Financeiro/Financeiro Lavoro/Planilhas";
const READ_CHUNK = 2500;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function loadLavoroCredentials() {
  const tenant_id = Deno.env.get("LAVORO_GRAPH_TENANT_ID");
  const client_id = Deno.env.get("LAVORO_GRAPH_CLIENT_ID");
  const client_secret = Deno.env.get("LAVORO_GRAPH_CLIENT_SECRET");
  if (!tenant_id || !client_id || !client_secret) {
    throw new Error("Credenciais Graph Lavoro ausentes (LAVORO_GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET)");
  }
  return { tenant_id, client_id, client_secret };
}

async function getGraphToken(creds: { tenant_id: string; client_id: string; client_secret: string }) {
  const r = await fetch(`https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Auth Graph Lavoro falhou: ${JSON.stringify(d)}`);
  validateGraphTokenClaims(d.access_token);
  return d.access_token as string;
}

function decodeJwtPayload(token: string): Record<string, any> {
  const payload = token.split(".")[1];
  if (!payload) return {};
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

function validateGraphTokenClaims(token: string) {
  const claims = decodeJwtPayload(token);
  const roles = Array.isArray(claims.roles) ? claims.roles : [];
  console.log(
    `[sync-lavoro-bases] Graph token claims aud=${claims.aud ?? "?"} tid=${claims.tid ?? "?"} appid=${claims.appid ?? claims.azp ?? "?"} roles=${roles.join(",") || "<none>"}`,
  );

  const hasSharePointRole = roles.some((role: string) => ["Sites.Read.All", "Sites.ReadWrite.All", "Files.Read.All", "Files.ReadWrite.All"].includes(role));
  if (!hasSharePointRole) {
    throw new Error(
      `O App Graph autenticou, mas o token não contém permissão Application para SharePoint. ` +
        `No Entra ID, adicione Microsoft Graph > Application permissions: Sites.Read.All ou Sites.ReadWrite.All e conceda Admin consent. ` +
        `Tenant detectado: ${claims.tid ?? "?"}; app: ${claims.appid ?? claims.azp ?? "?"}; roles: ${roles.join(",") || "nenhuma"}.`,
    );
  }
}

async function graphGet(token: string, url: string, attempt = 1): Promise<Response> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if ((r.status === 429 || [500, 502, 503, 504].includes(r.status)) && attempt < 4) {
    const retryAfter = Number(r.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(2 ** attempt * 500, 6000);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return graphGet(token, url, attempt + 1);
  }
  return r;
}

type SharePointDrive = { id: string; name: string; webUrl?: string };
type DrivePathTarget = { driveId: string | null; driveName: string; relativePath: string };
type DriveItemTarget = DrivePathTarget & { itemId: string; itemName: string; driveId: string };
type FolderChild = { name: string; lastModifiedDateTime?: string };
type WorkbookSheet = { id: string; name: string };

function encodeGraphPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part).replace(/'/g, "%27"))
    .join("/");
}

function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function parseSharePointConfig() {
  let hostname = (RAW_SHAREPOINT_HOSTNAME || "").trim();
  let sitePathFromHostname = "";

  if (/^https?:\/\//i.test(hostname)) {
    try {
      const url = new URL(hostname);
      hostname = url.hostname;
      sitePathFromHostname = url.pathname;
    } catch {
      // Cai no tratamento manual abaixo.
    }
  }

  if (hostname.includes("/")) {
    const [host, ...pathParts] = hostname.split("/");
    hostname = host;
    sitePathFromHostname ||= `/${pathParts.join("/")}`;
  }

  hostname = hostname.replace(/^https?:\/\//i, "").replace(/\/+$/g, "").trim();

  return {
    hostname: hostname || "seguroslavoro.sharepoint.com",
    sitePath: sanitizeSitePath(RAW_SHAREPOINT_SITE_PATH || sitePathFromHostname),
  };
}

function getSharePointHostnameCandidates(hostname: string): string[] {
  return Array.from(new Set([hostname]));
}

function sanitizeSitePath(raw: string): string {
  // Aceita "/sites/xxx", "/teams/xxx" ou URL completa do SharePoint.
  let v = (raw || "").trim();
  if (/^https?:\/\//i.test(v)) {
    try {
      v = new URL(v).pathname;
    } catch {
      v = "";
    }
  }
  if (!v) return "";
  if (/^\/(sites|teams)\/[^/]+/i.test(v)) return v.replace(/\/+$/, "");
  return "";
}

async function resolveSiteId(token: string): Promise<string> {
  const { hostname, sitePath } = parseSharePointConfig();
  const hostnames = getSharePointHostnameCandidates(hostname);
  const urls = sitePath
    ? hostnames.map((host) => `https://graph.microsoft.com/v1.0/sites/${host}:${sitePath}`)
    : [
        ...hostnames.flatMap((host) => [
          `https://graph.microsoft.com/v1.0/sites/${host}`,
          `https://graph.microsoft.com/v1.0/sites/${host}:/`,
        ]),
        "https://graph.microsoft.com/v1.0/sites/root",
      ];

  const failures: string[] = [];
  for (const url of urls) {
    const r = await graphGet(token, url);
    if (r.ok) {
      const j = await r.json();
      return j.id as string;
    }
    const body = await r.text();
    failures.push(`${r.status} ${body.slice(0, 220)}`);
  }

  throw new Error(`Resolve site ("${sitePath || "<root>"}", hostnames="${hostnames.join(",")}") falhou: ${failures.join(" | ")}`);
}

async function listDriveObjects(token: string, siteId: string): Promise<SharePointDrive[]> {
  const r = await graphGet(token, `https://graph.microsoft.com/v1.0/sites/${siteId}/drives?$select=id,name,webUrl`);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.value || []) as SharePointDrive[];
}

async function resolveDrivePathTarget(token: string, siteId: string, path: string): Promise<DrivePathTarget> {
  const [firstSegment, ...rest] = path.split("/").filter(Boolean);
  if (!firstSegment || rest.length === 0) return { driveId: null, driveName: "default", relativePath: path };
  const drives = await listDriveObjects(token, siteId);
  const matched = drives.find((d) => normalizeText(d.name) === normalizeText(firstSegment));
  if (!matched) return { driveId: null, driveName: "default", relativePath: path };
  return { driveId: matched.id, driveName: matched.name, relativePath: rest.join("/") };
}

async function resolveDriveItemTarget(token: string, siteId: string, path: string): Promise<DriveItemTarget> {
  const target = await resolveDrivePathTarget(token, siteId, path);
  const enc = encodeGraphPath(target.relativePath);
  const url = target.driveId
    ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${target.driveId}/root:/${enc}?$select=id,name,parentReference`
    : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${enc}?$select=id,name,parentReference`;
  const r = await graphGet(token, url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Resolver arquivo "${path}" falhou no drive "${target.driveName}": ${r.status} ${body.slice(0, 300)}`);
  }
  const item = await r.json();
  const driveId = target.driveId || item?.parentReference?.driveId;
  if (!item?.id || !driveId) throw new Error(`Arquivo "${path}" resolvido sem driveId/itemId.`);
  return { ...target, driveId, itemId: item.id, itemName: item.name ?? target.relativePath.split("/").pop() ?? path };
}

async function listFolderChildren(token: string, siteId: string, folderPath: string): Promise<FolderChild[]> {
  const target = await resolveDrivePathTarget(token, siteId, folderPath);
  const enc = encodeGraphPath(target.relativePath);
  const url = target.driveId
    ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${target.driveId}/root:/${enc}:/children?$select=name,lastModifiedDateTime&$top=200`
    : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${enc}:/children?$select=name,lastModifiedDateTime&$top=200`;
  const r = await graphGet(token, url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Listar "${folderPath}" falhou no drive "${target.driveName}" em "${target.relativePath}": ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return (j.value || []) as FolderChild[];
}

const BRADESCO_NEEDLE = normalizeText("controle lavoro bradesco");

function pickBradescoFromChildren(children: FolderChild[]): FolderChild | null {
  const candidatos = children
    .filter((c) => {
      const n = normalizeText(c.name);
      return n.endsWith(".xlsx") && n.includes(BRADESCO_NEEDLE);
    })
    .sort((a, b) => {
      const ta = a.lastModifiedDateTime ? new Date(a.lastModifiedDateTime).getTime() : 0;
      const tb = b.lastModifiedDateTime ? new Date(b.lastModifiedDateTime).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.name.localeCompare(a.name);
    });
  return candidatos[0] ?? null;
}

async function tryListChildren(token: string, siteId: string, folderPath: string): Promise<FolderChild[]> {
  try {
    return await listFolderChildren(token, siteId, folderPath);
  } catch (err: any) {
    console.warn(`[sync-lavoro-bases] Subpasta "${folderPath}" ignorada: ${err?.message ?? String(err)}`);
    return [];
  }
}

async function findCaixaFiles(token: string, siteId: string): Promise<string[]> {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const anoAtual = now.getFullYear();
  const paths: string[] = [];

  // 1) Arquivo do ano corrente na raiz de Planilhas (ex.: "Controle Lavoro BRADESCO <data>.xlsx").
  const raiz = await listFolderChildren(token, siteId, CAIXA_FOLDER_PATH);
  const atual = pickBradescoFromChildren(raiz);
  if (atual) {
    paths.push(`${CAIXA_FOLDER_PATH}/${atual.name}`);
    console.log(`[sync-lavoro-bases] Caixa Bradesco (raiz/${anoAtual}): ${atual.name}`);
  } else {
    console.warn(`[sync-lavoro-bases] Nenhum "Controle Lavoro BRADESCO" na raiz "${CAIXA_FOLDER_PATH}".`);
  }

  // 2) Subpastas por ano (2024, 2025, ...): pega o Bradesco mais recente de cada.
  const anosHistoricos: number[] = [];
  for (let ano = anoAtual - 1; ano >= anoAtual - 3; ano--) anosHistoricos.push(ano);

  for (const ano of anosHistoricos) {
    const subChildren = await tryListChildren(token, siteId, `${CAIXA_FOLDER_PATH}/${ano}`);
    if (!subChildren.length) continue;
    const escolhido = pickBradescoFromChildren(subChildren);
    if (escolhido) {
      paths.push(`${CAIXA_FOLDER_PATH}/${ano}/${escolhido.name}`);
      console.log(`[sync-lavoro-bases] Caixa Bradesco (${ano}): ${escolhido.name}`);
    }
  }

  if (!paths.length) {
    const disponiveis = raiz.map((c) => c.name).join(" | ");
    throw new Error(
      `Nenhum arquivo "Controle Lavoro BRADESCO" encontrado em "${CAIXA_FOLDER_PATH}" ou subpastas por ano. ` +
        `Arquivos na raiz (${raiz.length}): ${disponiveis.slice(0, 800)}`,
    );
  }
  return paths;
}

function colToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - m) / 26);
  }
  return s;
}

function workbookBase(target: DriveItemTarget, sheet: WorkbookSheet): string {
  return `https://graph.microsoft.com/v1.0/drives/${target.driveId}/items/${target.itemId}/workbook/worksheets/${encodeURIComponent(sheet.id)}`;
}

async function listWorkbookSheets(token: string, target: DriveItemTarget): Promise<WorkbookSheet[]> {
  const r = await graphGet(token, `https://graph.microsoft.com/v1.0/drives/${target.driveId}/items/${target.itemId}/workbook/worksheets?$select=id,name`);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Listar abas de "${target.itemName}" falhou: ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return (j.value || []) as WorkbookSheet[];
}

async function resolveWorkbookSheet(token: string, target: DriveItemTarget, sheetName: string): Promise<WorkbookSheet> {
  const sheets = await listWorkbookSheets(token, target);
  const sheet = sheets.find((s) => normalizeText(s.name) === normalizeText(sheetName));
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada em "${target.itemName}". Abas disponíveis: ${sheets.map((s) => s.name).join(", ")}`);
  return sheet;
}

async function getSheetDimensions(token: string, target: DriveItemTarget, sheet: WorkbookSheet): Promise<{ rowCount: number; columnCount: number }> {
  const r = await graphGet(token, `${workbookBase(target, sheet)}/usedRange(valuesOnly=false)?$select=rowCount,columnCount`);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Dimensões da aba "${sheet.name}" falharam: ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return { rowCount: Number(j.rowCount) || 0, columnCount: Number(j.columnCount) || 0 };
}

async function readRangeValues(token: string, target: DriveItemTarget, sheet: WorkbookSheet, address: string): Promise<unknown[][]> {
  const r = await graphGet(token, `${workbookBase(target, sheet)}/range(address='${address}')?$select=values`);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Range ${sheet.name}!${address} falhou: ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return (j.values || []) as unknown[][];
}

function rowFromValues(headers: string[], values: unknown[]): Record<string, unknown> | null {
  const row: Record<string, unknown> = {};
  let hasAny = false;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    const value = values[i] ?? null;
    row[header] = value;
    if (value !== null && value !== undefined && value !== "") hasAny = true;
  }
  return hasAny ? row : null;
}

async function insertInBatches(admin: ReturnType<typeof createClient>, table: string, rows: Record<string, unknown>[], batchSize = 500): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await admin.from(table as any).insert(batch as any);
    if (error) throw new Error(`Insert ${table} (batch ${i / batchSize + 1}): ${error.message}`);
  }
}

async function flushBatch(admin: ReturnType<typeof createClient>, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await insertInBatches(admin, table, rows);
  rows.length = 0;
}

async function resolveAutoHeaderRow(token: string, target: DriveItemTarget, sheet: WorkbookSheet, lastCol: string, expectedHeaders: string[]): Promise<number> {
  const expected = expectedHeaders.map(normalizeText);
  for (const row of [1, 2]) {
    const values = (await readRangeValues(token, target, sheet, `A${row}:${lastCol}${row}`))[0] || [];
    const keys = values.map((h) => normalizeText(String(h ?? "").trim()));
    if (expected.some((e) => keys.includes(e))) return row;
  }
  throw new Error(`Cabeçalho não encontrado na aba "${sheet.name}".`);
}

type GerencialSyncResult = { syncId: string; rows: number; ramos: number; totalComissaoBruta: number; comissaoBrutaComEmissao: number };
type CaixaSyncResult = { syncId: string; rows: number; totalReadRows: number; totalComissao: number };

async function syncGerencialBase(admin: ReturnType<typeof createClient>, token: string, siteId: string): Promise<GerencialSyncResult> {
  const syncId = uuidv4();
  await createPendingSyncLog(admin, syncId, "gerencial");
  try {
    const target = await resolveDriveItemTarget(token, siteId, GERENCIAL_FILE_PATH);
    const sheet = await resolveWorkbookSheet(token, target, "Gerencial");
    const dims = await getSheetDimensions(token, target, sheet);
    const lastCol = colToLetter(dims.columnCount);
    const headers = ((await readRangeValues(token, target, sheet, `A2:${lastCol}2`))[0] || []).map((h) => String(h ?? "").trim());

    let rows = 0;
    let totalComissaoBruta = 0;
    let comissaoBrutaComEmissao = 0;
    const batch: Record<string, unknown>[] = [];
    for (let r = 3; r <= dims.rowCount; r += READ_CHUNK) {
      const end = Math.min(r + READ_CHUNK - 1, dims.rowCount);
      const values = await readRangeValues(token, target, sheet, `A${r}:${lastCol}${end}`);
      for (const rowVals of values) {
        const raw = rowFromValues(headers, rowVals);
        if (!raw) continue;
        const c = convertGerencialRawRow(raw, syncId);
        if (!c) continue;
        batch.push(c);
        rows++;
        totalComissaoBruta += Number(c.comissao_bruta) || 0;
        if (c.data_emissao) comissaoBrutaComEmissao += Number(c.comissao_bruta) || 0;
      }
      await flushBatch(admin, "raw_lavoro_gerencial", batch);
    }

    const ramoSheet = await resolveWorkbookSheet(token, target, "aux Ramo");
    const ramoDims = await getSheetDimensions(token, target, ramoSheet);
    const ramoLastCol = colToLetter(ramoDims.columnCount);
    const headerRow = await resolveAutoHeaderRow(token, target, ramoSheet, ramoLastCol, ["Ramo", "Tipo de Ramo"]);
    const ramoHeaders = ((await readRangeValues(token, target, ramoSheet, `A${headerRow}:${ramoLastCol}${headerRow}`))[0] || []).map((h) => String(h ?? "").trim());
    let ramos = 0;
    const ramoBatch: Record<string, unknown>[] = [];
    for (let r = headerRow + 1; r <= ramoDims.rowCount; r += READ_CHUNK) {
      const end = Math.min(r + READ_CHUNK - 1, ramoDims.rowCount);
      const values = await readRangeValues(token, target, ramoSheet, `A${r}:${ramoLastCol}${end}`);
      for (const rowVals of values) {
        const raw = rowFromValues(ramoHeaders, rowVals);
        if (!raw) continue;
        const c = convertRamoRawRow(raw, syncId);
        if (!c) continue;
        ramoBatch.push(c);
        ramos++;
      }
      await flushBatch(admin, "raw_lavoro_depara_ramo", ramoBatch);
    }

    await updateSyncLog(admin, syncId, "gerencial", { status: "sucesso", linhas_importadas: rows, mensagem_erro: null });
    return { syncId, rows, ramos, totalComissaoBruta, comissaoBrutaComEmissao };
  } catch (err: any) {
    await updateSyncLog(admin, syncId, "gerencial", { status: "erro", mensagem_erro: err?.message ?? String(err) });
    throw err;
  }
}

async function syncCaixaBase(admin: ReturnType<typeof createClient>, token: string, siteId: string, result: Record<string, any>): Promise<CaixaSyncResult> {
  const syncId = uuidv4();
  await createPendingSyncLog(admin, syncId, "caixa");
  try {
    const caixaPaths = await findCaixaFiles(token, siteId);
    result.caixaPaths = caixaPaths;

    let totalReadRows = 0;
    let rows = 0;
    let totalComissao = 0;

    for (const caixaPath of caixaPaths) {
      console.log(`[sync-lavoro-bases] Processando caixa: ${caixaPath}`);
      const target = await resolveDriveItemTarget(token, siteId, caixaPath);
      const sheet = await resolveWorkbookSheet(token, target, "Descrição Financeira (Caixa)");
      const dims = await getSheetDimensions(token, target, sheet);
      const lastCol = colToLetter(dims.columnCount);
      const headers = ((await readRangeValues(token, target, sheet, `A2:${lastCol}2`))[0] || []).map((h) => String(h ?? "").trim());

      const batch: Record<string, unknown>[] = [];
      for (let r = 3; r <= dims.rowCount; r += READ_CHUNK) {
        const end = Math.min(r + READ_CHUNK - 1, dims.rowCount);
        const values = await readRangeValues(token, target, sheet, `A${r}:${lastCol}${end}`);
        for (const rowVals of values) {
          const raw = rowFromValues(headers, rowVals);
          if (!raw) continue;
          const c = convertCaixaRawRow(raw, syncId);
          if (!c) continue;
          totalReadRows++;
          if (!isCaixaComissaoConvertedRow(c)) continue;
          batch.push(c);
          rows++;
          totalComissao += Number(c.valor) || 0;
        }
        await flushBatch(admin, "raw_lavoro_caixa_comissao", batch);
      }
    }

    await updateSyncLog(admin, syncId, "caixa", { status: "sucesso", linhas_importadas: rows, mensagem_erro: null });
    return { syncId, rows, totalReadRows, totalComissao };
  } catch (err: any) {
    await updateSyncLog(admin, syncId, "caixa", { status: "erro", mensagem_erro: err?.message ?? String(err) });
    throw err;
  }
}

async function notifyAdmins(admin: ReturnType<typeof createClient>, mensagem: string, dados: Record<string, unknown>) {
  try {
    await admin.from("notificacoes_admin").insert({
      tipo: "sync_lavoro_falha",
      titulo: "Falha no Sync Lavoro (SharePoint)",
      mensagem,
      dados: { ...dados, timestamp_brt: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) },
    });
  } catch (err) {
    console.error("[sync-lavoro-bases] Falha ao gravar notificacao_admin:", err);
  }
}

async function logSync(
  admin: ReturnType<typeof createClient>,
  entry: { sync_id?: string | null; base: "gerencial" | "caixa"; status: "sucesso" | "erro"; linhas_importadas?: number | null; mensagem_erro?: string | null },
) {
  try {
    await admin.from("lavoro_sync_log").insert({
      sync_id: entry.sync_id ?? null,
      origem: "automatico",
      base: entry.base,
      status: entry.status,
      linhas_importadas: entry.linhas_importadas ?? null,
      mensagem_erro: entry.mensagem_erro ?? null,
      usuario_id: null,
    });
  } catch (err) {
    console.error("[sync-lavoro-bases] Falha ao gravar lavoro_sync_log:", err);
  }
}

async function createPendingSyncLog(admin: ReturnType<typeof createClient>, syncId: string, base: "gerencial" | "caixa") {
  await logSync(admin, {
    sync_id: syncId,
    base,
    status: "erro",
    mensagem_erro: "Sync iniciado; aguardando conclusão.",
  });
}

async function updateSyncLog(
  admin: ReturnType<typeof createClient>,
  syncId: string,
  base: "gerencial" | "caixa",
  entry: { status: "sucesso" | "erro"; linhas_importadas?: number | null; mensagem_erro?: string | null },
) {
  try {
    const { error } = await admin
      .from("lavoro_sync_log")
      .update({
        status: entry.status,
        linhas_importadas: entry.linhas_importadas ?? null,
        mensagem_erro: entry.mensagem_erro ?? null,
      })
      .eq("sync_id", syncId)
      .eq("base", base)
      .eq("origem", "automatico");
    if (error) throw error;
  } catch (err) {
    console.error("[sync-lavoro-bases] Falha ao atualizar lavoro_sync_log:", err);
  }
}

const MAX_ATTEMPTS = 3;

async function triggerFollowUp(
  authHeader: string | null,
  base: "gerencial" | "caixa",
  attempt: number,
  trigger: string,
) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-lavoro-bases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : { Authorization: `Bearer ${SERVICE_KEY}` }),
      },
      body: JSON.stringify({ trigger, base, attempt }),
    });
    console.log(`[sync-lavoro-bases] Follow-up ${base} (attempt ${attempt}) disparado: HTTP ${res.status}`);
  } catch (err: any) {
    console.error(`[sync-lavoro-bases] Falha ao disparar follow-up ${base}:`, err?.message ?? String(err));
  }
}

async function scheduleRetry(
  admin: ReturnType<typeof createClient>,
  authHeader: string | null,
  base: "gerencial" | "caixa",
  nextAttempt: number,
  errorMsg: string,
) {
  console.log(`[sync-lavoro-bases] Agendando retry ${base} attempt ${nextAttempt} após erro: ${errorMsg}`);
  await notifyAdmins(admin, `Sync Lavoro ${base} falhou (tentativa ${nextAttempt - 1}/${MAX_ATTEMPTS}). Reexecutando automaticamente…`, {
    base,
    next_attempt: nextAttempt,
    error: errorMsg,
  });
  // Pequeno delay pra evitar retry imediato sobre um erro transitório do Graph.
  await new Promise((r) => setTimeout(r, 5000));
  await triggerFollowUp(authHeader, base, nextAttempt, "auto-retry");
}

async function runSyncJob(
  admin: ReturnType<typeof createClient>,
  requestedBase: "all" | "gerencial" | "caixa",
  authHeader: string | null,
  attempt: number,
) {
  const result: Record<string, any> = { ok: false, base: requestedBase, attempt };
  const runGerencial = requestedBase === "all" || requestedBase === "gerencial";
  const runCaixa = requestedBase === "caixa";
  const chainCaixaAfter = requestedBase === "all";

  console.log(`[sync-lavoro-bases] START base=${requestedBase} attempt=${attempt}`);

  let creds: ReturnType<typeof loadLavoroCredentials>;
  let token: string;
  let siteId: string;
  try {
    creds = loadLavoroCredentials();
    token = await getGraphToken(creds);
    siteId = await resolveSiteId(token);
    result.siteId = siteId;
  } catch (err: any) {
    // Erro de setup (credenciais/site) — vale pra qualquer base pedida.
    const msg = err?.message ?? String(err);
    console.error("[sync-lavoro-bases] SETUP ERROR:", msg);
    const bases: ("gerencial" | "caixa")[] = requestedBase === "all" ? ["gerencial", "caixa"] : [requestedBase];
    for (const base of bases) {
      await logSync(admin, { base, status: "erro", mensagem_erro: `[setup attempt ${attempt}/${MAX_ATTEMPTS}] ${msg}` });
      if (attempt < MAX_ATTEMPTS) {
        await scheduleRetry(admin, authHeader, base, attempt + 1, msg);
      } else {
        await notifyAdmins(admin, `Sync Lavoro ${base} falhou após ${MAX_ATTEMPTS} tentativas`, { base, error: msg });
      }
    }
    throw err;
  }

  if (runGerencial) {
    try {
      const res = await syncGerencialBase(admin, token, siteId);
      result.gerencial = res;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error("[sync-lavoro-bases] GERENCIAL ERROR:", msg);
      if (attempt < MAX_ATTEMPTS) {
        await scheduleRetry(admin, authHeader, "gerencial", attempt + 1, msg);
      } else {
        await notifyAdmins(admin, `Sync Lavoro gerencial falhou após ${MAX_ATTEMPTS} tentativas`, { error: msg });
      }
      // Mesmo com Gerencial falhando, ainda encadeia a Caixa (é independente).
    }
  }

  if (runCaixa) {
    try {
      const res = await syncCaixaBase(admin, token, siteId, result);
      result.caixa = res;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error("[sync-lavoro-bases] CAIXA ERROR:", msg);
      if (attempt < MAX_ATTEMPTS) {
        await scheduleRetry(admin, authHeader, "caixa", attempt + 1, msg);
      } else {
        await notifyAdmins(admin, `Sync Lavoro caixa falhou após ${MAX_ATTEMPTS} tentativas`, { error: msg });
      }
    }
  }

  if (chainCaixaAfter) {
    await triggerFollowUp(authHeader, "caixa", 1, "chain-after-gerencial");
    result.caixa = { chained: true };
  }

  result.ok = true;
  console.log("[sync-lavoro-bases] DONE", JSON.stringify(result));
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const headers = { ...cors, "Content-Type": "application/json" };
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBase = body?.base === "gerencial" || body?.base === "caixa" ? body.base : "all";
    const attempt = Math.max(1, Math.min(MAX_ATTEMPTS, Number(body?.attempt) || 1));
    const authHeader = req.headers.get("Authorization");
    if (body?.wait === true) {
      const result = await runSyncJob(admin, requestedBase, authHeader, attempt);
      return new Response(JSON.stringify({ ok: true, status: "completed", base: requestedBase, attempt, result }), { headers });
    }

    EdgeRuntime.waitUntil(
      runSyncJob(admin, requestedBase, authHeader, attempt).catch((err) => {
        console.error("[sync-lavoro-bases] waitUntil unhandled:", err?.message ?? String(err));
      }),
    );
    return new Response(JSON.stringify({ ok: true, status: "accepted", base: requestedBase, attempt }), { headers });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[sync-lavoro-bases] ERROR:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers });
  }
});