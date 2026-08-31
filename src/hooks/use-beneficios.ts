import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Referencia = { id: string; nome: string; ativo: boolean };

export type Cliente = {
  id: string;
  numero_cliente: string;
  tipo_pessoa: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  porte_empresa: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  email: string | null;
  email_copia: string | null;
  contato_principal: string | null;
  canal_id: string;
  ativo: boolean;
};

export type Contrato = {
  id: string;
  cliente_id: string;
  seguradora_id: string;
  canal_id: string;
  migrou_outra_corretora: boolean;
  numero_apolice: string | null;
  quantidade_vidas: number | null;
  premio_atual: number | null;
  percentual_agenciamento: number | null;
  percentual_vitalicio: number | null;
  data_inicio_vigencia: string;
  data_fim_vigencia: string;
  status: string;
};

const TABELAS = ["seguradoras", "canais", "coberturas"] as const;
export type TabelaRef = (typeof TABELAS)[number];

export function useReferencia(tabela: TabelaRef) {
  return useQuery({
    queryKey: ["beneficios", tabela],
    queryFn: async (): Promise<Referencia[]> => {
      const { data, error } = await supabase.from(tabela).select("id, nome, ativo").order("nome");
      if (error) throw error;
      return (data ?? []) as Referencia[];
    },
  });
}

export function useSalvarReferencia(tabela: TabelaRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; nome: string; ativo: boolean }) => {
      if (input.id) {
        const { error } = await supabase
          .from(tabela)
          .update({ nome: input.nome, ativo: input.ativo })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tabela).insert({ nome: input.nome, ativo: input.ativo });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beneficios", tabela] }),
  });
}

export function useClientes() {
  return useQuery({
    queryKey: ["beneficios", "clientes"],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome_razao_social");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });
}

export function useContratos() {
  return useQuery({
    queryKey: ["beneficios", "contratos"],
    queryFn: async (): Promise<Contrato[]> => {
      const { data, error } = await supabase.from("contratos").select("*");
      if (error) throw error;
      return (data ?? []) as Contrato[];
    },
  });
}

export function useContrato(id: string) {
  return useQuery({
    queryKey: ["beneficios", "contrato", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select(
          "*, clientes(*), seguradoras(nome), canais(nome), contrato_coberturas(id, ativa_desde, ativa_ate, coberturas(nome))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCriarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Cliente, "id" | "numero_cliente" | "ativo">) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert(input)
        .select("id, numero_cliente")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beneficios", "clientes"] }),
  });
}
