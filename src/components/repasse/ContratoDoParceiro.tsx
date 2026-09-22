// Contrato vigente do parceiro, na tela, para o Comercial e para o Financeiro.
//
// O documento nunca é exposto por link fixo: a abertura gera uma URL assinada
// de 5 minutos no bucket dos contratos.
import { mensagemDeErro } from "@/lib/erro";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BUCKET = "canal-parceiros-contratos";

type Contrato = {
  contrato_id: string;
  parceiro: string | null;
  arquivo_nome: string | null;
  arquivo_path: string | null;
  tipo: string | null;
  assinado: boolean | null;
  assinado_em: string | null;
  assinatura_atestada_por: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais_efetivo: number | null;
  minimo_repasse: number | null;
  origem_leitura: string | null;
  situacao: string | null;
};

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const PCT = (v: number | null | undefined) =>
  v == null ? "—" : `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function ContratoDoParceiro({
  aberto,
  onFechar,
  canal,
  parceiro,
}: {
  aberto: boolean;
  onFechar: () => void;
  canal: string;
  parceiro: string;
}) {
  const [abrindo, setAbrindo] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["canal-repasse-contrato", canal],
    enabled: aberto && !!canal,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_canal_repasse_contrato_do_parceiro" as never,
        { p_canal_planilha: canal } as never,
      );
      if (error) throw error;
      const rows = (data ?? []) as Contrato[];
      return rows.length > 0 ? rows[0] : null;
    },
  });

  async function abrirDocumento() {
    if (!data?.arquivo_path || abrindo) return;
    setAbrindo(true);
    try {
      const { data: url, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(data.arquivo_path, 300);
      if (error) throw new Error(error.message);
      window.open(url?.signedUrl, "_blank", "noopener");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contrato de {parceiro}</DialogTitle>
          <DialogDescription>Contrato vigente registrado no Hub.</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {mensagemDeErro(error)}
            </AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Carregando
          </p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Este parceiro não tem contrato ativo no Hub.
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            <Item rotulo="Arquivo" valor={data.arquivo_nome ?? "—"} />
            <Item rotulo="Tipo" valor={data.tipo ?? "—"} />
            <Item
              rotulo="Assinatura"
              valor={
                data.assinatura_atestada_por
                  ? `atestada por ${data.assinatura_atestada_por}`
                  : data.assinado_em
                    ? fmtBR(data.assinado_em)
                    : data.assinado
                      ? "assinado"
                      : "sem assinatura"
              }
            />
            <Item
              rotulo="Vigência"
              valor={`${fmtBR(data.vigencia_inicio)} até ${fmtBR(data.vigencia_fim)}`}
            />
            <Item rotulo="Benefícios" valor={PCT(data.pct_beneficios)} />
            <Item rotulo="Garantia" valor={PCT(data.pct_garantia)} />
            <Item rotulo="Demais ramos" valor={PCT(data.pct_demais_efetivo)} />
            <Item rotulo="Mínimo por ciclo" valor={BRL(data.minimo_repasse)} />
            <Item rotulo="Como foi lido" valor={data.origem_leitura ?? "—"} />
          </dl>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          {data?.arquivo_path ? (
            <Button onClick={() => void abrirDocumento()} disabled={abrindo}>
              {abrindo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Abrir o documento
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-1 last:border-0">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium text-foreground">{valor}</dd>
    </div>
  );
}

export default ContratoDoParceiro;
