import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AreaPageProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  sections?: { title: string; description: string }[];
}

export function AreaPage({ icon: Icon, title, subtitle, description, sections = [] }: AreaPageProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:py-10">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-xl gradient-accent text-primary-foreground shadow-elegant">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            Área
          </Badge>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <Card className="mt-8 shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Sobre esta área</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </CardContent>
      </Card>

      {sections.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Card key={s.title} className="shadow-card transition-shadow hover:shadow-elegant">
              <CardHeader>
                <CardTitle className="font-display text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Esta área está pronta para receber conteúdo, integrações e ferramentas específicas do time.
      </div>
    </div>
  );
}
