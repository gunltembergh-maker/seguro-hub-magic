// Formatação pt-BR. Duplicada em src/lib/format.ts porque Edge Functions
// (Deno) e o front (Vite) não compartilham módulo — mantenha as duas iguais.

export function brl(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "R$ 0,00";
  const [int, dec] = Math.abs(v).toFixed(casas).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "-" : ""}R$ ${intFmt}${dec ? "," + dec : ""}`;
}

export function num(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "0";
  const [int, dec] = Math.abs(v).toFixed(casas).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "-" : ""}${intFmt}${dec ? "," + dec : ""}`;
}

export function pct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined) return "0%";
  return num(v * 100, casas) + "%";
}

export function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D+/g, "");
}

export function cnpjFmt(c: string | null | undefined): string {
  const d = soDigitos(c).padStart(14, "0");
  if (d.length !== 14) return String(c ?? "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function cpfMask(c: string | null | undefined): string {
  const d = soDigitos(c);
  if (d.length !== 11) return String(c ?? "");
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function docFmt(d: string | null | undefined): string {
  const dig = soDigitos(d);
  return dig.length === 14 ? cnpjFmt(dig) : cpfMask(dig);
}

/** 20 dígitos → 0000000-00.0000.0.00.0000 (padrão CNJ) */
export function processoFmt(n: string | null | undefined): string {
  const d = soDigitos(n);
  if (d.length !== 20) return String(n ?? "—");
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

export function dataFmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d.length <= 10 ? d + "T00:00:00" : d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

/** Parse de número em formato brasileiro ou americano vindo de CSV/API. */
export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
