import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registra cada página visitada pelo usuário e mantém um "ping" periódico
 * para medir quanto tempo ele permaneceu naquela tela.
 */
export function usePageTracking(enabled: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    idRef.current = null;

    const start = async () => {
      const { data } = await supabase.rpc("rpc_registrar_pageview" as never, {
        _rota: pathname,
        _titulo: typeof document !== "undefined" ? document.title : null,
        _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      } as never);
      if (!cancelled && typeof data === "string") idRef.current = data;
    };
    void start();

    const ping = () => {
      if (!idRef.current) return;
      void supabase.rpc("rpc_pageview_ping" as never, { _id: idRef.current } as never);
    };

    const interval = setInterval(ping, 30_000);
    const onHidden = () => {
      if (document.visibilityState === "hidden") ping();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHidden);
      ping();
    };
  }, [pathname, enabled]);
}
