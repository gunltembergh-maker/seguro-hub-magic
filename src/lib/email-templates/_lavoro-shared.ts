// Estilos compartilhados dos e-mails de auth do Hub Lavoro Seguros
// Design executivo, moderno, minimalista — paleta Lavoro (navy + cyan).
export const NAVY = "#14405C";
export const NAVY_DEEP = "#0E2E43";
export const CYAN = "#00BAF2";
export const STEEL = "#8AAFC9";
export const LIGHT_BG = "#EEF5FA";
export const BORDER = "#E5EAF0";
export const TEXT = "#1F2937";
export const MUTED = "#6B7280";
export const PAGE_BG = "#F1F5F9";

// Logo Lavoro (versão colorida sobre branco) — servida via CDN de assets do próprio Hub.
export const LOGO_URL =
  "https://hub.lavoroseguros.com.br/__l5e/assets-v1/1a15787d-0339-491f-9940-809b91f21630/logo-lavoro-email.png";

export const main = {
  backgroundColor: PAGE_BG,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "40px 0",
};

export const container = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 10px 40px rgba(14, 46, 67, 0.10)",
  border: `1px solid ${BORDER}`,
};

// Header claro com discreto degradê — dá espaço para a logo colorida da Lavoro respirar.
export const header = {
  background: `linear-gradient(180deg, #ffffff 0%, ${LIGHT_BG} 100%)`,
  padding: "26px 32px 20px",
  borderBottom: `1px solid ${BORDER}`,
};

export const logoImg = {
  height: "34px",
  width: "auto",
  display: "block",
};

// Fio decorativo cyan → navy (único elemento gráfico entre header e conteúdo)
export const accentBar = {
  height: "3px",
  background: `linear-gradient(90deg, ${CYAN} 0%, ${NAVY} 100%)`,
  lineHeight: "3px",
  fontSize: 0,
};

export const card = {
  padding: "36px 34px 28px",
  backgroundColor: "#ffffff",
};

export const eyebrow = {
  color: CYAN,
  fontSize: "11px",
  fontWeight: 700 as const,
  letterSpacing: "2.2px",
  textTransform: "uppercase" as const,
  margin: "0 0 14px",
};

export const h1 = {
  fontSize: "24px",
  lineHeight: "32px",
  fontWeight: 700 as const,
  color: NAVY_DEEP,
  margin: "0 0 20px",
  letterSpacing: "-0.3px",
};

export const text = {
  fontSize: "15px",
  color: TEXT,
  lineHeight: "24px",
  margin: "0 0 14px",
};

export const link = { color: NAVY, textDecoration: "underline" };

// CTA moderno com degradê navy → cyan, sombra suave
export const button = {
  background: `linear-gradient(135deg, ${NAVY} 0%, #1E5A82 60%, ${CYAN} 100%)`,
  backgroundColor: NAVY,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600 as const,
  borderRadius: "12px",
  padding: "15px 32px",
  textDecoration: "none",
  display: "inline-block",
  boxShadow: "0 6px 18px rgba(0, 186, 242, 0.25)",
  letterSpacing: "0.2px",
};

export const buttonWrap = {
  textAlign: "center" as const,
  margin: "28px 0 14px",
};

// Bloco informativo (perfil pré-aprovado)
export const infoBox = {
  backgroundColor: LIGHT_BG,
  padding: "14px 18px",
  borderRadius: "10px",
  margin: "22px 0 8px",
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
  padding: "0 32px 30px",
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

// ---------- Compat shims (templates legados: signup, email-change, reauthentication) ----------
export const brand = {
  color: NAVY_DEEP,
  fontSize: "18px",
  fontWeight: 700 as const,
  letterSpacing: "0.3px",
  margin: 0,
};
export const brandSub = {
  color: CYAN,
  fontSize: "11px",
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
  margin: "6px 0 0",
};
export const subHeader = {
  backgroundColor: LIGHT_BG,
  padding: "12px 24px",
  textAlign: "center" as const,
};
export const subHeaderText = {
  color: NAVY,
  fontSize: "12px",
  fontWeight: 700 as const,
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
  margin: 0,
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

// Compat: header antigo em versão navy (não usado nos novos templates).
export const headerTag = {
  color: "rgba(255,255,255,0.72)",
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "2.2px",
  textTransform: "uppercase" as const,
  margin: 0,
  textAlign: "right" as const,
};
