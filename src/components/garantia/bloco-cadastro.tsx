// Etapa de Cadastro (3b): as três saídas quando o cadastro é exigido.
//   A) um documento entre DRE, balanço e alteração contratual (aba Documentos, abaixo);
//   B) cosseguro cuja soma de IS alcança a IS da demanda;
//   C) dispensa com motivo escrito — fica registrada e não se apaga.

import { useState } from "react";
import { Crown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { CampoReal } from "@/components/garantia/campo-real";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import {
  useCosseguro,
  useDispensarCadastro,
  useIncluirCosseguro,
  useMarcarLider,
  useRemoverCosseguro,
} from "@/hooks/use-garantia-cosseguro";
import { useResponsaveis } from "@/hooks/use-entrada-demandas";
import { useSeguradorasConfig } from "@/hooks/use-garantia-limites";
import { hasRole } from "@/hooks/use-meu-perfil";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import { mensagemDeErro } from "@/lib/erro";
import { dataHora, moeda } from "@/lib/garantia/formato";

const OUTRA = "__outra__";

function SaidaCosseguro({ demanda }: { demanda: DemandaLista }) {
  const { data: linhas = [] } = useCosseguro(demanda.id);
  const { data: config = [] } = useSeguradorasConfig();
  const incluir = useIncluirCosseguro();
  const marcarLider = useMarcarLider();
  const remover = useRemoverCosseguro();
  const perfil = useMeuPerfilEfetivo();
  const ehAdmin = hasRole(perfil, "ADMIN");

  const [chave, setChave] = useState<string>("");
  const [livre, setLivre] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [lider, setLider] = useState(false);

  const is = demanda.importancia_segurada != null ? Number(demanda.importancia_segurada) : null;
  const total = linhas.reduce((s, l) => s + Number(l.importancia_segurada), 0);
  const falta = is != null ? Math.max(0, is - total) : null;
  const cobre = is != null && is > 0 && total >= is;
  const jaUsadas = new Set(linhas.map((l) => l.chave_mercado).filter(Boolean));
  const rotulo = (k: string | null) => config.find((c) => c.chave_mercado === k)?.rotulo ?? k ?? "";

  const salvar = async () => {
    const eOutra = chave === OUTRA;
    if (!chave || (eOutra && !livre.trim())) return toast.error("Escolha a seguradora.");
    if (!valor || valor <= 0) return toast.error("Informe quanto de IS a seguradora assume.");
    try {
      await incluir.mutateAsync({
        demanda_id: demanda.id,
        chave_mercado: eOutra ? null : chave,
        seguradora_livre: eOutra ? livre.trim() : null,
        importancia_segurada: valor,
        lider: lider || linhas.length === 0,
        observacao: null,
      });
      setChave("");
      setLivre("");
      setValor(null);
      setLider(false);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="font-semibold text-[#14405C]">B · Cosseguro</h5>
        {cobre ? <Badge className="bg-[#338B85] hover:bg-[#338B85]">Alcança a IS</Badge> : <Badge variant="outline">Não alcança a IS</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        Junte duas ou mais seguradoras para o mesmo risco. Só resolve quando a soma alcança a
        importância segurada — aí os documentos de cadastro deixam de ser exigidos.
      </p>

      {linhas.length > 0 && (
        <ul className="space-y-1.5">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {l.lider && <Crown className="h-4 w-4 shrink-0 text-[#338B85]" aria-label="Líder" />}
                <span className="truncate">{l.chave_mercado ? rotulo(l.chave_mercado) : l.seguradora_livre}</span>
                {l.lider && <span className="text-xs text-muted-foreground">líder</span>}
              </span>
              <span className="flex items-center gap-1">
                <strong>{moeda(Number(l.importancia_segurada))}</strong>
                {!l.lider && (
                  <Button size="sm" variant="ghost" disabled={marcarLider.isPending}
                    onClick={() => marcarLider.mutateAsync({ id: l.id, demandaId: demanda.id }).catch((e) => toast.error(mensagemDeErro(e)))}>
                    Tornar líder
                  </Button>
                )}
                {ehAdmin && (
                  <Button size="icon" variant="ghost" aria-label="Remover"
                    onClick={() => remover.mutateAsync(l.id).catch((e) => toast.error(mensagemDeErro(e)))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-1 rounded bg-muted/40 p-2 text-sm sm:grid-cols-3">
        <span>Total assumido: <strong>{moeda(total)}</strong></span>
        <span>IS da demanda: <strong>{is != null ? moeda(is) : "não preenchida"}</strong></span>
        <span>Falta: <strong className={falta ? "text-amber-700" : "text-[#338B85]"}>{falta != null ? moeda(falta) : "—"}</strong></span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div className="space-y-1">
          <Label>Seguradora</Label>
          <Select value={chave} onValueChange={setChave}>
            <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
            <SelectContent>
              {config.filter((c) => !jaUsadas.has(c.chave_mercado)).map((c) => (
                <SelectItem key={c.chave_mercado} value={c.chave_mercado}>{c.rotulo}</SelectItem>
              ))}
              <SelectItem value={OUTRA}>Outra (digitar)</SelectItem>
            </SelectContent>
          </Select>
          {chave === OUTRA && <Input placeholder="Nome da seguradora" value={livre} onChange={(e) => setLivre(e.target.value)} />}
        </div>
        <div className="space-y-1">
          <Label>IS assumida</Label>
          <CampoReal valor={valor} onChange={setValor} />
        </div>
        <Button onClick={salvar} disabled={incluir.isPending}>
          {incluir.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Incluir
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={lider || linhas.length === 0} disabled={linhas.length === 0} onCheckedChange={(v) => setLider(v === true)} />
        Esta é a líder {linhas.length === 0 && <span className="text-xs text-muted-foreground">(a primeira entra como líder)</span>}
      </label>
      {!ehAdmin && linhas.length > 0 && (
        <p className="text-xs text-muted-foreground">Para remover uma linha, peça a um administrador.</p>
      )}
    </div>
  );
}

function SaidaDispensa({ demanda }: { demanda: DemandaLista }) {
  const dispensar = useDispensarCadastro();
  const { data: pessoas = [] } = useResponsaveis();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (demanda.cadastro_dispensado_motivo) {
    const quem = pessoas.find((p) => p.user_id === demanda.cadastro_dispensado_por)?.nome ?? "—";
    return (
      <div className="space-y-1 rounded-md border p-3 text-sm">
        <h5 className="font-semibold text-[#14405C]">C · Dispensa registrada</h5>
        <p className="whitespace-pre-wrap">{demanda.cadastro_dispensado_motivo}</p>
        <p className="text-xs text-muted-foreground">
          Por {quem} em {dataHora(demanda.cadastro_dispensado_em)}. O registro fica no histórico mesmo
          que chegue documento depois.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3 text-sm">
      <h5 className="font-semibold text-[#14405C]">C · Dispensa</h5>
      <p className="text-xs text-muted-foreground">Passar de fase sem documentos nem cosseguro, com o motivo escrito.</p>
      <Button variant="link" className="h-auto px-0" onClick={() => setAberto(true)}>
        Seguir sem os documentos de cadastro
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Seguir sem os documentos de cadastro</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="motivo-dispensa">Motivo (obrigatório)</Label>
            <Textarea id="motivo-dispensa" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              disabled={!motivo.trim() || dispensar.isPending}
              onClick={async () => {
                try {
                  await dispensar.mutateAsync({ demandaId: demanda.id, motivo });
                  setAberto(false);
                  toast.success("Dispensa registrada.");
                } catch (e) {
                  toast.error(mensagemDeErro(e));
                }
              }}
            >
              {dispensar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar dispensa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BlocoCadastro({ demanda }: { demanda: DemandaLista }) {
  return (
    <div className="space-y-3" data-tour="gar-cadastro-saidas">
      {demanda.importancia_segurada == null ? (
        <p className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
          A decisão de exigir cadastro depende da importância segurada, que ainda não foi preenchida.
          Preencha na aba Dados.
        </p>
      ) : demanda.exige_cadastro ? (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          Nenhuma seguradora com portal cobre sozinha {moeda(Number(demanda.importancia_segurada))}.
          Qualquer uma das três saídas abaixo resolve.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Há seguradora com portal que cobre sozinha a importância segurada: o cadastro não é exigido.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border p-3 text-sm">
          <h5 className="font-semibold text-[#14405C]">A · Documentos de cadastro</h5>
          <p className="text-xs text-muted-foreground">
            Um documento basta: DRE, balanço ou alteração contratual. Anexe na área de documentos abaixo e
            responda as conferências de assinatura.
          </p>
        </div>
        <SaidaDispensa demanda={demanda} />
        <div className="lg:col-span-3"><SaidaCosseguro demanda={demanda} /></div>
      </div>
    </div>
  );
}
