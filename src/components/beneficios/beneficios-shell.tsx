import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAVY = "#14405C";

const ABAS = [
  { label: "Clientes", to: "/beneficios/clientes" },
  { label: "Cadastros de referência", to: "/beneficios/cadastros" },
] as const;

export function BeneficiosShell({
  titulo,
  trilha = [],
  acoes,
  children,
  mostrarAbas = true,
}: {
  titulo: string;
  trilha?: string[];
  acoes?: ReactNode;
  children: ReactNode;
  mostrarAbas?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-full" style={{ background: "#F4F6F8" }}>
      <header className="border-b border-gray-200 bg-white px-6 pt-6 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Hub Lavoro / Benefícios{trilha.map((t) => ` / ${t}`).join("")}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl" style={{ color: NAVY }}>
            {titulo}
          </h1>
          <div className="flex items-center gap-2">{acoes}</div>
        </div>

        {mostrarAbas && (
          <nav className="mt-4 flex gap-6">
            {ABAS.map((a) => {
              const ativo = pathname.startsWith(a.to);
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className={cn(
                    "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors",
                    ativo
                      ? "border-[#00BAF2] text-[#14405C]"
                      : "border-transparent text-gray-500 hover:text-[#14405C]",
                  )}
                >
                  {a.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <div className="p-6 md:p-8">{children}</div>
    </div>
  );
}
