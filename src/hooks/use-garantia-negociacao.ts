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
import { pendenciasAnaliseDemanda, pendenciasEtapa3b } from "@/lib/garantia/documentos-regra";
// Só o tipo: o contexto do CRM é carregado pelo hook do CRM, que por sua vez
// reusa `carregarTiposPresentes` daqui. Import de tipo não cria ciclo.
import type { ContextoCrm } from "@/hooks/use-garantia-crm";


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
  numero: string;
  legenda_manual: boolean;
  numero_contrato: string | null;
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
  exige_cadastro: boolean;
  balancos_assinados: boolean | null;
  dre_assinados: boolean | null;
  precisa_nomeacao: boolean;
  precisa_ccg: boolean;
  ia_analise_solicitada: boolean;
  cadastro_dispensado_motivo: string | null;
  cadastro_dispensado_por: string | null;
  cadastro_dispensado_em: string | null;
  /** Linhas do cosseguro (só a IS) — a soma decide a saída B do cadastro. */
  cosseguro?: { importancia_segurada: number }[] | null;

  atualizado_em: string;
  cliente: { id: string; nome: string; cpf_cnpj: string } | null;
  segurado: { id: string; nome: string; cpf_cnpj: string } | null;
  canal: { id: string; nome: string } | null;
}

const CAMPOS_DEMANDA =
  "id, codigo, numero, legenda, legenda_manual, numero_contrato, produto, entrada_id, solicitacao_id, fase, etapa, status_atual, triagem_completa, " +
  "chegada_em, cadastrado_em, cadastrado_por, cliente_id, segurado_id, modalidade, publico_privado, " +
  "tipo_movimento, tipo_alteracao, importancia_segurada, percentual_garantia, objeto, vigencia_exigida, " +
  "data_limite, canal_id, responsavel_cliente_id, responsavel_tecnico_id, premio_estimado, comissao_estimada, " +
  "numero_processo, observacao, atualizado_em, exige_cadastro, balancos_assinados, dre_assinados, " +
  "precisa_nomeacao, precisa_ccg, ia_analise_solicitada, " +
  "cadastro_dispensado_motivo, cadastro_dispensado_por, cadastro_dispensado_em, " +
  "cosseguro:garantia_cosseguro(importancia_segurada), " +

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
  return [...mapa.values()]
    .sort((a, b) => a.ordem - b.ordem)
    .map((c, i) => {
      const status = [...c.status].sort((a, b) => a.ordem - b.ordem);
      return {
        ...c,
        status,
        /** Número mostrado ao usuário: posição na ordem do catálogo. */
        posicao: i + 1,
        /** Status interno de entrada: relogio interno com a menor ordem. */
        entrada: status.find((s) => s.relogio === "interno") ?? status[0] ?? null,
      };
    });
}

export interface FiltrosNegociacao {
  produto?: string;
  modalidade?: string;
  responsavel_tecnico_id?: string;
  canal_id?: string;
  busca?: string;
  /** Fase do quadro. Sem valor, a lista é a da negociação. */
  fase?: string;
}

export function useDemandasNegociacao(filtros: FiltrosNegociacao) {
  return useQuery({
    queryKey: ["garantia", "demandas", "negociacao", filtros],
    queryFn: async (): Promise<DemandaLista[]> => {
      let q = supabase
        .from("garantia_demandas")
        .select(CAMPOS_DEMANDA)
        .eq("fase", filtros.fase ?? "negociacao")
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
  status_nome: string | null;
  relogio: string;
  com_quem: string | null;
  inicio: string;
  fim: string | null;
  duracao_segundos: number | null;
  observacao: string | null;
}

/**
 * A linha do tempo vem de um RPC, não da tabela: a leitura direta de
 * `garantia_status_historico` é restrita a quem tem o painel. O RPC devolve a
 * sequência de status para quem opera o pipeline e só entrega
 * `duracao_segundos` para a gerência — o portão é o banco, não a tela.
 */
export function useHistoricoDemanda(demandaId: string | null) {
  return useQuery({
    queryKey: ["garantia", "historico", demandaId],
    enabled: !!demandaId,
    queryFn: async (): Promise<HistoricoItem[]> => {
      const { data, error } = await supabase.rpc("rpc_garantia_historico_demanda", {
        _demanda_id: demandaId!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      return (data ?? []) as unknown as HistoricoItem[];
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

/** Situação da consulta a mercado do cliente, usada pela trava da etapa 3. */
export interface ContextoMercado {
  consultaValida: boolean;
  completa: boolean;
  /** Nomes das seguradoras com portal que ainda não têm resposta registrada. */
  faltantes: string[];
}

/**
 * Travas de negócio da movimentação. Devolve a mensagem do impedimento
 * (explicando o motivo) ou null quando a transição é permitida.
 *
 * `contexto` só é conhecido depois de ler a consulta a mercado do cliente.
 * Quando não é informado (pré-checagem na tela), a trava da etapa 3 não é
 * avaliada aqui — quem sempre avalia é useTrocarStatus, que busca o contexto
 * antes de gravar.
 */
export function impedimentoDaTransicao(
  demanda: DemandaLista,
  destino: StatusCatalogo,
  contexto?: ContextoMercado,
  /** Tipos de documento com versão vigente na demanda (checklists das etapas 2 e 3b). */
  tiposPresentes?: Set<string>,
  /** Cotação escolhida, minuta e aprovações — travas das etapas 4, 6 e 7. */
  crm?: ContextoCrm,
  /** Status atual no catálogo — sua `ordem` decide se o movimento é retorno. */
  origem?: StatusCatalogo,
): string | null {
  // REGRA: TRAVA É PARA AVANÇO; VOLTAR É LIVRE, PORQUE VOLTAR É COMO SE CONSERTA.
  // Retorno = destino.ordem < origem.ordem (a ordem do catálogo já codifica
  // a sequência inteira, inclusive a 3b). Num retorno NÃO se avalia nenhuma
  // trava de "sair da etapa" (mercado completo, cotação escolhida, checklists
  // das etapas 2/3b/6, minuta/aprovações, IS e data limite para a etapa 5).
  // Valem em qualquer direção só as regras de coerência do fluxo: triagem
  // incompleta, fiança nunca na etapa 3, entrada no CRM só pelo aceite e
  // volta do CRM só por pedido aprovado pelo admin.
  const retorno = !!origem && destino.ordem < origem.ordem;

  // O aceite não é troca de status: ele é o RPC que gera o código GAR-xxxxx.
  // Arrastar o cartão para o CRM pularia a geração do código.
  if (demanda.fase !== "crm" && destino.fase === "crm") {
    return "A entrada no CRM é feita pelo botão “Registrar aceite do cliente”, no detalhe da demanda: é ele que gera o código GAR e garante que não saiam dois códigos para o mesmo caso.";
  }
  if (demanda.fase === "crm" && destino.fase === "negociacao") {
    return "Esta demanda já foi aceita pelo cliente e está no CRM. A volta para a negociação é pedida pelo botão “Solicitar volta para a negociação” e decidida por um administrador.";
  }

  const etapaDestino = destino.etapa === "qualquer" ? demanda.etapa : destino.etapa;
  if (!demanda.triagem_completa && etapaDestino !== demanda.etapa) {
    return "A conferência dos dados ainda não foi feita. Use “Conferir dados da demanda” na análise da demanda: sem esses dados as etapas seguintes não têm o que analisar.";
  }

  if (demanda.produto === "fianca_locaticia" && etapaDestino === "3") {
    return "Fiança locatícia não passa por consulta a mercado: as APIs das seguradoras não atendem esse produto. Da análise da demanda ela segue direto para a cotação.";
  }
  if (retorno) return null;
  if (etapaDestino === "3b" && !["3", "3b"].includes(demanda.etapa)) {
    return "Os documentos de cadastro só são pedidos depois da consulta a mercado. Leve a demanda à consulta antes.";
  }
  // Sair da consulta a mercado exige consulta válida e completa. Fiança
  // locatícia nem passa pela etapa 3, então não é alcançada por esta regra.
  if (
    demanda.produto !== "fianca_locaticia" &&
    demanda.etapa === "3" &&
    etapaDestino !== "3" &&
    contexto
  ) {
    if (!contexto.consultaValida) {
      return "A consulta a mercado deste cliente não existe ou já venceu (ela vale 12 meses). Refaça a consulta na aba Limites antes de avançar.";
    }
    if (!contexto.completa) {
      const qtd = contexto.faltantes.length;
      return `Faltam ${qtd} das 18 seguradoras com portal sem resposta registrada: ${contexto.faltantes.join(", ")}. Lance o resultado delas na aba Limites para avançar.`;
    }
  }
  // Checklists de documento das etapas 2 e 3b. Só travam o que uma condição
  // explícita tornou obrigatório — a mensagem diz o documento E a condição.
  if (tiposPresentes && demanda.etapa !== etapaDestino) {
    const bloqueio = pendenciasDaEtapa(demanda, tiposPresentes, demanda.etapa).find((p) => p.bloqueia);
    if (bloqueio) return `${bloqueio.texto} Motivo: ${bloqueio.motivo}.`;
  }
  if (etapaDestino === "5") {
    const faltando: string[] = [];
    if (demanda.importancia_segurada == null) faltando.push("importância segurada");
    // Data limite não trava mais: vem da leitura do edital e é editável na aba Dados.
    if (faltando.length) {
      return `Para montar a proposta faltam: ${faltando.join(" e ")}. Preencha na aba Dados do detalhe da demanda.`;
    }
  }

  if (crm && demanda.etapa !== etapaDestino) {
    // Etapa 4: a proposta é montada em cima da cotação aceita.
    if (demanda.etapa === "4" && !crm.temCotacaoEscolhida) {
      return "Nenhuma cotação foi marcada como escolhida. Lance as cotações recebidas na aba Cotações e marque a aceita: é ela que define prêmio e comissão da proposta.";
    }
    // Etapa 7: minuta e aprovações antes da emissão.
    if (demanda.etapa === "7") {
      if (!crm.temMinuta) {
        return "A minuta ainda não foi anexada. Anexe o documento do tipo Minuta na aba Documentos: sem o texto conferido a emissão não pode ser pedida.";
      }
      if (!crm.aprovouCliente) {
        return "Falta registrar a aprovação da minuta pelo cliente (data e forma), na aba Minuta. Motivo: a emissão só é pedida com o texto aprovado por quem contrata.";
      }
      if (crm.seguradoExigeTexto && !crm.aprovouSegurado) {
        return "Falta o aceite do texto pelo segurado, na aba Minuta. Motivo: este segurado está cadastrado como exigindo texto próprio, então a apólice só é emitida com o aceite dele.";
      }
    }
  }
  return null;
}

export const totalCosseguro = (d: { cosseguro?: { importancia_segurada: number }[] | null }) =>
  (d.cosseguro ?? []).reduce((s, c) => s + Number(c.importancia_segurada ?? 0), 0);

/** Pendências de documento da etapa em que a demanda está hoje. */
function pendenciasDaEtapa(demanda: DemandaLista, tipos: Set<string>, etapa: string) {
  const alvo = {
    produto: demanda.produto,
    exige_cadastro: demanda.exige_cadastro,
    balancos_assinados: demanda.balancos_assinados,
    dre_assinados: demanda.dre_assinados,
    precisa_nomeacao: demanda.precisa_nomeacao,
    precisa_ccg: demanda.precisa_ccg,
    importancia_segurada: demanda.importancia_segurada,
    cosseguro_total: totalCosseguro(demanda),
    cadastro_dispensado_motivo: demanda.cadastro_dispensado_motivo,
  };
  if (etapa === "1" || etapa === "2") return pendenciasAnaliseDemanda(alvo, tipos);
  if (etapa === "3b") return pendenciasEtapa3b(alvo, tipos);
  // Etapa 6 (curadoria): a única exigência documental é o CCG, e só quando o
  // caso foi marcado como precisando dele. Reusa a MESMA função da etapa 3b.
  if (etapa === "6") return pendenciasEtapa3b(alvo, tipos).filter((p) => p.texto.includes("CCG"));
  return [];
}

/** Tipos de documento com versão vigente — alimenta os checklists na gravação. */
export async function carregarTiposPresentes(demandaId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("garantia_documentos")
    .select("tipo, substituido_por_id")
    .eq("demanda_id", demandaId);
  return new Set((data ?? []).filter((d) => !d.substituido_por_id).map((d) => d.tipo));
}


/** Lê a consulta a mercado vigente do cliente para alimentar a trava da etapa 3. */
export async function carregarContextoMercado(clienteId: string): Promise<ContextoMercado> {
  const { resumirConsulta } = await import("@/lib/garantia/limites-regra");
  const { data: consultas } = await supabase
    .from("garantia_consultas_mercado")
    .select("id, valida_ate")
    .eq("cliente_id", clienteId)
    .is("substituida_por_id", null)
    .order("consultada_em", { ascending: false })
    .limit(1);
  const consulta = consultas?.[0];
  if (!consulta || new Date(consulta.valida_ate).getTime() <= Date.now()) {
    return { consultaValida: false, completa: false, faltantes: [] };
  }
  const [{ data: config }, { data: limites }] = await Promise.all([
    supabase
      .from("garantia_seguradoras_config")
      .select("chave_mercado, rotulo, identificador_api, tem_portal, ativa_garantia, observacao"),
    supabase
      .from("garantia_limites_tomador")
      .select("id, consulta_id, cliente_id, chave_mercado, status_mercado, grupo_mercado, limite_total, limite_disponivel, taxa, modalidades, data_ultimo_cadastro, nomeacao, mensagem, origem, atualizado_em")
      .eq("consulta_id", consulta.id),
  ]);
  const resumo = resumirConsulta(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (limites ?? []) as any,
  );
  return { consultaValida: true, completa: resumo.completa, faltantes: resumo.faltantes };
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
      const etapaDestino = destino.etapa === "qualquer" ? demanda.etapa : destino.etapa;
      const origem = await carregarStatusCatalogo(demanda.status_atual);
      const retorno = !!origem && destino.ordem < origem.ordem;
      const mudaEtapa = etapaDestino !== demanda.etapa;
      if (retorno && mudaEtapa) {
        throw new Error("Voltar de etapa exige motivo: use o botão do destino no detalhe da demanda.");
      }
      const precisaMercado =
        !retorno && demanda.produto !== "fianca_locaticia" && demanda.etapa === "3" && etapaDestino !== "3";
      const contexto = precisaMercado ? await carregarContextoMercado(demanda.cliente_id) : undefined;
      const tipos = mudaEtapa && !retorno ? await carregarTiposPresentes(demanda.id) : undefined;
      // Cotação escolhida, minuta e aprovações: só é lido quando a etapa avança.
      const crm = mudaEtapa && !retorno
        ? await (await import("@/hooks/use-garantia-crm")).carregarContextoCrm(demanda)
        : undefined;
      const impedimento = impedimentoDaTransicao(demanda, destino, contexto, tipos, crm, origem ?? undefined);
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
  data_limite?: string | null;
  responsavel_cliente_id?: string | null;
  responsavel_tecnico_id: string | null;
}

/**
 * Fecha a conferência dos dados: grava os campos e marca triagem_completa.
 * NÃO muda de etapa — quem move é a pessoa, pelo botão de destino.
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
      // Upsert, não insert: `demanda_id` é unique. Se a perda gravar e o UPDATE
      // da fase falhar, a demanda fica em negociação com a linha já criada — a
      // retentativa tem que atualizar a linha existente, não colidir na chave.
      const { error: erroPerda } = await supabase.from("garantia_perdas").upsert(
        {
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
        } as any,
        { onConflict: "demanda_id" },
      );
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

      // A demanda já foi reaberta acima. Se o carimbo falhar, o que se perdeu
      // foi o registro de reabertura — não a reabertura. Propagar o erro faria
      // o usuário tentar de novo e reabrir duas vezes.
      const { error: erroPerda } = await supabase
        .from("garantia_perdas")
        .update({ reaberta_em: new Date().toISOString(), reaberta_por: sessao.user?.id ?? null })
        .eq("id", perda.id);
      if (erroPerda) {
        console.error("Demanda reaberta, mas o carimbo de reabertura não foi gravado:", erroPerda);
      }
      return { carimboGravado: !erroPerda };
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

/**
 * Início do status atual de cada demanda, lido do RPC dos status em aberto. O
 * RPC só devolve linhas para quem tem `menu_garantia_painel` — o `enabled`
 * abaixo é conveniência; o portão é o banco.
 */
export function useInicioDoStatus(ativo: boolean) {
  return useQuery({
    queryKey: ["garantia", "historico", "abertos"],
    enabled: ativo,
    queryFn: async (): Promise<Record<string, string>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("rpc_garantia_status_abertos");
      if (error) throw error;

      const mapa: Record<string, string> = {};
      for (const linha of data ?? []) mapa[linha.demanda_id as string] = linha.inicio as string;
      return mapa;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Retornos                                                           */
/* ------------------------------------------------------------------ */

/** Linha do catálogo de um status — a `ordem` decide se o movimento é retorno. */
export async function carregarStatusCatalogo(codigo: string): Promise<StatusCatalogo | null> {
  const { data } = await supabase
    .from("garantia_status_catalogo")
    .select("codigo, nome, etapa, fase, relogio, com_quem, sla_horas, ordem, ativo")
    .eq("codigo", codigo)
    .maybeSingle();
  return (data as StatusCatalogo | null) ?? null;
}

/** Retorno de etapa: exige motivo, que vai para a observação do histórico. */
export function useVoltarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandaId, destino, motivo }: { demandaId: string; destino: string; motivo: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("rpc_garantia_voltar_etapa", {
        _demanda_id: demandaId,
        _status_destino: destino,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

export interface RetornoSolicitacao {
  id: string;
  demanda_id: string;
  motivo: string;
  situacao: "pendente" | "aprovada" | "recusada";
  solicitado_por: string | null;
  solicitado_em: string;
  demanda?: { legenda: string | null; codigo: string | null } | null;
}

/** Pedidos pendentes de volta do CRM (opcionalmente de uma demanda). */
export function useRetornosPendentes(demandaId?: string | null, habilitado = true) {
  return useQuery({
    queryKey: ["garantia", "retornos", demandaId ?? "todos"],
    enabled: habilitado,
    queryFn: async (): Promise<RetornoSolicitacao[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from as any)("garantia_retorno_solicitacoes")
        .select("id, demanda_id, motivo, situacao, solicitado_por, solicitado_em, demanda:garantia_demandas(legenda, codigo)")
        .eq("situacao", "pendente")
        .order("solicitado_em");
      if (demandaId) q = q.eq("demanda_id", demandaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RetornoSolicitacao[];
    },
  });
}

export function useSolicitarRetorno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandaId, motivo }: { demandaId: string; motivo: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("rpc_garantia_solicitar_retorno", {
        _demanda_id: demandaId,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garantia", "retornos"] }),
  });
}

export function useDecidirRetorno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aprovar, resposta }: { id: string; aprovar: boolean; resposta: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("rpc_garantia_decidir_retorno", {
        _solicitacao_id: id,
        _aprovar: aprovar,
        _resposta: resposta,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garantia", "retornos"] });
      invalidarPipeline(qc);
    },
  });
}
