import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-meu-perfil";

export interface AdminUserV2 {
  user_id: string;
  full_name: string | null;
  email: string;
  blocked: boolean;
  active: boolean;
  primeiro_acesso: boolean;
  perfil_id: string | null;
  perfil_nome: string | null;
  ultimo_acesso: string | null;
  criado_em: string;
  total_sessoes: number;
  tipo_usuario: "interno" | "externo";
  roles: AppRole[];
}

export interface ConviteExterno {
  id: string;
  email: string;
  perfil_id: string | null;
  perfil_nome: string | null;
  criado_em: string;
  aceito_em: string | null;
}

export interface AtividadeItem {
  tipo: string;
  momento: string;
  detalhes: Record<string, unknown>;
}

export function useAdminUsersV2() {
  return useQuery({
    queryKey: ["admin-users-v2"],
    queryFn: async (): Promise<AdminUserV2[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_users_v2" as never);
      if (error) throw error;
      return ((data as unknown as AdminUserV2[]) ?? []).map((r) => ({
        ...r,
        total_sessoes: Number(r.total_sessoes ?? 0),
        roles: (r.roles ?? []) as AppRole[],
      }));
    },
  });
}

export function useConvitesExternos() {
  return useQuery({
    queryKey: ["admin-convites-externos"],
    queryFn: async (): Promise<ConviteExterno[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_convites_externo" as never);
      if (error) throw error;
      return (data as unknown as ConviteExterno[]) ?? [];
    },
  });
}

export function useAtividadeUsuario(userId: string | null) {
  return useQuery({
    queryKey: ["admin-atividade-usuario", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AtividadeItem[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_atividade_usuario" as never, {
        _user_id: userId,
        _limit: 100,
      } as never);
      if (error) throw error;
      return ((data as unknown as AtividadeItem[]) ?? []).map((x) => ({
        ...x,
        detalhes: (x.detalhes ?? {}) as Record<string, unknown>,
      }));
    },
  });
}
