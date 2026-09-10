import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dispara os e-mails das reservas expiradas ainda não notificadas.
 * Idempotente: cada reserva é marcada como notificada após o envio.
 */
export const processarAusencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { processarAusenciasPendentes } = await import("./rp-ausencias.server");
      return await processarAusenciasPendentes();
    } catch (error) {
      console.error("[rp-ausencias] falha ao processar", error);
      return { processadas: 0, enviados: 0 };
    }
  });
