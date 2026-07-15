import { useState, useEffect, useCallback, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoBranca from "@/assets/logo-branca.png.asset.json";

const DEFAULT_LOGO_URL = logoBranca.url;

interface PopupData {
  id: string;
  titulo: string;
  mensagem: string;
  cor_fundo: string | null;
  cor_texto: string | null;
  botao_label: string | null;
  logo_url: string | null;
  mostrar_nome_hub: boolean | null;
}

/** Card reutilizável — usado tanto no live preview do admin quanto no popup real */
export function PopupCard({
  titulo,
  mensagem,
  logo_url,
  mostrar_nome_hub,
  botao_label,
  onDismissPermanent,
  onDismissTemporary,
}: {
  titulo: string;
  mensagem: string;
  logo_url?: string | null;
  mostrar_nome_hub?: boolean;
  botao_label?: string | null;
  onDismissPermanent?: () => void;
  onDismissTemporary?: () => void;
}) {
  const logoSrc = logo_url === "" ? null : logo_url ?? DEFAULT_LOGO_URL;
  const showName = mostrar_nome_hub ?? true;

  return (
    <div className="w-full max-w-[480px] rounded-xl overflow-hidden shadow-2xl bg-white">
      <div
        className="p-6 flex flex-col items-center gap-2"
        style={{ backgroundColor: "#14405C" }}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt="Hub Lavoro"
            className="max-h-[42px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        {showName && (
          <span className="text-white text-[11px] tracking-[2px] font-medium uppercase">
            Hub Lavoro Seguros
          </span>
        )}
      </div>

      <div className="bg-white px-6 py-5 text-center">
        <h2 className="font-display font-bold text-lg leading-tight text-[#14405C]">
          {titulo || "Título do comunicado"}
        </h2>
        <p className="text-slate-500 text-sm mt-3 whitespace-pre-line leading-relaxed">
          {mensagem || "Mensagem do comunicado..."}
        </p>
      </div>

      <div className="border-t border-slate-200" />
      <div className="flex items-center justify-between px-6 py-4 bg-white">
        <button
          type="button"
          onClick={onDismissPermanent}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline"
        >
          Não mostrar novamente
        </button>
        <Button
          type="button"
          onClick={onDismissTemporary}
          size="sm"
          className="text-sm font-medium text-white hover:opacity-90"
          style={{ backgroundColor: "#14405C" }}
        >
          {botao_label || "Entendido!"}
        </Button>
      </div>
    </div>
  );
}

export function PopupComunicado() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const dismissedThisSession = useRef<Set<string>>(new Set());

  const fetchPopups = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("rpc_get_popups_ativos", {
        p_pagina: pathname,
      } as { p_pagina?: string });
      if (error) {
        console.warn("[popup] fetch error:", error.message);
        return;
      }
      const filtered = ((data as unknown as PopupData[]) || []).filter(
        (p) => !dismissedThisSession.current.has(p.id),
      );
      if (filtered.length > 0) {
        setPopups(filtered);
        setCurrentIndex(0);
        setVisible(true);
        requestAnimationFrame(() => setAnimating(true));
      } else {
        setVisible(false);
        setPopups([]);
      }
    } catch (err) {
      console.warn("[popup] err:", err);
    }
  }, [pathname]);

  useEffect(() => {
    void fetchPopups();
  }, [fetchPopups]);

  const closeOne = () => {
    setAnimating(false);
    setTimeout(() => {
      if (currentIndex < popups.length - 1) {
        setCurrentIndex((i) => i + 1);
        requestAnimationFrame(() => setAnimating(true));
      } else {
        setVisible(false);
        setPopups([]);
      }
    }, 220);
  };

  const handleDismissPermanent = async () => {
    const popup = popups[currentIndex];
    if (!popup) return;
    try {
      await supabase.rpc("rpc_dispensar_popup", { p_popup_id: popup.id } as {
        p_popup_id: string;
      });
    } catch {}
    dismissedThisSession.current.add(popup.id);
    closeOne();
  };

  const handleDismissTemporary = () => {
    const popup = popups[currentIndex];
    if (popup) dismissedThisSession.current.add(popup.id);
    closeOne();
  };

  if (!visible || popups.length === 0) return null;
  const popup = popups[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: animating ? 1 : 0 }}
        onClick={handleDismissTemporary}
      />
      <div
        className="relative transition-all duration-300"
        style={{
          opacity: animating ? 1 : 0,
          transform: animating ? "translateY(0)" : "translateY(20px)",
        }}
      >
        <PopupCard
          titulo={popup.titulo}
          mensagem={popup.mensagem}
          logo_url={popup.logo_url}
          mostrar_nome_hub={popup.mostrar_nome_hub ?? true}
          botao_label={popup.botao_label}
          onDismissPermanent={handleDismissPermanent}
          onDismissTemporary={handleDismissTemporary}
        />
      </div>
    </div>
  );
}
