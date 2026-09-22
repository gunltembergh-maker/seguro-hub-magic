// Consulta a mercado (etapa 3) — leitura e lançamento manual de limites.
//
// Regras que moram aqui:
//  · A consulta vale 12 meses (valida_ate). Consulta válida não se refaz sozinha.
//  · Obrigatórias são só as 18 seguradoras com portal; as 17 sem portal são
//    opcionais e não travam nada.
//  · `nao_consultado` é falha técnica, nunca recusa — o grupo é sempre derivado
//    do status, nunca escolhido à mão.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { consultarMercadoDaDemanda } from "@/lib/garantia/garantia-mercado.functions";
import {
  grupoDoStatusMercado,
  recalcularConsulta,
  resumirConsulta,
  type LimiteLinha,
  type SeguradoraConfig,
} from "@/lib/garantia/limites-regra";

const CAMPOS_LIMITE =
  "id, consulta_id, cliente_id, chave_mercado, status_mercado, grupo_mercado, limite_total, " +
  "limite_disponivel, taxa, modalidades, data_ultimo_cadastro, nomeacao, mensagem, origem, atualizado_em";

export interface ConsultaMercado {
  id: string;
  cliente_id: string;
  demanda_id: string | null;
  consultada_em: string;
  valida_ate: string;
  origem: string;
  completa: boolean;
  total_com_limite: number;
  total_sem_limite: number;
  total_nao_consultado: number;
  capacidade_total: number;
  substituida_por_id: string | null;
}

export function useSeguradorasConfig() {
  return useQuery({
    queryKey: ["garantia", "seguradoras-config"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<SeguradoraConfig[]> => {
      const { data, error } = await supabase
        .from("garantia_seguradoras_config")
        .select("chave_mercado, rotulo, identificador_api, tem_portal, ativa_garantia, observacao")
        .order("rotulo");
      if (error) throw error;
      return (data ?? []) as SeguradoraConfig[];
    },
  });
}

/** Consulta vigente do cliente (a que não foi substituída), válida ou vencida. */
export function useConsultaAtual(clienteId: string | null, ativo: boolean) {
  return useQuery({
    queryKey: ["garantia", "consulta-mercado", clienteId],
    enabled: !!clienteId && ativo,
    queryFn: async (): Promise<ConsultaMercado | null> => {
      const { data, error } = await supabase
        .from("garantia_consultas_mercado")
        .select(
          "id, cliente_id, demanda_id, consultada_em, valida_ate, origem, completa, total_com_limite, total_sem_limite, total_nao_consultado, capacidade_total, substituida_por_id",
        )
        .eq("cliente_id", clienteId!)
        .is("substituida_por_id", null)
        .order("consultada_em", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as ConsultaMercado | null;
    },
  });
}

export function useLimitesDaConsulta(consultaId: string | null) {
  return useQuery({
    queryKey: ["garantia", "limites", consultaId],
    enabled: !!consultaId,
    queryFn: async (): Promise<LimiteLinha[]> => {
      const { data, error } = await supabase
        .from("garantia_limites_tomador")
        .select(CAMPOS_LIMITE)
        .eq("consulta_id", consultaId!);
      if (error) throw error;
      return (data ?? []) as unknown as LimiteLinha[];
    },
  });
}

function invalidarLimites(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["garantia", "limites"] });
  qc.invalidateQueries({ queryKey: ["garantia", "consulta-mercado"] });
  qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
}

/** Dispara a consulta automática (10 seguradoras com API) pela server function. */
export function useConsultarMercado() {
  const qc = useQueryClient();
  const chamar = useServerFn(consultarMercadoDaDemanda);
  return useMutation({
    mutationFn: async ({ demandaId, forcar }: { demandaId: string; forcar?: boolean }) =>
      chamar({ data: { demandaId, forcar: !!forcar } }),
    onSuccess: () => invalidarLimites(qc),
  });
}

/**
 * Abre uma consulta manual quando ainda não existe nenhuma para o cliente —
 * é o que permite lançar à mão as 8 com portal e sem API antes de qualquer
 * chamada automática.
 */
export function useAbrirConsultaManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteId, demandaId }: { clienteId: string; demandaId: string }) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("garantia_consultas_mercado")
        .insert({
          cliente_id: clienteId,
          demanda_id: demandaId,
          origem: "manual",
          criado_por: sessao.user?.id ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalidarLimites(qc),
  });
}

export interface ValoresLimiteManual {
  status_mercado: string;
  limite_total: number | null;
  taxa: number | null;
  data_ultimo_cadastro: string | null;
  nomeacao: string | null;
  mensagem: string | null;
}

/**
 * Lançamento/edição manual de uma seguradora. O grupo é derivado do status
 * (nunca escolhido): marcar falha técnica como recusa distorceria o fluxo.
 * Ao editar uma linha vinda da API, a origem daquela linha vira `manual`.
 */
export function useSalvarLimiteManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      consultaId,
      clienteId,
      demandaId,
      chaveMercado,
      valores,
    }: {
      consultaId: string;
      clienteId: string;
      demandaId: string | null;
      chaveMercado: string;
      valores: ValoresLimiteManual;
    }) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase.from("garantia_limites_tomador").upsert(
        {
          consulta_id: consultaId,
          cliente_id: clienteId,
          chave_mercado: chaveMercado,
          status_mercado: valores.status_mercado,
          grupo_mercado: grupoDoStatusMercado(valores.status_mercado),
          limite_total: valores.limite_total,
          taxa: valores.taxa,
          data_ultimo_cadastro: valores.data_ultimo_cadastro,
          nomeacao: valores.nomeacao,
          mensagem: valores.mensagem,
          origem: "manual",
          registrado_por: sessao.user?.id ?? null,
          atualizado_em: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "consulta_id,chave_mercado" },
      );
      if (error) throw error;
      return await recalcularConsulta(supabase, consultaId, demandaId);
    },
    onSuccess: () => invalidarLimites(qc),
  });
}

export { resumirConsulta };
