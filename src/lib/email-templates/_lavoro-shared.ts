// Estilos compartilhados dos e-mails de auth do Hub Lavoro Seguros
// Visual moderno, executivo e minimalista.
export const NAVY = "#14405C";
export const NAVY_DEEP = "#0E2E43";
export const CYAN = "#00BAF2";
export const STEEL = "#8AAFC9";
export const LIGHT_BG = "#EEF5FA";
export const BORDER = "#E5EAF0";
export const TEXT = "#1F2937";
export const MUTED = "#6B7280";

export const LOGO_URL =
  "https://hub.lavoroseguros.com.br/__l5e/assets-v1/7869490b-ef06-42fc-a753-2a6967781570/logo-lavoro-branca.png";

export const main = {
  backgroundColor: "#F4F6F9",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

export const container = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "14px",
  overflow: "hidden",
  boxShadow: "0 8px 30px rgba(14, 46, 67, 0.08)",
  border: `1px solid ${BORDER}`,
};

// Header navy sólido, compacto, com logo pequena alinhada à esquerda
// e etiqueta discreta "HUB LAVORO SEGUROS" à direita.
export const header = {
  background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`,
  padding: "22px 32px",
};

export const headerRow = {
  width: "100%",
} as const;

export const logoImg = {
  height: "22px",
  width: "auto",
  display: "block",
};

export const headerTag = {
  color: "rgba(255,255,255,0.72)",
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "2.2px",
  textTransform: "uppercase" as const,
  margin: 0,
  textAlign: "right" as const,
};

// Faixa cyan fininha, apenas como fio decorativo entre header e conteúdo
export const accentBar = {
  height: "3px",
  background: `linear-gradient(90deg, ${CYAN} 0%, ${STEEL} 100%)`,
  lineHeight: "3px",
  fontSize: 0,
};

export const card = {
  padding: "36px 32px 28px",
  backgroundColor: "#ffffff",
};

export const eyebrow = {
  color: CYAN,
  fontSize: "11px",
  fontWeight: 700 as const,
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
  margin: "0 0 12px",
};

export const h1 = {
  fontSize: "22px",
  lineHeight: "30px",
  fontWeight: 700 as const,
  color: NAVY_DEEP,
  margin: "0 0 18px",
  letterSpacing: "-0.2px",
};

export const text = {
  fontSize: "15px",
  color: TEXT,
  lineHeight: "24px",
  margin: "0 0 14px",
};

export const link = { color: NAVY, textDecoration: "underline" };

// CTA principal — moderno, alto contraste
export const button = {
  backgroundColor: NAVY,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600 as const,
  borderRadius: "10px",
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block",
  boxShadow: "0 4px 12px rgba(20, 64, 92, 0.25)",
};

export const buttonWrap = {
  textAlign: "center" as const,
  margin: "28px 0 12px",
};

// Bloco informativo (perfil pré-aprovado) — sem borda-esquerda pesada
export const infoBox = {
  backgroundColor: LIGHT_BG,
  padding: "14px 18px",
  borderRadius: "10px",
  margin: "20px 0 8px",
  fontSize: "13px",
  color: NAVY_DEEP,
  lineHeight: "20px",
};

// Linha SSO inline, sem "caixa dentro de caixa"
export const ssoLine = {
  fontSize: "13px",
  color: MUTED,
  margin: "0 0 4px",
  textAlign: "center" as const,
};

export const ssoStrong = {
  color: NAVY_DEEP,
  fontWeight: 700 as const,
};

export const expiryNote = {
  fontSize: "12px",
  color: MUTED,
  textAlign: "center" as const,
  margin: "10px 0 0",
};

export const divider = {
  borderTop: `1px solid ${BORDER}`,
  margin: "28px 0 20px",
  height: 0,
  lineHeight: 0,
  fontSize: 0,
};

export const footer = {
  padding: "0 32px 28px",
  fontSize: "11px",
  color: MUTED,
  textAlign: "center" as const,
  lineHeight: "18px",
};

export const footerStrong = {
  color: NAVY_DEEP,
  fontWeight: 700 as const,
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
