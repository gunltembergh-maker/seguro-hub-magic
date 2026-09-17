// Peças compartilhadas entre a lista e o detalhe do Formulário Admin.
import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baixarAnexo, nomeArquivoPdf, nomeArquivoXlsx } from "@/lib/garantia/anexos-download";

export const STATUS = [
  { valor: "recebida", rotulo: "Recebida", classe: "bg-slate-100 text-slate-700 border-slate-200" },
  { valor: "consultando_mercado", rotulo: "Consultando mercado", classe: "bg-blue-100 text-blue-700 border-blue-200" },
  { valor: "mercado_consultado", rotulo: "Mercado consultado", classe: "bg-purple-100 text-purple-700 border-purple-200" },
  { valor: "email_enviado", rotulo: "E-mail enviado", classe: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { valor: "erro", rotulo: "Erro", classe: "bg-red-100 text-red-700 border-red-200" },
] as const;

export function formatarDataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatarDuracao(inicio: string | null | undefined, fim: string | null | undefined) {
  if (!inicio || !fim) return "";
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function EtiquetaStatus({ status }: { status: string }) {
  const def = STATUS.find((s) => s.valor === status);
  return (
    <Badge variant="outline" className={def?.classe ?? "bg-slate-100 text-slate-700 border-slate-200"}>
      {def?.rotulo ?? status}
    </Badge>
  );
}

/** Botões de download dos dois anexos. A URL assinada só é criada no clique. */
export function BotoesAnexos({
  protocolo,
  pdfPath,
  xlsxPath,
  tamanho = "icone",
}: {
  protocolo: string | null;
  pdfPath: string | null;
  xlsxPath: string | null;
  tamanho?: "icone" | "completo";
}) {
  const [baixando, setBaixando] = useState<string | null>(null);

  async function clicar(tipo: "pdf" | "xlsx", path: string, nome: string) {
    setBaixando(tipo);
    try {
      await baixarAnexo(path, nome);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível baixar o arquivo.");
    } finally {
      setBaixando(null);
    }
  }

  const itens = [
    {
      tipo: "pdf" as const,
      path: pdfPath,
      nome: nomeArquivoPdf(protocolo),
      rotulo: "Formulário (PDF)",
      Icone: FileText,
      indisponivel: "O PDF do formulário ainda não está disponível.",
    },
    {
      tipo: "xlsx" as const,
      path: xlsxPath,
      nome: nomeArquivoXlsx(protocolo),
      rotulo: "Consulta de mercado (XLSX)",
      Icone: FileSpreadsheet,
      indisponivel: "A planilha ainda não foi gerada — a demanda segue em processamento.",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {itens.map(({ tipo, path, nome, rotulo, Icone, indisponivel }) => {
        const botao = (
          <Button
            variant={tamanho === "completo" ? "outline" : "ghost"}
            size={tamanho === "completo" ? "sm" : "icon"}
            className={tamanho === "completo" ? "gap-2" : "h-8 w-8"}
            disabled={!path || baixando === tipo}
            onClick={(e) => {
              e.stopPropagation();
              if (path) void clicar(tipo, path, nome);
            }}
          >
            {baixando === tipo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icone className={`h-4 w-4 ${path ? "text-[#338B85]" : "text-muted-foreground/40"}`} />
            )}
            {tamanho === "completo" && rotulo}
          </Button>
        );
        return (
          <Tooltip key={tipo}>
            <TooltipTrigger asChild>
              <span>{botao}</span>
            </TooltipTrigger>
            <TooltipContent>{path ? `Baixar ${rotulo}` : indisponivel}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
