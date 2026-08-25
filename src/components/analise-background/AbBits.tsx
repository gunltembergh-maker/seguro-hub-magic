// Peças pequenas e reutilizáveis do módulo Análise Background.
// Usam apenas tokens semânticos do tema (primary, muted, destructive…),
// para herdar a identidade visual do Hub sem cor fixa.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { brl, num, prazoLabel, tomDoPrazo } from "@/lib/ab-format";
import { CATALOGO_GATILHOS, type Severidade } from "@/lib/ab-types";

// ---------------------------------------------------------------------
export function AbKpi({
  valor, rotulo, apoio, destaque,
}: { valor: string; rotulo: string; apoio?: string; destaque?: boolean }) {
  return (
    <Card className={cn(destaque && "border-primary/40")}>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{valor}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
          {rotulo}
        </div>
        {apoio && <div className="text-xs text-muted-foreground/80 mt-1.5">{apoio}</div>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
const GATILHO_MAP = new Map(CATALOGO_GATILHOS.map((g) => [g.codigo, g]));

export function GatilhoBadge({ codigo }: { codigo: string }) {
  const g = GATILHO_MAP.get(codigo);
  return (
    <Badge
      variant="outline"
      className="font-mono text-[10px] px-1.5 py-0"
      title={g ? `${g.nome} — fonte: ${g.fonte}` : codigo}
    >
      {codigo}
    </Badge>
  );
}

export function PrazoBadge({ dias }: { dias: number | null | undefined }) {
  const tom = tomDoPrazo(dias);
  return (
    <Badge
      variant={tom === "critico" ? "destructive" : "secondary"}
      className={cn(
        "text-[10px] px-1.5 py-0",
        tom === "alerta" && "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20",
      )}
    >
      {prazoLabel(dias)}
    </Badge>
  );
}

export function VereditoBadge({ veredito }: { veredito: string | null }) {
  if (!veredito) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, { variant: "default" | "destructive" | "secondary"; extra?: string }> = {
    APROVADO: { variant: "default" },
    ATENCAO: { variant: "secondary", extra: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    REPROVADO: { variant: "destructive" },
    SEM_DADOS: { variant: "secondary" },
  };
  const cfg = map[veredito] ?? { variant: "secondary" as const };
  const label = veredito === "ATENCAO" ? "ATENÇÃO" : veredito.replace("_", " ");
  return <Badge variant={cfg.variant} className={cn("text-[10px]", cfg.extra)}>{label}</Badge>;
}

export function SeveridadeBadge({ severidade }: { severidade: Severidade }) {
  const map: Record<Severidade, { variant: "destructive" | "secondary" | "outline"; extra?: string }> = {
    ALTA: { variant: "destructive" },
    MEDIA: { variant: "secondary", extra: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    BAIXA: { variant: "secondary" },
    INFO: { variant: "outline" },
  };
  const cfg = map[severidade];
  return (
    <Badge variant={cfg.variant} className={cn("text-[10px]", cfg.extra)}>
      {severidade === "MEDIA" ? "MÉDIA" : severidade}
    </Badge>
  );
}

const RESTRITIVO_GRAVE = new Set(["CEIS", "CNEP", "RJ"]);

export function RestritivoBadge({ tipo }: { tipo: string }) {
  const grave = RESTRITIVO_GRAVE.has(tipo);
  return (
    <Badge
      variant={grave ? "destructive" : "secondary"}
      className={cn(
        "text-[10px]",
        !grave && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      )}
    >
      {tipo}
    </Badge>
  );
}

export function SinalChip({ nome }: { nome: string }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
      {nome}
    </code>
  );
}

export function BarraProbabilidade({ valor }: { valor: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[76px]">
      <Progress value={valor * 100} className="h-1.5" />
      <span className="text-xs tabular-nums text-muted-foreground">
        {num(valor * 100, 0)}%
      </span>
    </div>
  );
}

export function Dinheiro({ valor, forte }: { valor: number | null; forte?: boolean }) {
  return (
    <span className={cn("tabular-nums font-mono text-[13px]", forte && "font-semibold")}>
      {brl(valor)}
    </span>
  );
}

// ---------------------------------------------------------------------
export function AvisoDemo({ onLimpar }: { onLimpar?: () => void }) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-3.5 text-[13px] flex items-start gap-3">
        <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
          Base de demonstração
        </span>
        <span className="text-muted-foreground">
          As empresas com prefixo DEMO são fictícias, criadas por{" "}
          <code className="text-[11px]">select ab_seed_demo()</code> para validar o motor
          antes de qualquer contrato de dados. Os textos de movimentação imitam o jargão do
          Judiciário. Remova com <code className="text-[11px]">select ab_limpar_demo()</code>.
        </span>
        {onLimpar && (
          <button onClick={onLimpar} className="text-xs underline shrink-0 text-muted-foreground">
            limpar
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export function EstadoVazio({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="text-sm font-medium">{titulo}</p>
      {detalhe && <p className="text-xs text-muted-foreground mt-1.5 max-w-lg mx-auto">{detalhe}</p>}
    </div>
  );
}


/**
 * Marca um número como estimativa, dizendo de onde ele saiu.
 *
 * Existe porque prêmio e comissão nesta tela são ARITMÉTICA sobre parâmetros
 * calibráveis, não cotação. Servem para ranquear a fila e dimensionar
 * esforço; não servem para falar com o cliente. Um número sem essa marca
 * vira promessa na boca de quem vende.
 */
export function Estimado({ nota }: { nota?: string }) {
  return (
    <span
      title={nota ?? "Valor estimado a partir dos parâmetros em Administração › Fontes. Não é cotação."}
      className="ml-1 cursor-help text-[10px] uppercase tracking-wide text-muted-foreground/80 align-super"
    >
      est.
    </span>
  );
}

/**
 * O que falta confirmar para o gatilho virar venda.
 *
 * É o bloco mais importante da tela para o time de Garantia: um gatilho é
 * uma HIPÓTESE com evidência. No T9, por exemplo, o PNCP prova que o
 * contrato existe — não que a garantia foi exigida, porque o art. 96 da Lei
 * 14.133/2021 diz que ela é facultativa ("a critério da Administração").
 * Tratar hipótese como fato faz o time ligar cobrando garantia que o órgão
 * não pediu, e isso queima a relação.
 */
export function AConfirmar({ itens }: { itens?: string[] | null }) {
  if (!itens?.length) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Confirmar antes de abordar
      </p>
      <ul className="space-y-1">
        {itens.map((t) => (
          <li key={t} className="flex gap-2 text-[13px]">
            <span className="text-amber-700 dark:text-amber-400 shrink-0">□</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Traduz a confiança do gatilho em linguagem de qualificação. */
export function QualidadeLead({ confianca }: { confianca: number }) {
  const c = Number(confianca);
  const [rotulo, tom, nota] = c >= 0.9
    ? ["Confirmado", "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
       "A fonte comprova o fato que gera a necessidade de garantia."]
    : c >= 0.75
      ? ["Provável", "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
         "A evidência é forte, mas há um passo a confirmar."]
      : ["A qualificar", "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
         "A fonte prova o fato, não que a garantia seja exigida. Confirme antes de abordar."];
  return (
    <Badge variant="outline" className={`text-[10px] font-normal ${tom}`} title={nota}>
      {rotulo} · {Math.round(c * 100)}%
    </Badge>
  );
}
