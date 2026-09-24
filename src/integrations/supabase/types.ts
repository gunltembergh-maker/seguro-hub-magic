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
          passos: Json | null
          perfis: string[] | null
          tipo: string
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
          passos?: Json | null
          perfis?: string[] | null
          tipo?: string
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
          passos?: Json | null
          perfis?: string[] | null
          tipo?: string
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
          cadastro_origem: string | null
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          criado_por: string | null
          eh_parceiro: boolean
          email_financeiro: string | null
          id: string
          modelo_repasse: string | null
          motivo_sem_contrato: string | null
          nome: string
          percentual_repasse: number | null
          pipefy_card_id: number | null
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          apelidos?: string[]
          ativo?: boolean
          cadastro_origem?: string | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          criado_por?: string | null
          eh_parceiro?: boolean
          email_financeiro?: string | null
          id?: string
          modelo_repasse?: string | null
          motivo_sem_contrato?: string | null
          nome: string
          percentual_repasse?: number | null
          pipefy_card_id?: number | null
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          apelidos?: string[]
          ativo?: boolean
          cadastro_origem?: string | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          criado_por?: string | null
          eh_parceiro?: boolean
          email_financeiro?: string | null
          id?: string
          modelo_repasse?: string | null
          motivo_sem_contrato?: string | null
          nome?: string
          percentual_repasse?: number | null
          pipefy_card_id?: number | null
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      canal_contrato_avisos: {
        Row: {
          contrato_id: string
          destinatario: string
          enviado_em: string
          id: string
          message_id: string | null
          tipo: string
        }
        Insert: {
          contrato_id: string
          destinatario: string
          enviado_em?: string
          id?: string
          message_id?: string | null
          tipo: string
        }
        Update: {
          contrato_id?: string
          destinatario?: string
          enviado_em?: string
          id?: string
          message_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "canal_contrato_avisos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "canal_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_contratos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          assinado: boolean
          assinado_em: string | null
          assinatura_confirmada_em: string | null
          assinatura_confirmada_por: string | null
          base_calculo: string
          canal_id: string | null
          corrigido_em: string | null
          corrigido_por: string | null
          declarado_assinado: boolean | null
          declarado_por: string | null
          enviado_em: string
          enviado_por: string | null
          extracao: Json | null
          hash_sha256: string | null
          id: string
          minimo_repasse: number
          motivo_bloqueio: string | null
          origem_leitura: string | null
          percentual_beneficios: number | null
          percentual_demais: number | null
          percentual_garantia: number | null
          renovacao_automatica: boolean | null
          renovado_de: string | null
          renovado_em: string | null
          renovado_por: string | null
          signatarios: number | null
          situacao: string
          suspenso_em: string | null
          suspenso_motivo: string | null
          suspenso_por: string | null
          tipo: string
          validado_em: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          assinado?: boolean
          assinado_em?: string | null
          assinatura_confirmada_em?: string | null
          assinatura_confirmada_por?: string | null
          base_calculo?: string
          canal_id?: string | null
          corrigido_em?: string | null
          corrigido_por?: string | null
          declarado_assinado?: boolean | null
          declarado_por?: string | null
          enviado_em?: string
          enviado_por?: string | null
          extracao?: Json | null
          hash_sha256?: string | null
          id?: string
          minimo_repasse?: number
          motivo_bloqueio?: string | null
          origem_leitura?: string | null
          percentual_beneficios?: number | null
          percentual_demais?: number | null
          percentual_garantia?: number | null
          renovacao_automatica?: boolean | null
          renovado_de?: string | null
          renovado_em?: string | null
          renovado_por?: string | null
          signatarios?: number | null
          situacao?: string
          suspenso_em?: string | null
          suspenso_motivo?: string | null
          suspenso_por?: string | null
          tipo?: string
          validado_em?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          assinado?: boolean
          assinado_em?: string | null
          assinatura_confirmada_em?: string | null
          assinatura_confirmada_por?: string | null
          base_calculo?: string
          canal_id?: string | null
          corrigido_em?: string | null
          corrigido_por?: string | null
          declarado_assinado?: boolean | null
          declarado_por?: string | null
          enviado_em?: string
          enviado_por?: string | null
          extracao?: Json | null
          hash_sha256?: string | null
          id?: string
          minimo_repasse?: number
          motivo_bloqueio?: string | null
          origem_leitura?: string | null
          percentual_beneficios?: number | null
          percentual_demais?: number | null
          percentual_garantia?: number | null
          renovacao_automatica?: boolean | null
          renovado_de?: string | null
          renovado_em?: string | null
          renovado_por?: string | null
          signatarios?: number | null
          situacao?: string
          suspenso_em?: string | null
          suspenso_motivo?: string | null
          suspenso_por?: string | null
          tipo?: string
          validado_em?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_contratos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_contratos_renovado_de_fkey"
            columns: ["renovado_de"]
            isOneToOne: false
            referencedRelation: "canal_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_liberacao_aprovadores: {
        Row: {
          criado_em: string
          criado_por: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          user_id?: string
        }
        Relationships: []
      }
      canal_liberacoes_excepcionais: {
        Row: {
          anexo_nome: string | null
          anexo_path: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          canal_id: string
          ciclo_ano: number
          ciclo_mes: number
          email_de_acordo: string | null
          email_decisao_em: string | null
          email_decisao_id: string | null
          email_expiracao_em: string | null
          email_pedido_em: string | null
          email_pedido_id: string | null
          id: string
          justificativa: string
          nome_de_acordo: string | null
          observacao: string | null
          solicitado_em: string
          solicitado_por: string | null
          status: string
          usada_em: string | null
        }
        Insert: {
          anexo_nome?: string | null
          anexo_path?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          canal_id: string
          ciclo_ano: number
          ciclo_mes: number
          email_de_acordo?: string | null
          email_decisao_em?: string | null
          email_decisao_id?: string | null
          email_expiracao_em?: string | null
          email_pedido_em?: string | null
          email_pedido_id?: string | null
          id?: string
          justificativa: string
          nome_de_acordo?: string | null
          observacao?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          usada_em?: string | null
        }
        Update: {
          anexo_nome?: string | null
          anexo_path?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          canal_id?: string
          ciclo_ano?: number
          ciclo_mes?: number
          email_de_acordo?: string | null
          email_decisao_em?: string | null
          email_decisao_id?: string | null
          email_expiracao_em?: string | null
          email_pedido_em?: string | null
          email_pedido_id?: string | null
          id?: string
          justificativa?: string
          nome_de_acordo?: string | null
          observacao?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          usada_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_liberacoes_excepcionais_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_parceiro_alteracoes: {
        Row: {
          anexo_nome: string | null
          anexo_path: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          canal_id: string
          contrato_id: string | null
          diretor_email: string
          email_decisao_em: string | null
          email_decisao_id: string | null
          email_pedido_em: string | null
          email_pedido_id: string | null
          id: string
          justificativa: string
          minimo: number | null
          observacao: string | null
          pct_beneficios: number | null
          pct_demais: number | null
          pct_garantia: number | null
          solicitado_em: string
          solicitado_por: string | null
          status: string
          superada_em: string | null
          superada_por_contrato_id: string | null
          vigencia_fim: string | null
        }
        Insert: {
          anexo_nome?: string | null
          anexo_path?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          canal_id: string
          contrato_id?: string | null
          diretor_email: string
          email_decisao_em?: string | null
          email_decisao_id?: string | null
          email_pedido_em?: string | null
          email_pedido_id?: string | null
          id?: string
          justificativa: string
          minimo?: number | null
          observacao?: string | null
          pct_beneficios?: number | null
          pct_demais?: number | null
          pct_garantia?: number | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          superada_em?: string | null
          superada_por_contrato_id?: string | null
          vigencia_fim?: string | null
        }
        Update: {
          anexo_nome?: string | null
          anexo_path?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          canal_id?: string
          contrato_id?: string | null
          diretor_email?: string
          email_decisao_em?: string | null
          email_decisao_id?: string | null
          email_pedido_em?: string | null
          email_pedido_id?: string | null
          id?: string
          justificativa?: string
          minimo?: number | null
          observacao?: string | null
          pct_beneficios?: number | null
          pct_demais?: number | null
          pct_garantia?: number | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          superada_em?: string | null
          superada_por_contrato_id?: string | null
          vigencia_fim?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_parceiro_alteracoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_parceiro_alteracoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "canal_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_parceiro_alteracoes_superada_por_contrato_id_fkey"
            columns: ["superada_por_contrato_id"]
            isOneToOne: false
            referencedRelation: "canal_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_parceiro_bloqueios: {
        Row: {
          bloqueado_em: string
          bloqueado_por: string
          canal_id: string
          id: string
          liberado_em: string | null
          liberado_por: string | null
          motivo: string
          motivo_liberacao: string | null
        }
        Insert: {
          bloqueado_em?: string
          bloqueado_por: string
          canal_id: string
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          motivo: string
          motivo_liberacao?: string | null
        }
        Update: {
          bloqueado_em?: string
          bloqueado_por?: string
          canal_id?: string
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          motivo?: string
          motivo_liberacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_parceiro_bloqueios_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_parceiro_eventos: {
        Row: {
          canal_id: string | null
          contrato_id: string | null
          criado_em: string
          detalhe: Json | null
          id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          canal_id?: string | null
          contrato_id?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          canal_id?: string | null
          contrato_id?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_parceiro_eventos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_parceiro_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "canal_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_parceiro_vinculos: {
        Row: {
          canal_id: string
          chave_planilha: string
          criado_em: string
          criado_por: string | null
          id: string
          origem: string
        }
        Insert: {
          canal_id: string
          chave_planilha: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          origem?: string
        }
        Update: {
          canal_id?: string
          chave_planilha?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "canal_parceiro_vinculos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_repasse_aprovadores_financeiro: {
        Row: {
          ativo: boolean
          incluido_em: string
          incluido_por: string | null
          observacao: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          incluido_em?: string
          incluido_por?: string | null
          observacao?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          incluido_em?: string
          incluido_por?: string | null
          observacao?: string | null
          user_id?: string
        }
        Relationships: []
      }
      canal_repasse_baixas: {
        Row: {
          canal_id: string
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          confirmado_em: string
          confirmado_por: string | null
          data_pagamento: string
          demanda_id: string | null
          id: string
          levado_ao_gerencial_em: string | null
          observacao: string | null
          valor_pago: number | null
        }
        Insert: {
          canal_id: string
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          confirmado_em?: string
          confirmado_por?: string | null
          data_pagamento: string
          demanda_id?: string | null
          id?: string
          levado_ao_gerencial_em?: string | null
          observacao?: string | null
          valor_pago?: number | null
        }
        Update: {
          canal_id?: string
          chave_planilha?: string
          ciclo_ano?: number
          ciclo_mes?: number
          confirmado_em?: string
          confirmado_por?: string | null
          data_pagamento?: string
          demanda_id?: string | null
          id?: string
          levado_ao_gerencial_em?: string | null
          observacao?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_repasse_baixas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_repasse_baixas_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "canal_repasse_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_repasse_ciclo_datas: {
        Row: {
          canal_id: string | null
          ciclo_ano: number
          ciclo_mes: number
          data_prevista: string
          definida_em: string
          definida_por: string | null
          id: string
          observacao: string | null
        }
        Insert: {
          canal_id?: string | null
          ciclo_ano: number
          ciclo_mes: number
          data_prevista: string
          definida_em?: string
          definida_por?: string | null
          id?: string
          observacao?: string | null
        }
        Update: {
          canal_id?: string | null
          ciclo_ano?: number
          ciclo_mes?: number
          data_prevista?: string
          definida_em?: string
          definida_por?: string | null
          id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_repasse_ciclo_datas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_repasse_demandas: {
        Row: {
          canal_id: string
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          data_prevista_pagamento: string | null
          decidido_em: string | null
          decidido_por: string | null
          email_cobranca_em: string | null
          email_cobranca_id: string | null
          email_resposta_em: string | null
          email_resposta_id: string | null
          email_solicitacao_em: string | null
          email_solicitacao_id: string | null
          id: string
          linhas: number | null
          observacao_financeiro: string | null
          observacao_solicitante: string | null
          solicitado_em: string
          solicitado_por: string | null
          status: string
          valor_total: number | null
        }
        Insert: {
          canal_id: string
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          data_prevista_pagamento?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          email_cobranca_em?: string | null
          email_cobranca_id?: string | null
          email_resposta_em?: string | null
          email_resposta_id?: string | null
          email_solicitacao_em?: string | null
          email_solicitacao_id?: string | null
          id?: string
          linhas?: number | null
          observacao_financeiro?: string | null
          observacao_solicitante?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          valor_total?: number | null
        }
        Update: {
          canal_id?: string
          chave_planilha?: string
          ciclo_ano?: number
          ciclo_mes?: number
          data_prevista_pagamento?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          email_cobranca_em?: string | null
          email_cobranca_id?: string | null
          email_resposta_em?: string | null
          email_resposta_id?: string | null
          email_solicitacao_em?: string | null
          email_solicitacao_id?: string | null
          id?: string
          linhas?: number | null
          observacao_financeiro?: string | null
          observacao_solicitante?: string | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_repasse_demandas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_repasse_documentos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          base_nome: string | null
          base_path: string | null
          canal_id: string
          ciclo_ano: number
          ciclo_mes: number
          conferido_em: string | null
          conferido_por: string | null
          data_emissao: string | null
          data_pagamento: string | null
          demanda_id: string
          email_anexos_em: string | null
          email_anexos_id: string | null
          email_decisao_em: string | null
          email_decisao_id: string | null
          email_envio_em: string | null
          email_envio_id: string | null
          enviado_em: string
          enviado_por: string
          id: string
          motivo_recusa: string | null
          numero_nf: string | null
          observacao: string | null
          status: string
          tipo: string
          valor_autorizado: number | null
          valor_diverge: boolean
          valor_nf: number | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          base_nome?: string | null
          base_path?: string | null
          canal_id: string
          ciclo_ano: number
          ciclo_mes: number
          conferido_em?: string | null
          conferido_por?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          demanda_id: string
          email_anexos_em?: string | null
          email_anexos_id?: string | null
          email_decisao_em?: string | null
          email_decisao_id?: string | null
          email_envio_em?: string | null
          email_envio_id?: string | null
          enviado_em?: string
          enviado_por: string
          id?: string
          motivo_recusa?: string | null
          numero_nf?: string | null
          observacao?: string | null
          status: string
          tipo: string
          valor_autorizado?: number | null
          valor_diverge?: boolean
          valor_nf?: number | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          base_nome?: string | null
          base_path?: string | null
          canal_id?: string
          ciclo_ano?: number
          ciclo_mes?: number
          conferido_em?: string | null
          conferido_por?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          demanda_id?: string
          email_anexos_em?: string | null
          email_anexos_id?: string | null
          email_decisao_em?: string | null
          email_decisao_id?: string | null
          email_envio_em?: string | null
          email_envio_id?: string | null
          enviado_em?: string
          enviado_por?: string
          id?: string
          motivo_recusa?: string | null
          numero_nf?: string | null
          observacao?: string | null
          status?: string
          tipo?: string
          valor_autorizado?: number | null
          valor_diverge?: boolean
          valor_nf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_repasse_documentos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_repasse_documentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "canal_repasse_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_repasse_exportacoes: {
        Row: {
          base: string
          canal_id: string | null
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          contrato_id: string | null
          data_prevista_pagamento: string | null
          demanda_id: string | null
          exportado_em: string
          exportado_por: string | null
          id: string
          liberacao_id: string | null
          linhas: number | null
          valor_total: number | null
        }
        Insert: {
          base: string
          canal_id?: string | null
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          contrato_id?: string | null
          data_prevista_pagamento?: string | null
          demanda_id?: string | null
          exportado_em?: string
          exportado_por?: string | null
          id?: string
          liberacao_id?: string | null
          linhas?: number | null
          valor_total?: number | null
        }
        Update: {
          base?: string
          canal_id?: string | null
          chave_planilha?: string
          ciclo_ano?: number
          ciclo_mes?: number
          contrato_id?: string | null
          data_prevista_pagamento?: string | null
          demanda_id?: string | null
          exportado_em?: string
          exportado_por?: string | null
          id?: string
          liberacao_id?: string | null
          linhas?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_repasse_exportacoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_repasse_exportacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "canal_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_repasse_exportacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "canal_repasse_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_repasse_exportacoes_liberacao_id_fkey"
            columns: ["liberacao_id"]
            isOneToOne: false
            referencedRelation: "canal_liberacoes_excepcionais"
            referencedColumns: ["id"]
          },
        ]
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
      garantia_analises_ia: {
        Row: {
          aplicada: boolean
          aplicada_em: string | null
          aplicada_por: string | null
          apolice_id: string | null
          atualizado_em: string
          campos_sugeridos: Json | null
          classificacao: Json | null
          criado_em: string
          demanda_id: string | null
          documento_id: string | null
          documentos_ids: string[]
          erro_mensagem: string | null
          fluxo: string
          id: string
          job_id: string | null
          modalidade_id: string | null
          modalidade_rotulo: string | null
          resultado: Json | null
          resumo: string | null
          situacao: string
          solicitada_por: string | null
        }
        Insert: {
          aplicada?: boolean
          aplicada_em?: string | null
          aplicada_por?: string | null
          apolice_id?: string | null
          atualizado_em?: string
          campos_sugeridos?: Json | null
          classificacao?: Json | null
          criado_em?: string
          demanda_id?: string | null
          documento_id?: string | null
          documentos_ids?: string[]
          erro_mensagem?: string | null
          fluxo: string
          id?: string
          job_id?: string | null
          modalidade_id?: string | null
          modalidade_rotulo?: string | null
          resultado?: Json | null
          resumo?: string | null
          situacao?: string
          solicitada_por?: string | null
        }
        Update: {
          aplicada?: boolean
          aplicada_em?: string | null
          aplicada_por?: string | null
          apolice_id?: string | null
          atualizado_em?: string
          campos_sugeridos?: Json | null
          classificacao?: Json | null
          criado_em?: string
          demanda_id?: string | null
          documento_id?: string | null
          documentos_ids?: string[]
          erro_mensagem?: string | null
          fluxo?: string
          id?: string
          job_id?: string | null
          modalidade_id?: string | null
          modalidade_rotulo?: string | null
          resultado?: Json | null
          resumo?: string | null
          situacao?: string
          solicitada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_analises_ia_apolice_fk"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_analises_ia_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_analises_ia_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "garantia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_apolices: {
        Row: {
          apolice_mae_id: string | null
          atualizado_em: string
          chave_mercado: string | null
          comissao_pct: number | null
          comissao_valor: number | null
          criado_em: string
          criado_por: string | null
          data_emissao: string | null
          demanda_id: string
          id: string
          importancia_segurada: number | null
          locador_id: string | null
          locatario_id: string | null
          numero_apolice: string
          numero_endosso: number
          objeto: string | null
          premio: number | null
          produto: string
          segurado_id: string | null
          seguradora_livre: string | null
          situacao: string
          tomador_id: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          apolice_mae_id?: string | null
          atualizado_em?: string
          chave_mercado?: string | null
          comissao_pct?: number | null
          comissao_valor?: number | null
          criado_em?: string
          criado_por?: string | null
          data_emissao?: string | null
          demanda_id: string
          id?: string
          importancia_segurada?: number | null
          locador_id?: string | null
          locatario_id?: string | null
          numero_apolice: string
          numero_endosso?: number
          objeto?: string | null
          premio?: number | null
          produto: string
          segurado_id?: string | null
          seguradora_livre?: string | null
          situacao?: string
          tomador_id?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          apolice_mae_id?: string | null
          atualizado_em?: string
          chave_mercado?: string | null
          comissao_pct?: number | null
          comissao_valor?: number | null
          criado_em?: string
          criado_por?: string | null
          data_emissao?: string | null
          demanda_id?: string
          id?: string
          importancia_segurada?: number | null
          locador_id?: string | null
          locatario_id?: string | null
          numero_apolice?: string
          numero_endosso?: number
          objeto?: string | null
          premio?: number | null
          produto?: string
          segurado_id?: string | null
          seguradora_livre?: string | null
          situacao?: string
          tomador_id?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_apolices_apolice_mae_id_fkey"
            columns: ["apolice_mae_id"]
            isOneToOne: false
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_apolices_chave_mercado_fkey"
            columns: ["chave_mercado"]
            isOneToOne: false
            referencedRelation: "garantia_seguradoras_config"
            referencedColumns: ["chave_mercado"]
          },
          {
            foreignKeyName: "garantia_apolices_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_apolices_locador_id_fkey"
            columns: ["locador_id"]
            isOneToOne: false
            referencedRelation: "garantia_segurados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_apolices_locatario_id_fkey"
            columns: ["locatario_id"]
            isOneToOne: false
            referencedRelation: "hub_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_apolices_segurado_id_fkey"
            columns: ["segurado_id"]
            isOneToOne: false
            referencedRelation: "garantia_segurados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_apolices_tomador_id_fkey"
            columns: ["tomador_id"]
            isOneToOne: false
            referencedRelation: "hub_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_aprovacoes_minuta: {
        Row: {
          criado_em: string
          data: string
          demanda_id: string
          documento_id: string | null
          forma: string | null
          id: string
          observacao: string | null
          quem: string
          registrado_por: string | null
        }
        Insert: {
          criado_em?: string
          data?: string
          demanda_id: string
          documento_id?: string | null
          forma?: string | null
          id?: string
          observacao?: string | null
          quem: string
          registrado_por?: string | null
        }
        Update: {
          criado_em?: string
          data?: string
          demanda_id?: string
          documento_id?: string | null
          forma?: string | null
          id?: string
          observacao?: string | null
          quem?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_aprovacoes_minuta_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_aprovacoes_minuta_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "garantia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_auditoria: {
        Row: {
          campo: string
          data: string
          id: string
          registro_id: string
          tabela: string
          usuario_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          data?: string
          id?: string
          registro_id: string
          tabela: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          data?: string
          id?: string
          registro_id?: string
          tabela?: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      garantia_avisos_renovacao: {
        Row: {
          apolice_id: string
          data_aviso: string
          demanda_renovacao_id: string | null
          dias_antes: number
          enviado: boolean
          enviado_em: string | null
          id: string
        }
        Insert: {
          apolice_id: string
          data_aviso: string
          demanda_renovacao_id?: string | null
          dias_antes: number
          enviado?: boolean
          enviado_em?: string | null
          id?: string
        }
        Update: {
          apolice_id?: string
          data_aviso?: string
          demanda_renovacao_id?: string | null
          dias_antes?: number
          enviado?: boolean
          enviado_em?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garantia_avisos_renovacao_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_avisos_renovacao_demanda_renovacao_id_fkey"
            columns: ["demanda_renovacao_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_cocorretagem: {
        Row: {
          cnpj: string | null
          corretora: string
          criado_em: string
          criado_por: string | null
          demanda_id: string
          eh_lavoro: boolean
          id: string
          lider: boolean
          observacao: string | null
          percentual_comissao: number
        }
        Insert: {
          cnpj?: string | null
          corretora: string
          criado_em?: string
          criado_por?: string | null
          demanda_id: string
          eh_lavoro?: boolean
          id?: string
          lider?: boolean
          observacao?: string | null
          percentual_comissao: number
        }
        Update: {
          cnpj?: string | null
          corretora?: string
          criado_em?: string
          criado_por?: string | null
          demanda_id?: string
          eh_lavoro?: boolean
          id?: string
          lider?: boolean
          observacao?: string | null
          percentual_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "garantia_cocorretagem_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_consultas_mercado: {
        Row: {
          capacidade_total: number
          cliente_id: string
          completa: boolean
          consultada_em: string
          criado_por: string | null
          demanda_id: string | null
          id: string
          origem: string
          resultado_bruto: Json | null
          solicitacao_id: string | null
          substituida_por_id: string | null
          total_com_limite: number
          total_nao_consultado: number
          total_sem_limite: number
          valida_ate: string
        }
        Insert: {
          capacidade_total?: number
          cliente_id: string
          completa?: boolean
          consultada_em?: string
          criado_por?: string | null
          demanda_id?: string | null
          id?: string
          origem: string
          resultado_bruto?: Json | null
          solicitacao_id?: string | null
          substituida_por_id?: string | null
          total_com_limite?: number
          total_nao_consultado?: number
          total_sem_limite?: number
          valida_ate?: string
        }
        Update: {
          capacidade_total?: number
          cliente_id?: string
          completa?: boolean
          consultada_em?: string
          criado_por?: string | null
          demanda_id?: string | null
          id?: string
          origem?: string
          resultado_bruto?: Json | null
          solicitacao_id?: string | null
          substituida_por_id?: string | null
          total_com_limite?: number
          total_nao_consultado?: number
          total_sem_limite?: number
          valida_ate?: string
        }
        Relationships: [
          {
            foreignKeyName: "garantia_consultas_mercado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hub_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_consultas_mercado_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_consultas_mercado_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "garantia_judicial_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_consultas_mercado_substituida_por_id_fkey"
            columns: ["substituida_por_id"]
            isOneToOne: false
            referencedRelation: "garantia_consultas_mercado"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_cosseguro: {
        Row: {
          chave_mercado: string | null
          criado_em: string
          criado_por: string | null
          demanda_id: string
          id: string
          importancia_segurada: number
          lider: boolean
          observacao: string | null
          seguradora_livre: string | null
        }
        Insert: {
          chave_mercado?: string | null
          criado_em?: string
          criado_por?: string | null
          demanda_id: string
          id?: string
          importancia_segurada: number
          lider?: boolean
          observacao?: string | null
          seguradora_livre?: string | null
        }
        Update: {
          chave_mercado?: string | null
          criado_em?: string
          criado_por?: string | null
          demanda_id?: string
          id?: string
          importancia_segurada?: number
          lider?: boolean
          observacao?: string | null
          seguradora_livre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_cosseguro_chave_mercado_fkey"
            columns: ["chave_mercado"]
            isOneToOne: false
            referencedRelation: "garantia_seguradoras_config"
            referencedColumns: ["chave_mercado"]
          },
          {
            foreignKeyName: "garantia_cosseguro_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_cotacoes: {
        Row: {
          chave_mercado: string | null
          comissao_pct: number | null
          comissao_valor: number | null
          cosseguro: boolean
          criado_em: string
          criado_por: string | null
          demanda_id: string
          escolhida: boolean
          id: string
          observacao: string | null
          premio: number | null
          recebida_em: string | null
          seguradora_livre: string | null
          taxa: number | null
        }
        Insert: {
          chave_mercado?: string | null
          comissao_pct?: number | null
          comissao_valor?: number | null
          cosseguro?: boolean
          criado_em?: string
          criado_por?: string | null
          demanda_id: string
          escolhida?: boolean
          id?: string
          observacao?: string | null
          premio?: number | null
          recebida_em?: string | null
          seguradora_livre?: string | null
          taxa?: number | null
        }
        Update: {
          chave_mercado?: string | null
          comissao_pct?: number | null
          comissao_valor?: number | null
          cosseguro?: boolean
          criado_em?: string
          criado_por?: string | null
          demanda_id?: string
          escolhida?: boolean
          id?: string
          observacao?: string | null
          premio?: number | null
          recebida_em?: string | null
          seguradora_livre?: string | null
          taxa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_cotacoes_chave_mercado_fkey"
            columns: ["chave_mercado"]
            isOneToOne: false
            referencedRelation: "garantia_seguradoras_config"
            referencedColumns: ["chave_mercado"]
          },
          {
            foreignKeyName: "garantia_cotacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_demandas: {
        Row: {
          apolice_anterior_id: string | null
          atualizado_em: string
          balancos_assinados: boolean | null
          cadastrado_em: string
          cadastrado_por: string | null
          cadastro_dispensado_em: string | null
          cadastro_dispensado_motivo: string | null
          cadastro_dispensado_por: string | null
          canal_id: string | null
          chegada_em: string
          cliente_id: string
          codigo: string | null
          comissao_estimada: number | null
          criado_em: string
          data_limite: string | null
          dre_assinados: boolean | null
          entrada_id: string | null
          etapa: string
          exige_cadastro: boolean
          fase: string
          ia_analise_solicitada: boolean
          id: string
          importancia_segurada: number | null
          justificativa_excecao: string | null
          legenda: string | null
          legenda_manual: boolean
          modalidade: string | null
          natureza_rotulo: string | null
          numero: string
          numero_contrato: string | null
          numero_processo: string | null
          objeto: string | null
          observacao: string | null
          percentual_garantia: number | null
          precisa_ccg: boolean
          precisa_nomeacao: boolean
          premio_estimado: number | null
          produto: string
          publico_privado: string | null
          responsavel_cliente_id: string | null
          responsavel_tecnico_id: string | null
          segurado_id: string | null
          solicitacao_id: string | null
          status_atual: string
          tipo_alteracao: string | null
          tipo_movimento: string | null
          triagem_completa: boolean
          vigencia_exigida: string | null
        }
        Insert: {
          apolice_anterior_id?: string | null
          atualizado_em?: string
          balancos_assinados?: boolean | null
          cadastrado_em?: string
          cadastrado_por?: string | null
          cadastro_dispensado_em?: string | null
          cadastro_dispensado_motivo?: string | null
          cadastro_dispensado_por?: string | null
          canal_id?: string | null
          chegada_em: string
          cliente_id: string
          codigo?: string | null
          comissao_estimada?: number | null
          criado_em?: string
          data_limite?: string | null
          dre_assinados?: boolean | null
          entrada_id?: string | null
          etapa?: string
          exige_cadastro?: boolean
          fase?: string
          ia_analise_solicitada?: boolean
          id?: string
          importancia_segurada?: number | null
          justificativa_excecao?: string | null
          legenda?: string | null
          legenda_manual?: boolean
          modalidade?: string | null
          natureza_rotulo?: string | null
          numero: string
          numero_contrato?: string | null
          numero_processo?: string | null
          objeto?: string | null
          observacao?: string | null
          percentual_garantia?: number | null
          precisa_ccg?: boolean
          precisa_nomeacao?: boolean
          premio_estimado?: number | null
          produto: string
          publico_privado?: string | null
          responsavel_cliente_id?: string | null
          responsavel_tecnico_id?: string | null
          segurado_id?: string | null
          solicitacao_id?: string | null
          status_atual: string
          tipo_alteracao?: string | null
          tipo_movimento?: string | null
          triagem_completa?: boolean
          vigencia_exigida?: string | null
        }
        Update: {
          apolice_anterior_id?: string | null
          atualizado_em?: string
          balancos_assinados?: boolean | null
          cadastrado_em?: string
          cadastrado_por?: string | null
          cadastro_dispensado_em?: string | null
          cadastro_dispensado_motivo?: string | null
          cadastro_dispensado_por?: string | null
          canal_id?: string | null
          chegada_em?: string
          cliente_id?: string
          codigo?: string | null
          comissao_estimada?: number | null
          criado_em?: string
          data_limite?: string | null
          dre_assinados?: boolean | null
          entrada_id?: string | null
          etapa?: string
          exige_cadastro?: boolean
          fase?: string
          ia_analise_solicitada?: boolean
          id?: string
          importancia_segurada?: number | null
          justificativa_excecao?: string | null
          legenda?: string | null
          legenda_manual?: boolean
          modalidade?: string | null
          natureza_rotulo?: string | null
          numero?: string
          numero_contrato?: string | null
          numero_processo?: string | null
          objeto?: string | null
          observacao?: string | null
          percentual_garantia?: number | null
          precisa_ccg?: boolean
          precisa_nomeacao?: boolean
          premio_estimado?: number | null
          produto?: string
          publico_privado?: string | null
          responsavel_cliente_id?: string | null
          responsavel_tecnico_id?: string | null
          segurado_id?: string | null
          solicitacao_id?: string | null
          status_atual?: string
          tipo_alteracao?: string | null
          tipo_movimento?: string | null
          triagem_completa?: boolean
          vigencia_exigida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_demandas_apolice_anterior_fk"
            columns: ["apolice_anterior_id"]
            isOneToOne: false
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_demandas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_demandas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hub_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_demandas_entrada_id_fkey"
            columns: ["entrada_id"]
            isOneToOne: false
            referencedRelation: "hub_entradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_demandas_segurado_id_fkey"
            columns: ["segurado_id"]
            isOneToOne: false
            referencedRelation: "garantia_segurados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_demandas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: true
            referencedRelation: "garantia_judicial_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_demandas_status_atual_fkey"
            columns: ["status_atual"]
            isOneToOne: false
            referencedRelation: "garantia_status_catalogo"
            referencedColumns: ["codigo"]
          },
        ]
      }
      garantia_documentos: {
        Row: {
          apolice_id: string | null
          caminho: string | null
          caminho_externo: string | null
          criado_em: string
          demanda_id: string | null
          enviado_por: string | null
          externo: boolean
          id: string
          mime_type: string | null
          nome_arquivo: string
          observacao: string | null
          solicitacao_id: string | null
          substituido_por_id: string | null
          tamanho_bytes: number | null
          tipo: string
          versao: number
        }
        Insert: {
          apolice_id?: string | null
          caminho?: string | null
          caminho_externo?: string | null
          criado_em?: string
          demanda_id?: string | null
          enviado_por?: string | null
          externo?: boolean
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          observacao?: string | null
          solicitacao_id?: string | null
          substituido_por_id?: string | null
          tamanho_bytes?: number | null
          tipo: string
          versao?: number
        }
        Update: {
          apolice_id?: string | null
          caminho?: string | null
          caminho_externo?: string | null
          criado_em?: string
          demanda_id?: string | null
          enviado_por?: string | null
          externo?: boolean
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          observacao?: string | null
          solicitacao_id?: string | null
          substituido_por_id?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "garantia_documentos_apolice_fk"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_documentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_documentos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "garantia_judicial_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_documentos_substituido_por_id_fkey"
            columns: ["substituido_por_id"]
            isOneToOne: false
            referencedRelation: "garantia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_encerramentos: {
        Row: {
          apolice_id: string
          aprovado_por: string | null
          criado_em: string
          criado_por: string | null
          data: string
          documento_id: string | null
          estorno_comissao: number | null
          id: string
          observacao: string | null
          premio_devolver: number | null
          tipo: string
        }
        Insert: {
          apolice_id: string
          aprovado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data: string
          documento_id?: string | null
          estorno_comissao?: number | null
          id?: string
          observacao?: string | null
          premio_devolver?: number | null
          tipo: string
        }
        Update: {
          apolice_id?: string
          aprovado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          documento_id?: string | null
          estorno_comissao?: number | null
          id?: string
          observacao?: string | null
          premio_devolver?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "garantia_encerramentos_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: true
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_encerramentos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "garantia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_financeiro: {
        Row: {
          apolice_id: string
          atualizado_em: string
          comissao_prevista: number | null
          comissao_recebida: number | null
          data_pagamento_premio: string | null
          data_recebimento: string | null
          enviado_financeiro_em: string | null
          id: string
          observacao: string | null
          repasse_para: string | null
          repasse_valor: number | null
          status_premio: string
          vencimento_boleto: string | null
        }
        Insert: {
          apolice_id: string
          atualizado_em?: string
          comissao_prevista?: number | null
          comissao_recebida?: number | null
          data_pagamento_premio?: string | null
          data_recebimento?: string | null
          enviado_financeiro_em?: string | null
          id?: string
          observacao?: string | null
          repasse_para?: string | null
          repasse_valor?: number | null
          status_premio?: string
          vencimento_boleto?: string | null
        }
        Update: {
          apolice_id?: string
          atualizado_em?: string
          comissao_prevista?: number | null
          comissao_recebida?: number | null
          data_pagamento_premio?: string | null
          data_recebimento?: string | null
          enviado_financeiro_em?: string | null
          id?: string
          observacao?: string | null
          repasse_para?: string | null
          repasse_valor?: number | null
          status_premio?: string
          vencimento_boleto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_financeiro_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: true
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_judicial_solicitacoes: {
        Row: {
          alerta_enviado_em: string | null
          atualizado_em: string
          cnpj_tomador: string
          consulta_iniciada_em: string | null
          consulta_tentativas: number
          criado_em: string
          dados_formulario: Json
          email_enviado_em: string | null
          erro_mensagem: string | null
          gerado_em: string | null
          id: string
          nome_tomador: string | null
          numero_processo: string | null
          payload_bruto: Json | null
          pdf_path: string | null
          protocolo: string | null
          resultado_mercado: Json | null
          status: string
          xlsx_path: string | null
        }
        Insert: {
          alerta_enviado_em?: string | null
          atualizado_em?: string
          cnpj_tomador: string
          consulta_iniciada_em?: string | null
          consulta_tentativas?: number
          criado_em?: string
          dados_formulario: Json
          email_enviado_em?: string | null
          erro_mensagem?: string | null
          gerado_em?: string | null
          id?: string
          nome_tomador?: string | null
          numero_processo?: string | null
          payload_bruto?: Json | null
          pdf_path?: string | null
          protocolo?: string | null
          resultado_mercado?: Json | null
          status?: string
          xlsx_path?: string | null
        }
        Update: {
          alerta_enviado_em?: string | null
          atualizado_em?: string
          cnpj_tomador?: string
          consulta_iniciada_em?: string | null
          consulta_tentativas?: number
          criado_em?: string
          dados_formulario?: Json
          email_enviado_em?: string | null
          erro_mensagem?: string | null
          gerado_em?: string | null
          id?: string
          nome_tomador?: string | null
          numero_processo?: string | null
          payload_bruto?: Json | null
          pdf_path?: string | null
          protocolo?: string | null
          resultado_mercado?: Json | null
          status?: string
          xlsx_path?: string | null
        }
        Relationships: []
      }
      garantia_limites_tomador: {
        Row: {
          atualizado_em: string
          chave_mercado: string
          cliente_id: string
          consulta_id: string
          data_ultimo_cadastro: string | null
          grupo_mercado: string | null
          id: string
          limite_disponivel: number | null
          limite_total: number | null
          limite_utilizado: number
          mensagem: string | null
          modalidades: Json | null
          nomeacao: string | null
          origem: string
          registrado_por: string | null
          status_mercado: string | null
          taxa: number | null
        }
        Insert: {
          atualizado_em?: string
          chave_mercado: string
          cliente_id: string
          consulta_id: string
          data_ultimo_cadastro?: string | null
          grupo_mercado?: string | null
          id?: string
          limite_disponivel?: number | null
          limite_total?: number | null
          limite_utilizado?: number
          mensagem?: string | null
          modalidades?: Json | null
          nomeacao?: string | null
          origem: string
          registrado_por?: string | null
          status_mercado?: string | null
          taxa?: number | null
        }
        Update: {
          atualizado_em?: string
          chave_mercado?: string
          cliente_id?: string
          consulta_id?: string
          data_ultimo_cadastro?: string | null
          grupo_mercado?: string | null
          id?: string
          limite_disponivel?: number | null
          limite_total?: number | null
          limite_utilizado?: number
          mensagem?: string | null
          modalidades?: Json | null
          nomeacao?: string | null
          origem?: string
          registrado_por?: string | null
          status_mercado?: string | null
          taxa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_limites_tomador_chave_mercado_fkey"
            columns: ["chave_mercado"]
            isOneToOne: false
            referencedRelation: "garantia_seguradoras_config"
            referencedColumns: ["chave_mercado"]
          },
          {
            foreignKeyName: "garantia_limites_tomador_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hub_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_limites_tomador_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "garantia_consultas_mercado"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_parametros: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          descricao: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          descricao?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          descricao?: string | null
          valor?: number
        }
        Relationships: []
      }
      garantia_perdas: {
        Row: {
          comissao_estimada: number | null
          concorrente: string | null
          criado_em: string
          criado_por: string | null
          data_retomar: string | null
          demanda_id: string
          etapa_perdida: string
          id: string
          motivo: string
          observacao: string | null
          premio_estimado: number | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_perdido: string | null
        }
        Insert: {
          comissao_estimada?: number | null
          concorrente?: string | null
          criado_em?: string
          criado_por?: string | null
          data_retomar?: string | null
          demanda_id: string
          etapa_perdida: string
          id?: string
          motivo: string
          observacao?: string | null
          premio_estimado?: number | null
          reaberta_em?: string | null
          reaberta_por?: string | null
          status_perdido?: string | null
        }
        Update: {
          comissao_estimada?: number | null
          concorrente?: string | null
          criado_em?: string
          criado_por?: string | null
          data_retomar?: string | null
          demanda_id?: string
          etapa_perdida?: string
          id?: string
          motivo?: string
          observacao?: string | null
          premio_estimado?: number | null
          reaberta_em?: string | null
          reaberta_por?: string | null
          status_perdido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_perdas_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: true
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_retorno_solicitacoes: {
        Row: {
          decidido_em: string | null
          decidido_por: string | null
          demanda_id: string
          id: string
          motivo: string
          resposta: string | null
          situacao: string
          solicitado_em: string
          solicitado_por: string | null
        }
        Insert: {
          decidido_em?: string | null
          decidido_por?: string | null
          demanda_id: string
          id?: string
          motivo: string
          resposta?: string | null
          situacao?: string
          solicitado_em?: string
          solicitado_por?: string | null
        }
        Update: {
          decidido_em?: string | null
          decidido_por?: string | null
          demanda_id?: string
          id?: string
          motivo?: string
          resposta?: string | null
          situacao?: string
          solicitado_em?: string
          solicitado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_retorno_solicitacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_seguradoras_config: {
        Row: {
          ativa_garantia: boolean
          atualizado_em: string
          chave_mercado: string
          id: string
          identificador_api: string | null
          observacao: string | null
          rotulo: string
          seguradora_id: string | null
          tem_portal: boolean
        }
        Insert: {
          ativa_garantia?: boolean
          atualizado_em?: string
          chave_mercado: string
          id?: string
          identificador_api?: string | null
          observacao?: string | null
          rotulo: string
          seguradora_id?: string | null
          tem_portal?: boolean
        }
        Update: {
          ativa_garantia?: boolean
          atualizado_em?: string
          chave_mercado?: string
          id?: string
          identificador_api?: string | null
          observacao?: string | null
          rotulo?: string
          seguradora_id?: string | null
          tem_portal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "garantia_seguradoras_config_seguradora_id_fkey"
            columns: ["seguradora_id"]
            isOneToOne: false
            referencedRelation: "seguradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_segurados: {
        Row: {
          atualizado_em: string
          cartao_atualizado_em: string | null
          cpf_cnpj: string
          criado_em: string
          criado_por: string | null
          dados_cartao_cnpj: Json | null
          exige_texto_proprio: boolean
          id: string
          nome: string
          publico_privado: string | null
          tipo_pessoa: string
        }
        Insert: {
          atualizado_em?: string
          cartao_atualizado_em?: string | null
          cpf_cnpj: string
          criado_em?: string
          criado_por?: string | null
          dados_cartao_cnpj?: Json | null
          exige_texto_proprio?: boolean
          id?: string
          nome: string
          publico_privado?: string | null
          tipo_pessoa: string
        }
        Update: {
          atualizado_em?: string
          cartao_atualizado_em?: string | null
          cpf_cnpj?: string
          criado_em?: string
          criado_por?: string | null
          dados_cartao_cnpj?: Json | null
          exige_texto_proprio?: boolean
          id?: string
          nome?: string
          publico_privado?: string | null
          tipo_pessoa?: string
        }
        Relationships: []
      }
      garantia_sinistros: {
        Row: {
          apolice_id: string
          criado_em: string
          criado_por: string | null
          data: string
          documento_id: string | null
          id: string
          observacao: string | null
          prazos: string | null
          situacao_regulacao: string | null
          tipo: string
        }
        Insert: {
          apolice_id: string
          criado_em?: string
          criado_por?: string | null
          data: string
          documento_id?: string | null
          id?: string
          observacao?: string | null
          prazos?: string | null
          situacao_regulacao?: string | null
          tipo: string
        }
        Update: {
          apolice_id?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          documento_id?: string | null
          id?: string
          observacao?: string | null
          prazos?: string | null
          situacao_regulacao?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "garantia_sinistros_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "garantia_apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_sinistros_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "garantia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      garantia_status_catalogo: {
        Row: {
          ativo: boolean
          codigo: string
          com_quem: string | null
          etapa: string
          fase: string
          nome: string
          ordem: number
          relogio: string
          sla_horas: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          com_quem?: string | null
          etapa: string
          fase: string
          nome: string
          ordem: number
          relogio: string
          sla_horas?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          com_quem?: string | null
          etapa?: string
          fase?: string
          nome?: string
          ordem?: number
          relogio?: string
          sla_horas?: number | null
        }
        Relationships: []
      }
      garantia_status_historico: {
        Row: {
          com_quem: string | null
          demanda_id: string
          duracao_segundos: number | null
          fim: string | null
          id: string
          inicio: string
          observacao: string | null
          relogio: string
          status_codigo: string
          usuario_id: string | null
        }
        Insert: {
          com_quem?: string | null
          demanda_id: string
          duracao_segundos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          observacao?: string | null
          relogio: string
          status_codigo: string
          usuario_id?: string | null
        }
        Update: {
          com_quem?: string | null
          demanda_id?: string
          duracao_segundos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          observacao?: string | null
          relogio?: string
          status_codigo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garantia_status_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantia_status_historico_status_codigo_fkey"
            columns: ["status_codigo"]
            isOneToOne: false
            referencedRelation: "garantia_status_catalogo"
            referencedColumns: ["codigo"]
          },
        ]
      }
      garantia_time_comercial: {
        Row: {
          ativo: boolean
          criado_em: string
          criado_por: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          user_id?: string
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
      hub_clientes: {
        Row: {
          ab_empresa_id: string | null
          ativo: boolean
          atualizado_em: string
          bairro: string | null
          canal_id: string | null
          capital_social: number | null
          cartao_atualizado_em: string | null
          cartao_fonte: string | null
          cep: string | null
          cliente_id: string | null
          cnae: string | null
          cnae_descricao: string | null
          complemento: string | null
          cpf_cnpj: string
          criado_em: string
          criado_por: string | null
          dados_cartao_cnpj: Json | null
          data_abertura: string | null
          email: string | null
          id: string
          logradouro: string | null
          municipio: string | null
          natureza_juridica: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          observacao: string | null
          porte: string | null
          responsavel_id: string | null
          situacao_cadastral: string | null
          telefone: string | null
          tipo_pessoa: string
          uf: string | null
        }
        Insert: {
          ab_empresa_id?: string | null
          ativo?: boolean
          atualizado_em?: string
          bairro?: string | null
          canal_id?: string | null
          capital_social?: number | null
          cartao_atualizado_em?: string | null
          cartao_fonte?: string | null
          cep?: string | null
          cliente_id?: string | null
          cnae?: string | null
          cnae_descricao?: string | null
          complemento?: string | null
          cpf_cnpj: string
          criado_em?: string
          criado_por?: string | null
          dados_cartao_cnpj?: Json | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          natureza_juridica?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          observacao?: string | null
          porte?: string | null
          responsavel_id?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          tipo_pessoa: string
          uf?: string | null
        }
        Update: {
          ab_empresa_id?: string | null
          ativo?: boolean
          atualizado_em?: string
          bairro?: string | null
          canal_id?: string | null
          capital_social?: number | null
          cartao_atualizado_em?: string | null
          cartao_fonte?: string | null
          cep?: string | null
          cliente_id?: string | null
          cnae?: string | null
          cnae_descricao?: string | null
          complemento?: string | null
          cpf_cnpj?: string
          criado_em?: string
          criado_por?: string | null
          dados_cartao_cnpj?: Json | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          natureza_juridica?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacao?: string | null
          porte?: string | null
          responsavel_id?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_clientes_ab_empresa_id_fkey"
            columns: ["ab_empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_clientes_ab_empresa_id_fkey"
            columns: ["ab_empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_carteira"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "hub_clientes_ab_empresa_id_fkey"
            columns: ["ab_empresa_id"]
            isOneToOne: false
            referencedRelation: "ab_v_fila"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "hub_clientes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_entradas: {
        Row: {
          assunto: string | null
          atualizado_em: string
          canal_id: string | null
          chegada_em: string
          cliente_id: string | null
          demanda_id: string | null
          destino: string
          id: string
          motivo_retencao: string | null
          observacao: string | null
          origem: string
          produto: string | null
          protocolo: string
          ramo: string
          registrado_em: string
          registrado_por: string | null
        }
        Insert: {
          assunto?: string | null
          atualizado_em?: string
          canal_id?: string | null
          chegada_em: string
          cliente_id?: string | null
          demanda_id?: string | null
          destino?: string
          id?: string
          motivo_retencao?: string | null
          observacao?: string | null
          origem?: string
          produto?: string | null
          protocolo?: string
          ramo: string
          registrado_em?: string
          registrado_por?: string | null
        }
        Update: {
          assunto?: string | null
          atualizado_em?: string
          canal_id?: string | null
          chegada_em?: string
          cliente_id?: string | null
          demanda_id?: string | null
          destino?: string
          id?: string
          motivo_retencao?: string | null
          observacao?: string | null
          origem?: string
          produto?: string | null
          protocolo?: string
          ramo?: string
          registrado_em?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_entradas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_entradas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hub_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_entradas_demanda_fk"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "garantia_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_notificacoes: {
        Row: {
          criado_em: string
          criado_por: string | null
          dados: Json | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          dados?: Json | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          dados?: Json | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
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
      notificacao_vistas: {
        Row: {
          chave: string
          user_id: string
          vista_em: string
        }
        Insert: {
          chave: string
          user_id: string
          vista_em?: string
        }
        Update: {
          chave?: string
          user_id?: string
          vista_em?: string
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
      permissoes_catalogo: {
        Row: {
          area: string
          ativo: boolean
          chave: string
          criado_em: string
          descricao: string | null
          exige_concessao: boolean
          ordem: number
          rotulo: string
        }
        Insert: {
          area: string
          ativo?: boolean
          chave: string
          criado_em?: string
          descricao?: string | null
          exige_concessao?: boolean
          ordem?: number
          rotulo: string
        }
        Update: {
          area?: string
          ativo?: boolean
          chave?: string
          criado_em?: string
          descricao?: string | null
          exige_concessao?: boolean
          ordem?: number
          rotulo?: string
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
      rp_email_templates: {
        Row: {
          assunto: string
          ativo: boolean
          corpo_html: string
          id: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assunto: string
          ativo?: boolean
          corpo_html: string
          id?: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assunto?: string
          ativo?: boolean
          corpo_html?: string
          id?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rp_posicoes: {
        Row: {
          apelido: string | null
          ativa: boolean
          bloco: string
          created_at: string
          fixa: boolean
          fixa_observacao: string | null
          fixa_user_id: string | null
          id: string
          numero: number
          updated_at: string
        }
        Insert: {
          apelido?: string | null
          ativa?: boolean
          bloco: string
          created_at?: string
          fixa?: boolean
          fixa_observacao?: string | null
          fixa_user_id?: string | null
          id?: string
          numero: number
          updated_at?: string
        }
        Update: {
          apelido?: string | null
          ativa?: boolean
          bloco?: string
          created_at?: string
          fixa?: boolean
          fixa_observacao?: string | null
          fixa_user_id?: string | null
          id?: string
          numero?: number
          updated_at?: string
        }
        Relationships: []
      }
      rp_reservas: {
        Row: {
          ausencia_notificada: boolean
          cancelada_em: string | null
          cancelada_por: string | null
          cancelamento_motivo: string | null
          checkin_at: string | null
          checkin_ip: string | null
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          periodo: unknown
          posicao_id: string
          status: string
          user_id: string
        }
        Insert: {
          ausencia_notificada?: boolean
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          checkin_at?: string | null
          checkin_ip?: string | null
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          periodo?: unknown
          posicao_id: string
          status?: string
          user_id: string
        }
        Update: {
          ausencia_notificada?: boolean
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          checkin_at?: string | null
          checkin_ip?: string | null
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          periodo?: unknown
          posicao_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_reservas_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "rp_posicoes"
            referencedColumns: ["id"]
          },
        ]
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
      senha_aprovacao: {
        Row: {
          atualizada_em: string
          bloqueada_ate: string | null
          criada_em: string
          falhas: number
          senha_hash: string
          user_id: string
        }
        Insert: {
          atualizada_em?: string
          bloqueada_ate?: string | null
          criada_em?: string
          falhas?: number
          senha_hash: string
          user_id: string
        }
        Update: {
          atualizada_em?: string
          bloqueada_ate?: string | null
          criada_em?: string
          falhas?: number
          senha_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      senha_aprovacao_codigos: {
        Row: {
          codigo_hash: string
          criado_em: string
          expira_em: string
          id: string
          tentativas: number
          usado_em: string | null
          user_id: string
        }
        Insert: {
          codigo_hash: string
          criado_em?: string
          expira_em: string
          id?: string
          tentativas?: number
          usado_em?: string | null
          user_id: string
        }
        Update: {
          codigo_hash?: string
          criado_em?: string
          expira_em?: string
          id?: string
          tentativas?: number
          usado_em?: string | null
          user_id?: string
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
      usuario_permissoes: {
        Row: {
          chave: string
          definido_em: string
          definido_por: string | null
          motivo: string | null
          permitido: boolean
          user_id: string
        }
        Insert: {
          chave: string
          definido_em?: string
          definido_por?: string | null
          motivo?: string | null
          permitido: boolean
          user_id: string
        }
        Update: {
          chave?: string
          definido_em?: string
          definido_por?: string | null
          motivo?: string | null
          permitido?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_permissoes_chave_fkey"
            columns: ["chave"]
            isOneToOne: false
            referencedRelation: "permissoes_catalogo"
            referencedColumns: ["chave"]
          },
        ]
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
      assinatura_area_do_usuario: { Args: { p_user: string }; Returns: string }
      canal_liberacao_emails_pendentes: {
        Args: never
        Returns: {
          anexo_nome: string
          aprovador_nome: string
          assinatura_area: string
          assinatura_nome: string
          ciclo: string
          destinatarios: string[]
          email_de_acordo: string
          justificativa: string
          liberacao_id: string
          nome_de_acordo: string
          observacao: string
          parceiro: string
          prazo_em: string
          situacao: string
          solicitado_em: string
          solicitante_email: string
          solicitante_nome: string
          tipo: string
        }[]
      }
      canal_liberacao_marcar_email: {
        Args: { p_liberacao_id: string; p_message_id: string; p_tipo: string }
        Returns: undefined
      }
      canal_parceiro_alteracoes_para_email: {
        Args: never
        Returns: {
          alteracao_id: string
          anexo_nome: string
          aprovador_nome: string
          assinatura_area: string
          assinatura_nome: string
          destinatarios: string[]
          diretor_email: string
          justificativa: string
          minimo: number
          observacao: string
          parceiro: string
          pct_beneficios: number
          pct_beneficios_contrato: number
          pct_demais: number
          pct_demais_contrato: number
          pct_garantia: number
          pct_garantia_contrato: number
          situacao: string
          solicitado_em: string
          solicitante_nome: string
          tipo: string
          vigencia_fim: string
        }[]
      }
      canal_parceiro_aprovadores_emails: { Args: never; Returns: string[] }
      canal_parceiro_bloqueado: {
        Args: { p_canal_id: string }
        Returns: boolean
      }
      canal_parceiro_casar: {
        Args: { p_nomes: string[] }
        Returns: {
          canal_id: string
          chave_planilha: string
          nome: string
        }[]
      }
      canal_parceiro_contrato_decisoes_para_email: {
        Args: never
        Returns: {
          arquivo_nome: string
          assinatura_area: string
          assinatura_nome: string
          contrato_id: string
          corrigido_em: string
          corrigido_por_nome: string
          destinatarios: string[]
          enviado_por_nome: string
          motivo: string
          parceiro: string
          pct_beneficios: number
          pct_demais: number
          pct_garantia: number
          situacao: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      canal_parceiro_data_do_ciclo: {
        Args: { p_ano: number; p_canal_id?: string; p_mes: number }
        Returns: string
      }
      canal_parceiro_data_prevista_recusa: {
        Args: { p_data: string }
        Returns: string
      }
      canal_parceiro_de: { Args: { p_canal_planilha: string }; Returns: string }
      canal_parceiro_emails_comercial: { Args: never; Returns: string[] }
      canal_parceiro_emails_juridico: { Args: never; Returns: string[] }
      canal_parceiro_expirar_contratos: { Args: never; Returns: number }
      canal_parceiro_janela_pagamento: {
        Args: { p_ref?: string }
        Returns: {
          fim: string
          inicio: string
        }[]
      }
      canal_parceiro_log: {
        Args: {
          p_canal_id: string
          p_contrato_id: string
          p_detalhe: Json
          p_tipo: string
          p_usuario: string
        }
        Returns: undefined
      }
      canal_parceiro_marcar_aviso: {
        Args: {
          p_contrato_id: string
          p_destinatario: string
          p_message_id?: string
          p_tipo: string
        }
        Returns: string
      }
      canal_parceiro_marcar_email_alteracao: {
        Args: { p_alteracao_id: string; p_message_id?: string; p_tipo: string }
        Returns: boolean
      }
      canal_parceiro_percentual: {
        Args: { p_canal_planilha: string; p_tipo_de_ramo: string }
        Returns: number
      }
      canal_parceiro_pode_exportar: {
        Args: { p_ano?: number; p_canal_planilha: string; p_mes?: number }
        Returns: boolean
      }
      canal_parceiro_registrar_contrato: {
        Args: {
          p_arquivo_nome: string
          p_arquivo_path: string
          p_assinado?: boolean
          p_assinado_em?: string
          p_canal_id?: string
          p_declarado_assinado?: boolean
          p_enviado_por?: string
          p_extracao?: Json
          p_hash_sha256?: string
          p_minimo?: number
          p_nomes_do_contrato: string[]
          p_origem_leitura?: string
          p_pct_beneficios?: number
          p_pct_demais?: number
          p_pct_garantia?: number
          p_renovacao_automatica?: boolean
          p_signatarios?: number
          p_tipo?: string
          p_vigencia_fim?: string
          p_vigencia_inicio?: string
        }
        Returns: {
          canal_id: string
          contrato_id: string
          motivo: string
          pode_exportar: boolean
          situacao: string
        }[]
      }
      canal_parceiro_superar_alteracoes: {
        Args: { p_canal_id: string; p_contrato_id: string }
        Returns: number
      }
      canal_parceiro_verificacoes_para_email: {
        Args: never
        Returns: {
          arquivo_nome: string
          assinatura_area: string
          assinatura_lida: boolean
          assinatura_nome: string
          contrato_id: string
          declarado_assinado: boolean
          destinatarios: string[]
          enviado_em: string
          enviado_por_nome: string
          motivo: string
          origem_leitura: string
          parceiro: string
          repasse_acumulado: number
          situacao: string
        }[]
      }
      canal_repasse_docs_emails_pendentes: {
        Args: never
        Returns: {
          anexos_ja_enviados: boolean
          arquivo_nome: string
          arquivo_path: string
          assinatura_area: string
          assinatura_nome: string
          base_nome: string
          base_path: string
          canal_id: string
          chave_planilha: string
          ciclo: string
          ciclo_ano: number
          ciclo_mes: number
          comercial_ja_enviado: boolean
          conferido_por_nome: string
          data_emissao: string
          data_pagamento: string
          data_prevista: string
          demanda_id: string
          destinatarios: string[]
          destinatarios_anexos: string[]
          documento_id: string
          enviado_por_nome: string
          motivo: string
          numero_nf: string
          parceiro: string
          situacao: string
          tipo: string
          valor_autorizado: number
          valor_diverge: boolean
          valor_nf: number
        }[]
      }
      canal_repasse_docs_marcar_email: {
        Args: { p_documento_id: string; p_message_id: string; p_tipo: string }
        Returns: undefined
      }
      canal_repasse_emails_pendentes: {
        Args: never
        Returns: {
          assinatura_area: string
          assinatura_nome: string
          ciclo: string
          ciclo_ano: number
          ciclo_mes: number
          data_prevista: string
          demanda_id: string
          destinatarios: string[]
          dias_de_atraso: number
          financeiro_nome: string
          linhas: number
          observacao: string
          parceiro: string
          situacao: string
          solicitante_email: string
          solicitante_nome: string
          tipo: string
          valor_total: number
        }[]
      }
      canal_repasse_expirar_pendentes: {
        Args: never
        Returns: {
          demandas_expiradas: number
          liberacoes_expiradas: number
        }[]
      }
      canal_repasse_financeiro_emails: { Args: never; Returns: string[] }
      canal_repasse_marcar_email: {
        Args: { p_demanda_id: string; p_message_id?: string; p_tipo: string }
        Returns: boolean
      }
      divide_safe: {
        Args: { denominador: number; numerador: number }
        Returns: number
      }
      garantia_ajustar_limite_utilizado: {
        Args: { _chave_mercado: string; _cliente_id: string; _delta: number }
        Returns: boolean
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
      lavoro_receita_caixa_visivel: { Args: never; Returns: boolean }
      lavoro_status_gera_receita: {
        Args: { p_status: string }
        Returns: boolean
      }
      lavoro_times_usuario: { Args: { _user_id: string }; Returns: string[] }
      lavoro_uid_efetivo: { Args: never; Returns: string }
      normalize_canal_repasse: { Args: { p_canal: string }; Returns: string }
      normalize_categoria_financeira: {
        Args: { categoria: string }
        Returns: string
      }
      notificar_admin_audit: { Args: never; Returns: undefined }
      permissoes_efetivas: { Args: { p_user?: string }; Returns: Json }
      pode_aprovar_liberacao_repasse: { Args: never; Returns: boolean }
      pode_aprovar_repasse_financeiro: { Args: never; Returns: boolean }
      pode_atestar_contrato: { Args: never; Returns: boolean }
      pode_beneficios: { Args: never; Returns: boolean }
      pode_cadastros: { Args: never; Returns: boolean }
      pode_definir_data_repasse: { Args: never; Returns: boolean }
      pode_definir_responsavel_cliente: { Args: never; Returns: boolean }
      pode_entrada_cadastrar_canal: { Args: never; Returns: boolean }
      pode_entrada_demandas: { Args: never; Returns: boolean }
      pode_garantia_painel: { Args: never; Returns: boolean }
      pode_garantia_pipeline: { Args: never; Returns: boolean }
      pode_gerenciar_configuracoes: {
        Args: { _user_id: string }
        Returns: boolean
      }
      pode_importar: {
        Args: { _tipo: string; _user_id: string }
        Returns: boolean
      }
      pode_ver_canal_parceiro: { Args: never; Returns: boolean }
      pode_ver_garantia_formulario: { Args: never; Returns: boolean }
      pode_ver_juridico_contratos: { Args: never; Returns: boolean }
      pode_ver_repasse_demanda: { Args: never; Returns: boolean }
      retry_lavoro_sync_if_needed: { Args: never; Returns: undefined }
      rp_expirar_reservas: { Args: never; Returns: number }
      rp_pode_controle: { Args: never; Returns: boolean }
      rp_registrar_checkin: {
        Args: { p_ip: string; p_reserva_id: string; p_user_id: string }
        Returns: Json
      }
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
      rpc_admin_contas_mesmo_cpf: {
        Args: { p_user_id: string }
        Returns: {
          area: string
          ativo: boolean
          email: string
          empresa: string
          user_id: string
        }[]
      }
      rpc_admin_convidar_externo: {
        Args: { _email: string; _perfil_id: string }
        Returns: string
      }
      rpc_admin_definir_permissao_usuario: {
        Args: {
          p_chave: string
          p_motivo?: string
          p_permitido: boolean
          p_user_id: string
        }
        Returns: {
          chave: string
          efetivo: string
          excecao: boolean
        }[]
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
          passos: Json
          perfis: string[]
          tipo: string
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
      rpc_admin_permissoes_catalogo: {
        Args: never
        Returns: {
          area: string
          chave: string
          descricao: string
          exige_concessao: boolean
          ordem: number
          rotulo: string
        }[]
      }
      rpc_admin_permissoes_usuario: {
        Args: { p_user_id: string }
        Returns: {
          area: string
          chave: string
          definido_em: string
          definido_por_nome: string
          efetivo: boolean
          excecao: boolean
          exige_concessao: boolean
          motivo: string
          ordem: number
          rotulo: string
          valor_do_perfil: boolean
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
          p_passos?: Json
          p_perfis?: string[]
          p_tipo?: string
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
      rpc_canal_parceiro_alteracoes: {
        Args: { p_status?: string }
        Returns: {
          alteracao_id: string
          anexo_nome: string
          anexo_path: string
          aprovado_em: string
          aprovado_por_nome: string
          canal_id: string
          diretor_email: string
          justificativa: string
          minimo: number
          observacao: string
          parceiro: string
          pct_beneficios: number
          pct_beneficios_contrato: number
          pct_demais: number
          pct_garantia: number
          pct_garantia_contrato: number
          solicitado_em: string
          solicitado_por_nome: string
          sou_o_aprovador: boolean
          sou_o_solicitante: boolean
          status: string
          superada_em: string
          vigencia_fim: string
        }[]
      }
      rpc_canal_parceiro_autorizar_exportacao: {
        Args: {
          p_ano: number
          p_canal_planilha: string
          p_data_prevista?: string
          p_linhas?: number
          p_mes: number
          p_valor?: number
        }
        Returns: {
          base: string
          data_prevista: string
          exportacao_id: string
          liberado_por: string
          parceiro: string
        }[]
      }
      rpc_canal_parceiro_cadastrar_manual: {
        Args: {
          p_canal_id?: string
          p_cnpj?: string
          p_contato_email?: string
          p_contato_nome?: string
          p_email_financeiro?: string
          p_motivo?: string
          p_nome?: string
          p_razao_social?: string
        }
        Returns: {
          canal_id: string
          criado: boolean
          nome: string
        }[]
      }
      rpc_canal_parceiro_ciclo: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          ciclo_ano: number
          ciclo_mes: number
          data_prevista: string
          definida_em: string
          definida_por_nome: string
          excecoes: number
          janela_fim: string
          janela_inicio: string
          observacao: string
          posso_definir: boolean
        }[]
      }
      rpc_canal_parceiro_contratos: {
        Args: { p_canal_id?: string }
        Returns: {
          arquivo_nome: string
          arquivo_path: string
          assinado: boolean
          assinado_em: string
          assinatura_atestada_em: string
          assinatura_atestada_por: string
          canal_id: string
          canal_nome: string
          contrato_id: string
          corrigido_em: string
          corrigido_por_nome: string
          declarado_assinado: boolean
          dias_para_vencer: number
          enviado_em: string
          hash_sha256: string
          minimo_repasse: number
          motivo_bloqueio: string
          origem_leitura: string
          pct_beneficios: number
          pct_demais: number
          pct_demais_efetivo: number
          pct_garantia: number
          signatarios: number
          situacao: string
          tipo: string
          validado_em: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_canal_parceiro_corrigir_contrato: {
        Args: {
          p_confirmar_assinatura?: boolean
          p_contrato_id: string
          p_minimo?: number
          p_motivo: string
          p_pct_beneficios?: number
          p_pct_demais?: number
          p_pct_garantia?: number
          p_vigencia_fim?: string
          p_vigencia_inicio?: string
        }
        Returns: {
          contrato_id: string
          motivo: string
          pode_exportar: boolean
          situacao: string
        }[]
      }
      rpc_canal_parceiro_decidir_alteracao: {
        Args: {
          p_alteracao_id: string
          p_aprovar: boolean
          p_observacao?: string
        }
        Returns: {
          alteracao_id: string
          status: string
        }[]
      }
      rpc_canal_parceiro_decidir_liberacao: {
        Args: {
          p_aprovar: boolean
          p_liberacao_id: string
          p_observacao?: string
        }
        Returns: {
          liberacao_id: string
          status: string
        }[]
      }
      rpc_canal_parceiro_definir_data_ciclo: {
        Args: {
          p_ano: number
          p_canal_id?: string
          p_data: string
          p_mes: number
          p_observacao?: string
        }
        Returns: {
          abrangencia: string
          ciclo: string
          data_prevista: string
        }[]
      }
      rpc_canal_parceiro_documentos: {
        Args: { p_canal_id?: string; p_demanda_id?: string }
        Returns: {
          arquivo_nome: string
          arquivo_path: string
          canal_id: string
          ciclo_ano: number
          ciclo_mes: number
          conferido_em: string
          conferido_por_nome: string
          data_emissao: string
          data_pagamento: string
          demanda_id: string
          documento_id: string
          enviado_em: string
          enviado_por_nome: string
          motivo_recusa: string
          numero_nf: string
          observacao: string
          parceiro: string
          status: string
          tipo: string
          valor_autorizado: number
          valor_diverge: boolean
          valor_nf: number
        }[]
      }
      rpc_canal_parceiro_eventos: {
        Args: { p_canal_id?: string; p_limite?: number }
        Returns: {
          canal_id: string
          canal_nome: string
          contrato_id: string
          criado_em: string
          detalhe: Json
          evento_id: string
          tipo: string
          usuario: string
          usuario_email: string
        }[]
      }
      rpc_canal_parceiro_excluir: {
        Args: { p_canal_id: string; p_motivo: string }
        Returns: {
          canal_id: string
          mensagem: string
          parceiro: string
        }[]
      }
      rpc_canal_parceiro_liberacoes: {
        Args: { p_status?: string }
        Returns: {
          anexo_nome: string
          anexo_path: string
          aprovado_em: string
          aprovado_por_nome: string
          canal_id: string
          canal_nome: string
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          email_de_acordo: string
          justificativa: string
          liberacao_id: string
          nome_de_acordo: string
          observacao: string
          solicitado_em: string
          solicitado_por_nome: string
          sou_o_aprovador: boolean
          status: string
          usada_em: string
        }[]
      }
      rpc_canal_parceiro_lista: {
        Args: never
        Returns: {
          cadastro_origem: string
          canal_id: string
          chaves_planilha: string[]
          cnpj: string
          eh_parceiro: boolean
          motivo_sem_contrato: string
          nome: string
          razao_social: string
        }[]
      }
      rpc_canal_parceiro_pendencias_verificacao: {
        Args: never
        Returns: {
          arquivo_nome: string
          arquivo_path: string
          assinatura_lida: boolean
          canal_id: string
          contrato_id: string
          declarado_assinado: boolean
          enviado_em: string
          enviado_por_nome: string
          ja_avisado_em: string
          minimo_repasse: number
          motivo_bloqueio: string
          origem_leitura: string
          parceiro: string
          pct_beneficios: number
          pct_demais: number
          pct_garantia: number
          repasse_acumulado: number
          situacao: string
          tentativas: number
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_canal_parceiro_percentuais: {
        Args: { p_canal_planilha?: string }
        Returns: {
          autorizado_em: string
          canal_id: string
          chave_planilha: string
          minimo_repasse: number
          origem_beneficios: string
          origem_demais: string
          origem_garantia: string
          parceiro: string
          pct_beneficios: number
          pct_demais: number
          pct_garantia: number
        }[]
      }
      rpc_canal_parceiro_resolver_vinculo: {
        Args: { p_canal_id: string; p_contrato_id: string }
        Returns: {
          canal_id: string
          contrato_id: string
          motivo: string
          pode_exportar: boolean
          situacao: string
        }[]
      }
      rpc_canal_parceiro_situacao: {
        Args: { p_canal_planilha?: string }
        Returns: {
          assinado: boolean
          assinado_em: string
          bloqueado: boolean
          bloqueio_motivo: string
          cadastro_origem: string
          canal_id: string
          chave_planilha: string
          contrato_id: string
          dias_para_vencer: number
          eh_parceiro: boolean
          minimo_repasse: number
          motivo_parado: string
          nome: string
          pct_beneficios: number
          pct_demais_efetivo: number
          pct_garantia: number
          pode_exportar: boolean
          situacao: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_canal_parceiro_solicitar_alteracao: {
        Args: {
          p_anexo_nome?: string
          p_anexo_path?: string
          p_canal_id: string
          p_diretor_email: string
          p_justificativa: string
          p_minimo?: number
          p_pct_beneficios?: number
          p_pct_demais?: number
          p_pct_garantia?: number
          p_vigencia_fim?: string
        }
        Returns: {
          alteracao_id: string
          mensagem: string
          status: string
        }[]
      }
      rpc_canal_parceiro_solicitar_liberacao: {
        Args: {
          p_anexo_nome?: string
          p_anexo_path?: string
          p_ano: number
          p_canal_planilha: string
          p_email_de_acordo?: string
          p_justificativa: string
          p_mes: number
          p_nome_de_acordo?: string
        }
        Returns: {
          liberacao_id: string
          mensagem: string
          status: string
        }[]
      }
      rpc_canal_parceiro_vencimentos_pendentes: {
        Args: { p_dias?: number }
        Returns: {
          arquivo_nome: string
          canal_id: string
          cnpj: string
          contrato_id: string
          destinatarios: string[]
          dias_para_vencer: number
          parceiro: string
          pct_beneficios: number
          pct_demais: number
          pct_garantia: number
          razao_social: string
          renovacao_automatica: boolean
          repasse_acumulado: number
          tipo_aviso: string
          vencido: boolean
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_canal_parceiro_vigencias: {
        Args: never
        Returns: {
          aviso_60_enviado_em: string
          canal_id: string
          contrato_id: string
          dias_para_vencer: number
          parceiro: string
          situacao: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_canal_repasse_autorizar_envio_parceiro: {
        Args: {
          p_ano: number
          p_canal_planilha: string
          p_linhas?: number
          p_mes: number
          p_valor?: number
        }
        Returns: {
          aprovado_por_nome: string
          base: string
          data_prevista: string
          demanda: string
          exportacao_id: string
          liberado_por: string
          parceiro: string
          rotulo_status: string
        }[]
      }
      rpc_canal_repasse_cancelar_nf: {
        Args: { p_demanda_id: string }
        Returns: {
          demanda_id: string
          mensagem: string
          situacao: string
        }[]
      }
      rpc_canal_repasse_conferir_nf: {
        Args: { p_aprovar: boolean; p_documento_id: string; p_motivo?: string }
        Returns: {
          documento_id: string
          mensagem: string
          status: string
        }[]
      }
      rpc_canal_repasse_confirmar_baixa: {
        Args: {
          p_data_pagamento?: string
          p_demanda_id: string
          p_nova_data_prevista?: string
          p_observacao?: string
          p_pago: boolean
        }
        Returns: {
          baixa_id: string
          mensagem: string
          situacao: string
        }[]
      }
      rpc_canal_repasse_contrato_do_parceiro: {
        Args: { p_canal_planilha: string }
        Returns: {
          arquivo_nome: string
          arquivo_path: string
          assinado: boolean
          assinado_em: string
          assinatura_atestada_por: string
          contrato_id: string
          minimo_repasse: number
          origem_leitura: string
          parceiro: string
          pct_beneficios: number
          pct_demais_efetivo: number
          pct_garantia: number
          situacao: string
          tipo: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_canal_repasse_decidir_nf: {
        Args: {
          p_aprovar: boolean
          p_data_prevista?: string
          p_demanda_id: string
          p_observacao?: string
        }
        Returns: {
          demanda_id: string
          mensagem: string
          situacao: string
        }[]
      }
      rpc_canal_repasse_demandas: {
        Args: { p_ano?: number; p_mes?: number; p_situacao?: string }
        Returns: {
          baixa_confirmada_em: string
          baixa_confirmada_por: string
          baixa_data_pagamento: string
          canal_id: string
          chave_planilha: string
          ciclo_ano: number
          ciclo_mes: number
          comprovante_documento_id: string
          data_prevista_pagamento: string
          decidido_em: string
          decidido_por_nome: string
          demanda_id: string
          dias_para_a_data: number
          horas_para_expirar: number
          linhas: number
          nf_documento_id: string
          nf_enviada_em: string
          nf_enviada_por_nome: string
          nf_motivo_recusa: string
          nf_numero: string
          nf_status: string
          nf_valor: number
          nf_valor_diverge: boolean
          observacao_financeiro: string
          observacao_solicitante: string
          parceiro: string
          prazo_resposta_em: string
          situacao: string
          solicitado_em: string
          solicitado_por_nome: string
          sou_o_aprovador: boolean
          sou_o_solicitante: boolean
          valor_total: number
        }[]
      }
      rpc_canal_repasse_divergencia_pct: {
        Args: { p_ano?: number; p_canal_repasse?: string; p_mes?: number }
        Returns: {
          chave_planilha: string
          linhas: number
          linhas_com_regra: number
          linhas_divergentes: number
          pct_hub: number[]
          pct_planilha: number[]
          resumo: string
          valor_divergente: number
        }[]
      }
      rpc_canal_repasse_enviar_nf: {
        Args: {
          p_arquivo_nome: string
          p_arquivo_path: string
          p_data_emissao?: string
          p_demanda_id: string
          p_numero_nf: string
          p_valor_nf: number
        }
        Returns: {
          documento_id: string
          mensagem: string
          valor_diverge: boolean
        }[]
      }
      rpc_canal_repasse_registrar_pagamento: {
        Args: {
          p_arquivo_nome: string
          p_arquivo_path: string
          p_base_nome?: string
          p_base_path?: string
          p_data_pagamento: string
          p_demanda_id: string
          p_observacao?: string
        }
        Returns: {
          baixa_id: string
          documento_id: string
          mensagem: string
        }[]
      }
      rpc_canal_repasse_situacao_ciclo: {
        Args: { p_ano: number; p_canal_planilha: string; p_mes: number }
        Returns: {
          aprovado_em: string
          aprovado_por_nome: string
          comprovante_documento_id: string
          data_pagamento: string
          data_prevista: string
          demanda_id: string
          nf_documento_id: string
          nf_motivo_recusa: string
          nf_numero: string
          nf_status: string
          nf_valor: number
          observacao_financeiro: string
          pago: boolean
          pode_enviar_nf: boolean
          rotulo: string
          situacao: string
          solicitado_em: string
          solicitado_por_nome: string
        }[]
      }
      rpc_canal_repasse_solicitar_nf: {
        Args: {
          p_ano: number
          p_canal_planilha: string
          p_linhas?: number
          p_mes: number
          p_observacao?: string
          p_valor?: number
        }
        Returns: {
          demanda_id: string
          mensagem: string
          situacao: string
        }[]
      }
      rpc_comissao_vencida_por_canal:
        | {
            Args: { p_ano: number; p_mes?: number; p_periodo?: string }
            Returns: {
              comissao_vencida: number
              tipo_de_ramo: string
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
              comissao_vencida: number
              tipo_de_ramo: string
            }[]
          }
      rpc_dispensar_popup: { Args: { p_popup_id: string }; Returns: Json }
      rpc_entrada_criar_canal: { Args: { _nome: string }; Returns: string }
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
      rpc_garantia_dar_baixa_apolice: {
        Args: {
          _apolice_id: string
          _data: string
          _documento_id: string
          _estorno_comissao: number
          _observacao: string
          _premio_devolver: number
          _tipo: string
        }
        Returns: {
          encerramento_id: string
          limite_devolvido: boolean
        }[]
      }
      rpc_garantia_decidir_retorno: {
        Args: { _aprovar: boolean; _resposta: string; _solicitacao_id: string }
        Returns: undefined
      }
      rpc_garantia_docs_apos_pedido: { Args: never; Returns: string[] }
      rpc_garantia_fila_comercial: {
        Args: never
        Returns: {
          aguardando_desde: string
          cliente_nome: string
          demanda_id: string
          legenda: string
          numero: string
          o_que_falta: string
          status_nome: string
        }[]
      }
      rpc_garantia_historico_demanda: {
        Args: { _demanda_id: string }
        Returns: {
          com_quem: string
          duracao_segundos: number
          fim: string
          id: string
          inicio: string
          observacao: string
          relogio: string
          status_codigo: string
          status_nome: string
        }[]
      }
      rpc_garantia_lancar_apolice: {
        Args: {
          _comissao_pct: number
          _data_emissao: string
          _demanda_id: string
          _importancia_segurada: number
          _numero_apolice: string
          _numero_endosso: number
          _objeto: string
          _premio: number
          _vencimento_boleto: string
          _vigencia_fim: string
          _vigencia_inicio: string
        }
        Returns: {
          apolice_id: string
          limite_atualizado: boolean
        }[]
      }
      rpc_garantia_painel_carteira: {
        Args: {
          _canal?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          agrupamento: string
          chave: string
          quantidade: number
          rotulo: string
          valor: number
        }[]
      }
      rpc_garantia_painel_conversao: {
        Args: {
          _ate?: string
          _canal?: string
          _de?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          abertas: number
          agrupamento: string
          chave: string
          ganhos: number
          pct_ganho: number
          perdidos: number
          rotulo: string
        }[]
      }
      rpc_garantia_painel_em_jogo: {
        Args: {
          _ate?: string
          _canal?: string
          _de?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          agrupamento: string
          chave: string
          comissao: number
          premio: number
          quantidade: number
          rotulo: string
        }[]
      }
      rpc_garantia_painel_perdas: {
        Args: {
          _ate?: string
          _canal?: string
          _de?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          agrupamento: string
          chave: string
          comissao: number
          premio: number
          quantidade: number
          rotulo: string
        }[]
      }
      rpc_garantia_painel_resultado: {
        Args: {
          _ate?: string
          _canal?: string
          _de?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          apolices: number
          comissao_prevista: number
          comissao_recebida: number
          mes: string
          premio_emitido: number
        }[]
      }
      rpc_garantia_painel_seguradoras: {
        Args: {
          _ate?: string
          _canal?: string
          _de?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          com_limite: number
          nao_consultado: number
          seguradora: string
          sem_limite: number
        }[]
      }
      rpc_garantia_painel_velocidade: {
        Args: {
          _ate?: string
          _canal?: string
          _de?: string
          _modalidade?: string
          _produto?: string
          _responsavel?: string
        }
        Returns: {
          agrupamento: string
          amostras: number
          chave: string
          horas_media: number
          relogio: string
          rotulo: string
        }[]
      }
      rpc_garantia_registrar_aceite: {
        Args: { _demanda_id: string }
        Returns: {
          codigo: string
          legenda: string
        }[]
      }
      rpc_garantia_solicitar_documento: {
        Args: { _demanda_id: string; _faltando: string; _observacao?: string }
        Returns: number
      }
      rpc_garantia_solicitar_retorno: {
        Args: { _demanda_id: string; _motivo: string }
        Returns: string
      }
      rpc_garantia_status_abertos: {
        Args: never
        Returns: {
          demanda_id: string
          inicio: string
        }[]
      }
      rpc_garantia_taxa_media_modalidade: {
        Args: { _modalidade: string }
        Returns: {
          amostras: number
          media: number
        }[]
      }
      rpc_garantia_time_comercial_acesso: {
        Args: never
        Returns: {
          nome: string
          tem_acesso: boolean
          user_id: string
        }[]
      }
      rpc_garantia_voltar_etapa: {
        Args: { _demanda_id: string; _motivo: string; _status_destino: string }
        Returns: undefined
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
          passos: Json
          tipo: string
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
      rpc_hub_listar_pessoas: {
        Args: never
        Returns: {
          nome: string
          user_id: string
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
      rpc_juridico_bloquear_repasse: {
        Args: { p_canal_id: string; p_motivo: string }
        Returns: {
          bloqueio_id: string
          demandas_derrubadas: number
          mensagem: string
        }[]
      }
      rpc_juridico_contratos: {
        Args: { p_situacao?: string }
        Returns: {
          arquivo_nome: string
          arquivo_path: string
          bloqueado: boolean
          bloqueio_em: string
          bloqueio_motivo: string
          bloqueio_por: string
          canal_id: string
          cnpj: string
          contrato_id: string
          dias_para_vencer: number
          minimo_repasse: number
          motivo_bloqueio: string
          parceiro: string
          pct_beneficios: number
          pct_demais: number
          pct_garantia: number
          razao_social: string
          renovacao_automatica: boolean
          renovado_em: string
          renovado_por: string
          repasse_acumulado: number
          situacao: string
          suspenso_motivo: string
          tipo: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_juridico_liberar_repasse: {
        Args: { p_canal_id: string; p_motivo: string }
        Returns: {
          mensagem: string
        }[]
      }
      rpc_juridico_renovar_contrato: {
        Args: { p_contrato_id: string; p_justificativa: string }
        Returns: {
          contrato_id: string
          mensagem: string
          periodos: number
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      rpc_juridico_suspender_contrato: {
        Args: { p_contrato_id: string; p_justificativa: string }
        Returns: {
          mensagem: string
        }[]
      }
      rpc_lavoro_apolices_filtros:
        | {
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
        | {
            Args: { p_user_id: string }
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
      rpc_lavoro_apolices_kpis:
        | {
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
        | {
            Args: {
              p_ano: number
              p_apolice: string
              p_grupo: string
              p_possui_repasse: string
              p_ramo: string
              p_seguradora: string
              p_status: string
              p_tipo_ramo: string
              p_tomador: string
              p_user_id: string
            }
            Returns: {
              comissao_emitida: number
              comissao_gerada: number
              comissao_menos_repasse: number
              premio_total: number
              repasse_parceiro: number
            }[]
          }
      rpc_lavoro_apolices_lista:
        | {
            Args: {
              p_filtros?: Json
              p_pagina?: number
              p_tamanho_pagina?: number
            }
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
        | {
            Args: {
              p_filtros: Json
              p_pagina: number
              p_tamanho_pagina: number
              p_user_id: string
            }
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
      rpc_lavoro_apolices_por_seguradora:
        | {
            Args: { p_filtros?: Json }
            Returns: {
              comissao_bruta: number
              premio_total: number
              seguradora: string
            }[]
          }
        | {
            Args: { p_filtros: Json; p_user_id: string }
            Returns: {
              comissao_bruta: number
              premio_total: number
              seguradora: string
            }[]
          }
      rpc_lavoro_apolices_previsao_dezena:
        | {
            Args: { p_ano?: number; p_mes?: number }
            Returns: {
              ano: number
              dezena: string
              empresa_faturada: string
              mes: number
              valor_a_receber: number
            }[]
          }
        | {
            Args: { p_ano: number; p_mes: number; p_user_id: string }
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
      rpc_lavoro_comissao_vencida_export_detalhe:
        | {
            Args: {
              p_data_ini?: string
              p_limit?: number
              p_offset?: number
              p_seguradora?: string
              p_tipo_de_ramo?: string
            }
            Returns: {
              comissao_bruta: number
              data_emissao: string
              data_pagamento: string
              dias_atraso: number
              documento: string
              faixa_aging: string
              id: number
              numero_apolice: string
              numero_da_parcela: number
              observacao: string
              ramo: string
              responsavel: string
              segurado: string
              seguradora: string
              status_parcela_comissao: string
              tipo_de_ramo: string
              tomador: string
            }[]
          }
        | {
            Args: {
              p_data_ini: string
              p_limit: number
              p_offset: number
              p_seguradora: string
              p_tipo_de_ramo: string
              p_user_id: string
            }
            Returns: {
              comissao_bruta: number
              data_emissao: string
              data_pagamento: string
              dias_atraso: number
              documento: string
              faixa_aging: string
              id: number
              numero_apolice: string
              numero_da_parcela: number
              observacao: string
              ramo: string
              responsavel: string
              segurado: string
              seguradora: string
              status_parcela_comissao: string
              tipo_de_ramo: string
              tomador: string
            }[]
          }
      rpc_lavoro_comissao_vencida_export_resumo:
        | {
            Args: { p_data_ini?: string }
            Returns: {
              comissao_bruta: number
              faixa_aging: string
              qtd_itens: number
              seguradora: string
              tipo_de_ramo: string
            }[]
          }
        | {
            Args: { p_data_ini: string; p_user_id: string }
            Returns: {
              comissao_bruta: number
              faixa_aging: string
              qtd_itens: number
              seguradora: string
              tipo_de_ramo: string
            }[]
          }
      rpc_lavoro_dezenas_detalhe: {
        Args: {
          p_data_fim: string
          p_data_ini: string
          p_dezena?: string
          p_empresa?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          comissao_bruta: number
          data_emissao: string
          data_pagamento: string
          dezena: string
          documento: string
          empresa_faturada: string
          fim_vigencia: string
          imposto_ret: number
          inicio_vigencia: string
          numero_apolice: string
          numero_da_parcela: number
          observacao: string
          percentual_comissao: number
          percentual_repasse: number
          possui_repasse: string
          premio_parcela: number
          premio_total: number
          qtd_parcelas: number
          ramo: string
          segurado: string
          seguradora: string
          status_parcela_comissao: string
          status_repasse: string
          tipo_de_ramo: string
          tomador: string
          valor_iss: number
          valor_recebido_a_receber: number
          valor_repasse_total: number
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
      rpc_lavoro_receita_caixa_comparativo_anual:
        | {
            Args: { p_anos: number[] }
            Returns: {
              ano: number
              mes: number
              receita_caixa: number
            }[]
          }
        | {
            Args: { p_anos: number[]; p_user_id: string }
            Returns: {
              ano: number
              mes: number
              receita_caixa: number
            }[]
          }
      rpc_lavoro_receita_comparativo_anual:
        | {
            Args: { p_anos: number[] }
            Returns: {
              ano: number
              mes: number
              receita_competencia: number
            }[]
          }
        | {
            Args: { p_anos: number[]; p_user_id: string }
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
      rpc_lavoro_receita_por_canal:
        | {
            Args: { p_ano: number; p_mes: number; p_periodo?: string }
            Returns: {
              receita: number
              tipo_de_ramo: string
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
              receita: number
              tipo_de_ramo: string
            }[]
          }
      rpc_lavoro_receita_por_ramo:
        | {
            Args: { p_ano: number; p_mes: number; p_periodo?: string }
            Returns: {
              ramo: string
              receita: number
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
              ramo: string
              receita: number
            }[]
          }
      rpc_lavoro_receita_serie_mensal:
        | {
            Args: { p_ano: number }
            Returns: {
              mes: number
              meta_mensal: number
              receita_caixa: number
              receita_competencia: number
            }[]
          }
        | {
            Args: { p_ano: number; p_user_id: string }
            Returns: {
              mes: number
              meta_mensal: number
              receita_caixa: number
              receita_competencia: number
            }[]
          }
      rpc_lavoro_receita_variacoes:
        | {
            Args: { p_ano: number; p_mes: number }
            Returns: {
              variacao_ano_anterior: number
              variacao_mes_anterior: number
            }[]
          }
        | {
            Args: { p_ano: number; p_mes: number; p_user_id: string }
            Returns: {
              variacao_ano_anterior: number
              variacao_mes_anterior: number
            }[]
          }
      rpc_lavoro_repasse_detalhe: {
        Args: {
          p_ano?: number
          p_canal_repasse?: string
          p_limit?: number
          p_mes?: number
          p_modo?: string
          p_offset?: number
          p_situacao_repasse?: string
        }
        Returns: {
          analise: string
          ano: number
          base_liquida: number
          comissao_bruta: number
          comissao_emitida: number
          data_emissao: string
          data_pagamento: string
          data_repasse: string
          documento: string
          empresa_faturada: string
          fat_competencia: string
          fim_vigencia: string
          grupo: string
          imposto_ret: number
          inicio_vigencia: string
          mes: number
          numero_apolice: string
          numero_da_parcela: number
          observacao: string
          parcelas: string
          percentual_comissao: number
          percentual_imposto: number
          percentual_repasse: number
          periodo_atualizacao: string
          possui_repasse: string
          premio_parcela: number
          premio_total: number
          qtd_parcelas: number
          ramo: string
          segurado: string
          seguradora: string
          status_parcela_comissao: string
          status_repasse: string
          tipo_pagamento: string
          tomador: string
          valor_is: number
          valor_iss: number
          valor_recebido_a_receber: number
          valor_repasse_total: number
        }[]
      }
      rpc_lavoro_repasse_filtros: {
        Args: never
        Returns: {
          tipo: string
          valor: string
        }[]
      }
      rpc_lavoro_repasse_idade: {
        Args: {
          p_ano?: number
          p_canal_repasse?: string
          p_mes?: number
          p_situacao_repasse?: string
        }
        Returns: {
          canal_repasse: string
          faixa: string
          mes_mais_antigo: string
          ordem: number
          parcelas: number
          valor: number
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
      rpc_minhas_notificacoes: {
        Args: never
        Returns: {
          categoria: string
          chave: string
          descricao: string
          desde: string
          link: string
          titulo: string
          urgencia: string
          vista: boolean
        }[]
      }
      rpc_notificacoes_marcar_vistas: {
        Args: { p_chaves: string[] }
        Returns: number
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
      rpc_rp_cancelar_reserva: {
        Args: { p_motivo?: string; p_reserva_id: string }
        Returns: Json
      }
      rpc_rp_controle_ranking: {
        Args: { p_ate: string; p_de: string }
        Returns: Json
      }
      rpc_rp_controle_reservas: {
        Args: {
          p_ate: string
          p_de: string
          p_posicao_numero?: number
          p_status?: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_rp_criar_reserva: {
        Args: {
          p_data: string
          p_hora_fim: string
          p_hora_inicio: string
          p_posicao_id: string
        }
        Returns: Json
      }
      rpc_rp_grade_dia: { Args: { p_data: string }; Returns: Json }
      rpc_rp_minhas_reservas: { Args: never; Returns: Json }
      rpc_rp_parametros: { Args: never; Returns: Json }
      rpc_senha_aprovacao_confirmar: {
        Args: { p_alvo?: string; p_area: string; p_senha: string }
        Returns: {
          bloqueada_ate: string
          motivo: string
          ok: boolean
        }[]
      }
      rpc_senha_aprovacao_criar: {
        Args: { p_alvo?: string; p_area?: string; p_senha: string }
        Returns: boolean
      }
      rpc_senha_aprovacao_redefinir: {
        Args: {
          p_alvo?: string
          p_area?: string
          p_codigo: string
          p_nova_senha: string
        }
        Returns: {
          motivo: string
          ok: boolean
        }[]
      }
      rpc_senha_aprovacao_status: {
        Args: never
        Returns: {
          bloqueada_ate: string
          definida: boolean
        }[]
      }
      rpc_set_meta_anual: {
        Args: { _ano: number; _valor: number }
        Returns: undefined
      }
      rpc_toggle_schedule: {
        Args: { p_modulo: string; p_motivo?: string }
        Returns: boolean
      }
      senha_aprovacao_gerar_codigo: {
        Args: { p_user_id: string }
        Returns: string
      }
      senha_confirmada: {
        Args: { p_area: string; p_minutos?: number }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      super_admin_liberado: {
        Args: { p_area?: string; p_minutos?: number }
        Returns: boolean
      }
      tem_permissao: {
        Args: { p_chave: string; p_user?: string }
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
