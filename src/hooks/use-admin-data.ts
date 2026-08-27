import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  user_id: string;
  full_name: string | null;
  email: string;
  blocked: boolean;
  active: boolean;
  perfil_id: string | null;
  perfil_nome: string | null;
  ultimo_acesso: string | null;
  criado_em: string;
}

export interface PerfilAcesso {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface PermissionItem {
  key: string;
  label: string;
  desc?: string;
  child?: boolean;
}

export interface PermissionGroup {
  title: string;
  items: PermissionItem[];
}

/**
 * Catálogo mestre de permissões (pai/filho).
 * Qualquer chave nova aqui aparece automaticamente em TODOS os perfis já
 * existentes como desabilitada — o admin decide habilitar por perfil.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Menu Principal",
    items: [
      { key: "menu_inicio", label: "Hub (Início)", desc: "Tela inicial com blocos e atualizações" },
    ],
  },
  {
    title: "Dashboards",
    items: [
      { key: "menu_dashboards", label: "Dashboards", desc: "Controle mestre do grupo Dashboards" },
      { key: "menu_dashboard_receita", label: "↳ Receita", desc: "Dashboard de Receita (Competência x Caixa)", child: true },
      { key: "menu_dashboard_receita_caixa", label: "↳ Receita Caixa", desc: "Detalhamento por caixa", child: true },
      { key: "menu_dashboard_receita_executivo", label: "↳ Resumo Executivo", desc: "Visão executiva consolidada", child: true },
      { key: "menu_dashboard_report_fechamento", label: "↳ Report Fechamento", desc: "Report de fechamento mensal", child: true },
    ],
  },
  {
    title: "Áreas",
    items: [
      { key: "menu_area_financeiro", label: "Financeiro" },
      { key: "menu_area_juridico", label: "Jurídico" },
      { key: "menu_area_operacional", label: "Operacional" },
      { key: "menu_area_middle", label: "Middle" },
      { key: "menu_area_facilities", label: "Facilities" },
    ],
  },
  {
    title: "Ramos",
    items: [
      { key: "menu_ramo_garantia", label: "Garantia", desc: "Controle mestre do grupo Garantia" },
      { key: "menu_garantia_operacional", label: "↳ Operacional", desc: "Análise de limite / auditoria T&C", child: true },
      { key: "menu_garantia_analise_processos", label: "↳ Análise de Processos", desc: "Fila de originação por processo (requer também Originação (Garantia))", child: true },
      { key: "menu_ramo_beneficios", label: "Benefícios" },
      { key: "menu_ramo_demais", label: "Demais Ramos" },
    ],
  },
  {
    title: "Análise Background",
    items: [
      { key: "ab_garantia", label: "Originação (Garantia)",
        desc: "Fila por ramo, carteira, prêmio, comissão e prioridade. Abre a porta Garantia › Análise de Processos" },
      { key: "ab_juridico", label: "Consulta processual (Jurídico)",
        desc: "Acervo de processos e andamentos. NÃO vê pipeline comercial. Abre a porta Jurídico › Background Check" },
      { key: "ab_compliance", label: "Background de cliente e fornecedor",
        desc: "Dossiê de PJ por CNPJ. Abre a porta Jurídico › Background Check" },
      { key: "ab_rh", label: "Background de colaborador e candidato",
        desc: "Dossiê de CPF, com trava de base legal (LGPD). Abre a porta Jurídico › Background Check" },
      { key: "ab_solicitar", label: "↳ Solicitar pesquisa de processos",
        desc: "Permissão de AÇÃO: abre pedido que pode gerar consulta paga. Sozinha não dá acesso a nada para ver", child: true },
      { key: "ab_cota_gerir", label: "↳ Gerir cota e custos",
        desc: "Permissão de AÇÃO: define o teto mensal por área e libera quem esbarrou nele. Sozinha não dá acesso a nada para ver", child: true },
    ],
  },
  {
    title: "Administração",
    items: [
      { key: "menu_admin_usuarios", label: "Usuários", desc: "Gestão de usuários do Hub" },
      { key: "menu_admin_perfis", label: "Perfis de Acesso", desc: "Esta tela — gerenciar perfis" },
      { key: "menu_admin_comunicados", label: "Comunicados", desc: "Popups e comunicados internos" },
      { key: "menu_admin_importar", label: "Importar Bases", desc: "Página de upload de bases" },
      { key: "menu_importar_gerencial", label: "↳ Base Gerencial (Lavoro)", desc: "Upload da base gerencial", child: true },
      { key: "menu_importar_caixa", label: "↳ Caixa Bradesco", desc: "Upload da base de caixa", child: true },
      { key: "menu_admin_emails", label: "E-mails", desc: "Destinatários e templates" },
      { key: "menu_admin_emails_schedules", label: "↳ Agendamentos", desc: "Configurar disparos recorrentes", child: true },
      { key: "menu_admin_emails_log", label: "↳ Log de E-mails", desc: "Histórico de envios", child: true },
      { key: "menu_admin_configuracoes", label: "Configurações", desc: "Configurações gerais do Hub" },
    ],
  },
];

/** Lista plana de todas as chaves — mantida para retro-compatibilidade. */
export const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items);



export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_users");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export function usePerfis() {
  return useQuery({
    queryKey: ["admin-perfis"],
    queryFn: async (): Promise<PerfilAcesso[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_perfis");
      if (error) throw error;
      return ((data ?? []) as PerfilAcesso[]).map((p) => ({
        ...p,
        permissoes: (p.permissoes ?? {}) as Record<string, boolean>,
      }));
    },
  });
}

export function useLastImport(tipo: "gerencial" | "caixa") {
  return useQuery({
    queryKey: ["admin-last-import", tipo],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("rpc_admin_last_import", { _tipo: tipo });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}
