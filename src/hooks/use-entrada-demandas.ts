// Consultas e gravações da Entrada de Demandas.
//
// Tudo passa pelo client publishable, sujeito a RLS: o gate de verdade está
// nas policies do banco, não aqui.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useResponsaveis() {
  return useQuery({
    queryKey: ["entrada", "responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("active", true)
        .or("blocked.is.null,blocked.eq.false")
        .order("full_name");
      if (error) throw error;
      return (data ?? []).filter((p) => !!p.user_id);
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
}

/**
 * Grava a entrada e, quando for Garantia, a demanda em Triagem.
 * Se a demanda falhar, a entrada criada é desfeita: entrada "roteada" sem
 * demanda é registro órfão, e ninguém acharia depois.
 * Nada é escrito em garantia_status_historico — o trigger do banco cuida.
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
          destino: ehGarantia ? "roteada" : "retida",
          motivo_retencao: ehGarantia
            ? null
            : "Ramo ainda sem pipeline próprio no Hub: a demanda fica registrada e retida.",
          registrado_por: uid,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select("id, protocolo, chegada_em, registrado_em")
        .single();
      if (erroEntrada) throw erroEntrada;

      if (!ehGarantia) return { entrada, demandaId: null as string | null };

      try {
        const { data: demanda, error: erroDemanda } = await supabase
          .from("garantia_demandas")
          .insert({
            produto: v.produto!,
            entrada_id: entrada.id,
            cliente_id: v.cliente_id,
            chegada_em: v.chegada_em,
            canal_id: v.canal_id,
            fase: "negociacao",
            etapa: "1",
            status_atual: "triagem",
            triagem_completa: false,
            cadastrado_por: uid,
            modalidade: v.produto === "fianca_locaticia" ? "locaticia" : null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .select("id")
          .single();
        if (erroDemanda) throw erroDemanda;

        const { error: erroVinculo } = await supabase
          .from("hub_entradas")
          .update({ destino: "roteada", demanda_id: demanda.id })
          .eq("id", entrada.id);
        if (erroVinculo) throw erroVinculo;

        return { entrada, demandaId: demanda.id as string };
      } catch (err) {
        // Desfaz a entrada para não sobrar registro roteado sem demanda.
        await supabase.from("hub_entradas").delete().eq("id", entrada.id);
        throw err;
      }
    },
    onSuccess: () => {
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
