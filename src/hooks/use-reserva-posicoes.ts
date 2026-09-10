import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  RpMinhaReserva,
  RpParametros,
  RpPosicaoGrade,
} from "@/lib/rp/rp-tipos";

const PADRAO: RpParametros = {
  rp_janela_antecedencia_dias: 30,
  rp_tolerancia_checkin_min: 15,
  rp_checkin_liberado_antes_min: 30,
  rp_horario_funcionamento: { inicio: "07:00", fim: "20:00" },
  rp_enviar_email_usuario: true,
};

export function useRpParametros() {
  return useQuery({
    queryKey: ["rp-parametros"],
    queryFn: async (): Promise<RpParametros> => {
      const { data, error } = await supabase.rpc("rpc_rp_parametros");
      if (error) throw error;
      return { ...PADRAO, ...((data ?? {}) as Partial<RpParametros>) };
    },
    staleTime: 5 * 60_000,
  });
}

export function useRpGradeDia(dataIso: string) {
  return useQuery({
    queryKey: ["rp-grade-dia", dataIso],
    queryFn: async (): Promise<RpPosicaoGrade[]> => {
      const { data, error } = await supabase.rpc("rpc_rp_grade_dia", { p_data: dataIso });
      if (error) throw error;
      return ((data ?? []) as unknown as RpPosicaoGrade[]).map((p) => ({
        ...p,
        reservas: p.reservas ?? [],
      }));
    },
  });
}

export function useRpMinhasReservas() {
  return useQuery({
    queryKey: ["rp-minhas-reservas"],
    queryFn: async (): Promise<RpMinhaReserva[]> => {
      const { data, error } = await supabase.rpc("rpc_rp_minhas_reservas");
      if (error) throw error;
      return (data ?? []) as unknown as RpMinhaReserva[];
    },
  });
}

export function useFeriados() {
  return useQuery({
    queryKey: ["rp-feriados"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("feriados_nacionais").select("data");
      if (error) throw error;
      return new Set((data ?? []).map((f: { data: string }) => f.data));
    },
    staleTime: 60 * 60_000,
  });
}
