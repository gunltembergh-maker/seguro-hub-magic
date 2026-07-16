import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSplash } from "@/components/loading-splash";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let done = false;
    const go = (to: "/inicio" | "/auth") => {
      if (done) return;
      done = true;
      navigate({ to, replace: true });
    };

    // Aguarda hidratação do session pelo Supabase (PKCE ?code=... ou hash #access_token=...)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        go(session ? "/inicio" : "/auth");
      }
    });

    // Fallback caso o evento não dispare rapidamente
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go("/inicio");
    });

    const timeout = setTimeout(() => go("/auth"), 2500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);
  return <LoadingSplash />;
}
