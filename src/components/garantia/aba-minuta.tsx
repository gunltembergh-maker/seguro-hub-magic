// Etapa 7 — Minuta.
//
// Seguradora, prêmio e taxa são HERDADOS da cotação escolhida: a tela mostra
// para conferência e o botão confirma — ninguém redigita.
//
// A versão da minuta é do trigger do banco: v2 supera a v1 sem apagá-la.
// A caixa de análise por IA da minuta registra o PEDIDO; o motor de leitura
// não é chamado aqui.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  nomeSeguradoraCotacao,
  useAprovacoesMinuta,
  useCotacoes,
  useSalvarAprovacaoMinuta,
  useSeguradoDaDemanda,
  useSeguradorasGarantia,
} from "@/hooks/use-garantia-crm";
import { useDocumentosDaDemanda } from "@/hooks/use-garantia-documentos";
import {
  useAtualizarDemanda,
  useTrocarStatus,
  type DemandaLista,
  type StatusCatalogo,
} from "@/hooks/use-garantia-negociacao";
import { A_DEFINIR, dataCurta, moeda } from "@/lib/garantia/formato";

const FORMAS = [
  { valor: "email", rotulo: "E-mail" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "assinatura", rotulo: "Assinatura eletrônica" },
  { valor: "verbal", rotulo: "Verbal registrada" },
];

function BlocoAprovacao({
  titulo,
  descricao,
  quem,
  demandaId,
  atual,
}: {
  titulo: string;
  descricao: string;
  quem: "cliente" | "segurado";
  demandaId: string;
  atual: { data: string; forma: string | null } | null;
}) {
  const salvar = useSalvarAprovacaoMinuta(demandaId);
  const [data, setData] = useState(atual?.data?.slice(0, 10) ?? "");
  const [forma, setForma] = useState(atual?.forma ?? "");

  useEffect(() => {
    setData(atual?.data?.slice(0, 10) ?? "");
    setForma(atual?.forma ?? "");
  }, [atual?.data, atual?.forma]);

  const gravar = async () => {
    if (!data) {
      toast.error("Informe a data da aprovação.");
      return;
    }
    try {
      await salvar.mutateAsync({ quem, data: `${data}T12:00:00`, forma: forma || null });
      toast.success("Aprovação registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-[#14405C]">{titulo}</h4>
        {atual ? (
          <Badge className="gap-1 bg-[#338B85] hover:bg-[#338B85]">
            <Check className="h-3 w-3" /> registrada em {dataCurta(atual.data)}
          </Badge>
        ) : (
          <Badge variant="secondary">pendente</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{descricao}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Forma</Label>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger>
              <SelectValue placeholder="Como veio a aprovação" />
            </SelectTrigger>
            <SelectContent>
              {FORMAS.map((f) => (
                <SelectItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={gravar} disabled={salvar.isPending}>
        {salvar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {atual ? "Atualizar" : "Registrar"}
      </Button>
    </div>
  );
}

export function AbaMinuta({
  demanda,
  catalogo,
  moverAoReceberMinuta = true,
}: {
  demanda: DemandaLista;
  catalogo: StatusCatalogo[];
  moverAoReceberMinuta?: boolean;
}) {
  const { data: cotacoes = [] } = useCotacoes(demanda.id);
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const { data: aprovacoes = [] } = useAprovacoesMinuta(demanda.id);
  const { data: segurado } = useSeguradoDaDemanda(demanda.segurado_id);
  const atualizar = useAtualizarDemanda();
  const trocar = useTrocarStatus();
  const carimbouRef = useRef(false);

  const escolhida = cotacoes.find((c) => c.escolhida) ?? null;
  const minutas = useMemo(
    () => docs.filter((d) => d.tipo === "minuta").sort((a, b) => b.versao - a.versao),
    [docs],
  );
  const temMinuta = minutas.length > 0;

  // Chegou a primeira minuta (ou a versão nova depois de um ajuste): o status
  // vai para a conferência. O relógio continua sendo do trigger do banco.
  useEffect(() => {
    if (!moverAoReceberMinuta) return;
    if (!temMinuta || carimbouRef.current) return;
    if (!["aguard_minuta", "ajuste_minuta"].includes(demanda.status_atual)) return;
    const destino = catalogo.find((s) => s.codigo === "conferencia_minuta");
    if (!destino) return;
    carimbouRef.current = true;
    trocar.mutate(
      { demanda, destino },
      {
        onSuccess: () => toast.success("Minuta recebida: o caso foi para a conferência da minuta."),
        onError: () => undefined,
      },
    );
  }, [moverAoReceberMinuta, temMinuta, demanda, catalogo, trocar]);

  const mudarStatus = async (codigo: string) => {
    const destino = catalogo.find((s) => s.codigo === codigo);
    if (!destino) return;
    try {
      await trocar.mutateAsync({ demanda, destino });
      toast.success(`Status alterado para “${destino.nome}”.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mudar o status.");
    }
  };

  const confirmarHeranca = async () => {
    if (!escolhida) return;
    try {
      await atualizar.mutateAsync({
        id: demanda.id,
        valores: {
          premio_estimado: escolhida.premio,
          comissao_estimada: escolhida.comissao_valor,
        },
      });
      toast.success("Dados da cotação confirmados na demanda.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível confirmar.");
    }
  };

  const doCliente = aprovacoes.find((a) => a.quem === "cliente") ?? null;
  const doSegurado = aprovacoes.find((a) => a.quem === "segurado") ?? null;
  const exigeTexto = !!segurado?.exige_texto_proprio;

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2 rounded-md border p-3">
        <h4 className="font-semibold text-[#14405C]">Herdado da cotação escolhida</h4>
        {escolhida ? (
          <>
            <p>
              Seguradora: <strong>{nomeSeguradoraCotacao(escolhida, seguradoras)}</strong> · Prêmio:{" "}
              <strong>{moeda(escolhida.premio)}</strong> · Taxa:{" "}
              <strong>{escolhida.taxa ?? A_DEFINIR}</strong>
            </p>
            <Button size="sm" variant="outline" onClick={confirmarHeranca} disabled={atualizar.isPending}>
              Confirmar seguradora, prêmio e taxa
            </Button>
          </>
        ) : (
          <p className="text-amber-700">
            Nenhuma cotação escolhida. Marque a cotação aceita na aba Cotações.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <h4 className="font-semibold text-[#14405C]">Minuta</h4>
        {temMinuta ? (
          <p>
            Versão atual: <strong>v{minutas[0]!.versao}</strong> — {minutas[0]!.nome_arquivo}
            {minutas.length > 1 && (
              <span className="block text-xs text-muted-foreground">
                {minutas.length - 1} versão(ões) anterior(es) preservada(s) na aba Documentos.
              </span>
            )}
          </p>
        ) : (
          <p className="flex items-start gap-2 text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Nenhuma minuta anexada. Use a aba Documentos, que já abre com o tipo “Minuta”
            selecionado.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={trocar.isPending || demanda.status_atual === "ajuste_minuta"}
            onClick={() => mudarStatus("ajuste_minuta")}
          >
            Pedir ajuste da minuta à seguradora
          </Button>
          {demanda.status_atual === "ajuste_minuta" && (
            <span className="self-center text-xs text-muted-foreground">
              Quando a versão nova for anexada, o caso volta sozinho para a conferência.
            </span>
          )}
        </div>
      </div>

      <Separator />

      <BlocoAprovacao
        titulo="Aprovação do cliente"
        descricao="Obrigatória para avançar à emissão."
        quem="cliente"
        demandaId={demanda.id}
        atual={doCliente}
      />

      {exigeTexto ? (
        <BlocoAprovacao
          titulo="Aceite do texto pelo segurado"
          descricao="Este segurado está cadastrado como exigindo texto próprio, então o aceite dele também é obrigatório."
          quem="segurado"
          demandaId={demanda.id}
          atual={doSegurado}
        />
      ) : (
        <p className="rounded-md border border-dashed p-3 text-muted-foreground">
          O segurado desta demanda não exige texto próprio: o aceite do texto por ele não é pedido.
        </p>
      )}
    </div>
  );
}
