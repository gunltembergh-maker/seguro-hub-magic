// Canal Parceiros — alterações de percentual aguardando o De Acordo da diretoria.
//
// Quem pode aprovar é o banco que decide (sou_o_aprovador). Aqui só escondemos
// os botões de quem não é o aprovador e exigimos a senha de super administrador
// antes de aprovar, do mesmo jeito que as liberações excepcionais.
import { mensagemDeErro } from "@/lib/erro";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BUCKET = "canal-parceiros-contratos";

export interface Alteracao {
  alteracao_id: string;
  canal_id: string | null;
  parceiro: string | null;
  status: string | null;
  justificativa: string | null;
  diretor_email: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  minimo: number | null;
  vigencia_fim: string | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  pct_beneficios_contrato: number | null;
  pct_garantia_contrato: number | null;
  solicitado_por_nome: string | null;
  solicitado_em: string | null;
  aprovado_por_nome: string | null;
  aprovado_em: string | null;
  observacao: string | null;
  superada_em: string | null;
  sou_o_aprovador: boolean | null;
  sou_o_solicitante: boolean | null;
}

/* --------------------------------------------------------------- formatos */

export const pctAlt = (v?: number | null) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export const diaAlt = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const reais = (v?: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ dados */

export function useAlteracoesPercentual(status?: string | null) {
  return useQuery({
    queryKey: ["canal-parceiro-alteracoes", status ?? "TODAS"],
    queryFn: async (): Promise<Alteracao[]> => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_alteracoes" as never,
        {
          p_status: status ?? null,
        } as never,
      );
      if (error) throw error;
      return (data ?? []) as unknown as Alteracao[];
    },
    staleTime: 60_000,
  });
}

/** Link temporário de 5 minutos para o anexo do De Acordo. */
async function abrirAnexo(path?: string | null) {
  if (!path) {
    toast.error("Este pedido não tem anexo guardado.");
    return;
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    toast.error(error?.message || "Não foi possível abrir o De Acordo.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/* -------------------------------------------------------------- o bloco */

export function FilaAlteracoesPercentual({ semCard = false }: { semCard?: boolean } = {}) {
  const pendentes = useAlteracoesPercentual("PENDENTE");
  const queryClient = useQueryClient();

  const [aprovando, setAprovando] = useState<Alteracao | null>(null);
  const [recusando, setRecusando] = useState<Alteracao | null>(null);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const linhas = pendentes.data ?? [];
  if (pendentes.isLoading || linhas.length === 0) return null;

  async function decidir(id: string, aprovar: boolean, obs: string | null) {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc(
        "rpc_canal_parceiro_decidir_alteracao" as never,
        {
          p_alteracao_id: id,
          p_aprovar: aprovar,
          p_observacao: obs,
        } as never,
      );
      if (error) throw error;
      toast.success(aprovar ? "Alteração aprovada." : "Alteração recusada.");
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-alteracoes"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-contratos"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-eventos"] });
      setAprovando(null);
      setRecusando(null);
      setObservacao("");
    } catch (e) {
      setErro(mensagemDeErro(e));
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const conteudo = (
    <div className="space-y-3">
      {linhas.map((a) => (
        <div key={a.alteracao_id} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{a.parceiro ?? "Parceiro"}</p>
              <p className="text-xs text-muted-foreground">
                Pedido por {a.solicitado_por_nome ?? "—"} em {dataHora(a.solicitado_em)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => abrirAnexo(a.anexo_path)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver o De Acordo
              </Button>
              {a.sou_o_aprovador === true ? (
                <>
                  <Button size="sm" onClick={() => { setErro(null); setAprovando(a); }}>
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setObservacao("");
                      setErro(null);
                      setRecusando(a);
                    }}
                  >
                    Recusar
                  </Button>
                </>
              ) : (
                <Badge variant="outline">Aguardando aprovação de Alessandro Oliveira.</Badge>
              )}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                <LinhaMudanca
                  rotulo="Benefícios"
                  contrato={pctAlt(a.pct_beneficios_contrato)}
                  pedido={a.pct_beneficios}
                />
                <LinhaMudanca
                  rotulo="Garantia"
                  contrato={pctAlt(a.pct_garantia_contrato)}
                  pedido={a.pct_garantia}
                />
                <LinhaMudanca rotulo="Demais ramos" contrato="—" pedido={a.pct_demais} />
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {a.minimo != null ? <span>Mínimo por ciclo: {reais(a.minimo)}</span> : null}
            {a.vigencia_fim ? <span>Nova vigência até {diaAlt(a.vigencia_fim)}</span> : null}
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
            {a.justificativa ?? "Sem justificativa."}
          </p>

          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">De Acordo de </span>
            <span className="font-semibold text-foreground">{a.diretor_email ?? "—"}</span>
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {semCard ? (
        conteudo
      ) : (
        <Card className="border-amber-600/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Alterações de percentual aguardando aprovação
            </CardTitle>
            <CardDescription>
              Percentual diferente do contrato só vale depois do De Acordo da diretoria.
            </CardDescription>
          </CardHeader>
          <CardContent>{conteudo}</CardContent>
        </Card>
      )}

      {/* aprovar — exige a senha do super administrador */}
      <Dialog
        open={!!aprovando}
        onOpenChange={(v) => {
          if (!v) setAprovando(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovar alteração de percentual</DialogTitle>
            <DialogDescription>
              {aprovando?.parceiro ?? "Parceiro"} — o percentual autorizado passa a valer na
              exportação do repasse.
            </DialogDescription>
          </DialogHeader>

          <SuperAdminGate
            area="canal-parceiro-alteracoes"
            titulo="Aprovar alterações de percentual"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                De Acordo de{" "}
                <span className="font-medium text-foreground">
                  {aprovando?.diretor_email ?? "—"}
                </span>
                .
              </p>
              <Button
                className="w-full"
                disabled={salvando}
                onClick={() => aprovando && decidir(aprovando.alteracao_id, true, null)}
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar aprovação
              </Button>
            </div>
          </SuperAdminGate>
        </DialogContent>
      </Dialog>

      {/* recusar — observação obrigatória */}
      <Dialog
        open={!!recusando}
        onOpenChange={(v) => {
          if (!v) setRecusando(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recusar alteração de percentual</DialogTitle>
            <DialogDescription>
              {recusando?.parceiro ?? "Parceiro"} — diga por que o pedido não foi aceito.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="alt-recusa">Observação</Label>
            <Textarea
              id="alt-recusa"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={salvando || !observacao.trim()}
              onClick={() => recusando && decidir(recusando.alteracao_id, false, observacao.trim())}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LinhaMudanca({
  rotulo,
  contrato,
  pedido,
}: {
  rotulo: string;
  contrato: string;
  pedido: number | null;
}) {
  if (pedido == null) return null;
  return (
    <tr className="border-b last:border-0">
      <td className="py-1 pr-3 text-muted-foreground">{rotulo}</td>
      <td className="py-1 pr-3 tabular-nums">{contrato}</td>
      <td className="py-1 pr-3 text-muted-foreground">→</td>
      <td className="py-1 font-medium tabular-nums text-foreground">{pctAlt(pedido)}</td>
    </tr>
  );
}

export default FilaAlteracoesPercentual;
