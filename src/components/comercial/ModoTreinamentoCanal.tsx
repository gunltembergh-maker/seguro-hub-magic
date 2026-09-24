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

type Status = {
  ativo: boolean;
  emails: string[] | null;
  atualizado_em: string | null;
  atualizado_por_nome: string | null;
};

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
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const ativo = status.data?.ativo === true;
  const emails = status.data?.emails ?? [];

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
      await qc.invalidateQueries({ queryKey: ["canal-treinamento-status"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const listaDoTexto = () =>
    texto.split(",").map((x) => x.trim()).filter((x) => x.includes("@"));

  function alternar(v: boolean) {
    if (!v && !window.confirm("Os avisos voltam a ir para as pessoas reais. Desligar?")) return;
    void definir(v, v ? listaDoTexto() : emails);
  }

  return (
    <div className="space-y-2">
      {ativo && (
        <div className="sticky top-0 z-30 rounded-md border border-amber-500 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Modo treinamento ligado: os e-mails do Canal Parceiros vão só para {emails.join(", ") || "ninguém"}
        </div>
      )}
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
    </div>
  );
}

export default ModoTreinamentoCanal;
