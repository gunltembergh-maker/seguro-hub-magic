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
  { title: "Hub", url: "/hub", icon: Home },
];

const areas = [
  { title: "Financeiro", url: "/financeiro", icon: Landmark },
  { title: "Jurídico", url: "/juridico", icon: Scale },
  { title: "Operacional", url: "/operacional", icon: Cog },
  { title: "Middle", url: "/middle", icon: Layers },
  { title: "Facilities", url: "/facilities", icon: Wrench },
];

const ramos = [
  { title: "Garantia", url: "/garantia", icon: ShieldCheck },
  { title: "Benefícios", url: "/beneficios", icon: HeartPulse },
  { title: "Demais Ramos", url: "/demais-ramos", icon: Boxes },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url;

  const meuPerfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(meuPerfil, "ADMIN");

  const dashboardItems = [
    { title: "Receita", url: "/dashboard/receita",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita") },
    { title: "Receita Caixa", url: "/dashboard/receita-caixa",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita_caixa") || hasPermission(meuPerfil, "menu_dashboard_receita") },
    { title: "Resumo Executivo", url: "/dashboard/receita-executivo",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita") },
    { title: "Report Fechamento", url: "/dashboard/report-fechamento",
      show: isAdmin || hasPermission(meuPerfil, "menu_dashboard_receita") },
  ].filter((i) => i.show);
  const showDashboards =
    isAdmin || hasPermission(meuPerfil, "menu_dashboards") || dashboardItems.length > 0;

  const adminItems = [
    { title: "Usuários", url: "/admin/usuarios", icon: Users, show: isAdmin },
    { title: "Perfis", url: "/admin/perfis", icon: KeyRound, show: isAdmin },
    { title: "Importar Bases", url: "/admin/importar-bases", icon: Upload,
      show: isAdmin || hasPermission(meuPerfil, "menu_importar_gerencial") || hasPermission(meuPerfil, "menu_importar_caixa") },
    { title: "Emails", url: "/admin/emails", icon: Mail, show: isAdmin },
    { title: "Configurações", url: "/admin/configuracoes", icon: Settings,
      show: hasPermission(meuPerfil, "menu_admin_configuracoes") },

  ].filter((i) => i.show);



  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/hub" className="flex items-center gap-2 px-2 py-1.5">
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
