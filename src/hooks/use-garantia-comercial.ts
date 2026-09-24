// Time comercial de Garantia, pedido de documento ao comercial e avisos por
// pessoa (hub_notificacoes). Quem decide é o banco: RLS e RPCs.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface MembroComercial {
  user_id: string;
  ativo: boolean;
  criado_em: string;
}

export function useTimeComercial(habilitado = true) {
  return useQuery({
    queryKey: ["garantia", "time-comercial"],
    enabled: habilitado,
    queryFn: async (): Promise<MembroComercial[]> => {
      const { data, error } = await db
        .from("garantia_time_comercial")
        .select("user_id, ativo, criado_em")
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as MembroComercial[];
    },
  });
}

export function useSalvarMembroComercial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      const { data: s } = await supabase.auth.getUser();
      const { error } = await db
        .from("garantia_time_comercial")
        .upsert({ user_id: userId, ativo, criado_por: s.user?.id ?? null }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garantia", "time-comercial"] }),
  });
}

export function useSolicitarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { demandaId: string; faltando: string; observacao: string | null }) => {
      const { data, error } = await db.rpc("rpc_garantia_solicitar_documento", {
        _demanda_id: v.demandaId,
        _faltando: v.faltando,
        _observacao: v.observacao,
      });
      if (error) throw error;
      return (data ?? 0) as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garantia"] });
    },
  });
}

/** Demandas em aguard_doc_contrato que receberam anexo depois do pedido. */
export function useDocsAposPedido() {
  return useQuery({
    queryKey: ["garantia", "docs-apos-pedido"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await db.rpc("rpc_garantia_docs_apos_pedido");
      if (error) throw error;
      return new Set(((data ?? []) as (string | { rpc_garantia_docs_apos_pedido: string })[]).map((r) =>
        typeof r === "string" ? r : r.rpc_garantia_docs_apos_pedido,
      ));
    },
    refetchInterval: 60_000,
  });
}

export interface AvisoPessoal {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  criado_em: string;
}

export const CHAVE_AVISOS_PESSOAIS = ["hub-notificacoes-pessoais"] as const;

export function useAvisosPessoais() {
  return useQuery({
    queryKey: CHAVE_AVISOS_PESSOAIS,
    queryFn: async (): Promise<AvisoPessoal[]> => {
      const { data: s } = await supabase.auth.getUser();
      if (!s.user) return [];
      const { data, error } = await db
        .from("hub_notificacoes")
        .select("id, tipo, titulo, mensagem, link, lida, criado_em")
        .eq("user_id", s.user.id)
        .order("criado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AvisoPessoal[];
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export async function marcarAvisosLidos(ids: string[]) {
  if (ids.length === 0) return null;
  const { error } = await db.from("hub_notificacoes").update({ lida: true }).in("id", ids);
  return error;
}
