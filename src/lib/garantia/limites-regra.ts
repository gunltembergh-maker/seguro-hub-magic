// Regras de negócio da consulta a mercado (etapa 3 do pipeline de Garantia).
//
// A normalização do retorno das APIs NÃO está aqui: ela é de
// garantia-judicial-normalizar.ts (resumirResultadoMercado), fonte única
// compartilhada com a tela Análise de Limite, a planilha e o e-mail.
// Este módulo cuida só do que a consulta decide no fluxo.

import type { StatusKey, GrupoResumo } from "./garantia-judicial-normalizar";

export type StatusMercado = StatusKey;

export const STATUS_MERCADO: { valor: StatusMercado; rotulo: string }[] = [
  { valor: "aprovado", rotulo: "Aprovado (com limite)" },
  { valor: "nomeado", rotulo: "Nomeado com outro corretor" },
  { valor: "sem_limite", rotulo: "Sem limite" },
  { valor: "bloqueado", rotulo: "Bloqueado" },
  { valor: "filial", rotulo: "Cadastro de filial" },
  { valor: "sem_resposta", rotulo: "Sem resposta (falha técnica)" },
  { valor: "instavel", rotulo: "Portal instável (falha técnica)" },
  { valor: "erro", rotulo: "Erro na consulta (falha técnica)" },
];

export const rotuloStatusMercado = (v: string | null | undefined) =>
  STATUS_MERCADO.find((s) => s.valor === v)?.rotulo ?? (v ?? "—");

export const ROTULO_GRUPO: Record<string, string> = {
  com_limite: "Com limite",
  sem_limite: "Sem limite",
  nao_consultado: "Não consultado",
};

/**
 * Grupo derivado do status — nunca escolhido à mão. Mesma regra fechada da
 * normalização: falha técnica (`nao_consultado`) jamais vira recusa.
 * Usado para as linhas lançadas manualmente; as linhas de API já chegam
 * classificadas por resumirResultadoMercado().
 */
export function grupoDoStatusMercado(statusKey: string | null | undefined): GrupoResumo {
  if (statusKey === "aprovado") return "com_limite";
  if (statusKey === "sem_limite" || statusKey === "bloqueado" || statusKey === "nomeado" || statusKey === "filial")
    return "sem_limite";
  return "nao_consultado"; // sem_resposta, instavel, erro — e também o não lançado
}

export interface SeguradoraConfig {
  chave_mercado: string;
  rotulo: string;
  identificador_api: string | null;
  tem_portal: boolean;
  ativa_garantia: boolean;
  observacao: string | null;
}

export interface LimiteLinha {
  id: string;
  consulta_id: string;
  cliente_id: string;
  chave_mercado: string;
  status_mercado: string | null;
  grupo_mercado: string | null;
  limite_total: number | null;
  limite_disponivel: number | null;
  taxa: number | null;
  modalidades: unknown;
  data_ultimo_cadastro: string | null;
  nomeacao: string | null;
  mensagem: string | null;
  origem: string;
  atualizado_em: string;
}

export const CADASTRO_VENCIDO_MESES = 6;

export function cadastroVencido(data: string | null | undefined): boolean {
  if (!data) return false;
  const d = new Date(`${data.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - CADASTRO_VENCIDO_MESES);
  return d.getTime() < limite.getTime();
}

export interface ResumoConsulta {
  /** As 18 com portal que ainda não têm resposta registrada. */
  faltantes: string[];
  completa: boolean;
  total_com_limite: number;
  total_sem_limite: number;
  total_nao_consultado: number;
  capacidade_total: number;
  /**
   * true/false quando a IS está preenchida; null quando ainda não dá para
   * concluir (sem IS). Com null, o exige_cadastro da demanda fica como está.
   */
  exige_cadastro: boolean | null;
  /** Seguradoras com portal cujo limite disponível cobre sozinho a IS. */
  cobrem_sozinhas: string[];
  /** IS usada na conta (null = não preenchida). */
  importancia_segurada: number | null;
}

/** Limite disponível da linha; lançamento manual só traz o total. */
export const limiteDisponivel = (l: LimiteLinha): number | null =>
  l.limite_disponivel != null
    ? Number(l.limite_disponivel)
    : l.limite_total != null
      ? Number(l.limite_total)
      : null;

/**
 * Obrigatórias são só as 18 com portal. As 17 sem portal são opcionais e não
 * entram na conta de `completa` — quem quiser lançar, pode.
 */
export function resumirConsulta(
  config: SeguradoraConfig[],
  limites: LimiteLinha[],
  importanciaSegurada: number | null,
): ResumoConsulta {
  const porChave = new Map(limites.map((l) => [l.chave_mercado, l]));
  const obrigatorias = config.filter((c) => c.tem_portal && c.ativa_garantia);

  const faltantes = obrigatorias
    .filter((c) => !porChave.get(c.chave_mercado)?.status_mercado)
    .map((c) => c.rotulo);

  let com = 0;
  let sem = 0;
  let nao = 0;
  let capacidade = 0;
  for (const l of limites) {
    if (!l.status_mercado) continue;
    const grupo = l.grupo_mercado ?? grupoDoStatusMercado(l.status_mercado);
    if (grupo === "com_limite") {
      com += 1;
      capacidade += Number(l.limite_total ?? 0);
    } else if (grupo === "sem_limite") {
      // Só recusa comercial entra aqui. Falha técnica fica em nao_consultado.
      sem += 1;
    } else {
      nao += 1;
    }
  }

  // REGRA DO CADASTRO (mudou duas vezes — esta é a vigente):
  //   exige_cadastro = true quando NENHUMA seguradora com portal
  //   (tem_portal = true) tem limite disponível >= importância segurada.
  //   Não é "ninguém liberou nada": é "ninguém cobre sozinho o valor".
  //   · As sem portal não entram na conta: são opcionais e não decidem nada.
  //   · Só conta linha em com_limite (falha técnica e recusa não cobrem).
  //   · Sem IS preenchida, a regra não conclui (null).
  //   Versões anteriores: (1) três exercícios de DRE/balanço sempre;
  //   (2) exige quando nenhuma seguradora tem limite algum.
  const comPortal = new Set(config.filter((c) => c.tem_portal).map((c) => c.chave_mercado));
  const rotulo = new Map(config.map((c) => [c.chave_mercado, c.rotulo]));
  const is = importanciaSegurada != null && Number(importanciaSegurada) > 0 ? Number(importanciaSegurada) : null;
  const cobrem =
    is == null
      ? []
      : limites
          .filter((l) => comPortal.has(l.chave_mercado))
          .filter((l) => (l.grupo_mercado ?? grupoDoStatusMercado(l.status_mercado)) === "com_limite")
          .filter((l) => (limiteDisponivel(l) ?? 0) >= is)
          .map((l) => rotulo.get(l.chave_mercado) ?? l.chave_mercado);

  return {
    faltantes,
    completa: faltantes.length === 0,
    total_com_limite: com,
    total_sem_limite: sem,
    total_nao_consultado: nao,
    capacidade_total: capacidade,
    exige_cadastro: is == null ? null : cobrem.length === 0,
    cobrem_sozinhas: cobrem,
    importancia_segurada: is,
  };
}

/**
 * Recalcula os totais da consulta e o `exige_cadastro` da demanda. Serve tanto
 * ao servidor (consulta automática) quanto à tela (edição manual), sempre com
 * a mesma regra. Nunca escreve em garantia_status_historico.
 */
export async function recalcularConsulta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cliente: any,
  consultaId: string,
  demandaId: string | null,
): Promise<ResumoConsulta | null> {
  const [{ data: config }, { data: limites }, { data: demanda }] = await Promise.all([
    cliente
      .from("garantia_seguradoras_config")
      .select("chave_mercado, rotulo, identificador_api, tem_portal, ativa_garantia, observacao"),
    cliente
      .from("garantia_limites_tomador")
      .select(
        "id, consulta_id, cliente_id, chave_mercado, status_mercado, grupo_mercado, limite_total, limite_disponivel, taxa, modalidades, data_ultimo_cadastro, nomeacao, mensagem, origem, atualizado_em",
      )
      .eq("consulta_id", consultaId),
    demandaId
      ? cliente.from("garantia_demandas").select("importancia_segurada").eq("id", demandaId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!config) return null;

  const resumo = resumirConsulta(
    (config ?? []) as SeguradoraConfig[],
    (limites ?? []) as LimiteLinha[],
    (demanda?.importancia_segurada ?? null) as number | null,
  );

  await cliente
    .from("garantia_consultas_mercado")
    .update({
      completa: resumo.completa,
      total_com_limite: resumo.total_com_limite,
      total_sem_limite: resumo.total_sem_limite,
      total_nao_consultado: resumo.total_nao_consultado,
      capacidade_total: resumo.capacidade_total,
    })
    .eq("id", consultaId);

  // Sem IS a regra não conclui: exige_cadastro da demanda fica como está.
  if (demandaId && resumo.exige_cadastro !== null) {
    await cliente
      .from("garantia_demandas")
      .update({ exige_cadastro: resumo.exige_cadastro })
      .eq("id", demandaId);
  }

  return resumo;
}
