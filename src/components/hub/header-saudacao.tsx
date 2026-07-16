import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  fullName: string;
  lastUpdated: Date | null;
  isFetching: boolean;
  onRefresh: () => void;
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function fmtHora(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function HeaderSaudacao({ fullName, lastUpdated, isFetching, onRefresh }: Props) {
  const primeiro = (fullName || "Usuário").split(" ")[0];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-primary-foreground md:text-4xl">
          {saudacao()}, <span className="text-primary-glow">{primeiro}</span>.
        </h1>
        <p className="mt-1 text-sm capitalize text-primary-foreground/80">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}
        </p>
        <p className="text-xs text-primary-foreground/60">Visão consolidada da Lavoro Seguros</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-xs text-primary-foreground/70">
          <div>Última atualização</div>
          <div className="font-numeric font-medium text-primary-foreground">{fmtHora(lastUpdated)} BRT</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
