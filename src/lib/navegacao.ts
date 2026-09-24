/**
 * Fonte única da árvore de navegação do Hub, com as chaves de permissão de
 * cada item. Usada pelo menu lateral e pelo Acesso Rápido da tela inicial —
 * item novo entra aqui, e aparece nos dois com a mesma regra.
 */
import {
  Inbox, CalendarCheck, Landmark, Scale, Cog, Layers, Wrench, ShieldCheck, FileSearch,
  SearchCheck, HeartPulse, Boxes, Users, KeyRound, Upload, Settings, BarChart3, Mail,
  Activity, CalendarClock, UserSquare2, ClipboardList, Handshake, FileSignature, Megaphone,
  CornerDownRight, type LucideIcon,
} from "lucide-react";

export type NavChild = { title: string; url: string; icon: LucideIcon; perms?: string[] };

export type NavItem = {
  title: string;
  url?: string;
  icon: LucideIcon;
  tooltip?: string;
  perm?: string;
  children?: NavChild[];
};

export type NavLeaf = { title: string; url: string; icon: LucideIcon; perms: string[] };

export const NAV_PRINCIPAL: NavLeaf[] = [
  { title: "Entrada de Demandas", url: "/entrada-demandas", icon: Inbox, perms: ["menu_entrada_demandas"] },
  { title: "Reserva de Posições", url: "/reserva-posicoes", icon: CalendarCheck, perms: ["menu_reserva_posicoes"] },
];

export const NAV_DASHBOARDS: NavLeaf[] = [
  { title: "Receita", url: "/dashboard/receita", icon: BarChart3, perms: ["menu_dashboard_receita"] },
  { title: "Receita Caixa", url: "/dashboard/receita-caixa", icon: BarChart3, perms: ["menu_dashboard_receita_caixa"] },
  { title: "Resumo Executivo", url: "/dashboard/receita-executivo", icon: BarChart3, perms: ["menu_dashboard_receita_executivo"] },
  { title: "Report Fechamento", url: "/dashboard/report-fechamento", icon: BarChart3, perms: ["menu_dashboard_report_fechamento"] },
];

export const NAV_AREAS: NavItem[] = [
  {
    title: "Financeiro", icon: Landmark, tooltip: "Financeiro", perm: "menu_area_financeiro",
    children: [
      { title: "Fluxo Diário", url: "/financeiro/fluxo-diario", icon: CalendarClock, perms: ["menu_financeiro_fluxo_diario"] },
    ],
  },
  {
    title: "Comercial", icon: Handshake, tooltip: "Comercial", perm: "menu_area_comercial",
    children: [
      { title: "Canal Parceiros", url: "/comercial/canal-parceiros", icon: FileSignature, perms: ["menu_comercial_canal_parceiros"] },
      { title: "Garantia", url: "/garantia/comercial", icon: ClipboardList, perms: ["menu_garantia_comercial"] },
    ],
  },
  {
    title: "Jurídico", url: "/juridico", icon: Scale, perm: "menu_area_juridico",
    children: [
      { title: "Background Check", url: "/juridico/analise-background", icon: SearchCheck, perms: ["ab_juridico", "ab_compliance", "ab_rh"] },
      { title: "Contrato de Parceria", url: "/juridico/contrato-parceria", icon: FileSignature, perms: ["menu_juridico_contratos"] },
    ],
  },
  { title: "Operacional", url: "/operacional", icon: Cog, perm: "menu_area_operacional" },
  { title: "Middle", url: "/middle", icon: Layers, perm: "menu_area_middle" },
  { title: "Facilities", url: "/facilities", icon: Wrench, perm: "menu_area_facilities" },
  {
    title: "RH", icon: UserSquare2, tooltip: "RH", perm: "menu_rh_controle_posicoes",
    children: [
      { title: "Controle de Posições", url: "/rh/controle-posicoes", icon: ClipboardList, perms: ["menu_rh_controle_posicoes"] },
    ],
  },
];

export const NAV_RAMOS: NavItem[] = [
  {
    title: "Garantia", icon: ShieldCheck, tooltip: "Garantia", perm: "menu_ramo_garantia",
    children: [
      { title: "Operacional", url: "/garantia/analise-limite", icon: FileSearch, perms: ["menu_garantia_operacional"] },
      { title: "Análise de Processos", url: "/garantia/analise-background", icon: SearchCheck, perms: ["menu_garantia_analise_processos", "ab_garantia"] },
      { title: "Formulário Admin", url: "/garantia/formulario-admin", icon: ClipboardList, perms: ["menu_garantia_formulario_admin"] },
      { title: "Negociação", url: "/garantia/negociacao", icon: ClipboardList, perms: ["menu_garantia_negociacao"] },
      { title: "CRM", url: "/garantia/crm", icon: ClipboardList, perms: ["menu_garantia_crm"] },
      { title: "Painel da Gerência", url: "/garantia/painel", icon: BarChart3, perms: ["menu_garantia_painel"] },
    ],
  },
  { title: "Benefícios", url: "/beneficios", icon: HeartPulse, tooltip: "Benefícios", perm: "menu_ramo_beneficios" },
  { title: "Demais Ramos", url: "/demais-ramos", icon: Boxes, tooltip: "Demais Ramos", perm: "menu_ramo_demais" },
];

export const NAV_ADMIN: NavLeaf[] = [
  { title: "Usuários", url: "/admin/usuarios", icon: Users, perms: ["menu_admin_usuarios"] },
  { title: "Perfis", url: "/admin/perfis", icon: KeyRound, perms: ["menu_admin_perfis"] },
  { title: "Comunicados", url: "/admin/comunicados", icon: Megaphone, perms: ["menu_admin_comunicados"] },
  { title: "Importar Bases", url: "/admin/importar-bases", icon: Upload, perms: ["menu_admin_importar", "menu_importar_gerencial", "menu_importar_caixa"] },
  { title: "Relatório de Uso", url: "/admin/uso", icon: Activity, perms: ["menu_admin_uso"] },
  { title: "Reserva de Posições", url: "/admin/reservas", icon: CalendarCheck, perms: ["menu_admin_reservas"] },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings, perms: ["menu_admin_configuracoes"] },
];

export const NAV_EMAILS: NavLeaf[] = [
  { title: "Envio e testes", url: "/admin/emails", icon: CornerDownRight, perms: ["menu_admin_emails"] },
  { title: "Agendamentos", url: "/admin/emails/schedules", icon: CornerDownRight, perms: ["menu_admin_emails_schedules"] },
  { title: "Log de E-mails", url: "/admin/emails/log", icon: CornerDownRight, perms: ["menu_admin_emails_log"] },
];

export const NAV_EMAILS_ICON = Mail;

type Tem = (chave: string) => boolean;

/** Item sem chave nunca aparece para quem não é ADMIN. */
const liberado = (perms: string[] | undefined, tem: Tem, isAdmin: boolean) =>
  isAdmin || (!!perms?.length && perms.some(tem));

export type GrupoAtalhos = { titulo: string; itens: NavLeaf[] };

/** Atalhos planos por grupo, para o Acesso Rápido. */
export function atalhosVisiveis(tem: Tem, isAdmin: boolean): GrupoAtalhos[] {
  const achatar = (itens: NavItem[]): NavLeaf[] =>
    itens.flatMap((i) => {
      const out: NavLeaf[] = [];
      if (i.url) out.push({ title: i.title, url: i.url, icon: i.icon, perms: i.perm ? [i.perm] : [] });
      for (const c of i.children ?? []) {
        out.push({
          title: `${i.title} › ${c.title}`,
          url: c.url,
          icon: c.icon,
          perms: c.perms?.length ? c.perms : i.perm ? [i.perm] : [],
        });
      }
      return out;
    });

  const grupos: GrupoAtalhos[] = [
    { titulo: "Principal", itens: NAV_PRINCIPAL },
    { titulo: "Dashboards", itens: NAV_DASHBOARDS },
    { titulo: "Áreas", itens: achatar(NAV_AREAS) },
    { titulo: "Ramos", itens: achatar(NAV_RAMOS) },
    {
      titulo: "Administração",
      itens: [...NAV_ADMIN, ...NAV_EMAILS.map((e) => ({ ...e, icon: Mail, title: `E-mails › ${e.title}` }))],
    },
  ];
  return grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => liberado(i.perms, tem, isAdmin)) }))
    .filter((g) => g.itens.length > 0);
}
