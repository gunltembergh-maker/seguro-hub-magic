// ============================================================================
// Parser compartilhado das bases Lavoro (Gerencial / aux Ramo / Caixa Bradesco).
// Usado por:
//   - src/components/admin/LavoroImportSection.tsx  (upload manual, fallback)
//   - supabase/functions/sync-lavoro-bases          (sync automático SharePoint)
//
// IMPORTANTE: este módulo é PURO — não importa `xlsx`. Ambos os consumidores
// leem o workbook com seu próprio XLSX (browser vs Deno) e passam os arrays
// de linhas brutas pra cá.
// ============================================================================

// ─── Types ─────────────────────────────────────────────────────────────────

export type ValidationGerencial = {
  totalRows: number;
  totalComissaoBruta: number;
  comissaoBrutaComEmissao: number;
  totalRamos: number;
};

export type ValidationCaixa = {
  totalReadRows: number;
  totalRows: number;
  totalComissao: number;
  categorias: string[];
  tiposLancamento: string[];
};

export type ParsedGerencial = {
  syncId: string;
  gerencialRows: Record<string, unknown>[];
  ramoRows: { ramo: string; tipo_de_ramo: string; sync_id: string }[];
  validation: ValidationGerencial;
};

export type ParsedCaixa = {
  syncId: string;
  rows: Record<string, unknown>[];
  validation: ValidationCaixa;
};

type FieldKind = "text" | "num" | "int" | "date";
type ColMap = { excel: string; db: string; kind: FieldKind };
type ColMapWithAlts = ColMap & { alts?: string[] };

// ─── Helpers ───────────────────────────────────────────────────────────────

export function uuidv4(): string {
  const g = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const cleaned = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: unknown): number | null {
  const n = toNumOrNull(v);
  return n === null ? null : Math.trunc(n);
}

function toTextOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toDateOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") return excelSerialToISO(v);
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 20000 && serial <= 70000) return excelSerialToISO(serial);
  }
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) {
    const [, d, m, y] = m1;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalizeHeader(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:：]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeComissaoToken(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isCaixaComissaoConvertedRow(row: Record<string, unknown>): boolean {
  return [row.categoria, row.tipo_lancamento].some((v) => normalizeComissaoToken(v) === "comissao");
}

function hasAnyValue(row: Record<string, unknown>): boolean {
  return Object.values(row).some((v) => v !== null && v !== undefined && v !== "");
}

function pickValue(row: Record<string, unknown>, map: ColMapWithAlts): unknown {
  const keys = [map.excel, ...(map.alts ?? [])];
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    if (k in row) return row[k];
    const target = normalizeHeader(k);
    const hit = rowKeys.find((rk) => normalizeHeader(rk) === target);
    if (hit) return row[hit];
  }
  return null;
}

function convertRow(row: Record<string, unknown>, map: ColMapWithAlts[], syncId: string): Record<string, unknown> {
  const out: Record<string, unknown> = { sync_id: syncId };
  for (const m of map) {
    const raw = pickValue(row, m);
    switch (m.kind) {
      case "num": out[m.db] = toNumOrNull(raw); break;
      case "int": out[m.db] = toIntOrNull(raw); break;
      case "date": out[m.db] = toDateOrNull(raw); break;
      default: out[m.db] = toTextOrNull(raw);
    }
  }
  return out;
}

export function convertGerencialRawRow(row: Record<string, unknown>, syncId: string): Record<string, unknown> | null {
  if (!hasAnyValue(row)) return null;
  return convertRow(row, GERENCIAL_MAP, syncId);
}

export function convertRamoRawRow(
  row: Record<string, unknown>,
  syncId: string,
): { ramo: string; tipo_de_ramo: string; sync_id: string } | null {
  const ramo = toTextOrNull(pickValue(row, { excel: "Ramo", db: "ramo", kind: "text" }));
  const tipo = toTextOrNull(
    pickValue(row, { excel: "Tipo de Ramo", db: "tipo_de_ramo", kind: "text", alts: ["Tipo de ramo", "Tipo Ramo"] }),
  );
  if (!ramo || !tipo) return null;
  return { ramo, tipo_de_ramo: tipo, sync_id: syncId };
}

export function convertCaixaRawRow(row: Record<string, unknown>, syncId: string): Record<string, unknown> | null {
  if (!hasAnyValue(row)) return null;
  return convertRow(row, CAIXA_MAP, syncId);
}

// ─── Mappings ──────────────────────────────────────────────────────────────

const GERENCIAL_MAP: ColMapWithAlts[] = [
  { excel: "Grupo", db: "grupo", kind: "text" },
  { excel: "Tomador", db: "tomador", kind: "text" },
  { excel: "Segurado", db: "segurado", kind: "text" },
  { excel: "Documento", db: "documento", kind: "text" },
  { excel: "Ramo", db: "ramo", kind: "text" },
  { excel: "Seguradora", db: "seguradora", kind: "text" },
  { excel: "N° Apólice", db: "numero_apolice", kind: "text", alts: ["Nº Apólice", "N Apólice", "No Apólice"] },
  { excel: "Data de Emissão", db: "data_emissao", kind: "date" },
  { excel: "Início de Vigência", db: "inicio_vigencia", kind: "date" },
  { excel: "Fim de Vigência", db: "fim_vigencia", kind: "date" },
  { excel: "Período de atualização", db: "periodo_atualizacao", kind: "text" },
  { excel: "Valor da IS", db: "valor_is", kind: "num" },
  { excel: "Prêmio Total", db: "premio_total", kind: "num" },
  { excel: "% Comissão", db: "percentual_comissao", kind: "num" },
  { excel: "Comissão Emitida", db: "comissao_emitida", kind: "num" },
  { excel: "Qtd de Parcelas", db: "qtd_parcelas", kind: "int" },
  { excel: "Prêmio Parcela", db: "premio_parcela", kind: "num" },
  { excel: "Comissão Bruta", db: "comissao_bruta", kind: "num" },
  { excel: "Imposto Ret", db: "imposto_ret", kind: "num" },
  { excel: "Valor de ISS", db: "valor_iss", kind: "num" },
  { excel: "Valor recebido / a receber", db: "valor_recebido_a_receber", kind: "num" },
  { excel: "Número da parcela", db: "numero_da_parcela", kind: "int" },
  { excel: "Tipo de Pagamento", db: "tipo_pagamento", kind: "text" },
  { excel: "Empresa Faturada", db: "empresa_faturada", kind: "text" },
  { excel: "Data de pagamento", db: "data_pagamento", kind: "date" },
  { excel: "Mês", db: "mes", kind: "int" },
  { excel: "Ano", db: "ano", kind: "int" },
  { excel: "Fat Competência", db: "fat_competencia", kind: "text" },
  { excel: "Status da parcela de comissão", db: "status_parcela_comissao", kind: "text" },
  { excel: "Análise", db: "analise", kind: "text" },
  { excel: "Possui repasse", db: "possui_repasse", kind: "text" },
  { excel: "% Repasse", db: "percentual_repasse", kind: "num" },
  { excel: "Parcelas", db: "parcelas", kind: "text" },
  { excel: "% Imposto", db: "percentual_imposto", kind: "num" },
  { excel: "Valor Repasse Total", db: "valor_repasse_total", kind: "num" },
  { excel: "Data do Repasse", db: "data_repasse", kind: "date" },
  { excel: "Status do repasse", db: "status_repasse", kind: "text" },
  { excel: "Observação", db: "observacao", kind: "text" },
  { excel: "ID", db: "card_id", kind: "text" },
  { excel: "Responsavel", db: "responsavel", kind: "text", alts: ["Responsável"] },
  { excel: "Data Card Finalizado", db: "data_card_finalizado", kind: "date" },
];

const CAIXA_MAP: ColMapWithAlts[] = [
  { excel: "Tipo de Lançamento", db: "tipo_lancamento", kind: "text" },
  { excel: "Mês de Referência", db: "mes_referencia", kind: "text" },
  { excel: "Data de Pagamento", db: "data_pagamento", kind: "date" },
  { excel: "Descrição", db: "descricao", kind: "text" },
  { excel: "Valor:", db: "valor", kind: "num", alts: ["Valor"] },
  { excel: "Categoria", db: "categoria", kind: "text" },
  { excel: "Sub Categoria", db: "sub_categoria", kind: "text", alts: ["Subcategoria", "Sub-Categoria"] },
  { excel: "Referência", db: "referencia", kind: "text" },
  { excel: "Observações", db: "observacoes", kind: "text", alts: ["Observacoes", "Observação"] },
  { excel: "Data de Emissão da Nota Fiscal", db: "data_emissao_nota_fiscal", kind: "date" },
];

// ─── Public API — parsing dos rows brutos ──────────────────────────────────

export function parseGerencial(
  gerRaw: Record<string, unknown>[],
  auxRaw: Record<string, unknown>[],
  syncId: string,
): ParsedGerencial {
  const gerencialRows = gerRaw
    .map((r) => convertGerencialRawRow(r, syncId))
    .filter((x): x is Record<string, unknown> => x !== null);

  const ramoRows = auxRaw
    .map((r) => convertRamoRawRow(r, syncId))
    .filter((x): x is { ramo: string; tipo_de_ramo: string; sync_id: string } => x !== null);

  const totalComissaoBruta = gerencialRows.reduce((s, r) => s + (Number(r.comissao_bruta) || 0), 0);
  const comissaoBrutaComEmissao = gerencialRows.reduce(
    (s, r) => s + (r.data_emissao ? Number(r.comissao_bruta) || 0 : 0),
    0,
  );

  return {
    syncId,
    gerencialRows,
    ramoRows,
    validation: {
      totalRows: gerencialRows.length,
      totalComissaoBruta,
      comissaoBrutaComEmissao,
      totalRamos: ramoRows.length,
    },
  };
}

export function parseCaixa(caixaRaw: Record<string, unknown>[], syncId: string): ParsedCaixa {
  const allRows = caixaRaw
    .map((r) => convertCaixaRawRow(r, syncId))
    .filter((x): x is Record<string, unknown> => x !== null);
  const rows = allRows.filter(isCaixaComissaoConvertedRow);

  const totalComissao = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const categoriasSet = new Set<string>();
  rows.forEach((r) => { if (r.categoria) categoriasSet.add(String(r.categoria)); });
  const tiposLancamentoSet = new Set<string>();
  rows.forEach((r) => { if (r.tipo_lancamento) tiposLancamentoSet.add(String(r.tipo_lancamento)); });

  return {
    syncId,
    rows,
    validation: {
      totalReadRows: allRows.length,
      totalRows: rows.length,
      totalComissao,
      categorias: Array.from(categoriasSet).sort(),
      tiposLancamento: Array.from(tiposLancamentoSet).sort(),
    },
  };
}
