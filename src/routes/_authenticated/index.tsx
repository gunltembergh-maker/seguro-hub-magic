import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Landmark, Scale, Cog, Layers, Wrench, ShieldCheck, HeartPulse, Boxes,
  Megaphone, PinIcon, ArrowRight, Calendar,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/")({
  component: HubRedirect,
});

function HubRedirect() {
  // /_authenticated/ is unreachable from URLs (we use /hub). Kept as safety.
  return <HubHome />;
}

const shortcuts = [
  { label: "Financeiro", href: "/financeiro", icon: Landmark, tone: "from-[oklch(0.24_0.09_265)] to-[oklch(0.4_0.1_258)]" },
  { label: "Jurídico", href: "/juridico", icon: Scale, tone: "from-[oklch(0.28_0.08_262)] to-[oklch(0.45_0.1_252)]" },
  { label: "Operacional", href: "/operacional", icon: Cog, tone: "from-[oklch(0.3_0.09_260)] to-[oklch(0.5_0.11_250)]" },
  { label: "Middle", href: "/middle", icon: Layers, tone: "from-[oklch(0.32_0.09_258)] to-[oklch(0.55_0.11_248)]" },
  { label: "Facilities", href: "/facilities", icon: Wrench, tone: "from-[oklch(0.28_0.07_260)] to-[oklch(0.48_0.1_250)]" },
  { label: "Garantia", href: "/garantia", icon: ShieldCheck, tone: "from-[oklch(0.24_0.09_265)] to-[oklch(0.4_0.1_258)]" },
  { label: "Benefícios", href: "/beneficios", icon: HeartPulse, tone: "from-[oklch(0.3_0.09_260)] to-[oklch(0.5_0.11_250)]" },
  { label: "Demais Ramos", href: "/demais-ramos", icon: Boxes, tone: "from-[oklch(0.28_0.08_262)] to-[oklch(0.45_0.1_252)]" },
] as const;

const announcements = [
  {
    pinned: true,
    tag: "Importante",
    tagTone: "bg-warning/15 text-warning-foreground border-warning/30",
    date: "Hoje",
    title: "Nova política de compliance entra em vigor",
    excerpt: "A partir desta semana, todos os processos comerciais passam pelo novo fluxo de aprovação. Confira o guia rápido no Jurídico.",
  },
  {
    tag: "Financeiro",
    tagTone: "bg-primary/10 text-primary border-primary/20",
    date: "Ontem",
    title: "Fechamento contábil de novembro",
    excerpt: "Lançamentos devem ser encerrados até sexta-feira. Solicitações fora do prazo passam para o próximo ciclo.",
  },
  {
    tag: "Facilities",
    tagTone: "bg-accent text-accent-foreground border-border",
    date: "2 dias",
    title: "Manutenção do ar-condicionado — 3º andar",
    excerpt: "Serviço agendado para o sábado. Não há impacto no expediente da semana.",
  },
];

function HubHome() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl gradient-hero p-8 text-primary-foreground shadow-elegant md:p-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-widest ring-1 ring-primary-foreground/15">
            Hub Lavoro Seguros
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">
            Bem-vindo de volta.
          </h1>
          <p className="mt-3 text-primary-foreground/80 md:text-lg">
            Comunicados internos, atalhos por área e ferramentas do dia a dia — tudo em um só lugar.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-primary-glow/30 blur-2xl" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Mural / Comunicados */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Megaphone className="h-5 w-5 text-primary" /> Mural de comunicados
            </h2>
            <Link to="/comunicados" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {announcements.map((a) => (
              <Card key={a.title} className="shadow-card transition-shadow hover:shadow-elegant">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {a.pinned && <PinIcon className="h-3.5 w-3.5 text-warning" />}
                      <Badge variant="outline" className={a.tagTone}>{a.tag}</Badge>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {a.date}
                    </span>
                  </div>
                  <CardTitle className="mt-2 font-display text-base md:text-lg">{a.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{a.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Sidebar quick info */}
        <aside className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Agenda da semana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">Reunião geral</div>
                  <div className="text-xs text-muted-foreground">Terça, 10h — Auditório</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-success" />
                <div>
                  <div className="font-medium">Treinamento — Garantia</div>
                  <div className="text-xs text-muted-foreground">Quarta, 14h — Online</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-warning" />
                <div>
                  <div className="font-medium">Fechamento financeiro</div>
                  <div className="text-xs text-muted-foreground">Sexta, até 18h</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Suporte interno</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Problemas com acesso, sistemas ou infraestrutura? Fale com o time de TI.
              <a href="mailto:ti@lavoroseguros.com.br" className="mt-3 inline-flex font-medium text-primary hover:underline">
                ti@lavoroseguros.com.br
              </a>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Atalhos */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">Atalhos por área</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acesse rapidamente cada frente da Lavoro Seguros.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              to={s.href}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${s.tone} text-primary-foreground shadow-elegant`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="font-display font-semibold">{s.label}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                Abrir área <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
