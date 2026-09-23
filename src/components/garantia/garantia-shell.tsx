import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { PaginaHub } from "@/components/hub/pagina-hub";
import { cn } from "@/lib/utils";

const ABAS = [
  { label: "Negociação", to: "/garantia/negociacao" },
  { label: "CRM", to: "/garantia/crm" },
  { label: "Painel", to: "/garantia/painel" },
] as const;

export function GarantiaShell({
  titulo,
  trilha = [],
  acoes,
  children,
}: {
  titulo: string;
  trilha?: string[];
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const abas = (
    <nav className="flex gap-6">
          {ABAS.map((a) => {
            const ativo = pathname.startsWith(a.to);
            return (
              <Link
                key={a.to}
                to={a.to}
                className={cn(
                  "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors",
                  ativo
                    ? "border-primary text-card-foreground"
                    : "border-transparent text-muted-foreground hover:text-card-foreground",
                )}
              >
                {a.label}
              </Link>
            );
          })}
    </nav>
  );

  return (
    <PaginaHub trilha={["Hub Lavoro", "Garantia", ...trilha]} titulo={titulo} acoes={acoes} abas={abas}>
      {children}
    </PaginaHub>
  );
}
