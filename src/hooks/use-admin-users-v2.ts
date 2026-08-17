import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminSendAuthEmail } from "@/lib/admin-users.functions";
import type { AppRole } from "@/hooks/use-meu-perfil";

export function useSendAuthEmail() {
  const send = useServerFn(adminSendAuthEmail);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      user_id?: string | null;
      email: string;
      tipo: "invite" | "magiclink" | "recovery";
    }) => send({ data: vars }),
    onSuccess: (_r, vars) => {
      const labels = {
        invite: "Convite enviado",
        magiclink: "Magic link enviado",
        recovery: "E-mail de recuperação de senha enviado",
      } as const;
      toast.success(`${labels[vars.tipo]} para ${vars.email}`);
      qc.invalidateQueries({ queryKey: ["admin-atividade-usuario"] });
    },
    onError: (e: Error) => toast.error("Falha ao enviar", { description: e.message }),
  });
}

export function usePreCadastrarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; full_name: string; perfil_id: string }) => {
      const { data, error } = await supabase.rpc("rpc_admin_precadastrar_usuario" as never, {
        _email: vars.email,
        _full_name: vars.full_name,
        _perfil_id: vars.perfil_id,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Usuário pré-cadastrado");
      qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
      qc.invalidateQueries({ queryKey: ["admin-convites-externos"] });
    },
    onError: (e: Error) => toast.error("Falha ao pré-cadastrar", { description: e.message }),
  });
}

export function useUpdateUserV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      user_id: string;
      full_name: string;
      perfil_id: string | null;
      blocked: boolean;
      active: boolean;
    }) => {
      const { error } = await supabase.rpc("rpc_admin_update_user_v2" as never, {
        _user_id: vars.user_id,
        _full_name: vars.full_name,
        _perfil_id: vars.perfil_id,
        _blocked: vars.blocked,
        _active: vars.active,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
    },
    onError: (e: Error) => toast.error("Falha ao atualizar", { description: e.message }),
  });
}

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
  times_receita: string[];
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
        times_receita: (r.times_receita ?? []) as string[],
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
