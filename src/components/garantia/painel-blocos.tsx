// Peças visuais do Painel da Gerência (Garantia).
//
// Regras de desenho que valem para todos os blocos daqui:
//  - um eixo y por gráfico, sempre. Prêmio e quantidade nunca dividem escala;
//  - cor segue a entidade, nunca a posição na lista;
//  - legenda sempre que houver duas ou mais séries;
//  - toda figura tem tabela equivalente (alternador gráfico/tabela), porque
//    número de gestão é copiado para apresentação;
//  - cor de texto vem dos tokens do tema, nunca literal.

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { moeda } from "@/lib/garantia/formato";

/** Cores fixas por entidade — as mesmas da Análise de Limite e do e-mail. */
export const COR_GRUPO = {
  com_limite: "#338B85",
  sem_limite: "#DC2626",
  nao_consultado: "#7C3AED",
} as const;

/** Interno × externo: oposição de duas pontas, cores estáveis. */
export const COR_RELOGIO = {
  interno: "#14405C",
  externo: "#00BAF2",
} as const;

export const COR_VALOR = "#14405C";
export const COR_QUANTIDADE = "#8AAFC9";

export const VAZIO = "Ainda não há demanda suficiente para este indicador.";

export function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{valor}</p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

export interface ColunaTabela<T> {
  chave: string;
  titulo: string;
  valor: (linha: T) => string;
  alinharDireita?: boolean;
}

/**
 * Bloco padrão: título curto do que responde, alternador gráfico/tabela e
 * estado vazio honesto (nunca gráfico de zeros passando por dado).
 */
export function Bloco<T>({
  titulo,
  descricao,
  nota,
  dados,
  colunas,
  grafico,
  altura = 280,
}: {
  titulo: string;
  descricao?: string;
  nota?: ReactNode;
  dados: T[];
  colunas: ColunaTabela<T>[];
  grafico: ReactNode;
  altura?: number;
}) {
  const [modo, setModo] = useState<"grafico" | "tabela">("grafico");
  const vazio = dados.length === 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {!vazio && (
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(["grafico", "tabela"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                aria-pressed={modo === m}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors",
                  modo === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "grafico" ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                {m === "grafico" ? "Gráfico" : "Tabela"}
              </button>
            ))}
          </div>
        )}
      </div>

      {nota && <div className="mt-2 text-xs text-muted-foreground">{nota}</div>}

      {vazio ? (
        <p className="mt-6 text-sm text-muted-foreground">{VAZIO}</p>
      ) : modo === "grafico" ? (
        <div className="mt-3" style={{ height: altura }}>
          <ResponsiveContainer>{grafico as React.ReactElement}</ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                {colunas.map((c) => (
                  <th key={c.chave} className={cn("py-2 pr-4 font-medium", c.alinharDireita ? "text-right" : "text-left")}>
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map((linha, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {colunas.map((c) => (
                    <td
                      key={c.chave}
                      className={cn("py-2 pr-4 text-foreground", c.alinharDireita && "text-right tabular-nums")}
                    >
                      {c.valor(linha)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Eixos discretos, tema-cientes: cor vem dos tokens. */
export const eixoProps = {
  tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  stroke: "hsl(var(--border))",
  tickLine: false,
} as const;

export function GradeEixos({
  chaveX,
  formatarY,
}: {
  chaveX: string;
  formatarY?: (v: number) => string;
}) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis dataKey={chaveX} {...eixoProps} interval={0} angle={-20} textAnchor="end" height={64} />
      <YAxis {...eixoProps} width={80} tickFormatter={(v: number) => (formatarY ? formatarY(v) : String(v))} />
    </>
  );
}

export const tooltipProps = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--card-foreground))",
    fontSize: 12,
  },
} as const;

/** Barras de valor em R$ — um eixo só, sempre. */
export function BarrasValor({
  dados,
  chaveX,
  series,
}: {
  dados: Record<string, unknown>[];
  chaveX: string;
  series: { chave: string; nome: string; cor: string }[];
}) {
  return (
    <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
      <GradeEixos chaveX={chaveX} formatarY={(v) => moeda(v).replace(/\s/g, " ")} />
      <Tooltip {...tooltipProps} formatter={(v: number | string) => moeda(Number(v))} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {series.map((s) => (
        <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={s.cor} radius={[4, 4, 0, 0]} />
      ))}
    </BarChart>
  );
}

/** Barras de contagem/percentual — escala própria, nunca junto de R$. */
export function BarrasNumero({
  dados,
  chaveX,
  series,
  sufixo,
  empilhado,
}: {
  dados: Record<string, unknown>[];
  chaveX: string;
  series: { chave: string; nome: string; cor: string }[];
  sufixo?: string;
  empilhado?: boolean;
}) {
  return (
    <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
      <GradeEixos chaveX={chaveX} formatarY={(v) => `${v}${sufixo ?? ""}`} />
      <Tooltip {...tooltipProps} formatter={(v: number | string) => `${v}${sufixo ?? ""}`} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {series.map((s) => (
        <Bar
          key={s.chave}
          dataKey={s.chave}
          name={s.nome}
          fill={s.cor}
          {...(empilhado ? { stackId: "total" } : {})}
          radius={empilhado ? undefined : [4, 4, 0, 0]}
        />
      ))}
    </BarChart>
  );
}
