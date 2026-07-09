import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, ShieldAlert, Target } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasPermission } from "@/hooks/use-meu-perfil";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: AdminConfigPage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function AdminConfigPage() {
  const { data: perfil } = useMeuPerfil();
  const qc = useQueryClient();
  const ano = new Date().getFullYear();
  const [valor, setValor] = useState("");

  const { data: metaAtual } = useQuery({
    queryKey: ["meta-anual", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_meta_anual", { _ano: ano });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  useEffect(() => {
    if (metaAtual != null && !valor) setValor(String(metaAtual));
  }, [metaAtual, valor]);

  const mut = useMutation({
    mutationFn: async () => {
      const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
      if (isNaN(v)) throw new Error("Valor inválido");
      const { error } = await supabase.rpc("rpc_set_meta_anual", { _ano: ano, _valor: v });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta anual salva");
      qc.invalidateQueries({ queryKey: ["meta-anual"] });
      qc.invalidateQueries({ queryKey: ["receita"] });
    },
    onError: (e: Error) => toast.error("Falha ao salvar", { description: e.message }),
  });

  if (!hasPermission(perfil, "menu_admin_configuracoes")) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Parâmetros gerais do Hub.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> Meta Anual — {ano}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metaAtual != null && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              Meta atual: <span className="font-semibold tabular-nums">{BRL.format(metaAtual)}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Nova meta anual (R$)</Label>
            <Input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex: 12000000"
            />
            <p className="text-xs text-muted-foreground">
              O valor é distribuído proporcionalmente pelos meses no Dashboard de Receita.
            </p>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar meta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
