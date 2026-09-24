import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { AppRole } from "@/hooks/use-meu-perfil";
import { atalhosVisiveis } from "@/lib/navegacao";
import { cn } from "@/lib/utils";

interface Props {
  role: AppRole | null;
  permissoes: Record<string, boolean>;
  /** Em destaque no topo (largura total), com grade mais larga. */
  destaque?: boolean;
}

export function AcessoRapidoCard({ role, permissoes, destaque = false }: Props) {
  const isAdmin = role === "ADMIN";
  const grupos = atalhosVisiveis((k) => permissoes[k] === true, isAdmin);

  return (
    <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      <h3 className="font-display text-base font-semibold text-card-foreground">Acesso Rápido</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Atalhos filtrados pelas suas permissões.</p>

      {grupos.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum atalho liberado para o seu perfil.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{g.titulo}</div>
              <div
                className={cn(
                  "grid gap-1.5",
                  destaque ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-2",
                )}
              >
                {g.itens.map((i) => (
                  <Link
                    key={i.url}
                    to={i.url as never}
                    title={i.title}
                    className="group flex items-center gap-2 rounded-md border border-transparent bg-muted px-2.5 py-2 text-[13px] font-medium text-card-foreground transition-colors hover:border-primary/30 hover:bg-accent"
                  >
                    <i.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="flex-1 truncate">{i.title}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
