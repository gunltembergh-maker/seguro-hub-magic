// Hooks de dados do módulo Análise Background.
// Leitura direta das views (RLS garante o recorte por perfil); escrita só
// por RPC ou rota de servidor do Hub.
//
// IMPORTANTE: este projeto NÃO usa Edge Functions — elas estão bloqueadas.
// Toda a lógica de servidor vive em rotas do próprio Hub (src/routes/api).
// A diferença prática para o front: `supabase.functions.invoke` anexava a
// sessão sozinho; um `fetch` para /api/... não anexa nada. Por isso o
// token vai explícito no Authorization, via chamarHub().

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, useMeuPerfil } from "@/hooks/use-meu-perfil";
import type {
  ChaveAbTodas, Consentimento, Cota, ContratoPublico, Dossie, Empresa, Escopo,
  Evento, Finalidade, IngestLog, InscricaoDivida, LinhaCarteira, LinhaFila,
  LinhaProcesso, Modalidade, Parametro, Processo, ProvedorDados, ResultadoBgCheck,
  Restritivo, SinalDicionario, Socio, Solicitacao, StatusLead,
} from "@/lib/ab-types";

const K = {
  fila: (f: unknown) => ["hub", "fila", f] as const,
  carteira: (f: unknown) => ["hub", "carteira", f] as const,
  lead: (id: string) => ["hub", "lead", id] as const,
  empresa: (id: string) => ["hub", "empresa", id] as const,
  dossies: ["hub", "dossies"] as const,
  consentimentos: ["hub", "consentimentos"] as const,
  fontes: ["hub", "fontes"] as const,
};

// ---------------------------------------------------------------------
// Chamada às rotas de servidor do Hub, com o token da sessão anexado.
// Erro de negócio (403 de consentimento, 400 de documento) vem no corpo
// como { erro, detalhe } — o Error resultante carrega os dois campos,
// para a tela poder distinguir "consentimento_ausente" de falha real.
// ---------------------------------------------------------------------
async function chamarHub<T>(rota: string, body: unknown = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Entre de novo.");

  const r = await fetch(rota, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const txt = await r.text();
  let corpo: Record<string, unknown> | null = null;
  try { corpo = txt ? JSON.parse(txt) : null; } catch { /* resposta não-JSON */ }

  if (!r.ok) {
    const msg = (corpo?.detalhe as string) ?? (corpo?.erro as string) ??
      `HTTP ${r.status} em ${rota}`;
    throw Object.assign(new Error(msg), corpo ?? {}, { status: r.status });
  }
  return corpo as T;
}

// ---------------------------------------------------------------------
// Permissão: usa o modelo que o Hub já tem (rpc_meu_perfil + perfis_acesso).
// Chaves do módulo: ab_garantia | ab_compliance | ab_rh
// ADMIN passa em tudo — é o comportamento do hasPermission() do Hub.
// ---------------------------------------------------------------------
export type ChaveAb = ChaveAbTodas;

export function usePermissoesAb() {
  const { data: perfil, isLoading } = useMeuPerfil();
  const pode = (...chaves: ChaveAb[]) => chaves.some((c) => hasPermission(perfil, c));
  return {
    isLoading,
    perfil,
    pode,
    // As quatro chaves de acesso ao acervo. ab_solicitar e ab_cota_gerir são
    // permissões de AÇÃO: sozinhas não dão acesso a nada para ver.
    temAlgum: pode("ab_garantia", "ab_juridico", "ab_compliance", "ab_rh"),
    isAdmin: !!perfil?.roles.includes("ADMIN"),
  };
}

/** A área do usuário (profiles.area) — é a chave da cota de custo. */
export function useMinhaArea() {
  return useQuery({
    queryKey: ["hub", "minha-area"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("ab_minha_area");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}


// ---------------------------------------------------------------------
export interface FiltroFila {
  modalidade?: string;
  gatilho?: string;
  status?: string;
  bloqueados?: "ocultar" | "mostrar" | "somente";
  busca?: string;
  ordenarPor?: "prioridade" | "importancia_segurada" | "deadline";
}

export function useFila(filtro: FiltroFila) {
  return useQuery({
    queryKey: K.fila(filtro),
    queryFn: async (): Promise<LinhaFila[]> => {
      let q = supabase.from("ab_v_fila").select("*");

      if (filtro.modalidade) q = q.eq("modalidade", filtro.modalidade);
      if (filtro.status) q = q.eq("status", filtro.status);
      if (filtro.gatilho) q = q.contains("gatilhos", [filtro.gatilho]);
      if (filtro.bloqueados === "ocultar") q = q.is("bloqueios", null);
      if (filtro.bloqueados === "somente") q = q.not("bloqueios", "is", null);
      if (filtro.busca?.trim()) {
        const termo = filtro.busca.trim();
        const dig = termo.replace(/\D+/g, "");
        q = dig.length >= 3
          ? q.or(`razao_social.ilike.%${termo}%,cnpj.like.%${dig}%`)
          : q.ilike("razao_social", `%${termo}%`);
      }

      const ordem = filtro.ordenarPor ?? "prioridade";
      q = ordem === "deadline"
        ? q.order("deadline", { ascending: true, nullsFirst: false })
        : q.order(ordem, { ascending: false });

      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as LinhaFila[];
    },
  });
}

export function useCarteira(filtro: { busca?: string; relacao?: string }) {
  return useQuery({
    queryKey: K.carteira(filtro),
    queryFn: async (): Promise<LinhaCarteira[]> => {
      let q = supabase.from("ab_v_carteira").select("*");
      if (filtro.relacao) q = q.eq("relacao", filtro.relacao);
      if (filtro.busca?.trim()) {
        const termo = filtro.busca.trim();
        const dig = termo.replace(/\D+/g, "");
        q = dig.length >= 3
          ? q.or(`razao_social.ilike.%${termo}%,cnpj.like.%${dig}%`)
          : q.ilike("razao_social", `%${termo}%`);
      }
      const { data, error } = await q.order("is_potencial", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as LinhaCarteira[];
    },
  });
}

// ---------------------------------------------------------------------
export interface LeadDetalhe {
  lead: LinhaFila & { argumento: string | null; observacao: string | null };
  empresa: Empresa;
  eventos: Evento[];
  processos: Processo[];
  inscricoes: InscricaoDivida[];
  contratos: ContratoPublico[];
  restritivos: Restritivo[];
  socios: Socio[];
}

export function useLead(leadId: string | undefined) {
  return useQuery({
    queryKey: K.lead(leadId ?? ""),
    enabled: !!leadId,
    queryFn: async (): Promise<LeadDetalhe> => {
      const { data: lead, error: e1 } = await supabase
        .from("ab_lead").select("*").eq("id", leadId!).single();
      if (e1) throw e1;

      const { data: linha } = await supabase
        .from("ab_v_fila").select("*").eq("lead_id", leadId!).single();

      const empresaId = lead.empresa_id as string;

      const [emp, eventos, procs, inscs, ctrs, restrs, socios] = await Promise.all([
        supabase.from("ab_empresa").select("*").eq("id", empresaId).single(),
        supabase.from("ab_evento").select("*")
          .eq("empresa_id", empresaId).eq("modalidade", lead.modalidade)
          .order("valor_base", { ascending: false }),
        supabase.from("ab_processo")
          .select("*, ab_movimentacao(id, data, tipo, texto, sinais)")
          .eq("empresa_id", empresaId)
          .order("valor_causa", { ascending: false }),
        supabase.from("ab_inscricao_divida").select("*").eq("empresa_id", empresaId)
          .order("valor", { ascending: false }),
        supabase.from("ab_contrato_publico").select("*").eq("empresa_id", empresaId)
          .order("data_assinatura", { ascending: false }),
        supabase.from("ab_restritivo").select("*").eq("empresa_id", empresaId),
        supabase.from("ab_socio").select("*").eq("empresa_id", empresaId),
      ]);

      return {
        lead: { ...(linha ?? {}), ...lead } as LeadDetalhe["lead"],
        empresa: emp.data as Empresa,
        eventos: (eventos.data ?? []) as Evento[],
        processos: (procs.data ?? []) as Processo[],
        inscricoes: (inscs.data ?? []) as InscricaoDivida[],
        contratos: (ctrs.data ?? []) as ContratoPublico[],
        restritivos: (restrs.data ?? []) as Restritivo[],
        socios: (socios.data ?? []) as Socio[],
      };
    },
  });
}

export function useMoverLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      leadId: string; status: StatusLead; nota?: string; responsavel?: string;
    }) => {
      const { data, error } = await supabase.rpc("rpc_ab_mover_lead", {
        p_lead_id: args.leadId,
        p_status: args.status,
        // p_nota e p_responsavel têm DEFAULT NULL no banco: omitir é o
        // mesmo que mandar null, e é o que os tipos gerados aceitam.
        p_nota: args.nota ?? undefined,
        p_responsavel: args.responsavel ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hub", "fila"] });
      qc.invalidateQueries({ queryKey: K.lead(vars.leadId) });
    },
  });
}

// ---------------------------------------------------------------------
export function useBgCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { documento: string; finalidade: string; nome?: string }) =>
      chamarHub<ResultadoBgCheck>("/api/ab/bgcheck", args),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.dossies }),
  });
}

export function useDossies(limite = 20) {
  return useQuery({
    queryKey: K.dossies,
    queryFn: async (): Promise<Dossie[]> => {
      const { data, error } = await supabase
        .from("ab_dossie")
        .select("id, tipo_documento, documento, nome, finalidade, veredito, score, created_at")
        .order("created_at", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return (data ?? []) as Dossie[];
    },
  });
}

export function useConsentimentos() {
  return useQuery({
    queryKey: K.consentimentos,
    queryFn: async (): Promise<Consentimento[]> => {
      const { data, error } = await supabase
        .from("ab_consentimento").select("*")
        .is("revogado_em", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Consentimento[];
    },
  });
}

/**
 * Base legal do tratamento de dado pessoal (LGPD art. 7º).
 *
 * Não é detalhe de formulário. RH e Compliance tratam CPF com
 * CONSENTIMENTO do titular (inciso I). O Jurídico, para instruir processo
 * em que a empresa é parte, trata com EXERCÍCIO REGULAR DE DIREITOS
 * (inciso VI) — e nesse caso pedir "consentimento" seria registrar uma
 * base falsa, que é pior que não registrar nada, porque parece conforme.
 */
export type BaseLegal =
  | "consentimento"
  | "exercicio_regular_de_direitos"
  | "obrigacao_legal"
  | "legitimo_interesse";

export const BASE_LEGAL_LABEL: Record<BaseLegal, string> = {
  consentimento: "Consentimento do titular (art. 7º, I)",
  exercicio_regular_de_direitos: "Exercício regular de direitos em processo (art. 7º, VI)",
  obrigacao_legal: "Cumprimento de obrigação legal (art. 7º, II)",
  legitimo_interesse: "Legítimo interesse (art. 7º, IX)",
};

export function useRegistrarConsentimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      documento: string;
      nome: string;
      finalidade: string;
      baseLegal?: BaseLegal;
      /** Obrigatória quando a base não é consentimento: o que justifica. */
      justificativa?: string;
      diasValidade?: number;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const validade = new Date();
      validade.setDate(validade.getDate() + (args.diasValidade ?? 180));
      const { data, error } = await supabase.from("ab_consentimento").insert({
        documento: args.documento.replace(/\D+/g, ""),
        nome: args.nome,
        finalidade: args.finalidade,
        base_legal: args.baseLegal ?? "consentimento",
        solicitante: u?.user?.id ?? null,
        validade: validade.toISOString().slice(0, 10),
        evidencia: {
          canal: "hub_web",
          registrado_em: new Date().toISOString(),
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          justificativa: args.justificativa ?? null,
        },
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.consentimentos }),
  });
}

export function useRevogarConsentimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ab_consentimento")
        .update({ revogado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.consentimentos }),
  });
}

// ---------------------------------------------------------------------
export function useFontes() {
  return useQuery({
    queryKey: K.fontes,
    queryFn: async () => {
      const [logs, sinais, params, contagem] = await Promise.all([
        supabase.from("ab_ingest_log").select("*")
          .order("created_at", { ascending: false }).limit(60),
        supabase.from("ab_sinal").select("*").order("peso", { ascending: false }),
        supabase.from("ab_parametro").select("*"),
        supabase.from("ab_evento").select("gatilho"),
      ]);
      const porGatilho: Record<string, number> = {};
      for (const e of contagem.data ?? []) {
        porGatilho[e.gatilho] = (porGatilho[e.gatilho] ?? 0) + 1;
      }
      // último log por fonte
      const ultimoPorFonte: Record<string, IngestLog> = {};
      for (const l of (logs.data ?? []) as IngestLog[]) {
        if (!ultimoPorFonte[l.fonte]) ultimoPorFonte[l.fonte] = l;
      }
      return {
        logs: (logs.data ?? []) as IngestLog[],
        ultimoPorFonte,
        sinais: (sinais.data ?? []) as SinalDicionario[],
        parametros: (params.data ?? []) as Parametro[],
        eventosPorGatilho: porGatilho,
      };
    },
  });
}

/**
 * Dispara uma rotina do módulo pela tela de Fontes.
 *
 * O front não chama /api/public/hooks/* diretamente: aquelas rotas são
 * protegidas por AB_MOTOR_SECRET, que é server-only. O disparo manual
 * passa por /api/ab/executar, que autentica pelo JWT e confere ab_garantia.
 */
export type RotinaAb =
  | "ab-motor-run"
  | "ab-ingest-pncp"
  | "ab-ingest-pgfn"
  | "ab-ingest-transparencia"
  | "ab-enriquecer"
  | "ab-bureau-monitorar";

export function useRodarFuncao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { nome: RotinaAb; body?: Record<string, unknown> }) =>
      chamarHub<Record<string, unknown>>("/api/ab/executar", {
        nome: args.nome,
        body: args.body ?? {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub"] });
    },
  });
}

// =====================================================================
// Solicitação de pesquisa — a tela equivalente à busca da Tratum.
//
// O pedido é um registro, não uma consulta anônima: finalidade, área,
// custo e responsável ficam gravados. É isso que permite responder três
// perguntas que uma busca solta não responde: quem pediu, com que base
// legal, e quanto custou.
// =====================================================================
export interface ArgsSolicitar {
  documento: string;
  finalidade: Finalidade;
  escopo?: Escopo;
  nome?: string;
}

export interface RespostaSolicitacao {
  ok: boolean;
  solicitacao_id: string;
  status: string;
  detalhe: string;
  provedor?: string;
  custo?: number;
  empresa_id?: string | null;
  razao_social?: string | null;
  processos_encontrados?: number;
  movimentacoes_novas?: number;
  leads_gerados?: number;
  processos_na_base?: number;
  documento_mascarado?: string;
  avisos?: string[];
}

export function useSolicitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: ArgsSolicitar) =>
      chamarHub<RespostaSolicitacao>("/api/ab/solicitar", args),
    onSuccess: () => {
      // A solicitação pode ter gerado processo, lead e consumo de cota.
      // Invalida largo: é mais barato recarregar do que mostrar número velho.
      qc.invalidateQueries({ queryKey: ["hub"] });
    },
  });
}

export interface FiltroSolicitacao {
  finalidade?: Finalidade;
  status?: string;
  busca?: string;
  limite?: number;
}

export function useSolicitacoes(filtro: FiltroSolicitacao = {}) {
  return useQuery({
    queryKey: ["hub", "solicitacoes", filtro],
    queryFn: async (): Promise<Solicitacao[]> => {
      let q = supabase.from("ab_v_solicitacao").select("*");
      if (filtro.finalidade) q = q.eq("finalidade", filtro.finalidade);
      if (filtro.status) q = q.eq("status", filtro.status);
      if (filtro.busca?.trim()) {
        const termo = filtro.busca.trim();
        const dig = termo.replace(/\D+/g, "");
        q = dig.length >= 3
          ? q.or(`razao_social.ilike.%${termo}%,documento.like.%${dig}%`)
          : q.ilike("razao_social", `%${termo}%`);
      }
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(filtro.limite ?? 100);
      if (error) throw error;
      return (data ?? []) as Solicitacao[];
    },
  });
}

// =====================================================================
// Cota de custo por área
// =====================================================================
export function useCotas() {
  return useQuery({
    queryKey: ["hub", "cotas"],
    queryFn: async (): Promise<Cota[]> => {
      const { data, error } = await supabase
        .from("ab_v_cota").select("*")
        .order("mes", { ascending: false })
        .order("area", { ascending: true })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as Cota[];
    },
  });
}

export function useDefinirCota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      area: string;
      mes?: string;
      // undefined = não mexer · null = sem teto · 0 = bloquear
      limiteConsultas?: number | null;
      limiteValor?: number | null;
      observacao?: string;
    }) => chamarHub<{ ok: boolean; cota: Cota }>("/api/ab/cota", args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hub", "cotas"] }),
  });
}

export function useProvedores() {
  return useQuery({
    queryKey: ["hub", "provedores"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProvedorDados[]> => {
      const { data, error } = await supabase
        .from("ab_provedor")
        .select("chave, nome, ativo, custo_consulta, custo_monitoramento_mes, capacidades, observacao, doc_url")
        .order("ativo", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProvedorDados[];
    },
  });
}

// =====================================================================
// Consulta processual — a visão do Jurídico.
//
// Lê ab_v_processo, que de propósito NÃO expõe prêmio, comissão nem
// prioridade. Instrução de caso não tem por que ver a fila de vendas.
// =====================================================================
export interface FiltroProcesso {
  busca?: string;
  uf?: string;
  fase?: string;
  polo?: string;
  area?: string;
  somenteConstricao?: boolean;
  semGarantia?: boolean;
  ordenarPor?: "valor" | "recente" | "constricao";
  limite?: number;
}

export function useProcessos(filtro: FiltroProcesso = {}) {
  return useQuery({
    queryKey: ["hub", "processos", filtro],
    queryFn: async (): Promise<LinhaProcesso[]> => {
      let q = supabase.from("ab_v_processo").select("*");
      if (filtro.uf) q = q.eq("uf", filtro.uf);
      if (filtro.fase) q = q.eq("fase", filtro.fase);
      if (filtro.polo) q = q.eq("polo", filtro.polo);
      if (filtro.area) q = q.eq("area", filtro.area);
      if (filtro.somenteConstricao) q = q.gt("movimentacoes_constricao", 0);
      if (filtro.semGarantia) q = q.or("garantia_prestada.is.null,garantia_prestada.eq.false");
      if (filtro.busca?.trim()) {
        const termo = filtro.busca.trim();
        const dig = termo.replace(/\D+/g, "");
        q = dig.length >= 3
          ? q.or(`razao_social.ilike.%${termo}%,cnpj.like.%${dig}%,numero.like.%${dig}%`)
          : q.ilike("razao_social", `%${termo}%`);
      }
      const ordem = filtro.ordenarPor ?? "valor";
      q = ordem === "recente"
        ? q.order("ultima_movimentacao", { ascending: false, nullsFirst: false })
        : ordem === "constricao"
          ? q.order("movimentacoes_constricao", { ascending: false })
          : q.order("valor_execucao", { ascending: false, nullsFirst: false });

      const { data, error } = await q.limit(filtro.limite ?? 300);
      if (error) throw error;
      return (data ?? []) as LinhaProcesso[];
    },
  });
}

/** Andamentos de um processo, com os sinais que o classificador marcou. */
export function useAndamentos(processoId: string | undefined) {
  return useQuery({
    queryKey: ["hub", "andamentos", processoId ?? ""],
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_movimentacao")
        .select("id, data, tipo, codigo_tpu, texto, sinais, fonte")
        .eq("processo_id", processoId!)
        .order("data", { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as {
        id: string; data: string | null; tipo: string | null;
        codigo_tpu: string | null; texto: string | null;
        sinais: string[] | null; fonte: string | null;
      }[];
    },
  });
}

/** KPIs por ramo, para o painel de originação. */
export function useResumoRamos() {
  return useQuery({
    queryKey: ["hub", "resumo-ramos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_v_fila")
        .select("modalidade, premio_estimado, importancia_segurada, bloqueios, deadline")
        .limit(2000);
      if (error) throw error;
      const linhas = (data ?? []) as {
        modalidade: Modalidade; premio_estimado: number;
        importancia_segurada: number; bloqueios: string[] | null; deadline: string | null;
      }[];
      const hoje = new Date().toISOString().slice(0, 10);
      const porRamo: Record<string, {
        leads: number; bloqueados: number;
        premio: number; is: number; vencendo: number;
      }> = {};
      for (const l of linhas) {
        const r = (porRamo[l.modalidade] ??= {
          leads: 0, bloqueados: 0, premio: 0, is: 0, vencendo: 0,
        });
        if (l.bloqueios?.length) { r.bloqueados++; continue; }
        r.leads++;
        r.premio += Number(l.premio_estimado ?? 0);
        r.is += Number(l.importancia_segurada ?? 0);
        if (l.deadline && l.deadline >= hoje) {
          const dias = (new Date(l.deadline).getTime() - new Date(hoje).getTime()) / 86_400_000;
          if (dias <= 15) r.vencendo++;
        }
      }
      return porRamo;
    },
  });
}
