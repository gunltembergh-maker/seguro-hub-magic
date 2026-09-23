import type { ReactNode } from "react";

export interface PaginaHubProps {
  trilha?: string[];
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
  abas?: ReactNode;
  children: ReactNode;
}

export function PaginaHub({
  trilha = [],
  titulo,
  subtitulo,
  acoes,
  abas,
  children,
}: PaginaHubProps) {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6 text-card-foreground sm:px-6 md:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl min-w-0">
          {trilha.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {trilha.join(" / ")}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="break-words font-display text-2xl font-bold tracking-tight md:text-3xl">
                {titulo}
              </h1>
              {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
            </div>
            {acoes && (
              <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                {acoes}
              </div>
            )}
          </div>

          {abas && (
            <div className="mt-4 flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {abas}
            </div>
          )}
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
      </div>
    </div>
  );
}