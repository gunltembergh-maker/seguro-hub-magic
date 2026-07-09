export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dominio_empresa: {
        Row: {
          ativo: boolean
          created_at: string
          dominio: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dominio: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dominio?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hub_admin_settings: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          descricao: string | null
          key: string
          value: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          descricao?: string | null
          key: string
          value: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          descricao?: string | null
          key?: string
          value?: Json
        }
        Relationships: []
      }
      notificacoes_admin: {
        Row: {
          created_at: string
          dados: Json
          id: string
          lida: boolean
          mensagem: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados?: Json
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      perfis_acesso: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          permissoes: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          permissoes?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          blocked: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          perfil_id: string | null
          primeiro_acesso: boolean
          ultimo_acesso: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          blocked?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          perfil_id?: string | null
          primeiro_acesso?: boolean
          ultimo_acesso?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          blocked?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          perfil_id?: string | null
          primeiro_acesso?: boolean
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_lavoro_caixa_comissao: {
        Row: {
          apolice: string | null
          arquivo_origem: string | null
          canal: string | null
          data_competencia: string | null
          data_previsto: string | null
          data_recebimento: string | null
          endosso: string | null
          id: number
          importado_em: string
          importado_por: string | null
          observacoes: string | null
          parcela_num: number | null
          ramo: string | null
          segurado: string | null
          seguradora: string | null
          status: string | null
          valor_previsto: number | null
          valor_recebido: number | null
        }
        Insert: {
          apolice?: string | null
          arquivo_origem?: string | null
          canal?: string | null
          data_competencia?: string | null
          data_previsto?: string | null
          data_recebimento?: string | null
          endosso?: string | null
          id?: number
          importado_em?: string
          importado_por?: string | null
          observacoes?: string | null
          parcela_num?: number | null
          ramo?: string | null
          segurado?: string | null
          seguradora?: string | null
          status?: string | null
          valor_previsto?: number | null
          valor_recebido?: number | null
        }
        Update: {
          apolice?: string | null
          arquivo_origem?: string | null
          canal?: string | null
          data_competencia?: string | null
          data_previsto?: string | null
          data_recebimento?: string | null
          endosso?: string | null
          id?: number
          importado_em?: string
          importado_por?: string | null
          observacoes?: string | null
          parcela_num?: number | null
          ramo?: string | null
          segurado?: string | null
          seguradora?: string | null
          status?: string | null
          valor_previsto?: number | null
          valor_recebido?: number | null
        }
        Relationships: []
      }
      raw_lavoro_depara_ramo: {
        Row: {
          created_at: string
          id: number
          ramo_normalizado: string
          ramo_origem: string
          tipo_de_ramo: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          ramo_normalizado: string
          ramo_origem: string
          tipo_de_ramo?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          ramo_normalizado?: string
          ramo_origem?: string
          tipo_de_ramo?: string | null
        }
        Relationships: []
      }
      raw_lavoro_gerencial: {
        Row: {
          ano_competencia: number | null
          apolice: string | null
          arquivo_origem: string | null
          canal: string | null
          centro_custo: string | null
          cliente: string | null
          comissao_bruta: number | null
          comissao_liquida: number | null
          cpf_cnpj: string | null
          data_competencia: string | null
          data_emissao: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          endosso: string | null
          filial: string | null
          gerente: string | null
          id: number
          importado_em: string
          importado_por: string | null
          iof: number | null
          mes_competencia: number | null
          meta_atrelada: number | null
          modalidade: string | null
          moeda: string | null
          observacoes: string | null
          origem: string | null
          parcela_num: number | null
          parcela_total: number | null
          percentual_comissao: number | null
          praca: string | null
          premio_bruto: number | null
          premio_liquido: number | null
          produto: string | null
          produtor: string | null
          ramo: string | null
          regional: string | null
          segurado: string | null
          seguradora: string | null
          status_apolice: string | null
          status_parcela_comissao: string | null
          subramo: string | null
          supervisor: string | null
          tipo_de_ramo: string | null
          tipo_movimento: string | null
          unidade: string | null
        }
        Insert: {
          ano_competencia?: number | null
          apolice?: string | null
          arquivo_origem?: string | null
          canal?: string | null
          centro_custo?: string | null
          cliente?: string | null
          comissao_bruta?: number | null
          comissao_liquida?: number | null
          cpf_cnpj?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          endosso?: string | null
          filial?: string | null
          gerente?: string | null
          id?: number
          importado_em?: string
          importado_por?: string | null
          iof?: number | null
          mes_competencia?: number | null
          meta_atrelada?: number | null
          modalidade?: string | null
          moeda?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_num?: number | null
          parcela_total?: number | null
          percentual_comissao?: number | null
          praca?: string | null
          premio_bruto?: number | null
          premio_liquido?: number | null
          produto?: string | null
          produtor?: string | null
          ramo?: string | null
          regional?: string | null
          segurado?: string | null
          seguradora?: string | null
          status_apolice?: string | null
          status_parcela_comissao?: string | null
          subramo?: string | null
          supervisor?: string | null
          tipo_de_ramo?: string | null
          tipo_movimento?: string | null
          unidade?: string | null
        }
        Update: {
          ano_competencia?: number | null
          apolice?: string | null
          arquivo_origem?: string | null
          canal?: string | null
          centro_custo?: string | null
          cliente?: string | null
          comissao_bruta?: number | null
          comissao_liquida?: number | null
          cpf_cnpj?: string | null
          data_competencia?: string | null
          data_emissao?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          endosso?: string | null
          filial?: string | null
          gerente?: string | null
          id?: number
          importado_em?: string
          importado_por?: string | null
          iof?: number | null
          mes_competencia?: number | null
          meta_atrelada?: number | null
          modalidade?: string | null
          moeda?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_num?: number | null
          parcela_total?: number | null
          percentual_comissao?: number | null
          praca?: string | null
          premio_bruto?: number | null
          premio_liquido?: number | null
          produto?: string | null
          produtor?: string | null
          ramo?: string | null
          regional?: string | null
          segurado?: string | null
          seguradora?: string | null
          status_apolice?: string | null
          status_parcela_comissao?: string | null
          subramo?: string | null
          supervisor?: string | null
          tipo_de_ramo?: string | null
          tipo_movimento?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions_log: {
        Row: {
          id: string
          iniciado_em: string
          ip: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          iniciado_em?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          iniciado_em?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_lavoro_previsto_caixa: {
        Row: {
          ano: number | null
          canal: string | null
          mes: number | null
          ramo: string | null
          seguradora: string | null
          valor_previsto: number | null
        }
        Relationships: []
      }
      vw_lavoro_receita_caixa: {
        Row: {
          ano: number | null
          canal: string | null
          mes: number | null
          ramo: string | null
          seguradora: string | null
          valor_recebido: number | null
        }
        Relationships: []
      }
      vw_lavoro_receita_competencia: {
        Row: {
          ano: number | null
          canal: string | null
          comissao_bruta: number | null
          comissao_liquida: number | null
          mes: number | null
          premio_liquido: number | null
          ramo: string | null
          seguradora: string | null
          status_parcela_comissao: string | null
          tipo_de_ramo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      divide_safe: { Args: { den: number; num: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_diretoria: { Args: { _user_id: string }; Returns: boolean }
      is_dominio_lavoro: { Args: { _email: string }; Returns: boolean }
      normalize_categoria_financeira: { Args: { txt: string }; Returns: string }
      pode_gerenciar_configuracoes: {
        Args: { _user_id: string }
        Returns: boolean
      }
      pode_importar: {
        Args: { _tipo: string; _user_id: string }
        Returns: boolean
      }
      rpc_comissao_vencida_por_canal: {
        Args: { _ano: number; _mes: number; _periodo?: string }
        Returns: {
          canal: string
          valor: number
        }[]
      }
      rpc_get_meta_anual: { Args: { _ano: number }; Returns: number }
      rpc_meu_perfil: {
        Args: never
        Returns: {
          active: boolean
          blocked: boolean
          email: string
          full_name: string
          perfil_id: string
          perfil_nome: string
          permissoes: Json
          primeiro_acesso: boolean
          roles: Database["public"]["Enums"]["app_role"][]
          user_id: string
        }[]
      }
      rpc_permitir_login_senha: { Args: never; Returns: boolean }
      rpc_receita_caixa_comparativo_anual: {
        Args: { _anos: number[] }
        Returns: {
          ano: number
          caixa: number
          mes: number
        }[]
      }
      rpc_receita_comparativo_anual: {
        Args: { _anos: number[] }
        Returns: {
          ano: number
          competencia: number
          mes: number
        }[]
      }
      rpc_receita_kpis: {
        Args: { _ano: number; _mes: number; _periodo?: string }
        Returns: {
          atingimento: number
          atingimento_caixa: number
          caixa: number
          competencia: number
          defasagem: number
          meta: number
          previsto: number
        }[]
      }
      rpc_receita_por_canal: {
        Args: { _ano: number; _mes: number; _periodo?: string }
        Returns: {
          canal: string
          valor: number
        }[]
      }
      rpc_receita_por_ramo: {
        Args: { _ano: number; _mes: number; _periodo?: string }
        Returns: {
          ramo: string
          valor: number
        }[]
      }
      rpc_receita_serie_mensal: {
        Args: { _ano: number }
        Returns: {
          caixa: number
          competencia: number
          mes: number
          meta: number
        }[]
      }
      rpc_receita_variacoes: {
        Args: { _ano: number; _mes: number }
        Returns: {
          ano_anterior: number
          atual: number
          mes_anterior: number
          var_ano: number
          var_mes: number
        }[]
      }
      rpc_registrar_acesso: { Args: never; Returns: undefined }
      rpc_set_meta_anual: {
        Args: { _ano: number; _valor: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "ADMIN" | "DIRETORIA_GERAL" | "COLABORADOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "DIRETORIA_GERAL", "COLABORADOR"],
    },
  },
} as const
