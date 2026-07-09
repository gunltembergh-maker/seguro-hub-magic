import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  user_id: string;
  full_name: string | null;
  email: string;
  blocked: boolean;
  active: boolean;
  perfil_id: string | null;
  perfil_nome: string | null;
  ultimo_acesso: string | null;
  criado_em: string;
}

export interface PerfilAcesso {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export const PERMISSION_KEYS = [
  { key: "menu_inicio", label: "Menu Início" },
  { key: "menu_dashboard_receita", label: "Dashboard de Receita" },
  { key: "menu_importar_gerencial", label: "Importar Base Gerencial" },
  { key: "menu_importar_caixa", label: "Importar Caixa Bradesco" },
  { key: "menu_admin_usuarios", label: "Admin — Usuários" },
  { key: "menu_admin_perfis", label: "Admin — Perfis" },
  { key: "menu_admin_configuracoes", label: "Admin — Configurações" },
] as const;

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_users");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export function usePerfis() {
  return useQuery({
    queryKey: ["admin-perfis"],
    queryFn: async (): Promise<PerfilAcesso[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_perfis");
      if (error) throw error;
      return ((data ?? []) as PerfilAcesso[]).map((p) => ({
        ...p,
        permissoes: (p.permissoes ?? {}) as Record<string, boolean>,
      }));
    },
  });
}

export function useLastImport(tipo: "gerencial" | "caixa") {
  return useQuery({
    queryKey: ["admin-last-import", tipo],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("rpc_admin_last_import", { _tipo: tipo });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}
