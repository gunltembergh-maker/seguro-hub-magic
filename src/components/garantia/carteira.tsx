// Etapa 10 — Carteira: as apólices que estão de pé.
//
// Sinistro não é encerramento: a apólice em sinistro continua aqui, marcada.
// Só a baixa tira a apólice da carteira ativa — e nada é apagado.

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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

import {
  diasParaVencer,
  nomeSeguradoraApolice,
  useAbrirDemandaDerivada,
  useAbrirDemandaExecutante,
  useAvisosRenovacao,
  useCarteira,
  type ApoliceGarantia,
} from "@/hooks/use-garantia-apolices";
import { useSeguradorasGarantia } from "@/hooks/use-garantia-crm";
import { ROTULO_PRODUTO, TIPOS_ALTERACAO, dataCurta, moeda } from "@/lib/garantia/formato";

const TODOS = "__todos__";

function Avisos({ apoliceId }: { apoliceId: string }) {
  const { data: avisos = [] } = useAvisosRenovacao(apoliceId);
  if (!avisos.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {avisos.map((a) => (
        <Badge key={a.id} variant={a.enviado ? "secondary" : "outline"} className="text-[11px]">
          {a.dias_antes}d · {dataCurta(a.data_aviso)} · {a.enviado ? "enviado" : "pendente"}
          {a.demanda_renovacao_id ? " · renovação aberta" : ""}
        </Badge>
      ))}
    </div>
  );
}

function LinhaApolice({ apolice }: { apolice: ApoliceGarantia }) {
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const derivada = useAbrirDemandaDerivada();
  const executante = useAbrirDemandaExecutante();
  const [tipoAlteracao, setTipoAlteracao] = useState("");
  const dias = diasParaVencer(apolice);
  const perto = dias != null && dias <= 120;
  const judicial = apolice.demanda?.modalidade === "judicial";
  const licitante = apolice.demanda?.modalidade === "licitante";

  const abrir = async (tipo: "renovacao" | "endosso") => {
    if (tipo === "endosso" && !tipoAlteracao) {
      toast.error("Escolha o tipo de alteração do endosso.");
      return;
    }
    try {
      await derivada.mutateAsync({
        apolice,
        entrada: { tipo_movimento: tipo, tipo_alteracao: tipoAlteracao || null },
      });
      toast.success(
        tipo === "renovacao"
          ? "Renovação aberta em Triagem, herdando cliente, segurado, produto e canal."
          : "Endosso aberto em Triagem.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a demanda.");
    }
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${perto ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#14405C]">
          {apolice.demanda?.codigo ?? "sem código"}
        </span>
        <Badge variant="outline">
          {apolice.numero_apolice} / endosso {apolice.numero_endosso}
        </Badge>
        <Badge variant={apolice.situacao === "em_sinistro" ? "destructive" : "secondary"}>
          {apolice.situacao === "em_sinistro" ? "em sinistro" : "vigente"}
        </Badge>
        {dias != null && (
          <Badge variant={perto ? "destructive" : "outline"}>
            {dias >= 0 ? `vence em ${dias} dia(s)` : `vencida há ${Math.abs(dias)} dia(s)`}
          </Badge>
        )}
      </div>

      <p className="mt-1 text-muted-foreground">
        {apolice.demanda?.cliente?.nome ?? apolice.demanda?.legenda ?? "—"} ·{" "}
        {nomeSeguradoraApolice(apolice, seguradoras)} ·{" "}
        {ROTULO_PRODUTO[apolice.produto] ?? apolice.produto}
      </p>
      <p className="text-muted-foreground">
        IS {moeda(apolice.importancia_segurada)} · Prêmio {moeda(apolice.premio)} · Comissão{" "}
        {moeda(apolice.comissao_valor)} · Vigência {dataCurta(apolice.vigencia_inicio)} a{" "}
        {dataCurta(apolice.vigencia_fim)}
      </p>

      {perto && <Avisos apoliceId={apolice.id} />}

      {perto && judicial && (
        <p className="mt-1 flex items-start gap-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Garantia judicial: confirme o prazo do órgão antes de renovar. Não renovar a tempo pode
          virar sinistro.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={derivada.isPending} onClick={() => abrir("renovacao")}>
          {derivada.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Abrir renovação
        </Button>
        <Select value={tipoAlteracao} onValueChange={setTipoAlteracao}>
          <SelectTrigger className="h-8 w-52">
            <SelectValue placeholder="Alteração do endosso" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_ALTERACAO.map((t) => (
              <SelectItem key={t.valor} value={t.valor}>
                {t.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={derivada.isPending} onClick={() => abrir("endosso")}>
          Abrir endosso
        </Button>
        {licitante && (
          <Button
            size="sm"
            variant="outline"
            disabled={executante.isPending}
            onClick={async () => {
              try {
                await executante.mutateAsync(apolice);
                toast.success("Demanda de executante aberta em Triagem.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Não foi possível abrir a demanda.");
              }
            }}
          >
            Abrir demanda de executante
          </Button>
        )}
      </div>
    </div>
  );
}

export function Carteira() {
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const [chave, setChave] = useState<string>(TODOS);
  const [produto, setProduto] = useState<string>(TODOS);
  const [janela, setJanela] = useState<string>(TODOS);

  const { data: apolices = [], isLoading } = useCarteira({
    chave_mercado: chave === TODOS ? undefined : chave,
    produto: produto === TODOS ? undefined : produto,
    janela_dias: janela === TODOS ? undefined : Number(janela),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 space-y-1">
          <Label>Seguradora</Label>
          <Select value={chave} onValueChange={setChave}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {seguradoras.map((s) => (
                <SelectItem key={s.chave_mercado} value={s.chave_mercado}>
                  {s.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label>Produto</Label>
          <Select value={produto} onValueChange={setProduto}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              <SelectItem value="seguro_garantia">Seguro Garantia</SelectItem>
              <SelectItem value="fianca_locaticia">Fiança Locatícia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label>Vence em até</Label>
          <Select value={janela} onValueChange={setJanela}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Qualquer prazo</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="120">120 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : apolices.length ? (
        <div className="space-y-2">
          {apolices.map((a) => (
            <LinhaApolice key={a.id} apolice={a} />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nenhuma apólice na carteira com esses filtros.
        </p>
      )}
    </div>
  );
}

/** Campo de busca simples reaproveitado pela tela do CRM. */
export function BuscaCarteira({
  valor,
  onMudar,
}: {
  valor: string;
  onMudar: (v: string) => void;
}) {
  return <Input value={valor} onChange={(e) => onMudar(e.target.value)} placeholder="Buscar" />;
}
