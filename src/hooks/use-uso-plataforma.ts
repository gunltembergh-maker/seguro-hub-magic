import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UsoResumo {
  user_id: string;
  full_name: string | null;
  email: string;
  perfil_nome: string | null;
  dias_ativos: number;
  total_paginas: number;
  tempo_total_min: number;
  primeiro_acesso: string | null;
  ultimo_acesso: string | null;
  dias_sem_acessar: number | null;
  sessoes: number;
  top_rota: string | null;
}

export interface UsoPagina {
  user_id: string;
  full_name: string | null;
  email: string;
  rota: string;
  titulo: string | null;
  acessos: number;
  tempo_min: number;
  ultimo_em: string;
  primeiro_em: string | null;
  tempo_min_seg: number;
  tempo_max_seg: number;
  tempo_medio_seg: number;
  dias: number;
}

export interface UsoDetalhe {
  user_id: string;
  full_name: string | null;
  email: string;
  perfil_nome: string | null;
  dia: string;
  rota: string;
  area: string | null;
  subpagina: string | null;
  titulo: string | null;
  entrou_em: string;
  ultimo_ping_em: string | null;
  duracao_seg: number;
}

export interface UsoDiario {
  dia: string;
  user_id: string;
  full_name: string | null;
  email: string;
  paginas: number;
  tempo_min: number;
  primeiro_em: string;
  ultimo_em: string;
  rotas: string[];
}

export interface AuditItem {
  id: string;
  ator_email: string | null;
  ator_nome: string | null;
  acao: string;
  entidade: string;
  alvo_id: string | null;
  alvo_descricao: string | null;
  mudancas: Record<string, { antes: unknown; depois: unknown }> | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  notificado_em: string | null;
  notificacao_erro: string | null;
  created_at: string;
}

const num = (v: unknown) => Number(v ?? 0);

export function useUsoResumo(de: string, ate: string) {
  return useQuery({
    queryKey: ["uso-resumo", de, ate],
    queryFn: async (): Promise<UsoResumo[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_uso_resumo" as never, { _de: de, _ate: ate } as never);
      if (error) throw error;
      return ((data as unknown as UsoResumo[]) ?? []).map((r) => ({
        ...r,
        dias_ativos: num(r.dias_ativos),
        total_paginas: num(r.total_paginas),
        tempo_total_min: num(r.tempo_total_min),
        sessoes: num(r.sessoes),
        dias_sem_acessar: r.dias_sem_acessar === null ? null : num(r.dias_sem_acessar),
      }));
    },
  });
}

export function useUsoPaginas(de: string, ate: string, userId: string | null) {
  return useQuery({
    queryKey: ["uso-paginas", de, ate, userId],
    queryFn: async (): Promise<UsoPagina[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_uso_paginas" as never, {
        _de: de, _ate: ate, _user_id: userId,
      } as never);
      if (error) throw error;
      return ((data as unknown as UsoPagina[]) ?? []).map((r) => ({
        ...r,
        acessos: num(r.acessos),
        tempo_min: num(r.tempo_min),
        tempo_min_seg: num(r.tempo_min_seg),
        tempo_max_seg: num(r.tempo_max_seg),
        tempo_medio_seg: num(r.tempo_medio_seg),
        dias: num(r.dias),
      }));
    },
  });
}

export function useUsoDetalhado(de: string, ate: string, userId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["uso-detalhado", de, ate, userId],
    enabled,
    queryFn: async (): Promise<UsoDetalhe[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_uso_detalhado" as never, {
        _de: de, _ate: ate, _user_id: userId, _limit: 20000,
      } as never);
      if (error) throw error;
      return ((data as unknown as UsoDetalhe[]) ?? []).map((r) => ({
        ...r, duracao_seg: num(r.duracao_seg),
      }));
    },
  });
}

export function useUsoDiario(de: string, ate: string, userId: string | null) {
  return useQuery({
    queryKey: ["uso-diario", de, ate, userId],
    queryFn: async (): Promise<UsoDiario[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_uso_diario" as never, {
        _de: de, _ate: ate, _user_id: userId,
      } as never);
      if (error) throw error;
      return ((data as unknown as UsoDiario[]) ?? []).map((r) => ({
        ...r, paginas: num(r.paginas), tempo_min: num(r.tempo_min), rotas: r.rotas ?? [],
      }));
    },
  });
}

export function useAuditoria(de: string, ate: string) {
  return useQuery({
    queryKey: ["admin-auditoria", de, ate],
    queryFn: async (): Promise<AuditItem[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_audit_listar" as never, {
        _de: de, _ate: ate, _limit: 500,
      } as never);
      if (error) throw error;
      return (data as unknown as AuditItem[]) ?? [];
    },
  });
}
