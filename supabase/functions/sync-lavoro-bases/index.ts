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

const SHAREPOINT_HOSTNAME = Deno.env.get("LAVORO_SHAREPOINT_HOSTNAME") ?? "seguroslavoro.sharepoint.com";
const SHAREPOINT_SITE_PATH = Deno.env.get("LAVORO_SHAREPOINT_SITE_PATH") ?? "";
const GERENCIAL_FILE_PATH = "Financeiro/NF's e Extratos/Controle Gerencial - Financeiro.xlsx";
const CAIXA_LEGACY_FOLDER = "Financeiro/Financeiro Lavoro/Planilhas";
// A base do Bradesco foi movida para a pasta "DRE e DFC" (ano corrente na raiz,
// anos anteriores em subpastas <ano>/).
const CAIXA_ROOT_FOLDER = `${CAIXA_LEGACY_FOLDER}/DRE e DFC`;
const READ_CHUNK = 2500;
const GERENCIAL_READ_CHUNK = 2500;

// Anos históricos que devem ser sincronizados junto com o ano corrente.
type CaixaYearTarget = { ano: number; folders: string[]; nameMatchers: string[] };
const CAIXA_YEAR_TARGETS: CaixaYearTarget[] = [
  {
    ano: 2026,
    folders: [CAIXA_ROOT_FOLDER, CAIXA_LEGACY_FOLDER, `${CAIXA_ROOT_FOLDER}/2026`, `${CAIXA_LEGACY_FOLDER}/2026`],
    nameMatchers: ["controle lavoro bradesco 2026", "controle lavoro bradesco"],
  },
  {
    ano: 2025,
    folders: [`${CAIXA_ROOT_FOLDER}/2025`, `${CAIXA_LEGACY_FOLDER}/2025`],
    nameMatchers: ["controle lavoro bradesco 2025", "controle lavoro bradesco"],
  },
  {
    ano: 2024,
    folders: [`${CAIXA_ROOT_FOLDER}/2024`, `${CAIXA_LEGACY_FOLDER}/2024`],
    nameMatchers: ["controle lavoro bradesco 2024", "controle lavoro bradesco"],
  },
  {
    ano: 2023,
    folders: [`${CAIXA_ROOT_FOLDER}/2023`, `${CAIXA_LEGACY_FOLDER}/2023`],
    nameMatchers: ["controle lavoro - 2023", "controle lavoro 2023", "controle lavoro bradesco 2023", "controle lavoro"],
  },
];


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
  return d.access_token as string;
}

async function graphGet(token: string, url: string, attempt = 1, sessionId?: string): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (sessionId) headers["workbook-session-id"] = sessionId;
  const r = await fetch(url, { headers });
  if ((r.status === 429 || [500, 502, 503, 504].includes(r.status)) && attempt < 6) {
    const retryAfter = Number(r.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(2 ** attempt * 750, 15000);
    console.log(`[sync-lavoro-bases] graphGet retry ${attempt} status=${r.status} wait=${wait}ms url=${url.slice(0, 160)}`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return graphGet(token, url, attempt + 1, sessionId);
  }
  return r;
}

async function createWorkbookSession(token: string, target: DriveItemTarget): Promise<string | undefined> {
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${target.driveId}/items/${target.itemId}/workbook/createSession`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ persistChanges: false }),
      },
    );
    if (!r.ok) {
      console.warn(`[sync-lavoro-bases] createSession falhou ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return undefined;
    }
    const j = await r.json();
    console.log(`[sync-lavoro-bases] Workbook session criada para "${target.itemName}"`);
    return j.id as string;
  } catch (err) {
    console.warn(`[sync-lavoro-bases] createSession exception:`, (err as Error).message);
    return undefined;
  }
}

async function closeWorkbookSession(token: string, target: DriveItemTarget, sessionId: string) {
  try {
    await fetch(
      `https://graph.microsoft.com/v1.0/drives/${target.driveId}/items/${target.itemId}/workbook/closeSession`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "workbook-session-id": sessionId },
      },
    );
  } catch { /* ignore */ }
}

type SharePointDrive = { id: string; name: string; webUrl?: string };
type DrivePathTarget = { driveId: string | null; driveName: string; relativePath: string };
type DriveItemTarget = DrivePathTarget & { itemId: string; itemName: string; driveId: string };
type FolderChild = { name: string; lastModifiedDateTime?: string; folder?: { childCount?: number } };
type FoundFile = { name: string; path: string; lastModifiedDateTime?: string };
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

function normalizeSitePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const pathname = (() => {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed.split(/[?#]/)[0];
    }
  })();
  const decoded = decodeURIComponent(pathname).replace(/\/Forms\/AllItems\.aspx$/i, "");
  const withoutTrailingSlash = decoded.replace(/\/+$/g, "");
  return withoutTrailingSlash.startsWith("/") ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
}

function sitePathCandidates(): string[] {
  const configured = normalizeSitePath(SHAREPOINT_SITE_PATH);
  const candidates: string[] = [];
  if (configured) candidates.push(configured);

  // Se alguém preencher por engano uma pasta/biblioteca como site path
  // (ex.: /Financeiro/Financeiro Lavoro), tenta também só o primeiro segmento
  // e por fim o site raiz do tenant.
  const firstSegment = configured.split("/").filter(Boolean)[0];
  if (firstSegment) candidates.push(`/${firstSegment}`);
  candidates.push("");

  return Array.from(new Set(candidates));
}

async function resolveSiteId(token: string): Promise<string> {
  const errors: string[] = [];

  for (const sitePath of sitePathCandidates()) {
    const url = sitePath
      ? `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOSTNAME}:/${encodeGraphPath(sitePath)}`
      : `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOSTNAME}`;
    const r = await graphGet(token, url);
    if (r.ok) {
      const j = await r.json();
      console.log(`[sync-lavoro-bases] Site SharePoint resolvido: ${sitePath || "<root>"}`);
      return j.id as string;
    }

    const body = await r.text();
    errors.push(`${sitePath || "<root>"}: ${r.status} ${body.slice(0, 180)}`);
  }

  throw new Error(`Resolve site falhou para ${SHAREPOINT_HOSTNAME}. Tentativas: ${errors.join(" | ")}`);
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
    ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${target.driveId}/root:/${enc}:/children?$select=name,lastModifiedDateTime,folder&$top=200`
    : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${enc}:/children?$select=name,lastModifiedDateTime,folder&$top=200`;
  const r = await graphGet(token, url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Listar "${folderPath}" falhou no drive "${target.driveName}" em "${target.relativePath}": ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return (j.value || []) as FolderChild[];
}

// Varre a pasta e subpastas (a planilha do Bradesco foi movida para "DRE e DFC",
// então a busca não pode depender de um caminho fixo).
async function listXlsxRecursive(
  token: string,
  siteId: string,
  folderPath: string,
  depth = 2,
): Promise<FoundFile[]> {
  let children: FolderChild[];
  try {
    children = await listFolderChildren(token, siteId, folderPath);
  } catch (err) {
    console.warn(`[sync-lavoro-bases] Pasta indisponível (${folderPath}): ${(err as Error).message}`);
    return [];
  }

  const files: FoundFile[] = [];
  for (const c of children) {
    const childPath = `${folderPath}/${c.name}`;
    if (c.folder) {
      if (depth > 0) files.push(...(await listXlsxRecursive(token, siteId, childPath, depth - 1)));
    } else if (normalizeText(c.name).endsWith(".xlsx") && !c.name.startsWith("~$")) {
      files.push({ name: c.name, path: childPath, lastModifiedDateTime: c.lastModifiedDateTime });
    }
  }
  return files;
}

const _caixaFolderCache = new Map<string, FoundFile[]>();
async function listXlsxInFolder(token: string, siteId: string, folderPath: string): Promise<FoundFile[]> {
  const cached = _caixaFolderCache.get(folderPath);
  if (cached) return cached;
  const files = await listXlsxRecursive(token, siteId, folderPath, 0);
  _caixaFolderCache.set(folderPath, files);
  return files;
}

async function findCaixaFileForYear(token: string, siteId: string, target: CaixaYearTarget): Promise<string | null> {
  const anoStr = String(target.ano);
  const outroAno = /(20\d{2})/g;

  const ordenar = (arr: FoundFile[]) =>
    [...arr].sort((a, b) => {
      const ta = a.lastModifiedDateTime ? new Date(a.lastModifiedDateTime).getTime() : 0;
      const tb = b.lastModifiedDateTime ? new Date(b.lastModifiedDateTime).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.name.localeCompare(a.name);
    });

  const disponiveis: string[] = [];
  for (const folder of target.folders) {
    const arquivos = await listXlsxInFolder(token, siteId, folder);
    if (arquivos.length === 0) continue;
    disponiveis.push(...arquivos.map((a) => a.path));

    // Descarta arquivos cujo nome cita explicitamente outro ano.
    const candidatos = arquivos.filter((a) => {
      const anos = a.name.match(outroAno) ?? [];
      return anos.length === 0 || anos.includes(anoStr);
    });

    for (const matcher of target.nameMatchers) {
      const needle = normalizeText(matcher);
      const found = ordenar(candidatos.filter((c) => normalizeText(c.name).includes(needle)));
      if (found.length > 0) {
        const escolhido = found[0];
        console.log(
          `[sync-lavoro-bases] Caixa ${target.ano}: ${escolhido.path} (mod ${escolhido.lastModifiedDateTime ?? "?"})`,
        );
        return escolhido.path;
      }
    }
  }

  console.warn(
    `[sync-lavoro-bases] Nenhum arquivo Caixa ${target.ano} encontrado em ${target.folders.join(" | ")}. Disponíveis: ${disponiveis
      .join(" | ")
      .slice(0, 600)}`,
  );
  return null;
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

async function listWorkbookSheets(token: string, target: DriveItemTarget, sessionId?: string): Promise<WorkbookSheet[]> {
  const r = await graphGet(token, `https://graph.microsoft.com/v1.0/drives/${target.driveId}/items/${target.itemId}/workbook/worksheets?$select=id,name`, 1, sessionId);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Listar abas de "${target.itemName}" falhou: ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return (j.value || []) as WorkbookSheet[];
}

async function resolveWorkbookSheet(token: string, target: DriveItemTarget, sheetName: string, sessionId?: string): Promise<WorkbookSheet> {
  const sheets = await listWorkbookSheets(token, target, sessionId);
  const sheet = sheets.find((s) => normalizeText(s.name) === normalizeText(sheetName));
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada em "${target.itemName}". Abas disponíveis: ${sheets.map((s) => s.name).join(", ")}`);
  return sheet;
}

async function getSheetDimensions(token: string, target: DriveItemTarget, sheet: WorkbookSheet, sessionId?: string): Promise<{ rowCount: number; columnCount: number }> {
  const r = await graphGet(token, `${workbookBase(target, sheet)}/usedRange(valuesOnly=false)?$select=rowCount,columnCount`, 1, sessionId);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Dimensões da aba "${sheet.name}" falharam: ${r.status} ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  return { rowCount: Number(j.rowCount) || 0, columnCount: Number(j.columnCount) || 0 };
}

async function readRangeValues(token: string, target: DriveItemTarget, sheet: WorkbookSheet, address: string, sessionId?: string): Promise<unknown[][]> {
  const r = await graphGet(token, `${workbookBase(target, sheet)}/range(address='${address}')?$select=values`, 1, sessionId);
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

export type GerencialResume = { syncId: string; startRow: number; rowsSoFar: number };

// Máximo de chunks processados por invocação. O worker tem orçamento de CPU
// limitado: ler + converter a planilha inteira (19k+ linhas) numa única
// execução estourava "CPU Time exceeded". Agora a carga é retomada em
// invocações encadeadas.
const GERENCIAL_MAX_CHUNKS_PER_RUN = 2;

async function syncGerencialBase(
  admin: ReturnType<typeof createClient>,
  token: string,
  siteId: string,
  authHeader: string | null,
  resume?: GerencialResume,
): Promise<GerencialSyncResult & { partial?: boolean; nextRow?: number }> {
  const syncId = resume?.syncId ?? uuidv4();
  let sessionId: string | undefined;
  let target: DriveItemTarget | undefined;
  try {
    if (!resume) {
      await createPendingSyncLog(admin, syncId, "gerencial");
      // Snapshot completo: apaga as raws antes de reinserir (parity com caixa).
      const delG = await admin.from("raw_lavoro_gerencial").delete().neq("sync_id", "00000000-0000-0000-0000-000000000000");
      if (delG.error) throw new Error(`Limpar raw_lavoro_gerencial: ${delG.error.message}`);
      const delR = await admin.from("raw_lavoro_depara_ramo").delete().neq("sync_id", "00000000-0000-0000-0000-000000000000");
      if (delR.error) throw new Error(`Limpar raw_lavoro_depara_ramo: ${delR.error.message}`);
    }

    target = await resolveDriveItemTarget(token, siteId, GERENCIAL_FILE_PATH);
    sessionId = await createWorkbookSession(token, target);

    const sheet = await resolveWorkbookSheet(token, target, "Gerencial", sessionId);
    const dims = await getSheetDimensions(token, target, sheet, sessionId);
    const lastCol = colToLetter(dims.columnCount);
    const headers = ((await readRangeValues(token, target, sheet, `A2:${lastCol}2`, sessionId))[0] || []).map((h) => String(h ?? "").trim());
    console.log(`[sync-lavoro-bases] Gerencial dims: ${dims.rowCount} linhas x ${dims.columnCount} colunas (início na linha ${resume?.startRow ?? 3})`);

    let rows = resume?.rowsSoFar ?? 0;
    let totalComissaoBruta = 0;
    let comissaoBrutaComEmissao = 0;
    const batch: Record<string, unknown>[] = [];
    const totalChunks = Math.ceil(Math.max(0, dims.rowCount - 2) / GERENCIAL_READ_CHUNK);
    let r = resume?.startRow ?? 3;
    let chunksThisRun = 0;
    while (r <= dims.rowCount && chunksThisRun < GERENCIAL_MAX_CHUNKS_PER_RUN) {
      const end = Math.min(r + GERENCIAL_READ_CHUNK - 1, dims.rowCount);
      const values = await readRangeValues(token, target, sheet, `A${r}:${lastCol}${end}`, sessionId);
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
      chunksThisRun++;
      r = end + 1;
      const chunkIdx = Math.ceil((r - 3) / GERENCIAL_READ_CHUNK);
      // Heartbeat de progresso a cada chunk (também detectável na UI).
      await updateSyncLog(admin, syncId, "gerencial", {
        status: "erro",
        linhas_importadas: rows,
        mensagem_erro: `Em progresso: chunk ${chunkIdx}/${totalChunks} (${rows} linhas)`,
      });
    }

    if (r <= dims.rowCount) {
      // Ainda há linhas: encadeia a continuação numa nova invocação.
      console.log(`[sync-lavoro-bases] Gerencial parcial: continua na linha ${r}`);
      await triggerFollowUp(authHeader, "gerencial", 1, "resume-gerencial", {
        gerencialResume: { syncId, startRow: r, rowsSoFar: rows } satisfies GerencialResume,
      });
      return { syncId, rows, ramos: 0, totalComissaoBruta, comissaoBrutaComEmissao, partial: true, nextRow: r };
    }

    const ramoSheet = await resolveWorkbookSheet(token, target, "aux Ramo", sessionId);
    const ramoDims = await getSheetDimensions(token, target, ramoSheet, sessionId);
    const ramoLastCol = colToLetter(ramoDims.columnCount);
    const headerRow = await resolveAutoHeaderRow(token, target, ramoSheet, ramoLastCol, ["Ramo", "Tipo de Ramo"]);
    const ramoHeaders = ((await readRangeValues(token, target, ramoSheet, `A${headerRow}:${ramoLastCol}${headerRow}`, sessionId))[0] || []).map((h) => String(h ?? "").trim());
    let ramos = 0;
    const ramoBatch: Record<string, unknown>[] = [];
    for (let rr = headerRow + 1; rr <= ramoDims.rowCount; rr += READ_CHUNK) {
      const end = Math.min(rr + READ_CHUNK - 1, ramoDims.rowCount);
      const values = await readRangeValues(token, target, ramoSheet, `A${rr}:${ramoLastCol}${end}`, sessionId);
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
  } finally {
    if (sessionId && target) {
      await closeWorkbookSession(token, target, sessionId);
    }
  }

}


async function syncCaixaSingleFile(
  admin: ReturnType<typeof createClient>,
  token: string,
  siteId: string,
  caixaPath: string,
  syncId: string,
): Promise<{ rows: number; totalReadRows: number; totalComissao: number }> {
  const target = await resolveDriveItemTarget(token, siteId, caixaPath);
  const sheet = await resolveWorkbookSheet(token, target, "Descrição Financeira (Caixa)");
  const dims = await getSheetDimensions(token, target, sheet);
  const lastCol = colToLetter(dims.columnCount);
  const headers = ((await readRangeValues(token, target, sheet, `A2:${lastCol}2`))[0] || []).map((h) => String(h ?? "").trim());

  let totalReadRows = 0;
  let rows = 0;
  let totalComissao = 0;
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
  return { rows, totalReadRows, totalComissao };
}

async function syncCaixaBase(admin: ReturnType<typeof createClient>, token: string, siteId: string, result: Record<string, any>): Promise<CaixaSyncResult> {
  const syncId = uuidv4();
  _caixaFolderCache.clear(); // redescobre os arquivos a cada sync (pastas podem mudar)
  await createPendingSyncLog(admin, syncId, "caixa");
  try {
    // Snapshot completo: apagamos a raw antes de inserir todos os anos.
    const del = await admin.from("raw_lavoro_caixa_comissao").delete().neq("id", -1);
    if (del.error) throw new Error(`Limpar raw_lavoro_caixa_comissao: ${del.error.message}`);

    const perYear: Record<string, { path: string | null; rows: number; totalRead: number; totalComissao: number; error?: string }> = {};
    let rowsTotal = 0;
    let totalReadRows = 0;
    let totalComissao = 0;

    for (const yearTarget of CAIXA_YEAR_TARGETS) {
      const caixaPath = await findCaixaFileForYear(token, siteId, yearTarget);
      if (!caixaPath) {
        perYear[String(yearTarget.ano)] = { path: null, rows: 0, totalRead: 0, totalComissao: 0, error: "arquivo não encontrado" };
        continue;
      }
      try {
        const res = await syncCaixaSingleFile(admin, token, siteId, caixaPath, syncId);
        perYear[String(yearTarget.ano)] = { path: caixaPath, rows: res.rows, totalRead: res.totalReadRows, totalComissao: res.totalComissao };
        rowsTotal += res.rows;
        totalReadRows += res.totalReadRows;
        totalComissao += res.totalComissao;
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        console.error(`[sync-lavoro-bases] CAIXA ${yearTarget.ano} falhou:`, msg);
        perYear[String(yearTarget.ano)] = { path: caixaPath, rows: 0, totalRead: 0, totalComissao: 0, error: msg };
      }
    }

    result.caixaPorAno = perYear;
    result.caixaPath = perYear[String(CAIXA_YEAR_TARGETS[0].ano)]?.path ?? null;

    await updateSyncLog(admin, syncId, "caixa", { status: "sucesso", linhas_importadas: rowsTotal, mensagem_erro: null });
    return { syncId, rows: rowsTotal, totalReadRows, totalComissao };

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

// Evita execuções concorrentes da mesma base (crons duplicados / retries
// sobrepostos). Duas execuções simultâneas dividem o mesmo orçamento de CPU do
// worker e ambas morrem com "CPU Time exceeded".
const RUNNING_WINDOW_MIN = 12;

async function isBaseRunning(admin: ReturnType<typeof createClient>, base: "gerencial" | "caixa"): Promise<boolean> {
  try {
    const since = new Date(Date.now() - RUNNING_WINDOW_MIN * 60_000).toISOString();
    const { data, error } = await admin
      .from("lavoro_sync_log")
      .select("id, mensagem_erro, criado_em")
      .eq("base", base)
      .eq("status", "erro")
      .gte("criado_em", since)
      .order("criado_em", { ascending: false })
      .limit(20);
    if (error) return false;
    return (data ?? []).some((r: any) => {
      const m = String(r.mensagem_erro ?? "");
      return m.startsWith("Sync iniciado") || m.startsWith("Em progresso");
    });
  } catch {
    return false;
  }
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
  extra?: Record<string, unknown>,
) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-lavoro-bases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : { Authorization: `Bearer ${SERVICE_KEY}` }),
      },
      body: JSON.stringify({ trigger, base, attempt, ...(extra ?? {}) }),
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
    if (await isBaseRunning(admin, "gerencial")) {
      console.log("[sync-lavoro-bases] SKIP gerencial: já existe execução em andamento");
      result.gerencial = { skipped: "em_andamento" };
    } else {
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
      }
    }
  }

  if (runCaixa) {
    if (await isBaseRunning(admin, "caixa")) {
      console.log("[sync-lavoro-bases] SKIP caixa: já existe execução em andamento");
      result.caixa = { skipped: "em_andamento" };
    } else {
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
