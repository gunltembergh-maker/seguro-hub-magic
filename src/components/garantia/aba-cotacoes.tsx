// Aba "Cotações" do detalhe da demanda (etapa 4).
//
// `comissao_valor` é coluna gerada no banco: aparece, nunca é editada aqui.
// Marcar a cotação escolhida copia prêmio e comissão para a demanda — é o que
// alimenta o "em jogo" e o "deixado na mesa".

import { useState } from "react";
import { Check, Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  nomeSeguradoraCotacao,
  useCotacoes,
  useEscolherCotacao,
  useSalvarCotacao,
  useSeguradorasGarantia,
  type CotacaoDemanda,
} from "@/hooks/use-garantia-crm";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import { dataCurta, moeda } from "@/lib/garantia/formato";

const LIVRE = "__livre__";

const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

export function AbaCotacoes({ demanda }: { demanda: DemandaLista }) {
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const { data: cotacoes = [], isLoading } = useCotacoes(demanda.id);
  const salvar = useSalvarCotacao(demanda.id);
  const escolher = useEscolherCotacao(demanda.id);

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<CotacaoDemanda | null>(null);
  const [chave, setChave] = useState("");
  const [livre, setLivre] = useState("");
  const [taxa, setTaxa] = useState("");
  const [premio, setPremio] = useState("");
  const [comissao, setComissao] = useState("");
  const [cosseguro, setCosseguro] = useState(false);
  const [recebida, setRecebida] = useState("");
  const [obs, setObs] = useState("");

  const limpar = () => {
    setEditando(null);
    setChave("");
    setLivre("");
    setTaxa("");
    setPremio("");
    setComissao("");
    setCosseguro(false);
    setRecebida("");
    setObs("");
  };

  const abrirEdicao = (c: CotacaoDemanda) => {
    setEditando(c);
    setChave(c.chave_mercado ?? LIVRE);
    setLivre(c.seguradora_livre ?? "");
    setTaxa(c.taxa?.toString() ?? "");
    setPremio(c.premio?.toString() ?? "");
    setComissao(c.comissao_pct?.toString() ?? "");
    setCosseguro(c.cosseguro);
    setRecebida(c.recebida_em?.slice(0, 10) ?? "");
    setObs(c.observacao ?? "");
    setAberto(true);
  };

  const gravar = async () => {
    const usaLivre = chave === LIVRE || !chave;
    if (usaLivre && !livre.trim()) {
      toast.error("Informe a seguradora: escolha no catálogo ou digite o nome.");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: editando?.id,
        valores: {
          chave_mercado: usaLivre ? null : chave,
          seguradora_livre: usaLivre ? livre.trim() : null,
          taxa: num(taxa),
          premio: num(premio),
          comissao_pct: num(comissao),
          cosseguro,
          recebida_em: recebida ? `${recebida}T12:00:00` : null,
          observacao: obs.trim() || null,
        },
      });
      toast.success(editando ? "Cotação atualizada." : "Cotação registrada.");
      limpar();
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gravar a cotação.");
    }
  };

  const marcar = async (c: CotacaoDemanda) => {
    try {
      await escolher.mutateAsync(c);
      toast.success("Cotação escolhida. Prêmio e comissão foram copiados para a demanda.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar a cotação.");
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Pelo menos uma cotação é necessária para sair da etapa 4. Mais de uma é recomendado, não
          obrigatório.
        </p>
        <Button
          size="sm"
          onClick={() => {
            limpar();
            setAberto(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova cotação
        </Button>
      </div>

      {aberto && (
        <div className="space-y-3 rounded-md border p-3">
          <h4 className="font-semibold text-[#14405C]">
            {editando ? "Editar cotação" : "Nova cotação"}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Seguradora</Label>
              <Select value={chave} onValueChange={setChave}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a seguradora" />
                </SelectTrigger>
                <SelectContent>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.chave_mercado} value={s.chave_mercado}>
                      {s.rotulo}
                    </SelectItem>
                  ))}
                  <SelectItem value={LIVRE}>Outra (fora do catálogo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(chave === LIVRE || !chave) && (
              <div className="space-y-1">
                <Label>Nome da seguradora</Label>
                <Input value={livre} onChange={(e) => setLivre(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Taxa</Label>
              <Input value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Prêmio</Label>
              <Input value={premio} onChange={(e) => setPremio(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Comissão (%)</Label>
              <Input
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1">
              <Label>Recebida em</Label>
              <Input type="date" value={recebida} onChange={(e) => setRecebida(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={cosseguro} onCheckedChange={(v) => setCosseguro(v === true)} />
            Cosseguro
          </label>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button onClick={gravar} disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Gravar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                limpar();
                setAberto(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando as cotações…</p>
      ) : !cotacoes.length ? (
        <p className="rounded-md border border-dashed p-4 text-muted-foreground">
          Nenhuma cotação registrada ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {cotacoes.map((c) => (
            <div
              key={c.id}
              className={`rounded-md border p-3 ${c.escolhida ? "border-[#338B85] bg-[#338B85]/5" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#14405C]">
                  {nomeSeguradoraCotacao(c, seguradoras)}
                </span>
                <div className="flex items-center gap-2">
                  {c.cosseguro && <Badge variant="secondary">cosseguro</Badge>}
                  {c.escolhida ? (
                    <Badge className="gap-1 bg-[#338B85] hover:bg-[#338B85]">
                      <Check className="h-3 w-3" /> escolhida
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={escolher.isPending}
                      onClick={() => marcar(c)}
                    >
                      <Star className="mr-2 h-4 w-4" />
                      Marcar como escolhida
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => abrirEdicao(c)}>
                    Editar
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-muted-foreground">
                Taxa: {c.taxa ?? "—"} · Prêmio: {moeda(c.premio)} · Comissão: {c.comissao_pct ?? "—"}%
                ({moeda(c.comissao_valor)}) · Recebida em {dataCurta(c.recebida_em)}
              </p>
              {c.observacao && <p className="text-xs text-muted-foreground">{c.observacao}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
