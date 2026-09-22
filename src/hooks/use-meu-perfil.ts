import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "ADMIN" | "DIRETORIA_GERAL" | "COLABORADOR";

export interface MeuPerfil {
  user_id: string;
  full_name: string | null;
  email: string;
  blocked: boolean;
  active: boolean;
  primeiro_acesso: boolean;
  perfil_id: string | null;
  perfil_nome: string | null;
  permissoes: Record<string, boolean>;
  roles: AppRole[];
  times_receita: string[];
}

export function useMeuPerfil() {
  return useQuery({
    queryKey: ["meu-perfil"],
    queryFn: async (): Promise<MeuPerfil | null> => {
      const { data, error } = await supabase.rpc("rpc_meu_perfil");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        ...row,
        permissoes: (row.permissoes ?? {}) as Record<string, boolean>,
        roles: (row.roles ?? []) as AppRole[],
      } as MeuPerfil;
    },
    staleTime: 60_000,
  });
}

export function hasPermission(perfil: MeuPerfil | null | undefined, key: string) {
  if (!perfil) return false;
  const valor = perfil.permissoes[key];
  // Chave fora do catálogo: mantém o comportamento antigo, ADMIN vê tudo.
  if (valor === undefined) return perfil.roles.includes("ADMIN");
  return valor === true;
}

export function hasRole(perfil: MeuPerfil | null | undefined, role: AppRole) {
  return !!perfil?.roles.includes(role);
}
