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

const NAVY = "#14405C";

export function AreaPage({ icon: Icon, title, subtitle, description, sections = [] }: AreaPageProps) {
  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-10" style={{ background: NAVY }}>
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start gap-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-xl text-white shadow-lg"
            style={{ background: "#00BAF2" }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <Badge
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/15"
            >
              Área
            </Badge>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-white/70">{subtitle}</p>
          </div>
        </div>

        <Card className="mt-8 border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-lg" style={{ color: NAVY }}>
              Sobre esta área
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-gray-600">{description}</p>
          </CardContent>
        </Card>

        {sections.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => (
              <Card
                key={s.title}
                className="border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <CardTitle className="font-display text-base" style={{ color: NAVY }}>
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{s.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-dashed border-white/25 bg-white/5 p-6 text-center text-sm text-white/70">
          Esta área está pronta para receber conteúdo, integrações e ferramentas específicas do time.
        </div>
      </div>
    </div>
  );
}
