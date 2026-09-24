// Consultas e gravações da Entrada de Demandas.
//
// Tudo passa pelo client publishable, sujeito a RLS: o gate de verdade está
// nas policies do banco, não aqui.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_PIPELINE, TAMANHO_MAXIMO_BYTES } from "@/lib/garantia/documentos-regra";

export interface AnexoEntrada {
  arquivo: File;
  tipo: string;
}

export type RamoEntrada = "garantia" | "beneficios" | "demais_ramos" | "credito" | "outro";
export type ProdutoGarantia = "seguro_garantia" | "fianca_locaticia";
export type DestinoEntrada = "roteada" | "retida" | "descartada";

export interface ClienteHub {
  id: string;
  tipo_pessoa: string;
  cpf_cnpj: string;
  nome: string;
  nome_fantasia: string | null;
  municipio: string | null;
  uf: string | null;
  responsavel_id: string | null;
}

export interface EntradaLista {
  id: string;
  protocolo: string;
  ramo: string;
  produto: string | null;
  chegada_em: string;
  origem: string;
  assunto: string | null;
  destino: string;
  motivo_retencao: string | null;
  demanda_id: string | null;
  registrado_em: string;
  registrado_por: string | null;
  cliente: { id: string; nome: string; cpf_cnpj: string } | null;
  canal: { id: string; nome: string } | null;
}

export const soDigitosDoc = (v: string) => v.replace(/\D+/g, "");

/** Debounce simples, para não disparar uma busca por tecla digitada. */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/**
 * Busca cliente por nome OU documento ao mesmo tempo: quem já está salvo não
 * precisa ter o CNPJ digitado de novo a cada demanda.
 */
export function useBuscaClientes(termo: string) {
  const busca = useDebounce(termo.trim(), 300);
  return useQuery({
    queryKey: ["entrada", "clientes", busca],
    enabled: busca.length >= 2,
    queryFn: async (): Promise<ClienteHub[]> => {
      const digitos = soDigitosDoc(busca);
      const filtros = [`nome.ilike.%${busca}%`];
      if (digitos.length >= 3) filtros.push(`cpf_cnpj.like.${digitos}%`);
      const { data, error } = await supabase
        .from("hub_clientes")
        .select("id, tipo_pessoa, cpf_cnpj, nome, nome_fantasia, municipio, uf, responsavel_id")
        .or(filtros.join(","))
        .eq("ativo", true)
        .order("nome")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ClienteHub[];
    },
  });
}

export function useCanais() {
  return useQuery({
    queryKey: ["entrada", "canais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canais")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PessoaHub {
  user_id: string;
  nome: string;
}

/**
 * Lista de pessoas para os seletores de responsável.
 *
 * Não lê `profiles` direto: as policies de SELECT de lá só deixam o usuário
 * ver o próprio registro (ou tudo, se for admin/diretoria), então um
 * COLABORADOR veria um nome só. O RPC security definer devolve apenas
 * user_id e nome — sem e-mail — e vazio para quem não opera a Entrada nem o
 * pipeline de Garantia.
 */
export function useResponsaveis() {
  return useQuery({
    queryKey: ["entrada", "responsaveis"],
    queryFn: async (): Promise<PessoaHub[]> => {
      const { data, error } = await supabase.rpc("rpc_hub_listar_pessoas");
      if (error) throw error;
      return ((data ?? []) as PessoaHub[]).filter((p) => !!p.user_id);
    },
  });
}

export interface FiltrosEntradas {
  ramo?: string;
  destino?: string;
  de?: string;
  ate?: string;
}

export function useEntradas(filtros: FiltrosEntradas) {
  return useQuery({
    queryKey: ["entrada", "lista", filtros],
    queryFn: async (): Promise<EntradaLista[]> => {
      let q = supabase
        .from("hub_entradas")
        .select(
          "id, protocolo, ramo, produto, chegada_em, origem, assunto, destino, motivo_retencao, demanda_id, registrado_em, registrado_por, cliente:hub_clientes(id, nome, cpf_cnpj), canal:canais(id, nome)",
        )
        .order("registrado_em", { ascending: false })
        .limit(300);
      if (filtros.ramo) q = q.eq("ramo", filtros.ramo);
      if (filtros.destino) q = q.eq("destino", filtros.destino);
      if (filtros.de) q = q.gte("registrado_em", filtros.de);
      if (filtros.ate) q = q.lte("registrado_em", filtros.ate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EntradaLista[];
    },
  });
}

/** Entradas e demandas recentes do mesmo cliente — aviso, nunca bloqueio. */
export function useDuplicidadeCliente(clienteId: string | null) {
  return useQuery({
    queryKey: ["entrada", "duplicidade", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const corte = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [entradas, demandas] = await Promise.all([
        supabase
          .from("hub_entradas")
          .select("id, protocolo, ramo, registrado_em")
          .eq("cliente_id", clienteId!)
          .gte("registrado_em", corte)
          .order("registrado_em", { ascending: false })
          .limit(5),
        supabase
          .from("garantia_demandas")
          .select("id, codigo, status_atual, fase")
          .eq("cliente_id", clienteId!)
          .in("fase", ["negociacao", "crm"])
          .limit(5),
      ]);
      return {
        entradas: entradas.data ?? [],
        demandas: demandas.data ?? [],
      };
    },
  });
}

type NovoCliente = Record<string, unknown>;

export function useCriarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valores: NovoCliente) => {
      const { data, error } = await supabase
        .from("hub_clientes")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(valores as any)
        .select("id, tipo_pessoa, cpf_cnpj, nome, nome_fantasia, municipio, uf, responsavel_id")
        .single();
      if (error) throw error;
      return data as ClienteHub;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entrada", "clientes"] }),
  });
}

export function useAtualizarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: NovoCliente }) => {
      const { data, error } = await supabase
        .from("hub_clientes")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(valores as any)
        .eq("id", id)
        .select("id, tipo_pessoa, cpf_cnpj, nome, nome_fantasia, municipio, uf, responsavel_id")
        .single();
      if (error) throw error;
      return data as ClienteHub;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entrada", "clientes"] }),
  });
}

export interface NovaEntrada {
  ramo: RamoEntrada;
  produto: ProdutoGarantia | null;
  cliente_id: string;
  chegada_em: string;
  origem: string;
  canal_id: string | null;
  assunto: string;
  observacao: string | null;
  /** Só Garantia. Pelo menos um documento de contrato — a tela garante. */
  anexos?: AnexoEntrada[];
}

export interface DadosRoteamento {
  entrada_id: string;
  produto: ProdutoGarantia;
  cliente_id: string;
  chegada_em: string;
  canal_id: string | null;
  anexos?: AnexoEntrada[];
}

export interface ResultadoRoteamento {
  demandaId: string;
  /** Preenchido quando a demanda nasceu mas algum anexo não subiu. */
  falhaAnexo: string | null;
}

/**
 * Sobe os anexos da Entrada no caminho `${demanda}/${tipo}/${versao}-${nome}`.
 * A versão gravada é do trigger; aqui só se conta para montar o caminho.
 */
async function subirAnexos(demandaId: string, anexos: AnexoEntrada[], uid: string | null) {
  const porTipo: Record<string, number> = {};
  for (const { arquivo, tipo } of anexos) {
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) throw new Error(`${arquivo.name} passa de 20 MB.`);
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    const nomeLimpo = arquivo.name.replace(/[^\w.\-() ]+/g, "_");
    const caminho = `${demandaId}/${tipo}/${porTipo[tipo]}-${nomeLimpo}`;
    const { error: erroUpload } = await supabase.storage
      .from(BUCKET_PIPELINE)
      .upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream", upsert: false });
    if (erroUpload) throw new Error(`Não foi possível enviar ${arquivo.name}: ${erroUpload.message}`);
    const { error } = await supabase.from("garantia_documentos").insert({
      demanda_id: demandaId,
      tipo,
      caminho,
      nome_arquivo: arquivo.name,
      tamanho_bytes: arquivo.size,
      mime_type: arquivo.type || null,
      enviado_por: uid,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) throw error;
  }
}

/**
 * Abre a demanda de Garantia em Triagem e só então marca a entrada como
 * roteada. A ordem importa: a entrada nunca fica "roteada" antes de existir
 * a demanda que justifica esse destino.
 *
 * Se algo falhar, NÃO se apaga a entrada. A policy de DELETE de hub_entradas
 * é só de ADMIN: para os demais o delete não apaga nada e também não devolve
 * erro, e um delete que não apaga e não reclama é pior que nenhum delete.
 * Em vez disso a entrada continua "retida", com o motivo escrito — estado se
 * corrige, não se deleta.
 * Nada é escrito em garantia_status_historico — o trigger do banco cuida.
 */
async function abrirDemandaGarantia(d: DadosRoteamento, uid: string | null): Promise<ResultadoRoteamento> {
  // Responsável pelo cliente é COPIADO do cadastro: se mudar lá depois, a
  // demanda guarda quem era na chegada. Continua editável na aba Dados.
  const { data: clienteHub } = await supabase
    .from("hub_clientes")
    .select("responsavel_id")
    .eq("id", d.cliente_id)
    .maybeSingle();
  let demandaCriada: string | null = null;
  try {
    const { data: demanda, error: erroDemanda } = await supabase
      .from("garantia_demandas")
      .insert({
        produto: d.produto,
        entrada_id: d.entrada_id,
        cliente_id: d.cliente_id,
        chegada_em: d.chegada_em,
        canal_id: d.canal_id,
        fase: "negociacao",
        etapa: "1",
        status_atual: "triagem",
        triagem_completa: false,
        cadastrado_por: uid,
        responsavel_cliente_id: clienteHub?.responsavel_id ?? null,
        modalidade: d.produto === "fianca_locaticia" ? "locaticia" : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id")
      .single();
    if (erroDemanda) throw erroDemanda;
    demandaCriada = demanda.id as string;

    // Anexo falhou: NÃO se apaga a demanda (DELETE é só de ADMIN e não
    // reclamaria). A entrada fica retida, apontando para a demanda, com o
    // motivo; o checklist da análise impede que ela avance sem documento.
    if (d.anexos?.length) {
      try {
        await subirAnexos(demandaCriada, d.anexos, uid);
      } catch (erroAnexo) {
        const falha = erroAnexo instanceof Error ? erroAnexo.message : "Falha no envio dos anexos.";
        await supabase
          .from("hub_entradas")
          .update({
            destino: "retida",
            demanda_id: demandaCriada,
            motivo_retencao: `Demanda criada, mas sem documento: ${falha} Anexe pela aba Documentos da demanda.`,
          })
          .eq("id", d.entrada_id);
        return { demandaId: demandaCriada, falhaAnexo: falha };
      }
    }

    const { error: erroVinculo } = await supabase
      .from("hub_entradas")
      .update({ destino: "roteada", demanda_id: demanda.id, motivo_retencao: null })
      .eq("id", d.entrada_id);
    if (erroVinculo) throw erroVinculo;

    return { demandaId: demanda.id as string, falhaAnexo: null };
  } catch (err) {
    const quando = new Date().toLocaleString("pt-BR");
    const { error: erroCompensacao } = await supabase
      .from("hub_entradas")
      .update({
        destino: "retida",
        ...(demandaCriada ? { demanda_id: demandaCriada } : {}),
        motivo_retencao: demandaCriada
          ? `Demanda criada em ${quando}, mas a entrada não foi marcada como roteada.`
          : `Falha ao abrir a demanda de Garantia em ${quando}; a entrada ficou registrada e pode ser roteada de novo.`,
      })
      .eq("id", d.entrada_id);
    // Se nem a compensação passou, o erro original é o que interessa na tela.
    if (erroCompensacao) console.error("Falha ao registrar a retenção da entrada", erroCompensacao);
    throw err;
  }
}

/**
 * Grava a entrada e, quando for Garantia, abre a demanda em Triagem.
 * A entrada sempre nasce "retida": só vira "roteada" depois que a demanda
 * existe de fato.
 */
export function useCriarEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: NovaEntrada) => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id ?? null;
      const ehGarantia = v.ramo === "garantia";

      const { data: entrada, error: erroEntrada } = await supabase
        .from("hub_entradas")
        .insert({
          ramo: v.ramo,
          produto: ehGarantia ? v.produto : null,
          cliente_id: v.cliente_id,
          chegada_em: v.chegada_em,
          origem: v.origem,
          canal_id: v.canal_id,
          assunto: v.assunto,
          observacao: v.observacao,
          destino: "retida",
          motivo_retencao: ehGarantia
            ? "Aguardando a abertura da demanda de Garantia."
            : "Ramo ainda sem pipeline próprio no Hub: a demanda fica registrada e retida.",
          registrado_por: uid,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select("id, protocolo, chegada_em, registrado_em")
        .single();
      if (erroEntrada) throw erroEntrada;

      if (!ehGarantia) return { entrada, demandaId: null as string | null, falhaAnexo: null as string | null };

      const { demandaId, falhaAnexo } = await abrirDemandaGarantia(
        {
          entrada_id: entrada.id,
          produto: v.produto!,
          cliente_id: v.cliente_id,
          chegada_em: v.chegada_em,
          canal_id: v.canal_id,
          anexos: v.anexos,
        },
        uid,
      );
      return { entrada, demandaId, falhaAnexo };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entrada", "lista"] });
      qc.invalidateQueries({ queryKey: ["entrada", "duplicidade"] });
    },
    onError: () => {
      // A entrada ficou gravada como retida: a lista precisa mostrar a pendência.
      qc.invalidateQueries({ queryKey: ["entrada", "lista"] });
    },
  });
}

/**
 * Refaz só a etapa da demanda para uma entrada de Garantia que ficou retida.
 * Não cria entrada nova: reaproveita a que já existe, com o mesmo protocolo.
 */
export function useRotearEntradaGarantia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosRoteamento) => {
      const { data: sessao } = await supabase.auth.getUser();
      return abrirDemandaGarantia(d, sessao.user?.id ?? null);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["entrada", "lista"] });
      qc.invalidateQueries({ queryKey: ["entrada", "duplicidade"] });
    },
  });
}

export function useCriarCanal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.rpc("rpc_entrada_criar_canal", { _nome: nome });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entrada", "canais"] }),
  });
}
