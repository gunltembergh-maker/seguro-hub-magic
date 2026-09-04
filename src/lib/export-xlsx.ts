import { NAVY, CYAN, STEEL, LIGHT_BG, BORDER } from "@/lib/email-templates/_lavoro-shared";
import logoAsset from "@/assets/logo-lavoro-email.png.asset.json";

export type FormatoCol = "moeda" | "percentual" | "data" | "inteiro" | "texto";

export type ColunaExport = { header: string; key: string; width?: number; formato?: FormatoCol };

export type AbaExport = {
  nome: string;
  colunas: ColunaExport[];
  linhas: Record<string, unknown>[];
  totalizar?: string[];
  nota?: string;
};

export type CabecalhoExport = {
  titulo: string;
  subtitulo: string;
  info: Array<{ rotulo: string; valor: string }>;
};

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const WHITE = "FFFFFFFF";

const NUM_FMT: Record<FormatoCol, string | undefined> = {
  moeda: "R$ #,##0.00",
  percentual: "0%",
  data: "dd/mm/yyyy",
  inteiro: "0",
  texto: undefined,
};

const ALIGN: Record<FormatoCol, "left" | "right" | "center"> = {
  moeda: "right",
  percentual: "right",
  data: "center",
  inteiro: "center",
  texto: "left",
};

function converter(v: unknown, formato: FormatoCol): unknown {
  if (v === null || v === undefined || v === "") return null;
  if (formato === "data") {
    if (v instanceof Date) return v;
    const iso = String(v).slice(0, 10);
    const d = new Date(`${iso}T12:00:00`);
    return isNaN(d.getTime()) ? String(v) : d;
  }
  if (formato === "moeda" || formato === "percentual" || formato === "inteiro") {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  return String(v);
}

export async function exportarXlsx(opts: {
  arquivo: string;
  cabecalho: CabecalhoExport;
  abas: AbaExport[];
}): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hub Lavoro Seguros";
  workbook.created = new Date();

  let logoId: number | null = null;
  try {
    const res = await fetch(logoAsset.url);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      logoId = workbook.addImage({ buffer, extension: "png" });
    }
  } catch {
    logoId = null;
  }

  const thin = { style: "thin" as const, color: { argb: argb(BORDER) } };
  const bordaFina = { top: thin, left: thin, bottom: thin, right: thin };

  for (const aba of opts.abas) {
    const ws = workbook.addWorksheet(aba.nome.slice(0, 31));
    const nCols = Math.max(aba.colunas.length, 2);
    const ultima = nCols;

    ws.columns = aba.colunas.map((c) => ({ key: c.key, width: c.width ?? 16 }));

    // Linhas 1-2: faixa de marca
    ws.mergeCells(1, 1, 1, ultima);
    ws.mergeCells(2, 1, 2, ultima);
    for (let r = 1; r <= 2; r++) {
      for (let c = 1; c <= ultima; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(NAVY) } };
      }
    }
    const c1 = ws.getCell(1, 1);
    c1.value = opts.cabecalho.titulo;
    c1.font = { bold: true, size: 15, color: { argb: WHITE } };
    c1.alignment = { vertical: "middle", horizontal: "left", indent: 22 };
    ws.getRow(1).height = 30;
    const c2 = ws.getCell(2, 1);
    c2.value = opts.cabecalho.subtitulo;
    c2.font = { size: 10, color: { argb: argb(STEEL) } };
    c2.alignment = { vertical: "middle", horizontal: "left", indent: 22 };
    ws.getRow(2).height = 20;

    if (logoId !== null) {
      try {
        ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 38 } });
      } catch {
        /* sem logo */
      }
    }

    // Linha 3: vazia
    ws.getRow(3).height = 6;
    let linha = 4;

    // Bloco info
    for (const item of opts.cabecalho.info) {
      const a = ws.getCell(linha, 1);
      a.value = item.rotulo;
      a.font = { bold: true, color: { argb: argb(NAVY) } };
      a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(LIGHT_BG) } };
      const b = ws.getCell(linha, 2);
      b.value = item.valor;
      b.font = { bold: true, color: { argb: argb(NAVY) } };
      linha++;
    }
    linha++; // vazia

    if (aba.nota) {
      ws.mergeCells(linha, 1, linha, ultima);
      const n = ws.getCell(linha, 1);
      n.value = aba.nota;
      n.font = { italic: true, color: { argb: "FF6B5410" } };
      n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFDF3" } };
      n.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      linha++;
      linha++; // vazia
    }

    // Cabeçalho da tabela
    const headerRow = linha;
    aba.colunas.forEach((col, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = col.header;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(NAVY) } };
      cell.font = { bold: true, size: 10, color: { argb: WHITE } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = bordaFina;
    });
    ws.getRow(headerRow).height = 22;
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + Math.max(aba.linhas.length, 1), column: aba.colunas.length },
    };
    ws.views = [{ state: "frozen", ySplit: headerRow }];
    linha++;

    // Dados
    const primeiraDados = linha;
    aba.linhas.forEach((row, idx) => {
      const zebra = idx % 2 === 1;
      aba.colunas.forEach((col, i) => {
        const formato = col.formato ?? "texto";
        const cell = ws.getCell(linha, i + 1);
        cell.value = converter(row[col.key], formato) as never;
        const fmt = NUM_FMT[formato];
        if (fmt) cell.numFmt = fmt;
        cell.alignment = { horizontal: ALIGN[formato], vertical: "middle" };
        cell.border = bordaFina;
        if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(LIGHT_BG) } };
      });
      linha++;
    });
    const ultimaDados = linha - 1;

    // Total
    if (aba.totalizar && aba.totalizar.length > 0) {
      const medium = { style: "medium" as const, color: { argb: argb(CYAN) } };
      aba.colunas.forEach((col, i) => {
        const cell = ws.getCell(linha, i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(NAVY) } };
        cell.font = { bold: true, color: { argb: WHITE } };
        cell.border = { ...bordaFina, top: medium };
        if (i === 0) {
          cell.value = "TOTAL";
          cell.alignment = { horizontal: "left", vertical: "middle" };
        } else if (aba.totalizar!.includes(col.key)) {
          const soma = aba.linhas.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
          cell.value = Math.round(soma * 100) / 100;
          if (ultimaDados >= primeiraDados) {
            const letra = ws.getColumn(i + 1).letter;
            cell.value = { formula: `SUM(${letra}${primeiraDados}:${letra}${ultimaDados})`, result: cell.value } as never;
          }
          const fmt = NUM_FMT[col.formato ?? "moeda"];
          if (fmt) cell.numFmt = fmt;
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
      });
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
