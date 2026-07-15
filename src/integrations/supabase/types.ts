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
      lavoro_sync_log: {
        Row: {
          base: string
          criado_em: string
          id: number
          linhas_importadas: number | null
          mensagem_erro: string | null
          origem: string
          status: string
          sync_id: string | null
          usuario_id: string | null
        }
        Insert: {
          base: string
          criado_em?: string
          id?: never
          linhas_importadas?: number | null
          mensagem_erro?: string | null
          origem: string
          status: string
          sync_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          base?: string
          criado_em?: string
          id?: never
          linhas_importadas?: number | null
          mensagem_erro?: string | null
          origem?: string
          status?: string
          sync_id?: string | null
          usuario_id?: string | null
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
          categoria: string | null
          criado_em: string
          data_emissao_nota_fiscal: string | null
          data_pagamento: string | null
          descricao: string | null
          id: number
          mes_referencia: string | null
          observacoes: string | null
          referencia: string | null
          sub_categoria: string | null
          sync_id: string
          tipo_lancamento: string | null
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          criado_em?: string
          data_emissao_nota_fiscal?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: number
          mes_referencia?: string | null
          observacoes?: string | null
          referencia?: string | null
          sub_categoria?: string | null
          sync_id?: string
          tipo_lancamento?: string | null
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          criado_em?: string
          data_emissao_nota_fiscal?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: number
          mes_referencia?: string | null
          observacoes?: string | null
          referencia?: string | null
          sub_categoria?: string | null
          sync_id?: string
          tipo_lancamento?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      raw_lavoro_depara_ramo: {
        Row: {
          criado_em: string
          id: number
          ramo: string
          sync_id: string
          tipo_de_ramo: string
        }
        Insert: {
          criado_em?: string
          id?: number
          ramo: string
          sync_id?: string
          tipo_de_ramo: string
        }
        Update: {
          criado_em?: string
          id?: number
          ramo?: string
          sync_id?: string
          tipo_de_ramo?: string
        }
        Relationships: []
      }
      raw_lavoro_gerencial: {
        Row: {
          analise: string | null
          ano: number | null
          card_id: string | null
          comissao_bruta: number | null
          comissao_emitida: number | null
          criado_em: string
          data_card_finalizado: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_repasse: string | null
          documento: string | null
          empresa_faturada: string | null
          fat_competencia: string | null
          fim_vigencia: string | null
          grupo: string | null
          id: number
          imposto_ret: number | null
          inicio_vigencia: string | null
          mes: number | null
          numero_apolice: string | null
          numero_da_parcela: number | null
          observacao: string | null
          parcelas: string | null
          percentual_comissao: number | null
          percentual_imposto: number | null
          percentual_repasse: number | null
          periodo_atualizacao: string | null
          possui_repasse: string | null
          premio_parcela: number | null
          premio_total: number | null
          qtd_parcelas: number | null
          ramo: string | null
          responsavel: string | null
          segurado: string | null
          seguradora: string | null
          status_parcela_comissao: string | null
          status_repasse: string | null
          sync_id: string
          tipo_pagamento: string | null
          tomador: string | null
          valor_is: number | null
          valor_iss: number | null
          valor_recebido_a_receber: number | null
          valor_repasse_total: number | null
        }
        Insert: {
          analise?: string | null
          ano?: number | null
          card_id?: string | null
          comissao_bruta?: number | null
          comissao_emitida?: number | null
          criado_em?: string
          data_card_finalizado?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_repasse?: string | null
          documento?: string | null
          empresa_faturada?: string | null
          fat_competencia?: string | null
          fim_vigencia?: string | null
          grupo?: string | null
          id?: number
          imposto_ret?: number | null
          inicio_vigencia?: string | null
          mes?: number | null
          numero_apolice?: string | null
          numero_da_parcela?: number | null
          observacao?: string | null
          parcelas?: string | null
          percentual_comissao?: number | null
          percentual_imposto?: number | null
          percentual_repasse?: number | null
          periodo_atualizacao?: string | null
          possui_repasse?: string | null
          premio_parcela?: number | null
          premio_total?: number | null
          qtd_parcelas?: number | null
          ramo?: string | null
          responsavel?: string | null
          segurado?: string | null
          seguradora?: string | null
          status_parcela_comissao?: string | null
          status_repasse?: string | null
          sync_id?: string
          tipo_pagamento?: string | null
          tomador?: string | null
          valor_is?: number | null
          valor_iss?: number | null
          valor_recebido_a_receber?: number | null
          valor_repasse_total?: number | null
        }
        Update: {
          analise?: string | null
          ano?: number | null
          card_id?: string | null
          comissao_bruta?: number | null
          comissao_emitida?: number | null
          criado_em?: string
          data_card_finalizado?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_repasse?: string | null
          documento?: string | null
          empresa_faturada?: string | null
          fat_competencia?: string | null
          fim_vigencia?: string | null
          grupo?: string | null
          id?: number
          imposto_ret?: number | null
          inicio_vigencia?: string | null
          mes?: number | null
          numero_apolice?: string | null
          numero_da_parcela?: number | null
          observacao?: string | null
          parcelas?: string | null
          percentual_comissao?: number | null
          percentual_imposto?: number | null
          percentual_repasse?: number | null
          periodo_atualizacao?: string | null
          possui_repasse?: string | null
          premio_parcela?: number | null
          premio_total?: number | null
          qtd_parcelas?: number | null
          ramo?: string | null
          responsavel?: string | null
          segurado?: string | null
          seguradora?: string | null
          status_parcela_comissao?: string | null
          status_repasse?: string | null
          sync_id?: string
          tipo_pagamento?: string | null
          tomador?: string | null
          valor_is?: number | null
          valor_iss?: number | null
          valor_recebido_a_receber?: number | null
          valor_repasse_total?: number | null
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
      vw_lavoro_depara_ramo: {
        Row: {
          ramo: string | null
          tipo_de_ramo: string | null
        }
        Relationships: []
      }
      vw_lavoro_gerencial: {
        Row: {
          ano: number | null
          comissao_bruta: number | null
          comissao_emitida: number | null
          data_ajustada: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_repasse: string | null
          dezena: string | null
          documento: string | null
          empresa_faturada: string | null
          fim_vigencia: string | null
          grupo: string | null
          id: number | null
          imposto_ret: number | null
          inicio_vigencia: string | null
          mes: number | null
          numero_apolice: string | null
          numero_da_parcela: number | null
          observacao: string | null
          percentual_comissao: number | null
          percentual_repasse: number | null
          possui_repasse: string | null
          premio_parcela: number | null
          premio_total: number | null
          qtd_parcelas: number | null
          ramo: string | null
          responsavel: string | null
          segurado: string | null
          seguradora: string | null
          status_parcela_comissao: string | null
          status_repasse: string | null
          sync_id: string | null
          tipo_de_ramo: string | null
          tipo_pagamento: string | null
          tomador: string | null
          valor_is: number | null
          valor_iss: number | null
          valor_recebido_a_receber: number | null
          valor_repasse_total: number | null
        }
        Relationships: []
      }
      vw_lavoro_previsto_caixa: {
        Row: {
          ano: number | null
          data_pagamento: string | null
          mes: number | null
          ramo: string | null
          status_parcela_comissao: string | null
          tipo_de_ramo: string | null
          valor_previsto: number | null
        }
        Relationships: []
      }
      vw_lavoro_receita_caixa: {
        Row: {
          ano: number | null
          data_pagamento: string | null
          descricao: string | null
          id: number | null
          mes: number | null
          mes_referencia: string | null
          referencia: string | null
          sync_id: string | null
          valor: number | null
        }
        Relationships: []
      }
      vw_lavoro_receita_competencia: {
        Row: {
          ano: number | null
          comissao_bruta: number | null
          data_emissao: string | null
          data_pagamento: string | null
          documento: string | null
          mes: number | null
          ramo: string | null
          segurado: string | null
          seguradora: string | null
          status_parcela_comissao: string | null
          tipo_de_ramo: string | null
          tomador: string | null
        }
        Relationships: []
      }
      vw_lavoro_receita_executivo: {
        Row: {
          data_emissao: string | null
          data_pagamento: string | null
          grupo_status: string | null
          id: number | null
          status_parcela: string | null
          valor: number | null
        }
        Insert: {
          data_emissao?: string | null
          data_pagamento?: string | null
          grupo_status?: never
          id?: number | null
          status_parcela?: never
          valor?: number | null
        }
        Update: {
          data_emissao?: string | null
          data_pagamento?: string | null
          grupo_status?: never
          id?: number | null
          status_parcela?: never
          valor?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      divide_safe: {
        Args: { denominador: number; numerador: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_diretoria: { Args: { _user_id: string }; Returns: boolean }
      is_dominio_lavoro: { Args: { _email: string }; Returns: boolean }
      normalize_categoria_financeira: {
        Args: { categoria: string }
        Returns: string
      }
      pode_gerenciar_configuracoes: {
        Args: { _user_id: string }
        Returns: boolean
      }
      pode_importar: {
        Args: { _tipo: string; _user_id: string }
        Returns: boolean
      }
      rpc_admin_approve_user: {
        Args: { _perfil_id: string; _user_id: string }
        Returns: undefined
      }
      rpc_admin_caixa_append: {
        Args: { _rows: Json; _sync_id: string }
        Returns: number
      }
      rpc_admin_caixa_reset: { Args: never; Returns: string }
      rpc_admin_delete_perfil: { Args: { _id: string }; Returns: undefined }
      rpc_admin_gerencial_append: {
        Args: { _rows: Json; _sync_id: string }
        Returns: number
      }
      rpc_admin_gerencial_reset: { Args: never; Returns: string }
      rpc_admin_ingest_caixa: {
        Args: { _rows: Json }
        Returns: {
          linhas: number
          sync_id: string
        }[]
      }
      rpc_admin_ingest_gerencial: {
        Args: { _ramo_rows: Json; _rows: Json }
        Returns: {
          linhas_gerencial: number
          linhas_ramo: number
          sync_id: string
        }[]
      }
      rpc_admin_last_import: { Args: { _tipo: string }; Returns: string }
      rpc_admin_list_perfis: {
        Args: never
        Returns: {
          created_at: string
          descricao: string
          id: string
          nome: string
          permissoes: Json
          updated_at: string
        }[]
      }
      rpc_admin_list_users: {
        Args: never
        Returns: {
          active: boolean
          blocked: boolean
          criado_em: string
          email: string
          full_name: string
          perfil_id: string
          perfil_nome: string
          ultimo_acesso: string
          user_id: string
        }[]
      }
      rpc_admin_ramo_append: {
        Args: { _rows: Json; _sync_id: string }
        Returns: number
      }
      rpc_admin_update_user: {
        Args: {
          _active: boolean
          _blocked: boolean
          _perfil_id: string
          _user_id: string
        }
        Returns: undefined
      }
      rpc_admin_upsert_perfil: {
        Args: {
          _descricao: string
          _id: string
          _nome: string
          _permissoes: Json
        }
        Returns: string
      }
      rpc_comissao_vencida_por_canal: {
        Args: { p_ano: number; p_mes?: number; p_periodo?: string }
        Returns: {
          comissao_vencida: number
          tipo_de_ramo: string
        }[]
      }
      rpc_get_meta_anual: { Args: { _ano: number }; Returns: number }
      rpc_lavoro_apolices_filtros: {
        Args: never
        Returns: {
          anos: number[]
          apolices: string[]
          grupos: string[]
          ramos: string[]
          seguradoras: string[]
          status_parcela_comissao: string[]
          status_repasse: string[]
          tipos_ramo: string[]
          tomadores: string[]
        }[]
      }
      rpc_lavoro_apolices_kpis: {
        Args: {
          p_ano?: number
          p_apolice?: string
          p_grupo?: string
          p_possui_repasse?: string
          p_ramo?: string
          p_seguradora?: string
          p_status?: string
          p_tipo_ramo?: string
          p_tomador?: string
        }
        Returns: {
          comissao_emitida: number
          comissao_gerada: number
          comissao_menos_repasse: number
          premio_total: number
          repasse_parceiro: number
        }[]
      }
      rpc_lavoro_apolices_lista: {
        Args: { p_filtros?: Json; p_pagina?: number; p_tamanho_pagina?: number }
        Returns: {
          comissao_bruta: number
          data_emissao: string
          documento: string
          numero_apolice: string
          ramo: string
          segurado: string
          seguradora: string
          status_parcela_comissao: string
          tipo_de_ramo: string
          tomador: string
          total_linhas: number
        }[]
      }
      rpc_lavoro_apolices_por_seguradora: {
        Args: { p_filtros?: Json }
        Returns: {
          comissao_bruta: number
          premio_total: number
          seguradora: string
        }[]
      }
      rpc_lavoro_apolices_previsao_dezena: {
        Args: { p_ano?: number; p_mes?: number }
        Returns: {
          ano: number
          dezena: string
          empresa_faturada: string
          mes: number
          valor_a_receber: number
        }[]
      }
      rpc_lavoro_get_meta_anual: { Args: { p_ano: number }; Returns: number }
      rpc_lavoro_receita_caixa_comparativo_anual: {
        Args: { p_anos: number[] }
        Returns: {
          ano: number
          mes: number
          receita_caixa: number
        }[]
      }
      rpc_lavoro_receita_comparativo_anual: {
        Args: { p_anos: number[] }
        Returns: {
          ano: number
          mes: number
          receita_competencia: number
        }[]
      }
      rpc_lavoro_receita_kpis: {
        Args: { p_ano: number; p_mes: number; p_periodo?: string }
        Returns: {
          atingimento: number
          atingimento_caixa: number
          defasagem: number
          meta_periodo: number
          previsto_caixa: number
          receita_caixa: number
          receita_competencia: number
        }[]
      }
      rpc_lavoro_receita_por_canal: {
        Args: { p_ano: number; p_mes: number; p_periodo?: string }
        Returns: {
          receita: number
          tipo_de_ramo: string
        }[]
      }
      rpc_lavoro_receita_por_ramo: {
        Args: { p_ano: number; p_mes: number; p_periodo?: string }
        Returns: {
          ramo: string
          receita: number
        }[]
      }
      rpc_lavoro_receita_serie_mensal: {
        Args: { p_ano: number }
        Returns: {
          mes: number
          meta_mensal: number
          receita_caixa: number
          receita_competencia: number
        }[]
      }
      rpc_lavoro_receita_variacoes: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          variacao_ano_anterior: number
          variacao_mes_anterior: number
        }[]
      }
      rpc_lavoro_set_meta_anual: {
        Args: { p_ano: number; p_valor: number }
        Returns: undefined
      }
      rpc_lavoro_ultima_atualizacao: { Args: never; Returns: string }
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
      rpc_receita_executivo_complementares: {
        Args: { p_ano: number }
        Returns: {
          emissoes_ate_2025_a_receber: number
          posicao_total_vencida: number
          vencidos_anteriores_2026: number
        }[]
      }
      rpc_receita_executivo_mensal: {
        Args: { p_ano: number }
        Returns: {
          a_receber_futuro: number
          caixa: number
          caixa_corrente: number
          emitido: number
          mes: number
          saldo_vencido: number
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
