import { Link } from "@tanstack/react-router";
import {
  BarChart3, Landmark, Scale, Cog, Layers, Wrench, ShieldCheck, HeartPulse, Boxes,
  Upload, Users, KeyRound, Mail, ArrowRight,
} from "lucide-react";
import type { AppRole } from "@/hooks/use-meu-perfil";

interface Props {
  role: AppRole | null;
  permissoes: Record<string, boolean>;
}

interface Item {
  label: string;
  href: string;
  icon: any;
  show: boolean;
}

export function AcessoRapidoCard({ role, permissoes }: Props) {
  const isAdmin = role === "ADMIN";
  const has = (k: string) => isAdmin || permissoes[k] === true;

  const grupos: { titulo: string; items: Item[] }[] = [
    {
      titulo: "Dashboards",
      items: [
        { label: "Receita", href: "/dashboard/receita", icon: BarChart3, show: has("menu_dashboard_receita") },
        { label: "Receita Caixa", href: "/dashboard/receita-caixa", icon: BarChart3, show: has("menu_dashboard_receita_caixa") || has("menu_dashboard_receita") },
        { label: "Executivo", href: "/dashboard/receita-executivo", icon: BarChart3, show: has("menu_dashboard_receita") },
        { label: "Fechamento", href: "/dashboard/report-fechamento", icon: BarChart3, show: has("menu_dashboard_receita") },
      ],
    },
    {
      titulo: "Áreas",
      items: [
        { label: "Financeiro", href: "/financeiro", icon: Landmark, show: true },
        { label: "Jurídico", href: "/juridico", icon: Scale, show: true },
        { label: "Operacional", href: "/operacional", icon: Cog, show: true },
        { label: "Middle", href: "/middle", icon: Layers, show: true },
        { label: "Facilities", href: "/facilities", icon: Wrench, show: true },
        { label: "Garantia", href: "/garantia", icon: ShieldCheck, show: true },
        { label: "Benefícios", href: "/beneficios", icon: HeartPulse, show: true },
        { label: "Demais Ramos", href: "/demais-ramos", icon: Boxes, show: true },
      ],
    },
    {
      titulo: "Administração",
      items: [
        { label: "Importar Bases", href: "/admin/importar-bases", icon: Upload, show: has("menu_importar_gerencial") || has("menu_importar_caixa") },
        { label: "Usuários", href: "/admin/usuarios", icon: Users, show: isAdmin },
        { label: "Perfis", href: "/admin/perfis", icon: KeyRound, show: isAdmin },
        { label: "Emails", href: "/admin/emails", icon: Mail, show: isAdmin },
      ],
    },
  ];

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm" style={{ border: "1px solid rgba(20,64,92,0.15)" }}>
      <h3 className="font-display text-base font-semibold text-[#14405C]">Acesso Rápido</h3>
      <p className="mt-0.5 text-xs text-[#4B6D88]">Atalhos filtrados pelas suas permissões.</p>

      <div className="mt-4 space-y-4">
        {grupos.map((g) => {
          const visiveis = g.items.filter((i) => i.show);
          if (visiveis.length === 0) return null;
          return (
            <div key={g.titulo}>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#4B6D88]/80">{g.titulo}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {visiveis.map((i) => (
                  <Link
                    key={i.href}
                    to={i.href as any}
                    className="group flex items-center gap-2 rounded-md border border-transparent bg-[#F8FAFC] px-2.5 py-2 text-[13px] font-medium text-[#0E2E43] transition-colors hover:border-[#14405C]/20 hover:bg-[#14405C]/5"
                  >
                    <i.icon className="h-3.5 w-3.5 text-[#14405C]" />
                    <span className="flex-1 truncate">{i.label}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
