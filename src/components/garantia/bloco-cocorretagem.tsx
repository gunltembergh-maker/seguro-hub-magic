// Bloco "Co-corretagem": divisão da comissão entre corretoras. Exceção, não regra:
// vazio por padrão. A soma de 100% é aviso, não trava.
import { useState } from "react";
import { HelpCircle, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useCocorretagem,
  useIncluirCocorretagem,
  useMarcarLiderCocorretagem,
  useRemoverCocorretagem,
} from "@/hooks/use-garantia-cocorretagem";
import { mensagemDeErro } from "@/lib/erro";

const pct = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function mascaraCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function BlocoCocorretagem({ demandaId }: { demandaId: string }) {
  const { data: linhas = [] } = useCocorretagem(demandaId);
  const incluir = useIncluirCocorretagem();
  const marcar = useMarcarLiderCocorretagem();
  const remover = useRemoverCocorretagem();
  const [aberto, setAberto] = useState(false);
  const [corretora, setCorretora] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [percentual, setPercentual] = useState("");
  const [lider, setLider] = useState(false);
  const [ehLavoro, setEhLavoro] = useState(false);

  const soma = linhas.reduce((s, l) => s + l.percentual_comissao, 0);
  const valorPct = Number(percentual.replace(/\./g, "").replace(",", "."));
  const temLider = linhas.some((l) => l.lider);
  const podeSalvar = corretora.trim() && valorPct > 0 && valorPct <= 100;

  const salvar = async () => {
    if (lider && temLider) {
      toast.error("Já existe uma corretora líder. Só pode haver uma.");
      return;
    }
    try {
      await incluir.mutateAsync({
        demanda_id: demandaId,
        corretora: corretora.trim(),
        cnpj: cnpj.replace(/\D/g, "") || null,
        percentual_comissao: Math.round(valorPct * 100) / 100,
        lider,
        eh_lavoro: ehLavoro,
      });
      setCorretora(""); setCnpj(""); setPercentual(""); setLider(false); setEhLavoro(false);
      setAberto(false);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar a co-corretora."));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4" data-tour="gar-cocorretagem">
      <div className="flex items-center gap-2">
        <p className="font-semibold">Co-corretagem</p>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Ajuda: co-corretagem" className="text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-sm text-muted-foreground">
            Cosseguro divide o risco entre seguradoras; co-corretagem divide a comissão entre corretoras no mesmo negócio.
          </PopoverContent>
        </Popover>
      </div>

      {linhas.length > 0 && (
        <ul className="space-y-2">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{l.corretora}</span>
                {l.eh_lavoro && <span className="ml-2 rounded bg-muted px-1.5 text-xs">Lavoro</span>}
                {l.lider && <span className="ml-2 rounded bg-muted px-1.5 text-xs">Líder</span>}
                {l.cnpj && <span className="ml-2 text-xs text-muted-foreground">{mascaraCnpj(l.cnpj)}</span>}
              </div>
              <div className="flex items-center gap-1">
                <span className="tabular-nums">{pct(l.percentual_comissao)}%</span>
                {!l.lider && (
                  <Button size="icon" variant="ghost" title="Marcar como líder" disabled={marcar.isPending}
                    onClick={() => marcar.mutate({ id: l.id, demandaId }, { onError: (e) => toast.error(mensagemDeErro(e)) })}>
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" title="Remover" disabled={remover.isPending}
                  onClick={() => remover.mutate({ id: l.id, demandaId }, { onError: (e) => toast.error(mensagemDeErro(e)) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {linhas.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Soma: {pct(soma)}%{Math.abs(soma - 100) > 0.001 && (soma < 100 ? ` — falta ${pct(100 - soma)}%` : ` — passou ${pct(soma - 100)}%`)}
        </p>
      )}

      {aberto ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Corretora *</Label><Input value={corretora} onChange={(e) => setCorretora(e.target.value)} /></div>
          <div className="space-y-1"><Label>CNPJ</Label><Input value={mascaraCnpj(cnpj)} onChange={(e) => setCnpj(e.target.value)} /></div>
          <div className="space-y-1"><Label>% de comissão *</Label><Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} /></div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={lider} onCheckedChange={(v) => setLider(v === true)} /> Líder</label>
            <label className="flex items-center gap-2"><Checkbox checked={ehLavoro} onCheckedChange={(v) => setEhLavoro(v === true)} /> É a Lavoro</label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="outline" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button size="sm" disabled={!podeSalvar || incluir.isPending} onClick={() => void salvar()}>Salvar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar co-corretora
        </Button>
      )}
    </div>
  );
}
