import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight, Building2, Scale, Wrench, Users, Briefcase, HeartPulse } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const highlights = [
  { icon: Building2, label: "Financeiro" },
  { icon: Scale, label: "Jurídico" },
  { icon: Briefcase, label: "Operacional" },
  { icon: Users, label: "Middle" },
  { icon: Wrench, label: "Facilities" },
  { icon: ShieldCheck, label: "Garantia" },
  { icon: HeartPulse, label: "Benefícios" },
];

function Landing() {
  return (
    <div className="min-h-screen gradient-hero text-primary-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Lavoro <span className="opacity-70">Seguros</span>
          </span>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2 text-sm font-semibold text-primary transition-transform hover:scale-[1.02]"
        >
          Entrar no Hub <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-widest ring-1 ring-primary-foreground/15">
            Portal interno de colaboradores
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Um só hub para
            <br />
            <span className="text-primary-foreground/70">toda a Lavoro.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
            Comunicados, atalhos e ferramentas de todas as áreas — Financeiro, Jurídico, Operacional,
            Middle, Facilities, Garantia, Benefícios e demais ramos — em um único lugar,
            com acesso via SSO Microsoft 365.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary shadow-elegant transition-transform hover:scale-[1.02]"
            >
              Acessar com Microsoft 365 <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-primary-foreground/60">
              Uso restrito a colaboradores autorizados
            </span>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="flex flex-col items-center gap-2 rounded-xl bg-primary-foreground/5 p-4 text-center ring-1 ring-primary-foreground/10"
            >
              <h.icon className="h-5 w-5 opacity-80" />
              <span className="text-xs font-medium text-primary-foreground/80">{h.label}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-primary-foreground/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-primary-foreground/60">
          <span>© {new Date().getFullYear()} Lavoro Seguros — Uso interno</span>
          <span>Segurança e confiança em cada acesso</span>
        </div>
      </footer>
    </div>
  );
}
