import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/erro";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Status = {
  ativo: boolean;
  emails: string[] | null;
  atualizado_em: string | null;
  atualizado_por_nome: string | null;
};
type ItemResumo = { item: string; quantidade: number };
type ItemLimpo = { item: string; apagados: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

/** Só renderizar para ADMIN. */
export function ModoTreinamentoCanal() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["canal-treinamento-status"],
    queryFn: async (): Promise<Status | null> => {
      const { data, error } = await rpc("rpc_canal_treinamento_status");
      if (error) throw error;
      return ((Array.isArray(data) ? data[0] : data) as Status) ?? null;
    },
  });
  const resumo = useQuery({
    queryKey: ["canal-treinamento-resumo"],
    queryFn: async (): Promise<ItemResumo[]> => {
      const { data, error } = await rpc("rpc_canal_treinamento_resumo");
      if (error) throw error;
      return ((data ?? []) as ItemResumo[]).filter((r) => Number(r.quantidade) > 0);
    },
  });
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [dialogo, setDialogo] = useState<null | "encerrar" | "apagar">(null);
  const [manterContratos, setManterContratos] = useState(true);
  const ativo = status.data?.ativo === true;
  const emails = status.data?.emails ?? [];
  const itens = resumo.data ?? [];

  useEffect(() => {
    setTexto(emails.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data]);

  async function definir(novoAtivo: boolean, lista: string[]) {
    setSalvando(true);
    try {
      const { error } = await rpc("rpc_canal_treinamento_definir", { p_ativo: novoAtivo, p_emails: lista });
      if (error) throw error;
      toast.success(novoAtivo ? "Modo treinamento ligado." : "Modo treinamento desligado.");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar(apagar: boolean) {
    setSalvando(true);
    try {
      if (ativo) {
        const { error } = await rpc("rpc_canal_treinamento_definir", { p_ativo: false, p_emails: emails });
        if (error) throw error;
        toast.success("Modo treinamento desligado.");
      }
      if (apagar) {
        const { data, error } = await rpc("rpc_canal_treinamento_limpar", { p_manter_contratos: manterContratos });
        if (error) throw error;
        const total = ((data ?? []) as ItemLimpo[]).reduce((s, r) => s + Number(r.apagados || 0), 0);
        toast.success(`${total} registro(s) do treinamento apagado(s).`);
      }
      setDialogo(null);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
      await qc.invalidateQueries();
    }
  }

  const listaDoTexto = () =>
    texto.split(",").map((x) => x.trim()).filter((x) => x.includes("@"));

  function alternar(v: boolean) {
    if (!v) {
      setManterContratos(true);
      void resumo.refetch();
      setDialogo("encerrar");
      return;
    }
    void definir(true, listaDoTexto());
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch id="modo-treinamento" checked={ativo} disabled={salvando || status.isLoading} onCheckedChange={alternar} />
          <Label htmlFor="modo-treinamento">Modo treinamento</Label>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {ativo && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              className="min-w-0 max-w-xl"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="E-mails separados por vírgula"
            />
            <Button size="sm" variant="outline" disabled={salvando} onClick={() => definir(true, listaDoTexto())}>
              Salvar e-mails
            </Button>
          </div>
        )}
      </div>
      {!ativo && itens.length > 0 && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-foreground"
          onClick={() => {
            setManterContratos(true);
            setDialogo("apagar");
          }}
        >
          Apagar dados do último treinamento
        </button>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(o) => !o && !salvando && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar treinamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {resumo.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : itens.length === 0 ? (
              <p className="text-muted-foreground">Nada foi feito no treinamento</p>
            ) : (
              <ul className="space-y-1">
                {itens.map((r) => (
                  <li key={r.item} className="flex justify-between gap-4">
                    <span>{r.item}</span>
                    <span className="font-medium">{r.quantidade}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="manter-contratos"
                checked={manterContratos}
                onCheckedChange={(v) => setManterContratos(v === true)}
              />
              <Label htmlFor="manter-contratos" className="font-normal leading-snug">
                Manter os contratos enviados durante o treinamento (eles passam a valer)
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={salvando} onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            {dialogo === "encerrar" && (
              <Button variant="secondary" disabled={salvando} onClick={() => encerrar(false)}>
                Só desligar
              </Button>
            )}
            <Button variant="destructive" disabled={salvando} onClick={() => encerrar(true)}>
              {dialogo === "encerrar" ? "Desligar e apagar o treinamento" : "Apagar o treinamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ModoTreinamentoCanal;
