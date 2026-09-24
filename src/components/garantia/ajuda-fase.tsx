// "?" discreto da fase: abre o que a fase é e como preencher; um link leva ao fluxo inteiro.
// Dentro do cartão (que já é um botão) o gatilho é um span com role=button.

import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FLUXO_INTEIRO, ajudaDaEtapa } from "@/lib/garantia/ajuda";

export function AjudaFase({ etapa }: { etapa: string }) {
  const ajuda = ajudaDaEtapa(etapa);
  const [fluxo, setFluxo] = useState(false);
  if (!ajuda) return null;

  const parar = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Popover onOpenChange={(o) => !o && setFluxo(false)}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Ajuda: ${ajuda.titulo}`}
          onClick={parar}
          onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
          className="inline-flex shrink-0 cursor-pointer items-center text-muted-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[70vh] w-[340px] overflow-y-auto text-sm"
        onClick={parar}
        onPointerDown={parar}
      >
        {fluxo ? (
          <div className="space-y-2">
            <p className="font-semibold text-[#14405C]">O fluxo inteiro</p>
            {FLUXO_INTEIRO.map((p, i) => (
              <p key={i} className="text-muted-foreground">{p}</p>
            ))}
            <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setFluxo(false)}>
              Voltar para {ajuda.titulo}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-semibold text-[#14405C]">{ajuda.titulo}</p>
            <p className="text-muted-foreground">{ajuda.paraQueServe}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Como preencher</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {ajuda.comoPreencher.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Para avançar</p>
            <p className="text-muted-foreground">{ajuda.paraAvancar}</p>
            <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setFluxo(true)}>
              Ver o fluxo inteiro
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
