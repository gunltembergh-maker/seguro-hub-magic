import { supabase } from "@/integrations/supabase/client";
import { enviarEmailReserva } from "@/lib/rp/rp-email.functions";
import type { RpReservaRetorno } from "@/lib/rp/rp-tipos";

/**
 * Cancela uma reserva pela RPC e dispara os e-mails corretos:
 * - cancelado por RH/Admin: 'cancelamento_admin' ao dono + 'rh_cancelamento' ao RH;
 * - cancelado pelo próprio dono: 'cancelamento' + 'rh_cancelamento'.
 */
export async function cancelarReservaComMotivo(
  reservaId: string,
  motivo?: string,
): Promise<RpReservaRetorno> {
  const { data, error } = await supabase.rpc("rpc_rp_cancelar_reserva", {
    p_reserva_id: reservaId,
    ...(motivo ? { p_motivo: motivo } : {}),
  } as never);
  if (error) throw error;
  const reserva = data as unknown as RpReservaRetorno;

  enviarEmailReserva({
    data: {
      tipo: "cancelamento",
      por_terceiro: reserva.cancelado_por_terceiro === true,
      dono_user_id: reserva.user_id ?? null,
      motivo: reserva.motivo ?? motivo ?? null,
      reserva,
    },
  }).catch((e) => console.error("[rp] e-mail de cancelamento falhou", e));

  return reserva;
}
