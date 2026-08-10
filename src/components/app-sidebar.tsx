import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Megaphone,
  Landmark,
  Scale,
  Cog,
  Layers,
  Wrench,
  ShieldCheck,
  FileSearch,
  HeartPulse,
  Boxes,
  Users,
  KeyRound,
  Upload,
  Settings,
  BarChart3,
  CornerDownRight,
  Mail,
} from "lucide-react";




import logoBranca from "@/assets/logo-branca.png.asset.json";
import { hasPermission, hasRole } from "@/hooks/use-meu-perfil";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";


import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Início", url: "/inicio", icon: Home },
];

const areasAll = [
  { title: "Financeiro", url: "/financeiro", icon: Landmark, perm: "menu_area_financeiro" },
  { title: "Jurídico", url: "/juridico", icon: Scale, perm: "menu_area_juridico" },
  { title: "Operacional", url: "/operacional", icon: Cog, perm: "menu_area_operacional" },
  { title: "Middle", url: "/middle", icon: Layers, perm: "menu_area_middle" },
  { title: "Facilities", url: "/facilities", icon: Wrench, perm: "menu_area_facilities" },
];

type RamoItem = {
  title: string;
  url: string;
  icon: typeof ShieldCheck;
  perm: string;
  children?: { title: string; url: string; icon: typeof ShieldCheck }[];
};

const ramosAll: RamoItem[] = [
  {
    title: "Garantia",
    url: "/garantia",
    icon: ShieldCheck,
    perm: "menu_ramo_garantia",
    children: [{ title: "Análise de Limite", url: "/garantia/analise-limite", icon: FileSearch }],
  },
  { title: "Benefícios", url: "/beneficios", icon: HeartPulse, perm: "menu_ramo_beneficios" },
  { title: "Demais Ramos", url: "/demais-ramos", icon: Boxes, perm: "menu_ramo_demais" },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url;

  const meuPerfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(meuPerfil, "ADMIN");

  const areas = areasAll.filter((i) => isAdmin || hasPermission(meuPerfil, i.perm));
  const ramos = ramosAll.filter((i) => isAdmin || hasPermission(meuPerfil, i.perm));

  const dashboardItems = [
    { title: "Receita", url: "/dashboard/receita",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita") },
    { title: "Receita Caixa", url: "/dashboard/receita-caixa",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita_caixa") },
    { title: "Resumo Executivo", url: "/dashboard/receita-executivo",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita_executivo") },
    { title: "Report Fechamento", url: "/dashboard/report-fechamento",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_report_fechamento") },
  ].filter((i) => i.show);
  const showDashboards = dashboardItems.length > 0;

  const adminItems = [
    { title: "Usuários", url: "/admin/usuarios", icon: Users, show: isAdmin || hasPermission(meuPerfil, "menu_admin_usuarios") },
    { title: "Perfis", url: "/admin/perfis", icon: KeyRound, show: isAdmin || hasPermission(meuPerfil, "menu_admin_perfis") },
    { title: "Comunicados", url: "/admin/comunicados", icon: Megaphone, show: isAdmin || hasPermission(meuPerfil, "menu_admin_comunicados") },
    { title: "Importar Bases", url: "/admin/importar-bases", icon: Upload,
      show: isAdmin || hasPermission(meuPerfil, "menu_admin_importar") || hasPermission(meuPerfil, "menu_importar_gerencial") || hasPermission(meuPerfil, "menu_importar_caixa") },
    { title: "Emails", url: "/admin/emails", icon: Mail, show: isAdmin || hasPermission(meuPerfil, "menu_admin_emails") },
    { title: "Agendamento de E-mail", url: "/admin/emails/schedules", icon: Mail, show: isAdmin || hasPermission(meuPerfil, "menu_admin_emails_schedules") },
    { title: "Log de Emails", url: "/admin/emails/log", icon: Mail, show: isAdmin || hasPermission(meuPerfil, "menu_admin_emails_log") },
    { title: "Configurações", url: "/admin/configuracoes", icon: Settings,
      show: isAdmin || hasPermission(meuPerfil, "menu_admin_configuracoes") },

  ].filter((i) => i.show);



  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/inicio" className="flex items-center gap-2 px-2 py-1.5">
          <img
            src={logoBranca.url}
            alt="Lavoro Seguros"
            className={collapsed ? "h-7 w-7 shrink-0 object-contain" : "h-8 w-auto object-contain"}
          />

          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold text-sidebar-foreground">Lavoro Seguros</span>
              <span className="text-[11px] text-sidebar-foreground/60">Hub interno</span>
            </div>
          )}
        </Link>

      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title}>
                    <Link to={i.url}>
                      <i.icon />
                      <span>{i.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showDashboards && (
          <SidebarGroup>
            <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={false} tooltip="Dashboards" className="pointer-events-none opacity-80">
                    <BarChart3 />
                    <span>Dashboards</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {dashboardItems.map((i) => (
                  <SidebarMenuItem key={i.url}>
                    <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title} className="pl-6">
                      <Link to={i.url}>
                        <CornerDownRight />
                        <span>{i.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {areas.length > 0 && (
          <SidebarGroup>

            <SidebarGroupLabel>Áreas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {areas.map((i) => (
                  <SidebarMenuItem key={i.url}>
                    <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title}>
                      <Link to={i.url}>
                        <i.icon />
                        <span>{i.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {ramos.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Ramos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ramos.map((i) => (
                  <SidebarMenuItem key={i.url}>
                    <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title}>
                      <Link to={i.url}>
                        <i.icon />
                        <span>{i.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((i) => (
                  <SidebarMenuItem key={i.url}>
                    <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title}>
                      <Link to={i.url}>
                        <i.icon />
                        <span>{i.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <p className="px-2 py-1 text-[11px] text-sidebar-foreground/50">
            © {new Date().getFullYear()} Lavoro Seguros
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
