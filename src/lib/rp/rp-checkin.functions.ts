import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ reserva_id: z.string().uuid() });

/** IP público real do cliente, sempre lido dos headers da requisição (nunca do cliente). */
function ipDoCliente(): string | null {
  const h = getRequest()?.headers;
  if (!h) return null;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const primeiro = xff.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? null;
}

/**
 * Registra o check-in da reserva. A validação do IP do escritório acontece
 * exclusivamente no servidor.
 */
export const fazerCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

    const ip = ipDoCliente();
    if (!ip) {
      return { ok: false as const, erro: "Não foi possível identificar sua conexão. Tente novamente." };
    }

    const { data: cfg } = await lavoroAdmin
      .from("hub_admin_settings")
      .select("value")
      .eq("key", "rp_ips_escritorio")
      .maybeSingle();

    const permitidos = Array.isArray(cfg?.value) ? (cfg.value as string[]) : [];
    if (!permitidos.map((p) => String(p).trim()).includes(ip)) {
      return {
        ok: false as const,
        erro: "Check-in disponível apenas conectado ao Wi-Fi do escritório.",
      };
    }

    const { data: resultado, error } = await lavoroAdmin.rpc("rp_registrar_checkin", {
      p_reserva_id: data.reserva_id,
      p_user_id: context.userId,
      p_ip: ip,
    });

    if (error) {
      return { ok: false as const, erro: error.message };
    }

    return { ok: true as const, resultado };
  });
