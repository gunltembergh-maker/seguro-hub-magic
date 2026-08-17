import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, type AppRole, type MeuPerfil } from "@/hooks/use-meu-perfil";

const STORAGE_KEY = "lavoro:view-as:user-id";

export interface ViewAsProfile {
  user_id: string;
  full_name: string;
  email: string;
  perfil_nome: string | null;
  permissoes: Record<string, boolean>;
  roles: AppRole[];
}

interface ViewAsContextType {
  /** Perfil real do admin logado */
  realPerfil: MeuPerfil | null | undefined;
  /** Só é preenchido quando um admin escolheu ver como outro usuário */
  viewAsUserId: string | null;
  viewAsProfile: ViewAsProfile | null;
  setViewAs: (userId: string | null) => void;
  /** Perfil efetivo: real OU o do usuário visualizado */
  effectivePerfil: MeuPerfil | null;
  effectiveRole: AppRole | null;
  effectivePermissoes: Record<string, boolean>;
  isImpersonating: boolean;
  isAdmin: boolean;
}

const ViewAsContext = createContext<ViewAsContextType>({
  realPerfil: null,
  viewAsUserId: null,
  viewAsProfile: null,
  setViewAs: () => {},
  effectivePerfil: null,
  effectiveRole: null,
  effectivePermissoes: {},
  isImpersonating: false,
  isAdmin: false,
});

function readInitial(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { data: realPerfil } = useMeuPerfil();
  const isAdmin = !!realPerfil?.roles?.includes("ADMIN");

  const [viewAsUserId, setViewAsUserId] = useState<string | null>(() => readInitial());

  // Não permite impersonation por não-admin, nem impersonar a si mesmo
  useEffect(() => {
    if (!isAdmin && viewAsUserId) setViewAsUserId(null);
    if (isAdmin && viewAsUserId && realPerfil?.user_id === viewAsUserId) setViewAsUserId(null);
  }, [isAdmin, viewAsUserId, realPerfil?.user_id]);

  const setViewAs = useCallback((userId: string | null) => {
    setViewAsUserId(userId);
    try {
      if (userId) window.sessionStorage.setItem(STORAGE_KEY, userId);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const { data: viewAsProfile } = useQuery({
    queryKey: ["view-as-perfil", viewAsUserId],
    enabled: !!viewAsUserId && isAdmin,
    staleTime: 60_000,
    queryFn: async (): Promise<ViewAsProfile | null> => {
      if (!viewAsUserId) return null;
      const { data, error } = await supabase.rpc("rpc_admin_perfil_by_user_id" as never, {
        _user_id: viewAsUserId,
      } as never);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        user_id: row.user_id,
        full_name: row.full_name ?? row.email ?? "Usuário",
        email: row.email,
        perfil_nome: row.perfil_nome ?? null,
        permissoes: (row.permissoes ?? {}) as Record<string, boolean>,
        roles: (row.roles ?? []) as AppRole[],
      };
    },
  });

  const value = useMemo<ViewAsContextType>(() => {
    const isImpersonating = !!viewAsUserId && !!viewAsProfile && isAdmin;
    const effectivePerfil: MeuPerfil | null = isImpersonating
      ? {
          user_id: viewAsProfile!.user_id,
          full_name: viewAsProfile!.full_name,
          email: viewAsProfile!.email,
          blocked: false,
          active: true,
          primeiro_acesso: false,
          perfil_id: null,
          perfil_nome: viewAsProfile!.perfil_nome,
          permissoes: viewAsProfile!.permissoes,
          roles: viewAsProfile!.roles,
          times_receita: [],
        }
      : (realPerfil ?? null);

    const effectiveRole: AppRole | null =
      effectivePerfil?.roles?.[0] ?? (effectivePerfil ? "COLABORADOR" : null);

    return {
      realPerfil,
      viewAsUserId,
      viewAsProfile: viewAsProfile ?? null,
      setViewAs,
      effectivePerfil,
      effectiveRole,
      effectivePermissoes: effectivePerfil?.permissoes ?? {},
      isImpersonating,
      isAdmin,
    };
  }, [realPerfil, viewAsUserId, viewAsProfile, setViewAs, isAdmin]);

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs() {
  return useContext(ViewAsContext);
}

/** Perfil efetivo (real ou impersonado) — use no lugar de useMeuPerfil para gates de UI. */
export function useMeuPerfilEfetivo(): MeuPerfil | null {
  return useContext(ViewAsContext).effectivePerfil;
}
