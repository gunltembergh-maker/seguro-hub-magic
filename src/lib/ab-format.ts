// Formatação pt-BR do módulo Análise Background.
// Espelha supabase/functions/_shared/format.ts — mantenha as duas iguais.

export function brl(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "R$ 0,00";
  const [int, dec] = Math.abs(v).toFixed(casas).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "-" : ""}R$ ${intFmt}${dec ? "," + dec : ""}`;
}

/** Compacto para KPI: R$ 1,2 mi / R$ 340 mil */
export function brlCurto(v: number | null | undefined): string {
  const n = v ?? 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `R$ ${num(n / 1_000_000_000, 1)} bi`;
  if (abs >= 1_000_000) return `R$ ${num(n / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `R$ ${num(n / 1_000, 0)} mil`;
  return brl(n, 0);
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
  const d = soDigitos(c);
  if (d.length !== 14) return String(c ?? "—");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function cpfMask(c: string | null | undefined): string {
  const d = soDigitos(c);
  if (d.length !== 11) return String(c ?? "—");
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
  const dt = typeof d === "string" ? new Date(d.length <= 10 ? `${d}T00:00:00` : d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

export function tituloCase(s: string | null | undefined): string {
  if (!s) return "—";
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && minusculas.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** Rótulo de prazo: "vencido", "hoje", "7 d". */
export function prazoLabel(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return "—";
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoje";
  return `${dias} d`;
}

export type Tom = "critico" | "alerta" | "ok" | "neutro";

export function tomDoPrazo(dias: number | null | undefined): Tom {
  if (dias === null || dias === undefined) return "neutro";
  if (dias <= 0) return "critico";
  if (dias <= 15) return "alerta";
  return "neutro";
}
