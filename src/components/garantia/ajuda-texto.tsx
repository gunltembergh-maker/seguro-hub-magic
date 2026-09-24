// "?" discreto com um texto curto. Mesmo visual do AjudaFase.
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AjudaTexto({ texto, rotulo = "Ajuda" }: { texto: string; rotulo?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={rotulo}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 cursor-pointer items-center text-muted-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] text-sm text-muted-foreground">{texto}</PopoverContent>
    </Popover>
  );
}

export const AJUDA_CANAL_RESPONSAVEL =
  "Canal e responsável pelo cliente vêm do cadastro do cliente e valem para todas as demandas dele. Depois de definidos, só um administrador altera.";
