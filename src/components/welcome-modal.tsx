import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import logoBranca from "@/assets/logo-branca.png.asset.json";

const STORAGE_PREFIX = "hub-lavoro-welcome-dismissed:";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dontShow, setDontShow] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const uid = data.user.id;
      const meta = data.user.user_metadata as { full_name?: string; name?: string } | undefined;
      const nome = (meta?.full_name || meta?.name || data.user.email || "").split(" ")[0];
      setUserId(uid);
      setFirstName(nome);
      const dismissed = typeof window !== "undefined" && localStorage.getItem(STORAGE_PREFIX + uid);
      if (!dismissed) {
        setOpen(true);
        requestAnimationFrame(() => setAnimating(true));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    if (userId && dontShow) {
      localStorage.setItem(STORAGE_PREFIX + userId, new Date().toISOString());
    }
    setAnimating(false);
    setTimeout(() => setOpen(false), 220);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: animating ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300"
        style={{
          opacity: animating ? 1 : 0,
          transform: animating ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
        }}
      >
        {/* Header navy com logo */}
        <div
          className="relative px-8 pt-10 pb-16 text-center"
          style={{
            background:
              "linear-gradient(135deg, #14405C 0%, #1B5680 55%, #2E7BB0 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
            style={{ background: "#00BAF2" }}
          />
          <div
            className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full opacity-10 blur-2xl"
            style={{ background: "#8AAFC9" }}
          />
          <img
            src={logoBranca.url}
            alt="Hub Lavoro"
            className="mx-auto max-h-[52px] object-contain"
          />
          <div className="mt-2 text-[11px] uppercase tracking-[3px] text-white/70">
            Hub Lavoro Seguros
          </div>
        </div>

        {/* Card branco elevado */}
        <div className="relative -mt-10 mx-6 rounded-xl bg-white px-6 py-6 shadow-lg ring-1 ring-slate-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#00BAF2" }}>
            <Sparkles className="h-3.5 w-3.5" />
            Seja bem-vindo(a)
          </div>
          <h2
            className="mt-2 font-display text-2xl font-bold leading-tight"
            style={{ color: "#14405C" }}
          >
            Olá{firstName ? `, ${firstName}` : ""}. Que bom ter você aqui.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Este é o <strong style={{ color: "#14405C" }}>seu espaço</strong> na
            Lavoro Seguros — o lugar onde estratégia, números e pessoas se
            encontram. Aqui você acompanha a receita em tempo real, gerencia
            áreas, acessa relatórios e mantém tudo o que importa a um clique.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Explore, questione, decida. O Hub foi feito para caminhar com você
            — e evoluir junto.
          </p>
          <div
            className="mt-4 flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm"
            style={{ background: "rgba(0,186,242,0.08)", color: "#14405C" }}
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#00BAF2" }} />
            <span>
              <strong>A cada mês, uma novidade será lançada.</strong> Fique por
              dentro — o Hub está sempre evoluindo com você.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 hover:text-slate-700">
            <Checkbox
              checked={dontShow}
              onCheckedChange={(v) => setDontShow(v === true)}
            />
            Não mostrar novamente
          </label>
          <Button
            onClick={handleClose}
            className="gap-1.5 text-white hover:opacity-90"
            style={{ backgroundColor: "#14405C" }}
          >
            Vamos começar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
