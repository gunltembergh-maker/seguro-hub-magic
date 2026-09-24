import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Inbox,
  Megaphone,
  Landmark,
  Scale,
  Cog,
  Layers,
  Wrench,
  ShieldCheck,
  FileSearch,
  SearchCheck,
  HeartPulse,
  Boxes,
  Users,
  KeyRound,
  Upload,
  Settings,
  BarChart3,
  CornerDownRight,
  Mail,
  ChevronRight,
  Activity,
  CalendarClock,
  CalendarCheck,
  UserSquare2,
  ClipboardList,
  Handshake,
  FileSignature,
  type LucideIcon,
} from "lucide-react";

import logoBranca from "@/assets/logo-branca.png.asset.json";
import { hasPermission, hasRole, type MeuPerfil } from "@/hooks/use-meu-perfil";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";

import { cn } from "@/lib/utils";
import { NAV_AREAS, NAV_RAMOS, NAV_DASHBOARDS, NAV_ADMIN, NAV_EMAILS } from "@/lib/navegacao";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Início", url: "/inicio", icon: Home },
];

const RESERVA_ITEM = { title: "Reserva de Posições", url: "/reserva-posicoes", icon: CalendarCheck };

// Porta compartilhada de todos os ramos: fica no topo, fora de "Ramos".
const ENTRADA_ITEM = { title: "Entrada de Demandas", url: "/entrada-demandas", icon: Inbox };

const areasAll = NAV_AREAS as AreaItem[];

type ChildItem = { title: string; url: string; icon: LucideIcon; perms?: string[] };

type CollapsibleItem = {
  title: string;
  url?: string;
  icon: LucideIcon;
  tooltip?: string;
  perm?: string;
  children?: ChildItem[];
};

type AreaItem = {
  title: string;
  url?: string;
  icon: LucideIcon;
  tooltip?: string;
  perm: string;
  children?: ChildItem[];
};

const ramosAll: CollapsibleItem[] = NAV_RAMOS;

/**
 * Item de menu com subitens recolhíveis.
 * Os filhos ficam ocultos por padrão e aparecem ao passar o mouse ou clicar.
 * Se a rota ativa for um filho, o grupo abre automaticamente para manter o destorte.
 */
function CollapsibleNavItem({
  item,
  isActiveParent,
  hasActiveChild,
  isActiveChild,
  collapsed,
  onChildNavigate,
}: {
  item: CollapsibleItem;
  isActiveParent: boolean;
  hasActiveChild: boolean;
  isActiveChild: (url: string) => boolean;
  collapsed: boolean;
  onChildNavigate: () => void;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered || hasActiveChild;
  const Icon = item.icon;

  const toggle = () => setPinned((p) => !p);

  return (
    <SidebarMenuItem
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SidebarMenuButton
        asChild
        isActive={isActiveParent}
        tooltip={item.tooltip ?? item.title}
        onClick={item.url ? undefined : toggle}
      >
        {item.url ? (
          <Link to={item.url} onClick={toggle}>
            <Icon />
            <span>{item.title}</span>
            {item.children && item.children.length > 0 && (
              <ChevronRight
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
                  open && "rotate-90",
                )}
              />
            )}
          </Link>
        ) : (
          <button type="button" onClick={toggle}>
            <Icon />
            <span>{item.title}</span>
            {item.children && item.children.length > 0 && (
              <ChevronRight
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
                  open && "rotate-90",
                )}
              />
            )}
          </button>
        )}
      </SidebarMenuButton>

      {open && !collapsed && item.children && (
        <SidebarMenuSub>
          {item.children.map((c) => {
            const ChildIcon = c.icon;
            return (
              <SidebarMenuSubButton
                key={c.url}
                asChild
                isActive={isActiveChild(c.url)}
              >
                <Link to={c.url} onClick={onChildNavigate} className="flex items-center gap-2">
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{c.title}</span>
                </Link>
              </SidebarMenuSubButton>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/**
 * Filtra os filhos de um item conforme as permissões do perfil.
 * children vazio TEM de ser undefined, nunca [] — CollapsibleNavItem
 * renderiza o submenu quando `item.children` é truthy, e [] é truthy.
 * O compilador NÃO protege essa linha (spread de genérico é frouxo).
 */
function semFilhosProibidos<T extends { children?: ChildItem[] }>(
  item: T,
  meuPerfil: MeuPerfil | null | undefined,
  isAdmin: boolean,
): T {
  if (!item.children || item.children.length === 0) return item;
  const filhos = item.children.filter(
    (c) => isAdmin || !c.perms?.length || c.perms.some((p) => hasPermission(meuPerfil, p)),
  );
  // children vazio TEM de ser undefined, nunca []
  return { ...item, children: filhos?.length ? filhos : undefined };
}

export function AppSidebar() {
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url;

  // Recolher o menu principal ao navegar para itens filhos/submenu.
  const collapseOnNavigate = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const meuPerfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(meuPerfil, "ADMIN");

  const areas = areasAll
    .filter(
      (i) =>
        isAdmin ||
        hasPermission(meuPerfil, i.perm) ||
        (i.children ?? []).some((c) => (c.perms ?? []).some((p) => hasPermission(meuPerfil, p))),
    )
    .map((i) => semFilhosProibidos(i, meuPerfil, isAdmin));
  // A área aparece quando o perfil tem a permissão do grupo OU a de qualquer
  // um dos filhos — um sub-item liberado sozinho precisa ter porta de entrada.
  const ramos = ramosAll
    .filter(
      (i) =>
        isAdmin ||
        (i.perm ? hasPermission(meuPerfil, i.perm) : true) ||
        (i.children ?? []).some((c) => (c.perms ?? []).some((p) => hasPermission(meuPerfil, p))),
    )
    .map((i) => semFilhosProibidos(i, meuPerfil, isAdmin));

  const podeVer = (perms: string[]) => isAdmin || perms.some((p) => hasPermission(meuPerfil, p));
  const dashboardItems = NAV_DASHBOARDS.filter((i) => podeVer(i.perms));
  const showDashboards = dashboardItems.length > 0;
  const hasActiveDashboardChild = dashboardItems.some((i) => isActive(i.url));

  const adminItems = NAV_ADMIN.filter((i) => podeVer(i.perms));

  // Todos os itens de e-mail ficam dentro de uma única caixa "E-mails"
  const emailChildren = NAV_EMAILS.filter((i) => podeVer(i.perms)).map(({ title, url, icon }) => ({ title, url, icon }));

  const emailsCollapsible: CollapsibleItem = {
    title: "E-mails",
    icon: Mail,
    tooltip: "E-mails",
    children: emailChildren,
  };
  const hasActiveEmailChild = emailChildren.some((c) => isActive(c.url));

  // Item "Dashboards" agrupador com filhos recolhíveis
  const dashboardsCollapsible: CollapsibleItem = {
    title: "Dashboards",
    icon: BarChart3,
    tooltip: "Dashboards",
    children: dashboardItems.map((d) => ({
      title: d.title,
      url: d.url,
      icon: CornerDownRight,
    })),
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      onMouseEnter={() => {
        if (!isMobile) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!isMobile) setOpen(false);
      }}
    >
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

      <SidebarContent className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              {(isAdmin || hasPermission(meuPerfil, "menu_entrada_demandas")) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(ENTRADA_ITEM.url)}
                    tooltip={ENTRADA_ITEM.title}
                  >
                    <Link to={ENTRADA_ITEM.url}>
                      <ENTRADA_ITEM.icon />
                      <span>{ENTRADA_ITEM.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {(isAdmin || hasPermission(meuPerfil, "menu_reserva_posicoes")) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(RESERVA_ITEM.url)}
                    tooltip={RESERVA_ITEM.title}
                  >
                    <Link to={RESERVA_ITEM.url}>
                      <RESERVA_ITEM.icon />
                      <span>{RESERVA_ITEM.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showDashboards && (
          <SidebarGroup>
            <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <CollapsibleNavItem
                  item={dashboardsCollapsible}
                  isActiveParent={false}
                  hasActiveChild={hasActiveDashboardChild}
                  isActiveChild={isActive}
                  collapsed={collapsed}
                  onChildNavigate={collapseOnNavigate}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {areas.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Áreas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {areas.map((i) => {
                  if (i.children && i.children.length > 0) {
                    const hasActiveChild = !!i.children.some((c) => isActive(c.url));
                    return (
                      <CollapsibleNavItem
                        key={i.title}
                        item={i}
                        isActiveParent={i.url ? isActive(i.url) : false}
                        hasActiveChild={hasActiveChild}
                        isActiveChild={isActive}
                        collapsed={collapsed}
                        onChildNavigate={collapseOnNavigate}
                      />
                    );
                  }
                  return (
                    <SidebarMenuItem key={i.title}>
                      <SidebarMenuButton asChild isActive={i.url ? isActive(i.url) : false} tooltip={i.title}>
                        <Link to={i.url!}>
                          <i.icon />
                          <span>{i.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {ramos.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Ramos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ramos.map((i) => {
                  const hasActiveChild = !!i.children?.some((c) => isActive(c.url));
                  return (
                    <CollapsibleNavItem
                      key={i.title}
                      item={i}
                      isActiveParent={isActive(i.url ?? "")}
                      hasActiveChild={hasActiveChild}
                      isActiveChild={isActive}
                      collapsed={collapsed}
                      onChildNavigate={collapseOnNavigate}
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(adminItems.length > 0 || emailChildren.length > 0) && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems
                  .filter((i) => i.url !== "/admin/configuracoes")
                  .map((i) => (
                    <SidebarMenuItem key={i.url}>
                      <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title}>
                        <Link to={i.url}>
                          <i.icon />
                          <span>{i.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                {emailChildren.length > 0 && (
                  <CollapsibleNavItem
                    item={emailsCollapsible}
                    isActiveParent={false}
                    hasActiveChild={hasActiveEmailChild}
                    isActiveChild={isActive}
                    collapsed={collapsed}
                    onChildNavigate={collapseOnNavigate}
                  />
                )}

                {adminItems
                  .filter((i) => i.url === "/admin/configuracoes")
                  .map((i) => (
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
