import { createServerFn } from "@tanstack/react-start";

// Entrega de sessão entre a janela do SSO (topo) e a tela do Hub aberta dentro
// do preview do editor. Navegadores modernos particionam o localStorage do
// iframe, então a sessão obtida na janela auxiliar não é visível para o
// preview. Guardamos os tokens por poucos minutos, com um código de uso único.

export const ssoHandoffStore = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; payload: string }) => {
    if (!input?.code || input.code.length < 20 || input.code.length > 128) {
      throw new Error("Código inválido");
    }
    if (!input?.payload || input.payload.length > 8000) {
      throw new Error("Payload inválido");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    await lavoroAdmin
      .from("sso_handoff")
      .delete()
      .lt("expires_at", new Date().toISOString());
    const { error } = await lavoroAdmin.from("sso_handoff").upsert({
      code: data.code,
      payload: data.payload,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ssoHandoffClaim = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    if (!input?.code || input.code.length < 20 || input.code.length > 128) {
      throw new Error("Código inválido");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    const { data: row } = await lavoroAdmin
      .from("sso_handoff")
      .select("payload, expires_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) return { payload: null as string | null };
    await lavoroAdmin.from("sso_handoff").delete().eq("code", data.code);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { payload: null as string | null };
    }
    return { payload: row.payload as string };
  });
