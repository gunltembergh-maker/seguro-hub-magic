import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Pin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/comunicados")({
  component: ComunicadosPage,
});

const items = [
  {
    pinned: true,
    tag: "Importante",
    tagTone: "bg-warning/15 text-warning-foreground border-warning/30",
    date: "Hoje",
    title: "Nova política de compliance entra em vigor",
    excerpt: "A partir desta semana, todos os processos comerciais passam pelo novo fluxo de aprovação. Confira o guia rápido publicado pelo Jurídico.",
  },
  {
    tag: "Financeiro",
    tagTone: "bg-primary/10 text-primary border-primary/20",
    date: "Ontem",
    title: "Fechamento contábil de novembro",
    excerpt: "Lançamentos devem ser encerrados até sexta-feira, 18h. Solicitações fora do prazo passam para o próximo ciclo.",
  },
  {
    tag: "Facilities",
    tagTone: "bg-accent text-accent-foreground border-border",
    date: "2 dias",
    title: "Manutenção do ar-condicionado — 3º andar",
    excerpt: "Serviço agendado para o sábado. Não há impacto no expediente da semana.",
  },
  {
    tag: "RH",
    tagTone: "bg-success/15 text-success-foreground border-success/30",
    date: "3 dias",
    title: "Programa de treinamentos — 1º trimestre",
    excerpt: "Inscrições abertas para as trilhas de Garantia, Benefícios e Compliance. Vagas limitadas.",
  },
  {
    tag: "Operacional",
    tagTone: "bg-primary/10 text-primary border-primary/20",
    date: "1 semana",
    title: "Novo SLA de emissão para produtos de Garantia",
    excerpt: "Prazo passa a ser de 48h úteis. Casos com pendência serão sinalizados automaticamente no sistema.",
  },
];

function ComunicadosPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 md:py-10">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl gradient-accent text-primary-foreground shadow-elegant">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Comunicados</h1>
          <p className="text-sm text-muted-foreground">Avisos internos, políticas e atualizações da Lavoro Seguros.</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {items.map((a) => (
          <Card key={a.title} className="shadow-card transition-shadow hover:shadow-elegant">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-warning" />}
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
    </div>
  );
}
