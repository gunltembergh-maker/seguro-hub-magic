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
      ab_consentimento: {
        Row: {
          base_legal: string
          created_at: string
          documento: string
          evidencia: Json | null
          finalidade: string
          id: string
          nome: string | null
          revogado_em: string | null
          solicitante: string | null
          validade: string | null
        }
        Insert: {
          base_legal?: string
          created_at?: string
          documento: string
          evidencia?: Json | null
          finalidade: string
          id?: string
          nome?: string | null
          revogado_em?: string | null
          solicitante?: string | null
          validade?: string | null
        }
        Update: {
          base_legal?: string
          created_at?: string
          documento?: string
          evidencia?: Json | null
          finalidade?: string
          id?: string
          nome?: string | null
          revogado_em?: string | null
          solicitante?: string | null
          validade?: string | null
        }
        Relationships: []
      }
      ab_consumo: {
        Row: {
          area: string | null
          created_at: string
          custo: number
          detalhe: string | null
          documento: string | null
          id: string
          provedor: string | null
          solicitacao_id: string | null
          tipo: string
          usuario: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          custo?: number
          detalhe?: string | null
          documento?: string | null
          id?: string
          provedor?: string | null
          solicitacao_id?: string | null
          tipo: string
          usuario?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          custo?: number
          detalhe?: string | null
          documento?: string | null
          id?: string
          provedor?: string | null
          solicitacao_id?: string | null
          tipo?: string
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_consumo_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "ab_solicitacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_consumo_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "ab_v_solicitacao"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_contrato_publico: {
        Row: {
          created_at: string
          data_assinatura: string | null
          empresa_id: string
          fonte: string | null
          id: string
          identificador: string
          objeto: string | null
          obra_engenharia: boolean
          orgao: string | null
          raw: Json | null
          valor: number | null
          vigencia_fim: string | null
        }
        Insert: {
          created_at?: string
          data_assinatura?: string | null
          empresa_id: string
          fonte?: string | null
          id?: string
          identificador: string
          objeto?: string | null
          obra_engenharia?: boolean
          orgao?: string | null
          raw?: Json | null
          valor?: number | null
          vigencia_fim?: string | null
        }
        Update: {
          created_at?: string
          data_assinatura?: string | null
          empresa_id?: string
          fonte?: string | null
          id?: string
          identificador?: string
          objeto?: string | null
          obra_engenharia?: boolean
          orgao?: string | null
          raw?: Json | null
          valor?: number | null
          vigencia_fim?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_contrato_publico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_contrato_publico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_contrato_publico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_cota: {
        Row: {
          area: string
          consumido_consultas: number
          consumido_valor: number
          created_at: string
          id: string
          limite_consultas: number | null
          limite_valor: number | null
          mes: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          area: string
          consumido_consultas?: number
          consumido_valor?: number
          created_at?: string
          id?: string
          limite_consultas?: number | null
          limite_valor?: number | null
          mes: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          consumido_consultas?: number
          consumido_valor?: number
          created_at?: string
          id?: string
          limite_consultas?: number | null
          limite_valor?: number | null
          mes?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ab_dossie: {
        Row: {
          achados: Json | null
          created_at: string
          documento: string
          finalidade: string
          fontes_consultadas: Json | null
          fontes_indisponiveis: Json | null
          id: string
          nome: string | null
          score: number | null
          solicitante: string | null
          tipo_documento: string
          veredito: string | null
        }
        Insert: {
          achados?: Json | null
          created_at?: string
          documento: string
          finalidade: string
          fontes_consultadas?: Json | null
          fontes_indisponiveis?: Json | null
          id?: string
          nome?: string | null
          score?: number | null
          solicitante?: string | null
          tipo_documento: string
          veredito?: string | null
        }
        Update: {
          achados?: Json | null
          created_at?: string
          documento?: string
          finalidade?: string
          fontes_consultadas?: Json | null
          fontes_indisponiveis?: Json | null
          id?: string
          nome?: string | null
          score?: number | null
          solicitante?: string | null
          tipo_documento?: string
          veredito?: string | null
        }
        Relationships: []
      }
      ab_edital: {
        Row: {
          created_at: string
          data_encerramento: string | null
          exige_garantia_contratual: boolean
          exige_garantia_proposta: boolean
          fonte: string | null
          id: string
          identificador: string
          modalidade: string | null
          objeto: string | null
          orgao: string | null
          percentual_garantia: number | null
          raw: Json | null
          trecho_garantia: string | null
          uf: string | null
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          data_encerramento?: string | null
          exige_garantia_contratual?: boolean
          exige_garantia_proposta?: boolean
          fonte?: string | null
          id?: string
          identificador: string
          modalidade?: string | null
          objeto?: string | null
          orgao?: string | null
          percentual_garantia?: number | null
          raw?: Json | null
          trecho_garantia?: string | null
          uf?: string | null
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          data_encerramento?: string | null
          exige_garantia_contratual?: boolean
          exige_garantia_proposta?: boolean
          fonte?: string | null
          id?: string
          identificador?: string
          modalidade?: string | null
          objeto?: string | null
          orgao?: string | null
          percentual_garantia?: number | null
          raw?: Json | null
          trecho_garantia?: string | null
          uf?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      ab_empresa: {
        Row: {
          bairro: string | null
          cadastro_atualizado_em: string | null
          cadastro_fonte: string | null
          capital_social: number | null
          cep: string | null
          cnae: string | null
          cnae_descricao: string | null
          cnaes_secundarios: string[] | null
          cnpj: string
          cnpj_raiz: string
          complemento: string | null
          created_at: string
          data_abertura: string | null
          email: string | null
          id: string
          logradouro: string | null
          matriz_filial: string | null
          monitorado: boolean
          municipio: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          numero: string | null
          porte: string | null
          raw: Json | null
          razao_social: string
          relacao: string
          situacao_cadastral: string | null
          telefone: string | null
          telefone_2: string | null
          transparencia_checado_em: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cadastro_atualizado_em?: string | null
          cadastro_fonte?: string | null
          capital_social?: number | null
          cep?: string | null
          cnae?: string | null
          cnae_descricao?: string | null
          cnaes_secundarios?: string[] | null
          cnpj: string
          cnpj_raiz: string
          complemento?: string | null
          created_at?: string
          data_abertura?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          matriz_filial?: string | null
          monitorado?: boolean
          municipio?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte?: string | null
          raw?: Json | null
          razao_social: string
          relacao?: string
          situacao_cadastral?: string | null
          telefone?: string | null
          telefone_2?: string | null
          transparencia_checado_em?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cadastro_atualizado_em?: string | null
          cadastro_fonte?: string | null
          capital_social?: number | null
          cep?: string | null
          cnae?: string | null
          cnae_descricao?: string | null
          cnaes_secundarios?: string[] | null
          cnpj?: string
          cnpj_raiz?: string
          complemento?: string | null
          created_at?: string
          data_abertura?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          matriz_filial?: string | null
          monitorado?: boolean
          municipio?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte?: string | null
          raw?: Json | null
          razao_social?: string
          relacao?: string
          situacao_cadastral?: string | null
          telefone?: string | null
          telefone_2?: string | null
          transparencia_checado_em?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ab_evento: {
        Row: {
          confianca: number
          created_at: string
          deadline: string | null
          deadline_fonte: string | null
          descricao: string
          empresa_id: string
          evidencia: Json | null
          gatilho: string
          id: string
          importancia_segurada: number | null
          modalidade: string
          processo_id: string | null
          referencia: string
          valor_base: number
        }
        Insert: {
          confianca?: number
          created_at?: string
          deadline?: string | null
          deadline_fonte?: string | null
          descricao: string
          empresa_id: string
          evidencia?: Json | null
          gatilho: string
          id?: string
          importancia_segurada?: number | null
          modalidade: string
          processo_id?: string | null
          referencia: string
          valor_base?: number
        }
        Update: {
          confianca?: number
          created_at?: string
          deadline?: string | null
          deadline_fonte?: string | null
          descricao?: string
          empresa_id?: string
          evidencia?: Json | null
          gatilho?: string
          id?: string
          importancia_segurada?: number | null
          modalidade?: string
          processo_id?: string | null
          referencia?: string
          valor_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "ab_evento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_evento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_evento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_evento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "ab_processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_evento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "ab_v_processo"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_ingest_estado: {
        Row: {
          ciclos: number
          cursor_pagina: number
          detalhe: string | null
          falhas_na_pagina: number
          fonte: string
          indisponivel_ate: string | null
          janela_fim: string | null
          janela_inicio: string | null
          leitura_ok_em: string | null
          paginas_no_ciclo: number
          paginas_puladas: number[]
          rate_limited_ate: string | null
          total_paginas: number | null
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ciclos?: number
          cursor_pagina?: number
          detalhe?: string | null
          falhas_na_pagina?: number
          fonte: string
          indisponivel_ate?: string | null
          janela_fim?: string | null
          janela_inicio?: string | null
          leitura_ok_em?: string | null
          paginas_no_ciclo?: number
          paginas_puladas?: number[]
          rate_limited_ate?: string | null
          total_paginas?: number | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ciclos?: number
          cursor_pagina?: number
          detalhe?: string | null
          falhas_na_pagina?: number
          fonte?: string
          indisponivel_ate?: string | null
          janela_fim?: string | null
          janela_inicio?: string | null
          leitura_ok_em?: string | null
          paginas_no_ciclo?: number
          paginas_puladas?: number[]
          rate_limited_ate?: string | null
          total_paginas?: number | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ab_ingest_log: {
        Row: {
          created_at: string
          detalhe: string | null
          duracao_ms: number | null
          fonte: string
          gravados: number
          id: string
          recebidos: number
          status: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          duracao_ms?: number | null
          fonte: string
          gravados?: number
          id?: string
          recebidos?: number
          status: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          duracao_ms?: number | null
          fonte?: string
          gravados?: number
          id?: string
          recebidos?: number
          status?: string
        }
        Relationships: []
      }
      ab_inscricao_divida: {
        Row: {
          data_inscricao: string | null
          empresa_id: string
          ente: string
          fonte: string | null
          id: string
          numero_inscricao: string | null
          raw: Json | null
          receita_origem: string | null
          situacao: string | null
          tipo: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          data_inscricao?: string | null
          empresa_id: string
          ente?: string
          fonte?: string | null
          id?: string
          numero_inscricao?: string | null
          raw?: Json | null
          receita_origem?: string | null
          situacao?: string | null
          tipo?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          data_inscricao?: string | null
          empresa_id?: string
          ente?: string
          fonte?: string | null
          id?: string
          numero_inscricao?: string | null
          raw?: Json | null
          receita_origem?: string | null
          situacao?: string | null
          tipo?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ab_inscricao_divida_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_inscricao_divida_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_inscricao_divida_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_lead: {
        Row: {
          argumento: string | null
          bloqueios: string[] | null
          confianca: number
          created_at: string
          deadline: string | null
          empresa_id: string
          gatilhos: string[]
          id: string
          importancia_segurada: number
          modalidade: string
          observacao: string | null
          premio_estimado: number
          prioridade: number
          prob_subscricao: number
          produto: string
          responsavel: string | null
          status: string
          updated_at: string
          urgencia: number
          valor_base: number
        }
        Insert: {
          argumento?: string | null
          bloqueios?: string[] | null
          confianca?: number
          created_at?: string
          deadline?: string | null
          empresa_id: string
          gatilhos?: string[]
          id?: string
          importancia_segurada?: number
          modalidade: string
          observacao?: string | null
          premio_estimado?: number
          prioridade?: number
          prob_subscricao?: number
          produto: string
          responsavel?: string | null
          status?: string
          updated_at?: string
          urgencia?: number
          valor_base?: number
        }
        Update: {
          argumento?: string | null
          bloqueios?: string[] | null
          confianca?: number
          created_at?: string
          deadline?: string | null
          empresa_id?: string
          gatilhos?: string[]
          id?: string
          importancia_segurada?: number
          modalidade?: string
          observacao?: string | null
          premio_estimado?: number
          prioridade?: number
          prob_subscricao?: number
          produto?: string
          responsavel?: string | null
          status?: string
          updated_at?: string
          urgencia?: number
          valor_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "ab_lead_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_lead_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_lead_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_lead_evento: {
        Row: {
          created_at: string
          de_status: string | null
          id: string
          lead_id: string
          nota: string | null
          para_status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          de_status?: string | null
          id?: string
          lead_id: string
          nota?: string | null
          para_status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          de_status?: string | null
          id?: string
          lead_id?: string
          nota?: string | null
          para_status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_lead_evento_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "ab_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_lead_evento_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "ab_lead_evento_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "ab_v_oportunidade"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      ab_movimentacao: {
        Row: {
          codigo_tpu: string | null
          created_at: string
          data: string | null
          fonte: string | null
          id: string
          processo_id: string
          sinais: string[]
          texto: string | null
          tipo: string | null
        }
        Insert: {
          codigo_tpu?: string | null
          created_at?: string
          data?: string | null
          fonte?: string | null
          id?: string
          processo_id: string
          sinais?: string[]
          texto?: string | null
          tipo?: string | null
        }
        Update: {
          codigo_tpu?: string | null
          created_at?: string
          data?: string | null
          fonte?: string | null
          id?: string
          processo_id?: string
          sinais?: string[]
          texto?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_movimentacao_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "ab_processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_movimentacao_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "ab_v_processo"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_parametro: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      ab_processo: {
        Row: {
          area: string | null
          assuntos: Json | null
          classe: string | null
          classe_codigo: string | null
          created_at: string
          distribuicao: string | null
          empresa_id: string
          fase: string | null
          fonte: string | null
          garantia_prestada: boolean
          id: string
          numero: string
          orgao_julgador: string | null
          polo: string | null
          raw: Json | null
          status: string | null
          tribunal: string | null
          uf: string | null
          updated_at: string
          valor_causa: number | null
          valor_execucao: number | null
        }
        Insert: {
          area?: string | null
          assuntos?: Json | null
          classe?: string | null
          classe_codigo?: string | null
          created_at?: string
          distribuicao?: string | null
          empresa_id: string
          fase?: string | null
          fonte?: string | null
          garantia_prestada?: boolean
          id?: string
          numero: string
          orgao_julgador?: string | null
          polo?: string | null
          raw?: Json | null
          status?: string | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_execucao?: number | null
        }
        Update: {
          area?: string | null
          assuntos?: Json | null
          classe?: string | null
          classe_codigo?: string | null
          created_at?: string
          distribuicao?: string | null
          empresa_id?: string
          fase?: string | null
          fonte?: string | null
          garantia_prestada?: boolean
          id?: string
          numero?: string
          orgao_julgador?: string | null
          polo?: string | null
          raw?: Json | null
          status?: string | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_execucao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_provedor: {
        Row: {
          ativo: boolean
          auth_header: string | null
          auth_tipo: string | null
          base_url: string | null
          capacidades: Json
          chave: string
          created_at: string
          custo_consulta: number
          custo_monitoramento_mes: number
          doc_url: string | null
          nome: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auth_header?: string | null
          auth_tipo?: string | null
          base_url?: string | null
          capacidades?: Json
          chave: string
          created_at?: string
          custo_consulta?: number
          custo_monitoramento_mes?: number
          doc_url?: string | null
          nome: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auth_header?: string | null
          auth_tipo?: string | null
          base_url?: string | null
          capacidades?: Json
          chave?: string
          created_at?: string
          custo_consulta?: number
          custo_monitoramento_mes?: number
          doc_url?: string | null
          nome?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ab_restritivo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          fim: string | null
          fonte: string | null
          id: string
          inicio: string | null
          raw: Json | null
          tipo: string
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id: string
          fim?: string | null
          fonte?: string | null
          id?: string
          inicio?: string | null
          raw?: Json | null
          tipo: string
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          fim?: string | null
          fonte?: string | null
          id?: string
          inicio?: string | null
          raw?: Json | null
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_restritivo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_restritivo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_restritivo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_sinal: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          nome: string
          padrao: string
          peso: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          nome: string
          padrao: string
          peso: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          padrao?: string
          peso?: number
        }
        Relationships: []
      }
      ab_socio: {
        Row: {
          desde: string | null
          documento_mascarado: string | null
          empresa_id: string
          faixa_etaria: string | null
          fonte: string | null
          id: string
          nome: string
          qualificacao: string | null
          representante_nome: string | null
          representante_qualif: string | null
          tipo: string | null
        }
        Insert: {
          desde?: string | null
          documento_mascarado?: string | null
          empresa_id: string
          faixa_etaria?: string | null
          fonte?: string | null
          id?: string
          nome: string
          qualificacao?: string | null
          representante_nome?: string | null
          representante_qualif?: string | null
          tipo?: string | null
        }
        Update: {
          desde?: string | null
          documento_mascarado?: string | null
          empresa_id?: string
          faixa_etaria?: string | null
          fonte?: string | null
          id?: string
          nome?: string
          qualificacao?: string | null
          representante_nome?: string | null
          representante_qualif?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_socio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_socio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_socio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_solicitacao: {
        Row: {
          area: string | null
          concluido_em: string | null
          created_at: string
          custo: number
          detalhe: string | null
          documento: string
          empresa_id: string | null
          escopo: string
          finalidade: string
          id: string
          iniciado_em: string | null
          leads_gerados: number
          liberado_em: string | null
          liberado_por: string | null
          movimentacoes_novas: number
          nome: string | null
          processos_encontrados: number
          provedor: string | null
          resultado: Json | null
          solicitante: string | null
          status: string
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          concluido_em?: string | null
          created_at?: string
          custo?: number
          detalhe?: string | null
          documento: string
          empresa_id?: string | null
          escopo?: string
          finalidade: string
          id?: string
          iniciado_em?: string | null
          leads_gerados?: number
          liberado_em?: string | null
          liberado_por?: string | null
          movimentacoes_novas?: number
          nome?: string | null
          processos_encontrados?: number
          provedor?: string | null
          resultado?: Json | null
          solicitante?: string | null
          status?: string
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          concluido_em?: string | null
          created_at?: string
          custo?: number
          detalhe?: string | null
          documento?: string
          empresa_id?: string | null
          escopo?: string
          finalidade?: string
          id?: string
          iniciado_em?: string | null
          leads_gerados?: number
          liberado_em?: string | null
          liberado_por?: string | null
          movimentacoes_novas?: number
          nome?: string | null
          processos_encontrados?: number
          provedor?: string | null
          resultado?: Json | null
          solicitante?: string | null
          status?: string
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_solicitacao_provedor_fkey"
            columns: ["provedor"]
            isOneToOne: false
            referencedRelation: "ab_provedor"
            referencedColumns: ["chave"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          acao: string
          alvo_descricao: string | null
          alvo_id: string | null
          antes: Json | null
          ator_email: string | null
          ator_id: string | null
          ator_nome: string | null
          created_at: string
          depois: Json | null
          entidade: string
          id: string
          mudancas: Json | null
          notificacao_erro: string | null
          notificado_em: string | null
        }
        Insert: {
          acao: string
          alvo_descricao?: string | null
          alvo_id?: string | null
          antes?: Json | null
          ator_email?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          created_at?: string
          depois?: Json | null
          entidade: string
          id?: string
          mudancas?: Json | null
          notificacao_erro?: string | null
          notificado_em?: string | null
        }
        Update: {
          acao?: string
          alvo_descricao?: string | null
          alvo_id?: string | null
          antes?: Json | null
          ator_email?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          created_at?: string
          depois?: Json | null
          entidade?: string
          id?: string
          mudancas?: Json | null
          notificacao_erro?: string | null
          notificado_em?: string | null
        }
        Relationships: []
      }
      admin_popup_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          popup_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          popup_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          popup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_popup_dismissals_popup_id_fkey"
            columns: ["popup_id"]
            isOneToOne: false
            referencedRelation: "admin_popups"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_popups: {
        Row: {
          ativo: boolean
          botao_label: string | null
          cor_fundo: string | null
          cor_texto: string | null
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          destinatarios: string[] | null
          id: string
          logo_url: string | null
          mensagem: string
          mostrar_nome_hub: boolean | null
          paginas: string[] | null
          perfis: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          botao_label?: string | null
          cor_fundo?: string | null
          cor_texto?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          destinatarios?: string[] | null
          id?: string
          logo_url?: string | null
          mensagem: string
          mostrar_nome_hub?: boolean | null
          paginas?: string[] | null
          perfis?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          botao_label?: string | null
          cor_fundo?: string | null
          cor_texto?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          destinatarios?: string[] | null
          id?: string
          logo_url?: string | null
          mensagem?: string
          mostrar_nome_hub?: boolean | null
          paginas?: string[] | null
          perfis?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_rotas: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          rota: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          rota: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          rota?: string
        }
        Relationships: []
      }
      canais: {
        Row: {
          apelidos: string[]
          ativo: boolean
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          email_financeiro: string | null
          id: string
          modelo_repasse: string | null
          nome: string
          percentual_repasse: number | null
          pipefy_card_id: number | null
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          apelidos?: string[]
          ativo?: boolean
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          email_financeiro?: string | null
          id?: string
          modelo_repasse?: string | null
          nome: string
          percentual_repasse?: number | null
          pipefy_card_id?: number | null
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          apelidos?: string[]
          ativo?: boolean
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          email_financeiro?: string | null
          id?: string
          modelo_repasse?: string | null
          nome?: string
          percentual_repasse?: number | null
          pipefy_card_id?: number | null
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cliente_ramos: {
        Row: {
          cliente_id: string
          created_at: string
          ramo_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          ramo_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          ramo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_ramos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_ramos_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "ramos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_vinculos: {
        Row: {
          cliente_id: string
          created_at: string
          observacao: string | null
          vinculado_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          observacao?: string | null
          vinculado_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          observacao?: string | null
          vinculado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_vinculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_vinculos_vinculado_id_fkey"
            columns: ["vinculado_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          atividade_principal: string | null
          ativo: boolean
          canal_id: string
          cidade: string | null
          cliente_bradesco_6332: boolean | null
          contato_principal: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          email_copia: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_razao_social: string
          numero_cliente: string
          observacoes: string | null
          pipefy_card_id: number | null
          porte_empresa: string | null
          telefone: string | null
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          atividade_principal?: string | null
          ativo?: boolean
          canal_id: string
          cidade?: string | null
          cliente_bradesco_6332?: boolean | null
          contato_principal?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          email_copia?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_razao_social: string
          numero_cliente?: string
          observacoes?: string | null
          pipefy_card_id?: number | null
          porte_empresa?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Update: {
          atividade_principal?: string | null
          ativo?: boolean
          canal_id?: string
          cidade?: string | null
          cliente_bradesco_6332?: boolean | null
          contato_principal?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          email_copia?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_razao_social?: string
          numero_cliente?: string
          observacoes?: string | null
          pipefy_card_id?: number | null
          porte_empresa?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
        ]
      }
      coberturas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      contrato_coberturas: {
        Row: {
          ativa_ate: string | null
          ativa_desde: string
          cobertura_id: string
          contrato_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          ativa_ate?: string | null
          ativa_desde: string
          cobertura_id: string
          contrato_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativa_ate?: string | null
          ativa_desde?: string
          cobertura_id?: string
          contrato_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_coberturas_cobertura_id_fkey"
            columns: ["cobertura_id"]
            isOneToOne: false
            referencedRelation: "coberturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_coberturas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          canal_id: string
          cliente_id: string
          created_at: string
          data_fim_vigencia: string
          data_inicio_vigencia: string
          id: string
          migrou_outra_corretora: boolean
          numero_apolice: string | null
          percentual_agenciamento: number | null
          percentual_vitalicio: number | null
          premio_atual: number | null
          quantidade_vidas: number | null
          responsavel_id: string | null
          seguradora_id: string
          status: string
          updated_at: string
        }
        Insert: {
          canal_id: string
          cliente_id: string
          created_at?: string
          data_fim_vigencia: string
          data_inicio_vigencia: string
          id?: string
          migrou_outra_corretora?: boolean
          numero_apolice?: string | null
          percentual_agenciamento?: number | null
          percentual_vitalicio?: number | null
          premio_atual?: number | null
          quantidade_vidas?: number | null
          responsavel_id?: string | null
          seguradora_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          canal_id?: string
          cliente_id?: string
          created_at?: string
          data_fim_vigencia?: string
          data_inicio_vigencia?: string
          id?: string
          migrou_outra_corretora?: boolean
          numero_apolice?: string | null
          percentual_agenciamento?: number | null
          percentual_vitalicio?: number | null
          premio_atual?: number | null
          quantidade_vidas?: number | null
          responsavel_id?: string | null
          seguradora_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_seguradora_id_fkey"
            columns: ["seguradora_id"]
            isOneToOne: false
            referencedRelation: "seguradoras"
            referencedColumns: ["id"]
          },
        ]
      }
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
      email_destinatarios_automaticos: {
        Row: {
          adicionado_por: string | null
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          modulo: string
          user_id: string
        }
        Insert: {
          adicionado_por?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          modulo: string
          user_id: string
        }
        Update: {
          adicionado_por?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          modulo?: string
          user_id?: string
        }
        Relationships: []
      }
      email_disparos_automaticos: {
        Row: {
          data_envio: string
          detalhes_erro: Json | null
          disparado_em: string
          finalizado_em: string | null
          forcado_por: string | null
          hora_slot: string | null
          id: string
          modulo: string
          periodo_ref: string | null
          status: string
          total_destinatarios: number
          total_falhas: number
          total_sucessos: number
        }
        Insert: {
          data_envio: string
          detalhes_erro?: Json | null
          disparado_em?: string
          finalizado_em?: string | null
          forcado_por?: string | null
          hora_slot?: string | null
          id?: string
          modulo: string
          periodo_ref?: string | null
          status?: string
          total_destinatarios?: number
          total_falhas?: number
          total_sucessos?: number
        }
        Update: {
          data_envio?: string
          detalhes_erro?: Json | null
          disparado_em?: string
          finalizado_em?: string | null
          forcado_por?: string | null
          hora_slot?: string | null
          id?: string
          modulo?: string
          periodo_ref?: string | null
          status?: string
          total_destinatarios?: number
          total_falhas?: number
          total_sucessos?: number
        }
        Relationships: []
      }
      email_schedules_config: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cron_jobid: number | null
          dias_semana: number[]
          hora_brt: string
          modulo: string
          motivo_pausa: string | null
          pausado_em: string | null
          pausado_por: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cron_jobid?: number | null
          dias_semana?: number[]
          hora_brt?: string
          modulo: string
          motivo_pausa?: string | null
          pausado_em?: string | null
          pausado_por?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cron_jobid?: number | null
          dias_semana?: number[]
          hora_brt?: string
          modulo?: string
          motivo_pausa?: string | null
          pausado_em?: string | null
          pausado_por?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          disparado_por: string | null
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          disparado_por?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          disparado_por?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      feriados_nacionais: {
        Row: {
          created_at: string
          data: string
          descricao: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
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
      market_news_cache: {
        Row: {
          categoria: string
          criado_em: string
          fonte: string
          id: string
          link: string
          publicado_em: string | null
          titulo: string
        }
        Insert: {
          categoria: string
          criado_em?: string
          fonte: string
          id?: string
          link: string
          publicado_em?: string | null
          titulo: string
        }
        Update: {
          categoria?: string
          criado_em?: string
          fonte?: string
          id?: string
          link?: string
          publicado_em?: string | null
          titulo?: string
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
          area: string | null
          blocked: boolean
          cpf: string | null
          created_at: string
          email: string
          empresa: string | null
          full_name: string | null
          gestor: string | null
          id: string
          perfil_id: string | null
          primeiro_acesso: boolean
          times_receita: string[]
          tipo_usuario: string
          ultimo_acesso: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          blocked?: boolean
          cpf?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          full_name?: string | null
          gestor?: string | null
          id?: string
          perfil_id?: string | null
          primeiro_acesso?: boolean
          times_receita?: string[]
          tipo_usuario?: string
          ultimo_acesso?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          area?: string | null
          blocked?: boolean
          cpf?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          full_name?: string | null
          gestor?: string | null
          id?: string
          perfil_id?: string | null
          primeiro_acesso?: boolean
          times_receita?: string[]
          tipo_usuario?: string
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
      ramos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
      report_destinatarios: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string | null
          tipo: Database["public"]["Enums"]["report_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          tipo: Database["public"]["Enums"]["report_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          tipo?: Database["public"]["Enums"]["report_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      report_disparos: {
        Row: {
          created_at: string
          disparado_em: string
          disparado_por: string | null
          erro: string | null
          id: string
          payload: Json | null
          periodo_ref: string | null
          status: string
          tipo: Database["public"]["Enums"]["report_tipo"]
          total_destinatarios: number
        }
        Insert: {
          created_at?: string
          disparado_em?: string
          disparado_por?: string | null
          erro?: string | null
          id?: string
          payload?: Json | null
          periodo_ref?: string | null
          status?: string
          tipo: Database["public"]["Enums"]["report_tipo"]
          total_destinatarios?: number
        }
        Update: {
          created_at?: string
          disparado_em?: string
          disparado_por?: string | null
          erro?: string | null
          id?: string
          payload?: Json | null
          periodo_ref?: string | null
          status?: string
          tipo?: Database["public"]["Enums"]["report_tipo"]
          total_destinatarios?: number
        }
        Relationships: []
      }
      seguradoras: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      sso_handoff: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          payload: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          payload: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          payload?: string
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
      user_page_view: {
        Row: {
          created_at: string
          duracao_seg: number
          entrou_em: string
          id: string
          rota: string
          titulo: string | null
          ultimo_ping_em: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duracao_seg?: number
          entrou_em?: string
          id?: string
          rota: string
          titulo?: string | null
          ultimo_ping_em?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duracao_seg?: number
          entrou_em?: string
          id?: string
          rota?: string
          titulo?: string | null
          ultimo_ping_em?: string
          user_agent?: string | null
          user_id?: string
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
      usuarios_convite_externo: {
        Row: {
          aceito_em: string | null
          criado_em: string
          criado_por: string | null
          email: string
          id: string
          perfil_id: string | null
        }
        Insert: {
          aceito_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email: string
          id?: string
          perfil_id?: string | null
        }
        Update: {
          aceito_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string
          id?: string
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_convite_externo_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ab_v_carteira: {
        Row: {
          cnae_descricao: string | null
          cnpj: string | null
          contratos_publicos: number | null
          divida_ativa: number | null
          empresa_id: string | null
          exposicao_judicial: number | null
          is_potencial: number | null
          monitorado: boolean | null
          n_em_execucao: number | null
          n_leads: number | null
          n_processos: number | null
          porte: string | null
          razao_social: string | null
          relacao: string | null
          restritivos: string[] | null
          situacao_cadastral: string | null
          uf: string | null
        }
        Relationships: []
      }
      ab_v_consumo_mes: {
        Row: {
          area: string | null
          consultas: number | null
          mes: string | null
          provedor: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
      ab_v_cota: {
        Row: {
          area: string | null
          consumido_consultas: number | null
          consumido_valor: number | null
          id: string | null
          limite_consultas: number | null
          limite_valor: number | null
          mes: string | null
          observacao: string | null
          restante_consultas: number | null
          restante_valor: number | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          consumido_consultas?: number | null
          consumido_valor?: number | null
          id?: string | null
          limite_consultas?: number | null
          limite_valor?: number | null
          mes?: string | null
          observacao?: string | null
          restante_consultas?: never
          restante_valor?: never
          situacao?: never
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          consumido_consultas?: number | null
          consumido_valor?: number | null
          id?: string | null
          limite_consultas?: number | null
          limite_valor?: number | null
          mes?: string | null
          observacao?: string | null
          restante_consultas?: never
          restante_valor?: never
          situacao?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      ab_v_fila: {
        Row: {
          bloqueios: string[] | null
          cnae: string | null
          cnae_descricao: string | null
          cnpj: string | null
          confianca: number | null
          created_at: string | null
          deadline: string | null
          dias_para_prazo: number | null
          empresa_id: string | null
          gatilhos: string[] | null
          importancia_segurada: number | null
          lead_id: string | null
          modalidade: string | null
          monitorado: boolean | null
          municipio: string | null
          porte: string | null
          premio_estimado: number | null
          prioridade: number | null
          prob_subscricao: number | null
          produto: string | null
          qualificacao: string | null
          razao_social: string | null
          relacao: string | null
          responsavel: string | null
          status: string | null
          telefone: string | null
          telefone_2: string | null
          uf: string | null
          urgencia: number | null
          valor_base: number | null
        }
        Relationships: []
      }
      ab_v_oportunidade: {
        Row: {
          area: string | null
          bloqueios: string[] | null
          classe: string | null
          classe_codigo: string | null
          cnpj: string | null
          confianca: number | null
          deadline: string | null
          deadline_fonte: string | null
          dias_para_prazo: number | null
          distribuicao: string | null
          empresa_id: string | null
          fase: string | null
          garantia_prestada: boolean | null
          gatilhos: string[] | null
          importancia_segurada: number | null
          lead_id: string | null
          lead_status: string | null
          modalidade: string | null
          monitorado: boolean | null
          municipio: string | null
          origem: string | null
          polo: string | null
          porte: string | null
          processo_id: string | null
          processo_numero: string | null
          qualificacao: string | null
          razao_social: string | null
          referencia: string | null
          responsavel: string | null
          telefone: string | null
          telefone_2: string | null
          tribunal: string | null
          uf: string | null
          valor_base: number | null
          valor_causa: number | null
          valor_execucao: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_evento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_evento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_evento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_evento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "ab_processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_evento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "ab_v_processo"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_v_processo: {
        Row: {
          area: string | null
          assuntos: Json | null
          classe: string | null
          classe_codigo: string | null
          cnpj: string | null
          created_at: string | null
          distribuicao: string | null
          empresa_id: string | null
          fase: string | null
          fonte: string | null
          garantia_prestada: boolean | null
          id: string | null
          movimentacoes: number | null
          movimentacoes_constricao: number | null
          movimentacoes_exigencia: number | null
          numero: string | null
          orgao_julgador: string | null
          polo: string | null
          razao_social: string | null
          status: string | null
          tribunal: string | null
          uf: string | null
          ultima_movimentacao: string | null
          updated_at: string | null
          valor_causa: number | null
          valor_execucao: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      ab_v_solicitacao: {
        Row: {
          area: string | null
          concluido_em: string | null
          created_at: string | null
          custo: number | null
          detalhe: string | null
          documento: string | null
          duracao_seg: number | null
          empresa_id: string | null
          escopo: string | null
          finalidade: string | null
          id: string | null
          iniciado_em: string | null
          leads_gerados: number | null
          movimentacoes_novas: number | null
          nome: string | null
          processos_encontrados: number | null
          provedor: string | null
          razao_social: string | null
          solicitante: string | null
          solicitante_nome: string | null
          status: string | null
          tipo_documento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ab_solicitacao_provedor_fkey"
            columns: ["provedor"]
            isOneToOne: false
            referencedRelation: "ab_provedor"
            referencedColumns: ["chave"]
          },
        ]
      }
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
        Insert: {
          ano?: never
          data_pagamento?: string | null
          descricao?: string | null
          id?: number | null
          mes?: never
          mes_referencia?: string | null
          referencia?: string | null
          sync_id?: string | null
          valor?: number | null
        }
        Update: {
          ano?: never
          data_pagamento?: string | null
          descricao?: string | null
          id?: number | null
          mes?: never
          mes_referencia?: string | null
          referencia?: string | null
          sync_id?: string | null
          valor?: number | null
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
      _fechamento_janela: {
        Args: { p_ano: number; p_gran: string; p_periodo: number }
        Returns: {
          dt_fim: string
          dt_ini: string
        }[]
      }
      ab_limpar_demo: { Args: never; Returns: string }
      ab_minha_area: { Args: never; Returns: string }
      ab_pode: { Args: { p_chave: string }; Returns: boolean }
      ab_seed_demo: { Args: never; Returns: string }
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
      is_dia_util: { Args: { _data: string }; Returns: boolean }
      is_dominio_lavoro: { Args: { _email: string }; Returns: boolean }
      is_email_permitido: { Args: { _email: string }; Returns: boolean }
      lavoro_canais_permitidos: {
        Args: { _user_id: string }
        Returns: string[]
      }
      lavoro_canal: { Args: { p_tipo_de_ramo: string }; Returns: string }
      lavoro_canal_visivel: {
        Args: { p_tipo_de_ramo: string }
        Returns: boolean
      }
      lavoro_normaliza_ramo: { Args: { p_ramo: string }; Returns: string }
      lavoro_normaliza_seguradora: {
        Args: { p_seguradora: string }
        Returns: string
      }
      lavoro_pode_ver_canal: { Args: { p_canal: string }; Returns: boolean }
      lavoro_pode_ver_canal_para: {
        Args: { p_canal: string; p_user_id: string }
        Returns: boolean
      }
      lavoro_times_usuario: { Args: { _user_id: string }; Returns: string[] }
      normalize_canal_repasse: { Args: { p_canal: string }; Returns: string }
      normalize_categoria_financeira: {
        Args: { categoria: string }
        Returns: string
      }
      notificar_admin_audit: { Args: never; Returns: undefined }
      pode_beneficios: { Args: never; Returns: boolean }
      pode_cadastros: { Args: never; Returns: boolean }
      pode_gerenciar_configuracoes: {
        Args: { _user_id: string }
        Returns: boolean
      }
      pode_importar: {
        Args: { _tipo: string; _user_id: string }
        Returns: boolean
      }
      retry_lavoro_sync_if_needed: { Args: never; Returns: undefined }
      rpc_ab_atualizar_derivados: { Args: { p_linhas: Json }; Returns: number }
      rpc_ab_atualizar_sinais: { Args: { p_linhas: Json }; Returns: number }
      rpc_ab_consumir_cota: {
        Args: { p_area: string; p_consultas?: number; p_valor?: number }
        Returns: Json
      }
      rpc_ab_devolver_cota: {
        Args: { p_area: string; p_consultas?: number; p_valor?: number }
        Returns: undefined
      }
      rpc_ab_mover_lead: {
        Args: {
          p_lead_id: string
          p_nota?: string
          p_responsavel?: string
          p_status: string
        }
        Returns: {
          argumento: string | null
          bloqueios: string[] | null
          confianca: number
          created_at: string
          deadline: string | null
          empresa_id: string
          gatilhos: string[]
          id: string
          importancia_segurada: number
          modalidade: string
          observacao: string | null
          premio_estimado: number
          prioridade: number
          prob_subscricao: number
          produto: string
          responsavel: string | null
          status: string
          updated_at: string
          urgencia: number
          valor_base: number
        }
        SetofOptions: {
          from: "*"
          to: "ab_lead"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_adicionar_destinatario_automatico: {
        Args: { p_modulo: string; p_user_id: string }
        Returns: string
      }
      rpc_admin_approve_user: {
        Args: { _perfil_id: string; _user_id: string }
        Returns: undefined
      }
      rpc_admin_atividade_usuario: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          detalhes: Json
          momento: string
          tipo: string
        }[]
      }
      rpc_admin_audit_listar: {
        Args: { _ate: string; _de: string; _limit?: number }
        Returns: {
          acao: string
          alvo_descricao: string | null
          alvo_id: string | null
          antes: Json | null
          ator_email: string | null
          ator_id: string | null
          ator_nome: string | null
          created_at: string
          depois: Json | null
          entidade: string
          id: string
          mudancas: Json | null
          notificacao_erro: string | null
          notificado_em: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_audit_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_admin_caixa_append: {
        Args: { _rows: Json; _sync_id: string }
        Returns: number
      }
      rpc_admin_caixa_reset: { Args: never; Returns: string }
      rpc_admin_convidar_externo: {
        Args: { _email: string; _perfil_id: string }
        Returns: string
      }
      rpc_admin_delete_perfil: { Args: { _id: string }; Returns: undefined }
      rpc_admin_detalhe_usuario: { Args: { _user_id: string }; Returns: Json }
      rpc_admin_excluir_popup: { Args: { p_id: string }; Returns: Json }
      rpc_admin_excluir_usuario: {
        Args: { _user_id: string }
        Returns: undefined
      }
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
      rpc_admin_list_convites_externo: {
        Args: never
        Returns: {
          aceito_em: string
          criado_em: string
          email: string
          id: string
          perfil_id: string
          perfil_nome: string
        }[]
      }
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
      rpc_admin_list_users_simples: {
        Args: never
        Returns: {
          email: string
          full_name: string
          perfil_nome: string
          role: string
          user_id: string
        }[]
      }
      rpc_admin_list_users_v2: {
        Args: never
        Returns: {
          active: boolean
          area: string
          blocked: boolean
          convite_aceito_em: string
          convite_enviado_em: string
          convite_tipo: string
          cpf: string
          criado_em: string
          email: string
          empresa: string
          full_name: string
          gestor: string
          perfil_id: string
          perfil_nome: string
          primeiro_acesso: boolean
          roles: Database["public"]["Enums"]["app_role"][]
          times_receita: string[]
          tipo_usuario: string
          total_sessoes: number
          ultimo_acesso: string
          user_id: string
        }[]
      }
      rpc_admin_listar_popups: {
        Args: never
        Returns: {
          ativo: boolean
          botao_label: string
          cor_fundo: string
          cor_texto: string
          created_at: string
          data_fim: string
          data_inicio: string
          destinatarios: string[]
          id: string
          logo_url: string
          mensagem: string
          mostrar_nome_hub: boolean
          paginas: string[]
          perfis: string[]
          titulo: string
          total_dismiss: number
          total_views: number
        }[]
      }
      rpc_admin_listar_rotas: {
        Args: never
        Returns: {
          ativo: boolean
          nome: string
          rota: string
        }[]
      }
      rpc_admin_log_convite: {
        Args: { _tipo: string; _user_id: string }
        Returns: undefined
      }
      rpc_admin_perfil_by_user_id: {
        Args: { _user_id: string }
        Returns: {
          email: string
          full_name: string
          perfil_id: string
          perfil_nome: string
          permissoes: Json
          roles: Database["public"]["Enums"]["app_role"][]
          times_receita: string[]
          user_id: string
        }[]
      }
      rpc_admin_precadastrar_usuario: {
        Args: { _email: string; _full_name: string; _perfil_id: string }
        Returns: string
      }
      rpc_admin_precadastrar_usuario_full: {
        Args: {
          _area?: string
          _cpf?: string
          _email: string
          _empresa?: string
          _full_name: string
          _gestor?: string
          _perfil_id: string
          _tipo_usuario?: string
        }
        Returns: string
      }
      rpc_admin_ramo_append: {
        Args: { _rows: Json; _sync_id: string }
        Returns: number
      }
      rpc_admin_remover_convite_externo: {
        Args: { _id: string }
        Returns: undefined
      }
      rpc_admin_salvar_popup: {
        Args: {
          p_ativo?: boolean
          p_botao_label?: string
          p_cor_fundo?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_destinatarios?: string[]
          p_id?: string
          p_logo_url?: string
          p_mensagem?: string
          p_mostrar_nome_hub?: boolean
          p_paginas?: string[]
          p_perfis?: string[]
          p_titulo?: string
        }
        Returns: string
      }
      rpc_admin_toggle_bloqueio: {
        Args: { _blocked: boolean; _user_id: string }
        Returns: undefined
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
      rpc_admin_update_user_full: {
        Args: {
          _active: boolean
          _area?: string
          _blocked: boolean
          _cpf?: string
          _empresa?: string
          _full_name: string
          _gestor?: string
          _perfil_id: string
          _times_receita?: string[]
          _user_id: string
        }
        Returns: undefined
      }
      rpc_admin_update_user_v2: {
        Args: {
          _active: boolean
          _blocked: boolean
          _full_name: string
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
      rpc_admin_uso_detalhado: {
        Args: { _ate: string; _de: string; _limit?: number; _user_id?: string }
        Returns: {
          area: string
          dia: string
          duracao_seg: number
          email: string
          entrou_em: string
          full_name: string
          perfil_nome: string
          rota: string
          subpagina: string
          titulo: string
          ultimo_ping_em: string
          user_id: string
        }[]
      }
      rpc_admin_uso_diario: {
        Args: { _ate: string; _de: string; _user_id?: string }
        Returns: {
          dia: string
          email: string
          full_name: string
          paginas: number
          primeiro_em: string
          rotas: string[]
          tempo_min: number
          ultimo_em: string
          user_id: string
        }[]
      }
      rpc_admin_uso_paginas: {
        Args: { _ate: string; _de: string; _user_id?: string }
        Returns: {
          acessos: number
          dias: number
          email: string
          full_name: string
          primeiro_em: string
          rota: string
          tempo_max_seg: number
          tempo_medio_seg: number
          tempo_min: number
          tempo_min_seg: number
          titulo: string
          ultimo_em: string
          user_id: string
        }[]
      }
      rpc_admin_uso_resumo: {
        Args: { _ate: string; _de: string }
        Returns: {
          dias_ativos: number
          dias_sem_acessar: number
          email: string
          full_name: string
          perfil_nome: string
          primeiro_acesso: string
          sessoes: number
          tempo_total_min: number
          top_rota: string
          total_paginas: number
          ultimo_acesso: string
          user_id: string
        }[]
      }
      rpc_atualizar_schedule_config: {
        Args: {
          p_ativo: boolean
          p_dias_semana: number[]
          p_hora_brt: string
          p_modulo: string
        }
        Returns: Json
      }
      rpc_buscar_usuarios_hub: {
        Args: { p_busca?: string }
        Returns: {
          email: string
          nome: string
          role: string
          user_id: string
        }[]
      }
      rpc_comissao_vencida_por_canal: {
        Args: { p_ano: number; p_mes?: number; p_periodo?: string }
        Returns: {
          comissao_vencida: number
          tipo_de_ramo: string
        }[]
      }
      rpc_dispensar_popup: { Args: { p_popup_id: string }; Returns: Json }
      rpc_fechamento_a_receber: {
        Args: { p_ano: number; p_gran: string; p_periodo: number }
        Returns: Json
      }
      rpc_fechamento_base: {
        Args: {
          p_ano: number
          p_gran: string
          p_pagina?: number
          p_periodo: number
          p_tamanho?: number
        }
        Returns: Json
      }
      rpc_fechamento_caixa_ramo: {
        Args: {
          p_ano: number
          p_comparar?: boolean
          p_gran: string
          p_periodo: number
        }
        Returns: Json
      }
      rpc_fechamento_evolucao_mensal: {
        Args: {
          p_ano: number
          p_comparar?: boolean
          p_gran: string
          p_periodo: number
        }
        Returns: Json
      }
      rpc_fechamento_sumario: {
        Args: {
          p_ano: number
          p_comparar?: boolean
          p_gran: string
          p_periodo: number
        }
        Returns: Json
      }
      rpc_fechamento_top_tomadores: {
        Args: {
          p_ano: number
          p_comparar?: boolean
          p_gran: string
          p_periodo: number
        }
        Returns: Json
      }
      rpc_fechamento_vencidos: {
        Args: { p_ano: number; p_gran: string; p_periodo: number }
        Returns: Json
      }
      rpc_get_meta_anual: { Args: { _ano: number }; Returns: number }
      rpc_get_popups_ativos: {
        Args: { p_pagina?: string }
        Returns: {
          botao_label: string
          cor_fundo: string
          cor_texto: string
          data_fim: string
          id: string
          logo_url: string
          mensagem: string
          mostrar_nome_hub: boolean
          paginas: string[]
          titulo: string
        }[]
      }
      rpc_historico_disparos: {
        Args: { p_limit?: number; p_modulo: string }
        Returns: {
          data_envio: string
          detalhes_erro: Json
          disparado_em: string
          finalizado_em: string
          forcado_por_nome: string
          id: string
          status: string
          total_destinatarios: number
          total_falhas: number
          total_sucessos: number
        }[]
      }
      rpc_inicio_lavoro_resumo: {
        Args: never
        Returns: {
          atingimento_caixa_mes: number
          receita_caixa_mes: number
          receita_caixa_recebida_mes: number
          receita_competencia_mes: number
          total_vencido_mes: number
          ultima_atualizacao: string
        }[]
      }
      rpc_inicio_timestamps: {
        Args: never
        Returns: {
          fonte: string
          total_linhas: number
          ultima_atualizacao: string
        }[]
      }
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
      rpc_lavoro_beneficios_tipo_pagamento: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          competencia: number
          previsto: number
          recebido: number
          tipo_pagamento: string
        }[]
      }
      rpc_lavoro_get_meta_anual: { Args: { p_ano: number }; Returns: number }
      rpc_lavoro_recebimento_dezenas_empresas: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          ano: number
          dezena: string
          empresa: string
          mes: number
          valor: number
        }[]
      }
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
      rpc_lavoro_receita_kpis:
        | {
            Args: { p_ano: number; p_mes: number; p_periodo?: string }
            Returns: {
              atingimento: number
              atingimento_caixa: number
              caixa_beneficios: number
              caixa_demais: number
              caixa_garantia: number
              competencia_beneficios: number
              competencia_demais: number
              competencia_garantia: number
              defasagem: number
              meta_periodo: number
              previsto_beneficios: number
              previsto_caixa: number
              previsto_demais: number
              previsto_garantia: number
              receita_caixa: number
              receita_competencia: number
            }[]
          }
        | {
            Args: {
              p_ano: number
              p_mes: number
              p_periodo: string
              p_user_id: string
            }
            Returns: {
              atingimento: number
              atingimento_caixa: number
              caixa_beneficios: number
              caixa_demais: number
              caixa_garantia: number
              competencia_beneficios: number
              competencia_demais: number
              competencia_garantia: number
              defasagem: number
              meta_periodo: number
              previsto_beneficios: number
              previsto_caixa: number
              previsto_demais: number
              previsto_garantia: number
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
      rpc_lavoro_repasse_filtros: {
        Args: never
        Returns: {
          tipo: string
          valor: string
        }[]
      }
      rpc_lavoro_repasse_por_canal: {
        Args: {
          p_ano?: number
          p_canal_repasse?: string
          p_mes?: number
          p_modo?: string
          p_situacao_repasse?: string
        }
        Returns: {
          canal_repasse: string
          ciclo_ano: number
          ciclo_mes: number
          situacao: string
          situacao_repasse: string
          total_canal_no_ciclo: number
          valor: number
        }[]
      }
      rpc_lavoro_repasse_previsao_longa: {
        Args: { p_ano?: number; p_canal_repasse?: string; p_mes?: number }
        Returns: {
          canal_repasse: string
          linhas: number
          previsto_ano: number
          previsto_mes: number
          valor: number
        }[]
      }
      rpc_lavoro_repasse_rodape: {
        Args: never
        Returns: {
          grupo: string
          linhas: number
          situacao_repasse: string
          valor: number
        }[]
      }
      rpc_lavoro_set_meta_anual: {
        Args: { p_ano: number; p_valor: number }
        Returns: undefined
      }
      rpc_lavoro_ultima_atualizacao: { Args: never; Returns: string }
      rpc_listar_destinatarios_automaticos: {
        Args: { p_modulo: string }
        Returns: {
          adicionado_por_nome: string
          ativo: boolean
          criado_em: string
          email: string
          id: string
          nome: string
          role: string
          user_id: string
        }[]
      }
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
          times_receita: string[]
          user_id: string
        }[]
      }
      rpc_pageview_ping: { Args: { _id: string }; Returns: undefined }
      rpc_permitir_login_senha: { Args: never; Returns: boolean }
      rpc_proxima_execucao_schedule: {
        Args: { p_modulo: string }
        Returns: string
      }
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
      rpc_receita_executivo_canais:
        | {
            Args: { p_ano: number; p_mes?: number }
            Returns: {
              a_receber_futuro: number
              caixa: number
              caixa_corrente: number
              caixa_esperado: number
              canal: string
              emitido: number
              saldo_vencido: number
            }[]
          }
        | {
            Args: { p_ano: number; p_mes: number; p_user_id: string }
            Returns: {
              a_receber_futuro: number
              caixa: number
              caixa_corrente: number
              caixa_esperado: number
              canal: string
              emitido: number
              saldo_vencido: number
            }[]
          }
      rpc_receita_executivo_canais_mes:
        | {
            Args: { p_ano: number; p_mes: number }
            Returns: {
              caixa_esperado: number
              caixa_recebido: number
              canal: string
              emitido: number
              saldo_vencido: number
            }[]
          }
        | {
            Args: { p_ano: number; p_mes: number; p_user_id: string }
            Returns: {
              caixa_esperado: number
              caixa_recebido: number
              canal: string
              emitido: number
              saldo_vencido: number
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
      rpc_receita_executivo_mensal:
        | {
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
        | {
            Args: { p_ano: number; p_user_id: string }
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
      rpc_registrar_pageview: {
        Args: { _rota: string; _titulo?: string; _user_agent?: string }
        Returns: string
      }
      rpc_remover_destinatario_automatico: {
        Args: { p_id: string }
        Returns: boolean
      }
      rpc_set_meta_anual: {
        Args: { _ano: number; _valor: number }
        Returns: undefined
      }
      rpc_toggle_schedule: {
        Args: { p_modulo: string; p_motivo?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADMIN" | "DIRETORIA_GERAL" | "COLABORADOR"
      report_tipo: "receita_diaria" | "executivo_semanal" | "fechamento_manual"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      report_tipo: ["receita_diaria", "executivo_semanal", "fechamento_manual"],
    },
  },
} as const
