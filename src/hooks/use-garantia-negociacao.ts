// Pipeline de Negociação do ramo Garantia.
//
// Duas regras estruturais desta tela:
//  1. Colunas e status vêm SEMPRE de garantia_status_catalogo. Não há lista
//     fixa de status no código: status novo é INSERT no catálogo e aparece
//     sem deploy.
//  2. A interface NUNCA escreve em garantia_status_historico. O relógio é do
//     trigger do banco, que fecha o registro aberto e abre o novo quando
//     garantia_demandas.status_atual muda.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProdutoGarantia = "seguro_garantia" | "fianca_locaticia";

export interface StatusCatalogo {
  codigo: string;
  nome: string;
  etapa: string;
  fase: string;
  relogio: string;
  com_quem: string | null;
  sla_horas: number | null;
  ordem: number;
  ativo: boolean;
}

export interface DemandaLista {
  id: string;
  codigo: string | null;
  legenda: string | null;
  produto: string;
  entrada_id: string | null;
  solicitacao_id: string | null;
  fase: string;
  etapa: string;
  status_atual: string;
  triagem_completa: boolean;
  chegada_em: string;
  cadastrado_em: string;
  cadastrado_por: string | null;
  cliente_id: string;
  segurado_id: string | null;
  modalidade: string | null;
  publico_privado: string | null;
  tipo_movimento: string | null;
  tipo_alteracao: string | null;
  importancia_segurada: number | null;
  percentual_garantia: number | null;
  objeto: string | null;
  vigencia_exigida: string | null;
  data_limite: string | null;
  canal_id: string | null;
  responsavel_cliente_id: string | null;
  responsavel_tecnico_id: string | null;
  premio_estimado: number | null;
  comissao_estimada: number | null;
  numero_processo: string | null;
  observacao: string | null;
  atualizado_em: string;
  cliente: { id: string; nome: string; cpf_cnpj: string } | null;
  segurado: { id: string; nome: string; cpf_cnpj: string } | null;
  canal: { id: string; nome: string } | null;
}

const CAMPOS_DEMANDA =
  "id, codigo, legenda, produto, entrada_id, solicitacao_id, fase, etapa, status_atual, triagem_completa, " +
  "chegada_em, cadastrado_em, cadastrado_por, cliente_id, segurado_id, modalidade, publico_privado, " +
  "tipo_movimento, tipo_alteracao, importancia_segurada, percentual_garantia, objeto, vigencia_exigida, " +
  "data_limite, canal_id, responsavel_cliente_id, responsavel_tecnico_id, premio_estimado, comissao_estimada, " +
  "numero_processo, observacao, atualizado_em, " +
  "cliente:hub_clientes(id, nome, cpf_cnpj), segurado:garantia_segurados(id, nome, cpf_cnpj), canal:canais(id, nome)";

/** Catálogo de status da fase de negociação — origem única das colunas. */
export function useStatusNegociacao() {
  return useQuery({
    queryKey: ["garantia", "status-catalogo", "negociacao"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<StatusCatalogo[]> => {
      const { data, error } = await supabase
        .from("garantia_status_catalogo")
        .select("codigo, nome, etapa, fase, relogio, com_quem, sla_horas, ordem, ativo")
        .eq("fase", "negociacao")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as StatusCatalogo[];
    },
  });
}

/**
 * Colunas do quadro, deduzidas do catálogo (nunca de lista fixa).
 * Status de etapa "qualquer" não vira coluna: ele acontece dentro da etapa
 * em que a demanda já está.
 */
export function colunasDoCatalogo(catalogo: StatusCatalogo[]) {
  const mapa = new Map<string, { etapa: string; ordem: number; status: StatusCatalogo[] }>();
  for (const s of catalogo) {
    if (s.etapa === "qualquer") continue;
    const atual = mapa.get(s.etapa);
    if (atual) {
      atual.status.push(s);
      atual.ordem = Math.min(atual.ordem, s.ordem);
    } else {
      mapa.set(s.etapa, { etapa: s.etapa, ordem: s.ordem, status: [s] });
    }
  }
  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem);
}

export interface FiltrosNegociacao {
  produto?: string;
  modalidade?: string;
  responsavel_tecnico_id?: string;
  canal_id?: string;
  busca?: string;
}

export function useDemandasNegociacao(filtros: FiltrosNegociacao) {
  return useQuery({
    queryKey: ["garantia", "demandas", "negociacao", filtros],
    queryFn: async (): Promise<DemandaLista[]> => {
      let q = supabase
        .from("garantia_demandas")
        .select(CAMPOS_DEMANDA)
        .eq("fase", "negociacao")
        .order("cadastrado_em", { ascending: false })
        .limit(500);
      if (filtros.produto) q = q.eq("produto", filtros.produto);
      if (filtros.modalidade) q = q.eq("modalidade", filtros.modalidade);
      if (filtros.responsavel_tecnico_id) q = q.eq("responsavel_tecnico_id", filtros.responsavel_tecnico_id);
      if (filtros.canal_id) q = q.eq("canal_id", filtros.canal_id);
      const { data, error } = await q;
      if (error) throw error;
      const linhas = (data ?? []) as unknown as DemandaLista[];
      const busca = (filtros.busca ?? "").trim().toLowerCase();
      if (!busca) return linhas;
      return linhas.filter(
        (d) =>
          d.cliente?.nome.toLowerCase().includes(busca) ||
          (d.cliente?.cpf_cnpj ?? "").includes(busca.replace(/\D+/g, "")),
      );
    },
  });
}

export interface PerdaLista {
  id: string;
  demanda_id: string;
  motivo: string;
  etapa_perdida: string;
  status_perdido: string | null;
  premio_estimado: number | null;
  comissao_estimada: number | null;
  concorrente: string | null;
  data_retomar: string | null;
  observacao: string | null;
  reaberta_em: string | null;
  reaberta_por: string | null;
  criado_em: string;
  demanda: DemandaLista | null;
}

export interface FiltrosPerdas {
  motivo?: string;
  de?: string;
  ate?: string;
}

export function usePerdas(filtros: FiltrosPerdas, ativo: boolean) {
  return useQuery({
    queryKey: ["garantia", "perdas", filtros],
    enabled: ativo,
    queryFn: async (): Promise<PerdaLista[]> => {
      let q = supabase
        .from("garantia_perdas")
        .select(
          `id, demanda_id, motivo, etapa_perdida, status_perdido, premio_estimado, comissao_estimada,
           concorrente, data_retomar, observacao, reaberta_em, reaberta_por, criado_em,
           demanda:garantia_demandas(${CAMPOS_DEMANDA})`,
        )
        .order("criado_em", { ascending: false })
        .limit(300);
      if (filtros.motivo) q = q.eq("motivo", filtros.motivo);
      if (filtros.de) q = q.gte("criado_em", filtros.de);
      if (filtros.ate) q = q.lte("criado_em", filtros.ate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PerdaLista[];
    },
  });
}

export interface HistoricoItem {
  id: string;
  status_codigo: string;
  relogio: string;
  com_quem: string | null;
  inicio: string;
  fim: string | null;
  duracao_segundos: number | null;
  observacao: string | null;
}

export function useHistoricoDemanda(demandaId: string | null) {
  return useQuery({
    queryKey: ["garantia", "historico", demandaId],
    enabled: !!demandaId,
    queryFn: async (): Promise<HistoricoItem[]> => {
      const { data, error } = await supabase
        .from("garantia_status_historico")
        .select("id, status_codigo, relogio, com_quem, inicio, fim, duracao_segundos, observacao")
        .eq("demanda_id", demandaId!)
        .order("inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HistoricoItem[];
    },
  });
}

export interface OrigemEntrada {
  id: string;
  protocolo: string;
  chegada_em: string;
  origem: string;
  assunto: string | null;
  registrado_em: string;
  registrado_por: string | null;
  canal: { id: string; nome: string } | null;
}

export function useOrigemDaDemanda(entradaId: string | null) {
  return useQuery({
    queryKey: ["garantia", "origem", entradaId],
    enabled: !!entradaId,
    queryFn: async (): Promise<OrigemEntrada | null> => {
      const { data, error } = await supabase
        .from("hub_entradas")
        .select("id, protocolo, chegada_em, origem, assunto, registrado_em, registrado_por, canal:canais(id, nome)")
        .eq("id", entradaId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as OrigemEntrada | null;
    },
  });
}

export interface SeguradoHub {
  id: string;
  tipo_pessoa: string;
  cpf_cnpj: string;
  nome: string;
  publico_privado: string | null;
}

export function useBuscaSegurados(termo: string) {
  const busca = termo.trim();
  return useQuery({
    queryKey: ["garantia", "segurados", busca],
    enabled: busca.length >= 2,
    queryFn: async (): Promise<SeguradoHub[]> => {
      const digitos = busca.replace(/\D+/g, "");
      const filtros = [`nome.ilike.%${busca}%`];
      if (digitos.length >= 3) filtros.push(`cpf_cnpj.like.${digitos}%`);
      const { data, error } = await supabase
        .from("garantia_segurados")
        .select("id, tipo_pessoa, cpf_cnpj, nome, publico_privado")
        .or(filtros.join(","))
        .order("nome")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SeguradoHub[];
    },
  });
}

export function useCriarSegurado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valores: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("garantia_segurados")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(valores as any)
        .select("id, tipo_pessoa, cpf_cnpj, nome, publico_privado")
        .single();
      if (error) throw error;
      return data as SeguradoHub;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garantia", "segurados"] }),
  });
}

function invalidarPipeline(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
  qc.invalidateQueries({ queryKey: ["garantia", "perdas"] });
  qc.invalidateQueries({ queryKey: ["garantia", "historico"] });
}

/** Grava campos da demanda. Só garantia_demandas — o histórico é do trigger. */
export function useAtualizarDemanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("garantia_demandas")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(valores as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

/**
 * Travas de negócio da movimentação. Devolve a mensagem do impedimento
 * (explicando o motivo) ou null quando a transição é permitida.
 */
export function impedimentoDaTransicao(
  demanda: DemandaLista,
  destino: StatusCatalogo,
): string | null {
  if (!demanda.triagem_completa && destino.codigo !== demanda.status_atual) {
    return "A triagem ainda não foi completada. Use “Completar triagem” no detalhe da demanda: sem os dados da etapa 1 as etapas seguintes não têm o que analisar.";
  }
  const etapaDestino = destino.etapa === "qualquer" ? demanda.etapa : destino.etapa;

  if (demanda.produto === "fianca_locaticia" && etapaDestino === "3") {
    return "Fiança locatícia não passa por consulta a mercado: as APIs das seguradoras não atendem esse produto. Da análise técnica ela segue direto para a cotação.";
  }
  if (etapaDestino === "3b" && !["3", "3b"].includes(demanda.etapa)) {
    return "Os documentos de cadastro só são pedidos depois da consulta a mercado (etapa 3). Leve a demanda à consulta antes.";
  }
  if (etapaDestino === "5") {
    const faltando: string[] = [];
    if (demanda.importancia_segurada == null) faltando.push("importância segurada");
    if (!demanda.data_limite) faltando.push("data limite");
    if (faltando.length) {
      return `Para montar a proposta faltam: ${faltando.join(" e ")}. Preencha na aba Dados do detalhe da demanda.`;
    }
  }
  return null;
}

export function useTrocarStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demanda,
      destino,
    }: {
      demanda: DemandaLista;
      destino: StatusCatalogo;
    }) => {
      const impedimento = impedimentoDaTransicao(demanda, destino);
      if (impedimento) throw new Error(impedimento);
      const { error } = await supabase
        .from("garantia_demandas")
        .update({
          status_atual: destino.codigo,
          etapa: destino.etapa === "qualquer" ? demanda.etapa : destino.etapa,
          fase: destino.fase,
        })
        .eq("id", demanda.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

export interface DadosTriagem {
  segurado_id: string | null;
  publico_privado: string | null;
  modalidade: string | null;
  tipo_movimento: string | null;
  tipo_alteracao: string | null;
  importancia_segurada: number | null;
  percentual_garantia: number | null;
  objeto: string | null;
  vigencia_exigida: string | null;
  data_limite: string | null;
  responsavel_cliente_id: string | null;
  responsavel_tecnico_id: string | null;
}

/**
 * Fecha a triagem: grava os campos, marca triagem_completa e leva a demanda
 * à análise técnica (etapa 2). Nada é escrito no histórico pela interface.
 */
export function useCompletarTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosTriagem }) => {
      const { error } = await supabase
        .from("garantia_demandas")
        .update({
          ...dados,
          triagem_completa: true,
          fase: "negociacao",
          etapa: "2",
          status_atual: "analise_tecnica",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

export const MOTIVOS_PERDA: { codigo: string; rotulo: string }[] = [
  { codigo: "preco_taxa", rotulo: "Preço/taxa" },
  { codigo: "seguradoras_recusaram", rotulo: "Seguradoras recusaram ou sem limite" },
  { codigo: "documentacao_nao_veio", rotulo: "Documentação não veio" },
  { codigo: "cliente_perdeu_licitacao", rotulo: "Cliente perdeu a licitação" },
  { codigo: "fechou_outro_corretor", rotulo: "Fechou com outro corretor" },
  { codigo: "nomeado_outro_corretor", rotulo: "Nomeado com outro corretor" },
  { codigo: "prazo_nao_atendido", rotulo: "Prazo não atendido" },
  { codigo: "sem_retorno_cliente", rotulo: "Sem retorno do cliente" },
  { codigo: "desistiu_apos_aceite", rotulo: "Desistiu depois do aceite" },
];

export const rotuloMotivoPerda = (codigo: string) =>
  MOTIVOS_PERDA.find((m) => m.codigo === codigo)?.rotulo ?? codigo;

export interface NovaPerda {
  motivo: string;
  premio_estimado: number | null;
  comissao_estimada: number | null;
  concorrente: string | null;
  data_retomar: string | null;
  observacao: string | null;
}

/**
 * Perdido é estado, não exclusão: grava a linha em garantia_perdas e muda a
 * fase da demanda. Nenhum registro é apagado.
 */
export function useRegistrarPerda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demanda, perda }: { demanda: DemandaLista; perda: NovaPerda }) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error: erroPerda } = await supabase.from("garantia_perdas").insert({
        demanda_id: demanda.id,
        motivo: perda.motivo,
        etapa_perdida: demanda.etapa,
        status_perdido: demanda.status_atual,
        premio_estimado: perda.premio_estimado,
        comissao_estimada: perda.comissao_estimada,
        concorrente: perda.concorrente,
        data_retomar: perda.data_retomar,
        observacao: perda.observacao,
        criado_por: sessao.user?.id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (erroPerda) throw erroPerda;

      const { error: erroDemanda } = await supabase
        .from("garantia_demandas")
        .update({ fase: "perdida" })
        .eq("id", demanda.id);
      if (erroDemanda) throw erroDemanda;
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

/**
 * Reabre: a demanda volta à negociação na etapa em que estava e a linha da
 * perda ganha o carimbo de reabertura. A perda não é deletada — ela é o
 * histórico de que aquilo já foi perdido uma vez.
 */
export function useReabrirPerda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (perda: PerdaLista) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error: erroDemanda } = await supabase
        .from("garantia_demandas")
        .update({
          fase: "negociacao",
          etapa: perda.etapa_perdida,
          status_atual: perda.status_perdido ?? "triagem",
        })
        .eq("id", perda.demanda_id);
      if (erroDemanda) throw erroDemanda;

      const { error: erroPerda } = await supabase
        .from("garantia_perdas")
        .update({ reaberta_em: new Date().toISOString(), reaberta_por: sessao.user?.id ?? null })
        .eq("id", perda.id);
      if (erroPerda) throw erroPerda;
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

/**
 * Início do status atual de cada demanda, lido do registro em aberto do
 * histórico. Só é consultado para quem tem `menu_garantia_painel`: sem essa
 * permissão a tela não mostra tempo nenhum, então nem busca.
 */
export function useInicioDoStatus(ativo: boolean) {
  return useQuery({
    queryKey: ["garantia", "historico", "abertos"],
    enabled: ativo,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("garantia_status_historico")
        .select("demanda_id, inicio")
        .is("fim", null)
        .limit(1000);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const linha of data ?? []) mapa[linha.demanda_id as string] = linha.inicio as string;
      return mapa;
    },
  });
}
