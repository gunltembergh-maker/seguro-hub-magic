// CRM do ramo Garantia — só entra aqui o que o cliente aceitou.
//
// As colunas vêm de garantia_status_catalogo (fase = crm): 6 Curadoria,
// 7 Minuta, 8 Emissão e 9 Financeiro. As ações de emissão e financeiro
// chegam na próxima parte: as colunas aparecem, as ações não.
//
// O detalhe da demanda é O MESMO componente da Negociação — mesma demanda,
// outra fase. Nada é redigitado na passagem.

import { useMemo, useState } from "react";
import { Clock, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Carteira } from "@/components/garantia/carteira";
import { DemandaSheet, SeloProduto } from "@/components/garantia/demanda-sheet";
import { GarantiaShell } from "@/components/garantia/garantia-shell";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { useResponsaveis } from "@/hooks/use-entrada-demandas";
import { useSeguradorasEscolhidas, useStatusCrm } from "@/hooks/use-garantia-crm";
import {
  colunasDoCatalogo,
  useDemandasNegociacao,
  useInicioDoStatus,
  type DemandaLista,
  type FiltrosNegociacao,
} from "@/hooks/use-garantia-negociacao";
import { hasPermission } from "@/hooks/use-meu-perfil";
import {
  MODALIDADES,
  dataCurta,
  duracaoLegivel,
  horasDesde,
  moeda,
  rotuloEtapa,
  rotuloModalidade,
} from "@/lib/garantia/formato";

const TODOS = "__todos__";

function Cartao({
  demanda,
  statusNome,
  seguradora,
  inicioStatus,
  podeVerTempo,
  onAbrir,
}: {
  demanda: DemandaLista;
  statusNome: string;
  /** Seguradora da cotação escolhida, herdada da negociação. */
  seguradora: string | null;
  inicioStatus?: string;
  podeVerTempo: boolean;
  onAbrir: () => void;
}) {
  const horas = podeVerTempo && inicioStatus ? horasDesde(inicioStatus) : null;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-card-foreground">
          {demanda.codigo ?? "sem código"}
        </span>
        <SeloProduto produto={demanda.produto} />
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {demanda.legenda ?? demanda.cliente?.nome ?? "—"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {seguradora ?? "Seguradora a confirmar"} · {rotuloModalidade(demanda.modalidade)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Prêmio: {moeda(demanda.premio_estimado)} · Comissão: {moeda(demanda.comissao_estimada)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Data limite: {dataCurta(demanda.data_limite)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[11px]">{statusNome}</Badge>
        {podeVerTempo && horas != null && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {duracaoLegivel(Math.round(horas * 3600))} no status
          </span>
        )}
      </div>
    </button>
  );
}

export default function Crm() {
  const perfil = useMeuPerfilEfetivo();
  const podeVerTempo = hasPermission(perfil, "menu_garantia_painel");

  const [filtros, setFiltros] = useState<FiltrosNegociacao>({});
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const { data: catalogo = [], isLoading: carregandoCatalogo } = useStatusCrm();
  const { data: demandas = [], isLoading } = useDemandasNegociacao({
    ...filtros,
    busca,
    fase: "crm",
  });
  const { data: pessoas = [] } = useResponsaveis();
  const { data: inicios = {} } = useInicioDoStatus(podeVerTempo);
  const { data: seguradoraPorDemanda = {} } = useSeguradorasEscolhidas(demandas.map((d) => d.id));

  const colunas = useMemo(() => colunasDoCatalogo(catalogo), [catalogo]);
  const demandaAberta = demandas.find((d) => d.id === aberta) ?? null;

  return (
    <GarantiaShell titulo="CRM" trilha={["CRM"]}>
      <Tabs defaultValue="quadro" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quadro">Quadro</TabsTrigger>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
        </TabsList>
        <TabsContent value="carteira">
          <Carteira />
        </TabsContent>
        <TabsContent value="quadro" className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Produto</Label>
            <Select
              value={filtros.produto ?? TODOS}
              onValueChange={(v) => setFiltros({ ...filtros, produto: v === TODOS ? undefined : v })}
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                <SelectItem value="seguro_garantia">Seguro Garantia</SelectItem>
                <SelectItem value="fianca_locaticia">Fiança Locatícia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Modalidade</Label>
            <Select
              value={filtros.modalidade ?? TODOS}
              onValueChange={(v) =>
                setFiltros({ ...filtros, modalidade: v === TODOS ? undefined : v })
              }
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {MODALIDADES.map((m) => (
                  <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>
                ))}
                <SelectItem value="locaticia">Locatícia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Responsável técnico</Label>
            <Select
              value={filtros.responsavel_tecnico_id ?? TODOS}
              onValueChange={(v) =>
                setFiltros({ ...filtros, responsavel_tecnico_id: v === TODOS ? undefined : v })
              }
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {pessoas.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Cliente ou código</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-64 pl-8"
                placeholder="Buscar por nome, CNPJ ou GAR-"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading || carregandoCatalogo ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {colunas.map((coluna) => {
              const daColuna = demandas.filter((d) => d.etapa === coluna.etapa);
              return (
                <div
                  key={coluna.etapa}
                  className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      {rotuloEtapa(coluna.etapa)}
                    </h2>
                    <Badge variant="secondary">{daColuna.length}</Badge>
                  </div>
                  {coluna.etapa === "9" && (
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Esta etapa não conta tempo.
                    </p>
                  )}
                  <div className="space-y-2">
                    {daColuna.map((d) => (
                      <Cartao
                        key={d.id}
                        demanda={d}
                        statusNome={
                          catalogo.find((s) => s.codigo === d.status_atual)?.nome ?? d.status_atual
                        }
                        seguradora={seguradoraPorDemanda[d.id] ?? null}
                        inicioStatus={inicios[d.id]}
                        podeVerTempo={podeVerTempo}
                        onAbrir={() => setAberta(d.id)}
                      />
                    ))}
                    {!daColuna.length && (
                      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        Nenhuma demanda nesta etapa.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </TabsContent>
      </Tabs>

      <DemandaSheet
        demanda={demandaAberta}
        catalogo={catalogo}
        podeVerTempo={podeVerTempo}
        onFechar={() => setAberta(null)}
      />
    </GarantiaShell>
  );
}
