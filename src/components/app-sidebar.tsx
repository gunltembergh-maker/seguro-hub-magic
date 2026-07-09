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
} from "lucide-react";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import { useMeuPerfil, hasPermission, hasRole } from "@/hooks/use-meu-perfil";


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
  { title: "Comunicados", url: "/comunicados", icon: Megaphone },
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
  const { data: meuPerfil } = useMeuPerfil();
  const isAdmin = hasRole(meuPerfil, "ADMIN");
  const adminItems = [
    { title: "Usuários", url: "/admin/usuarios", icon: Users, show: isAdmin },
    { title: "Perfis", url: "/admin/perfis", icon: KeyRound, show: isAdmin },
    { title: "Importar Bases", url: "/admin/importar-bases", icon: Upload,
      show: isAdmin || hasPermission(meuPerfil, "menu_importar_gerencial") || hasPermission(meuPerfil, "menu_importar_caixa") },
    { title: "Configurações", url: "/admin/configuracoes", icon: Settings,
      show: hasPermission(meuPerfil, "menu_admin_configuracoes") },
  ].filter((i) => i.show);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url;

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
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <p className="px-2 py-1 text-[11px] text-sidebar-foreground/50">
            © {new Date().getFullYear()} Lavoro Seguros
          </p>
        )}
      </SidebarFooter>

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
