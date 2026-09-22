import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type TourPasso = {
  alvo: string | null;
  titulo: string;
  texto: string;
  posicao: "top" | "bottom" | "left" | "right" | "center";
};

export type TourPopup = {
  id: string;
  titulo: string;
  passos: TourPasso[] | null;
  cor_fundo: string | null;
  botao_label: string | null;
};

type Caixa = { top: number; left: number; width: number; height: number };
type Lado = Exclude<TourPasso["posicao"], "center">;

const MARGEM = 16;
const ESPACO = 14;
const LARGURA_CARTAO = 360;
const ALTURA_ESTIMADA = 290;

function encontrarAlvo(chave: string | null): HTMLElement | null {
  if (!chave) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(chave)}"]`);
}

function caixaDo(elemento: HTMLElement): Caixa | null {
  const r = elemento.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  const folga = 6;
  return {
    top: Math.max(MARGEM, r.top - folga),
    left: Math.max(MARGEM, r.left - folga),
    width: Math.min(window.innerWidth - MARGEM * 2, r.width + folga * 2),
    height: Math.min(window.innerHeight - MARGEM * 2, r.height + folga * 2),
  };
}

function posicaoCartao(caixa: Caixa | null, pedida: TourPasso["posicao"]) {
  if (!caixa || pedida === "center") {
    return {
      left: Math.max(MARGEM, (window.innerWidth - Math.min(LARGURA_CARTAO, window.innerWidth - 32)) / 2),
      top: Math.max(MARGEM, (window.innerHeight - ALTURA_ESTIMADA) / 2),
    };
  }

  const largura = Math.min(LARGURA_CARTAO, window.innerWidth - 32);
  const cabe: Record<Lado, boolean> = {
    top: caixa.top >= ALTURA_ESTIMADA + ESPACO + MARGEM,
    bottom: window.innerHeight - (caixa.top + caixa.height) >= ALTURA_ESTIMADA + ESPACO + MARGEM,
    left: caixa.left >= largura + ESPACO + MARGEM,
    right: window.innerWidth - (caixa.left + caixa.width) >= largura + ESPACO + MARGEM,
  };
  const oposto: Record<Lado, Lado> = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const preferida = pedida as Lado;
  const lado = cabe[preferida] ? preferida : cabe[oposto[preferida]] ? oposto[preferida] : "bottom";

  let left = caixa.left + caixa.width / 2 - largura / 2;
  let top = caixa.top + caixa.height + ESPACO;
  if (lado === "top") top = caixa.top - ALTURA_ESTIMADA - ESPACO;
  if (lado === "left") {
    left = caixa.left - largura - ESPACO;
    top = caixa.top + caixa.height / 2 - ALTURA_ESTIMADA / 2;
  }
  if (lado === "right") {
    left = caixa.left + caixa.width + ESPACO;
    top = caixa.top + caixa.height / 2 - ALTURA_ESTIMADA / 2;
  }
  return {
    left: Math.min(Math.max(MARGEM, left), window.innerWidth - largura - MARGEM),
    top: Math.min(Math.max(MARGEM, top), window.innerHeight - ALTURA_ESTIMADA - MARGEM),
  };
}

export function TourGuiado({ popup, onFinalizar }: { popup: TourPopup; onFinalizar: () => void }) {
  const passos = useMemo(
    () =>
      (popup.passos ?? []).filter((passo) => {
        if (!passo?.titulo || !passo?.texto) return false;
        return passo.alvo === null || encontrarAlvo(passo.alvo) !== null;
      }),
    [popup.passos],
  );
  const [indice, setIndice] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const passo = passos[indice];

  const medir = useCallback(() => {
    if (!passo?.alvo) {
      setCaixa(null);
      return;
    }
    const elemento = encontrarAlvo(passo.alvo);
    setCaixa(elemento ? caixaDo(elemento) : null);
  }, [passo]);

  useEffect(() => {
    if (!passo?.alvo) {
      setCaixa(null);
      return;
    }
    const elemento = encontrarAlvo(passo.alvo);
    if (!elemento) return;
    elemento.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    medir();
    const timer = window.setTimeout(medir, 360);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [medir, passo]);

  const finalizar = useCallback(async () => {
    if (finalizando) return;
    setFinalizando(true);
    const { error } = await supabase.rpc("rpc_dispensar_popup", {
      p_popup_id: popup.id,
    } as { p_popup_id: string });
    if (error) console.warn("[tour] dispense error:", error.message);
    onFinalizar();
  }, [finalizando, onFinalizar, popup.id]);

  const avancar = useCallback(() => {
    if (indice >= passos.length - 1) {
      void finalizar();
      return;
    }
    setIndice((atual) => atual + 1);
  }, [finalizar, indice, passos.length]);

  useEffect(() => {
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "ArrowRight" || evento.key === "Enter") {
        evento.preventDefault();
        avancar();
      } else if (evento.key === "ArrowLeft") {
        evento.preventDefault();
        setIndice((atual) => Math.max(0, atual - 1));
      } else if (evento.key === "Escape") {
        evento.preventDefault();
        void finalizar();
      }
    };
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [avancar, finalizar]);

  if (!passo || passos.length === 0) return null;

  const posicao = posicaoCartao(caixa, passo.posicao);
  const centralizado = caixa === null;

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={popup.titulo}>
      {centralizado ? <div className="absolute inset-0 bg-foreground/70" /> : null}
      {caixa ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-200"
          style={{
            top: caixa.top,
            left: caixa.left,
            width: caixa.width,
            height: caixa.height,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.68)",
          }}
        />
      ) : null}

      <div
        className={cn(
          "fixed w-[calc(100vw-2rem)] max-w-[360px] rounded-lg border bg-card p-5 text-card-foreground shadow-elegant",
          centralizado && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={centralizado ? undefined : posicao}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-medium text-muted-foreground">
            Passo {indice + 1} de {passos.length}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8"
            onClick={() => void finalizar()}
            disabled={finalizando}
            aria-label="Pular tour"
            title="Pular"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="mt-2 font-display text-lg font-semibold text-foreground">{passo.titulo}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {passo.texto}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            {indice > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIndice((i) => i - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
            ) : (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => void finalizar()}
                disabled={finalizando}
              >
                Pular
              </button>
            )}
          </div>
          <Button type="button" size="sm" onClick={avancar} disabled={finalizando}>
            {indice === passos.length - 1 ? popup.botao_label || "Concluir" : "Próximo"}
            {indice < passos.length - 1 ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
          </Button>
        </div>
        <button
          type="button"
          className="mt-4 text-xs text-muted-foreground underline underline-offset-4"
          onClick={() => void finalizar()}
          disabled={finalizando}
        >
          Não mostrar novamente
        </button>
      </div>
    </div>
  );
}