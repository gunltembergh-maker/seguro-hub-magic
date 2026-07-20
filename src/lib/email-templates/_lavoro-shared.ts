// Estilos compartilhados dos e-mails de auth do Hub Lavoro Seguros
export const NAVY = "#14405C";
export const CYAN = "#00BAF2";
export const STEEL = "#8AAFC9";
export const LIGHT_BG = "#DDECF3";

// Logo Lavoro branca (com nome) - CDN Lovable, servida no domínio do Hub.
export const LOGO_URL =
  "https://hub.lavoroseguros.com.br/__l5e/assets-v1/7869490b-ef06-42fc-a753-2a6967781570/logo-lavoro-branca.png";

export const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
};
export const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "32px 20px",
};
export const header = {
  backgroundColor: NAVY,
  padding: "32px 24px 24px",
  borderRadius: "10px 10px 0 0",
  textAlign: "center" as const,
};
export const logoImg = {
  display: "block",
  margin: "0 auto",
  height: "44px",
  width: "auto",
};
// Compat: templates antigos ainda importam `brand` / `brandSub`.
export const brand = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 700 as const,
  letterSpacing: "0.5px",
  margin: 0,
};
export const brandSub = {
  color: CYAN,
  fontSize: "12px",
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  margin: "6px 0 0",
};
export const subHeader = {
  backgroundColor: LIGHT_BG,
  padding: "14px 24px",
  textAlign: "center" as const,
  borderLeft: "1px solid #e5e7eb",
  borderRight: "1px solid #e5e7eb",
};
export const subHeaderText = {
  color: NAVY,
  fontSize: "13px",
  fontWeight: 700 as const,
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
  margin: 0,
};
export const card = {
  border: "1px solid #e5e7eb",
  borderTop: "none",
  borderRadius: "0 0 10px 10px",
  padding: "28px 24px",
  backgroundColor: "#ffffff",
};
export const h1 = {
  fontSize: "20px",
  fontWeight: 700 as const,
  color: NAVY,
  margin: "0 0 16px",
};
export const text = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "22px",
  margin: "0 0 16px",
};
export const link = { color: NAVY, textDecoration: "underline" };
export const button = {
  backgroundColor: NAVY,
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600 as const,
  borderRadius: "8px",
  padding: "12px 22px",
  textDecoration: "none",
  display: "inline-block",
};
// Caixa "Entrar com Microsoft"
export const ssoBox = {
  border: `1px solid ${STEEL}`,
  backgroundColor: "#f8fbfd",
  borderRadius: "8px",
  padding: "16px 18px",
  margin: "8px 0 20px",
  textAlign: "center" as const,
};
export const ssoTitle = {
  fontSize: "13px",
  fontWeight: 700 as const,
  color: NAVY,
  margin: "0 0 10px",
  letterSpacing: "0.5px",
};
export const ssoBadge = {
  display: "inline-block",
  padding: "10px 16px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: "13px",
  fontWeight: 600 as const,
};
export const infoBox = {
  backgroundColor: LIGHT_BG,
  borderLeft: `4px solid ${CYAN}`,
  padding: "12px 16px",
  borderRadius: "4px",
  margin: "0 0 20px",
  fontSize: "13px",
  color: NAVY,
  lineHeight: "20px",
};
export const expiryNote = {
  fontSize: "12px",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "12px 0 0",
  fontStyle: "italic" as const,
};
export const footer = {
  fontSize: "11px",
  color: "#9ca3af",
  textAlign: "center" as const,
  margin: "20px 0 0",
  lineHeight: "18px",
};

export const codeStyle = {
  fontFamily: "Courier, monospace",
  fontSize: "26px",
  fontWeight: 700 as const,
  color: NAVY,
  backgroundColor: LIGHT_BG,
  padding: "12px 18px",
  borderRadius: "8px",
  letterSpacing: "4px",
  display: "inline-block",
  margin: "0 0 20px",
};

// Helper: extrai "Primeiro Último" do nome completo ou do e-mail.
export function displayName(nome?: string | null, email?: string | null): string {
  const clean = (nome ?? "").trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (parts.length === 0) return "";
  if (parts.length === 1) return cap(parts[0]);
  return `${cap(parts[0])} ${cap(parts[parts.length - 1])}`;
}
