// Aba "Limites" do detalhe da demanda — consulta a mercado (etapa 3).
//
// Só aparece para Seguro Garantia: fiança locatícia não faz consulta a mercado.
// Vocabulário fechado: Com limite · Sem limite · Não consultado. "Não
// consultado" é falha técnica, NUNCA recusa — está escrito na tela de propósito.

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Save } from "lucide-react";
import { CampoReal } from "@/components/garantia/campo-real";
import { mensagemDeErro } from "@/lib/erro";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import {
  useAbrirConsultaManual,
  useConsultaAtual,
  useConsultarMercado,
  useLimitesDaConsulta,
  useSalvarLimiteManual,
  useSalvarLimitesEmLote,
  useSeguradorasConfig,
  type ValoresLimiteManual,
} from "@/hooks/use-garantia-limites";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import {
  ROTULO_GRUPO,
  STATUS_MERCADO,
  cadastroVencido,
  grupoDoStatusMercado,
  resumirConsulta,
  rotuloStatusMercado,
  type LimiteLinha,
  type SeguradoraConfig,
} from "@/lib/garantia/limites-regra";
import { dataCurta, dataHora, moeda } from "@/lib/garantia/formato";

const MENSAGENS_ERRO: Record<string, string> = {
  sem_permissao: "Você não tem permissão para consultar o mercado.",
  produto_sem_consulta: "Fiança locatícia não faz consulta a mercado.",
  cliente_pf: "A consulta a mercado é por CNPJ. Este cliente é pessoa física.",
  demanda_nao_encontrada: "Demanda não encontrada.",
  sem_seguradoras_ativas: "Nenhuma seguradora com consulta automática está ativa.",
};

function diasRestantes(validaAte: string): number {
  return Math.ceil((new Date(validaAte).getTime() - Date.now()) / 86_400_000);
}

function LinhaSeguradora({
  config,
  limite,
  onEditar,
}: {
  config: SeguradoraConfig;
  limite: LimiteLinha | undefined;
  onEditar: () => void;
}) {
  const grupo = limite?.status_mercado
    ? (limite.grupo_mercado ?? grupoDoStatusMercado(limite.status_mercado))
    : null;
  const vencido = cadastroVencido(limite?.data_ultimo_cadastro);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{config.rotulo}</span>
          {grupo ? (
            <Badge variant={grupo === "com_limite" ? "default" : "secondary"}>
              {ROTULO_GRUPO[grupo]}
            </Badge>
          ) : (
            <Badge variant="outline">Sem lançamento</Badge>
          )}
          {limite?.origem ? (
            <span className="text-xs text-muted-foreground">
              {limite.origem === "api" ? "automático" : "manual"}
            </span>
          ) : null}
        </div>
        {limite?.status_mercado && (
          <p className="text-sm text-muted-foreground">
            {rotuloStatusMercado(limite.status_mercado)}
            {limite.limite_total != null ? ` · ${moeda(Number(limite.limite_total))}` : ""}
            {limite.taxa != null ? ` · taxa ${Number(limite.taxa).toFixed(2).replace(".", ",")}%` : ""}
          </p>
        )}
        {limite?.mensagem && <p className="text-xs text-muted-foreground">{limite.mensagem}</p>}
        {config.observacao && (
          <p className="text-xs text-amber-700">{config.observacao}</p>
        )}
        {limite?.data_ultimo_cadastro && (
          <p className={`text-xs ${vencido ? "text-amber-700" : "text-muted-foreground"}`}>
            Último cadastro: {dataCurta(limite.data_ultimo_cadastro)}
            {vencido ? " — cadastro com mais de 6 meses, peça atualização." : ""}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onEditar}>
        {limite?.status_mercado ? "Editar" : "Lançar"}
      </Button>
    </div>
  );
}

function EdicaoDialog({
  aberta,
  config,
  limite,
  onFechar,
  onSalvar,
  salvando,
}: {
  aberta: boolean;
  config: SeguradoraConfig | null;
  limite: LimiteLinha | undefined;
  onFechar: () => void;
  onSalvar: (valores: ValoresLimiteManual) => void;
  salvando: boolean;
}) {
  const [status, setStatus] = useState<string>(limite?.status_mercado ?? "aprovado");
  const [limiteTotal, setLimiteTotal] = useState<number | null>(
    limite?.limite_total != null ? Number(limite.limite_total) : null,
  );
  const [taxa, setTaxa] = useState<string>(limite?.taxa != null ? String(limite.taxa) : "");
  const [cadastro, setCadastro] = useState<string>(limite?.data_ultimo_cadastro ?? "");
  const [nomeacao, setNomeacao] = useState<string>(limite?.nomeacao ?? "livre");
  const [observacao, setObservacao] = useState<string>(limite?.mensagem ?? "");

  if (!config) return null;

  return (
    <Dialog open={aberta} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{config.rotulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_MERCADO.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Limite total</Label>
              <CampoReal valor={limiteTotal} onChange={setLimiteTotal} />
            </div>
            <div className="space-y-1">
              <Label>Taxa (%)</Label>
              <Input value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data do último cadastro</Label>
              <Input type="date" value={cadastro} onChange={(e) => setCadastro(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nomeação</Label>
              <Select value={nomeacao} onValueChange={setNomeacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="livre">Livre</SelectItem>
                  <SelectItem value="nomeado_outro">Nomeado com outro corretor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={salvando}
            onClick={() =>
              onSalvar({
                status_mercado: status,
                limite_total: limiteTotal,
                taxa: taxa.trim() ? Number(taxa.replace(",", ".")) : null,
                data_ultimo_cadastro: cadastro || null,
                nomeacao,
                mensagem: observacao.trim() || null,
              })
            }
          >
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AbaLimites({ demanda }: { demanda: DemandaLista }) {
  const { data: config = [] } = useSeguradorasConfig();
  const { data: consulta } = useConsultaAtual(demanda.cliente_id, true);
  const { data: limites = [] } = useLimitesDaConsulta(consulta?.id ?? null);
  const consultar = useConsultarMercado();
  const abrirManual = useAbrirConsultaManual();
  const salvar = useSalvarLimiteManual();
  const salvarTudo = useSalvarLimitesEmLote();
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);

  const [emEdicao, setEmEdicao] = useState<string | null>(null);

  const porChave = useMemo(
    () => new Map(limites.map((l) => [l.chave_mercado, l])),
    [limites],
  );
  const resumo = useMemo(() => resumirConsulta(config, limites, demanda.importancia_segurada), [config, limites, demanda.importancia_segurada]);

  const comApi = config.filter((c) => c.identificador_api && c.ativa_garantia);
  const comPortalSemApi = config.filter((c) => c.tem_portal && !c.identificador_api);
  const semPortal = config.filter((c) => !c.tem_portal);

  const valida = consulta ? new Date(consulta.valida_ate).getTime() > Date.now() : false;
  const [semPortalAberto, setSemPortalAberto] = useState(false);

  const disparar = async (forcar: boolean) => {
    const r = await consultar.mutateAsync({ demandaId: demanda.id, forcar });
    if (!r.ok) {
      toast.error(MENSAGENS_ERRO[r.erro] ?? r.mensagem ?? "Não foi possível consultar o mercado.");
      return;
    }
    toast.success(
      r.reaproveitada
        ? "Consulta válida reaproveitada — nada foi reconsultado."
        : "Consulta a mercado concluída.",
    );
  };

  const configEmEdicao = config.find((c) => c.chave_mercado === emEdicao) ?? null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da consulta */}
      <div className="rounded-md border p-3 text-sm">
        {consulta ? (
          <div className="space-y-1">
            <p>
              Consultada em {dataHora(consulta.consultada_em)} · vale até{" "}
              {dataCurta(consulta.valida_ate)}
              {valida ? ` (${Math.max(0, diasRestantes(consulta.valida_ate))} dias restantes)` : ""}
            </p>
            <p className="text-muted-foreground">
              Origem: {consulta.origem === "api" ? "API" : consulta.origem === "manual" ? "manual" : "misto"} ·{" "}
              {resumo.completa
                ? "consulta completa"
                : `faltam ${resumo.faltantes.length} das 18 com portal`}
            </p>
            {!valida && (
              <p className="font-medium text-amber-700">
                Consulta vencida — ela vale 12 meses. Refaça antes de avançar a demanda.
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Nenhuma consulta a mercado registrada para este cliente.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {!valida && (
            <Button size="sm" disabled={consultar.isPending} onClick={() => disparar(false)}>
              {consultar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Consultar mercado
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={consultar.isPending}
            onClick={() => disparar(true)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar agora
          </Button>
          {!consulta && (
            <Button
              size="sm"
              variant="ghost"
              disabled={abrirManual.isPending}
              onClick={async () => {
                await abrirManual.mutateAsync({ clienteId: demanda.cliente_id, demandaId: demanda.id });
                toast.success("Consulta manual aberta. Lance as seguradoras abaixo.");
              }}
            >
              Lançar tudo à mão
            </Button>
          )}
        </div>
      </div>

      {/* Resumo em três grupos */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md border p-2">
          <p className="text-lg font-semibold text-[#338B85]">{resumo.total_com_limite}</p>
          <p className="text-muted-foreground">Com limite</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-lg font-semibold">{resumo.total_sem_limite}</p>
          <p className="text-muted-foreground">Sem limite</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-lg font-semibold">{resumo.total_nao_consultado}</p>
          <p className="text-muted-foreground">Não consultado</p>
        </div>
      </div>
      <p className="text-sm">
        Capacidade total das que têm limite: <strong>{moeda(resumo.capacidade_total)}</strong>
      </p>

      {resumo.exige_cadastro === null ? (
        <p className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
          A decisão de exigir cadastro depende da importância segurada, que ainda não foi preenchida
          na aba Dados. Até lá, nada é concluído.
        </p>
      ) : resumo.exige_cadastro && limites.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Nenhuma seguradora com portal tem limite disponível que cubra sozinha{" "}
            {moeda(resumo.importancia_segurada)}. O cadastro passa a ser exigido: na etapa Cadastro
            dá para seguir com documentos, cosseguro ou dispensa justificada.
          </p>
        </div>
      ) : resumo.cobrem_sozinhas.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Cobrem sozinhas a IS: {resumo.cobrem_sozinhas.join(", ")}. Cadastro não exigido.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={salvarTudo.isPending || !consulta}
          onClick={async () => {
            if (!consulta) return;
            try {
              await salvarTudo.mutateAsync({ consultaId: consulta.id, demandaId: demanda.id });
              setSalvoEm(new Date());
              toast.success("Limites salvos.");
            } catch (e) {
              toast.error(mensagemDeErro(e));
            }
          }}
        >
          {salvarTudo.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {salvarTudo.isPending ? "Salvando…" : "Salvar limites"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {salvarTudo.isPending
            ? "Gravando todos os lançamentos manuais…"
            : salvoEm
              ? `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : null}
        </span>
      </div>

      <Separator />

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-[#14405C]">
          Com API ({comApi.length}) — preenchidas automaticamente
        </h4>
        {comApi.map((c) => (
          <LinhaSeguradora
            key={c.chave_mercado}
            config={c}
            limite={porChave.get(c.chave_mercado)}
            onEditar={() => setEmEdicao(c.chave_mercado)}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-[#14405C]">
          Com portal, sem API ({comPortalSemApi.length}) — lançamento manual obrigatório
        </h4>
        {comPortalSemApi.map((c) => (
          <LinhaSeguradora
            key={c.chave_mercado}
            config={c}
            limite={porChave.get(c.chave_mercado)}
            onEditar={() => setEmEdicao(c.chave_mercado)}
          />
        ))}
      </section>

      <section className="space-y-2">
        <button
          type="button"
          className="text-sm font-semibold text-[#14405C] underline-offset-2 hover:underline"
          onClick={() => setSemPortalAberto((v) => !v)}
        >
          {semPortalAberto ? "▾" : "▸"} Sem portal ({semPortal.length}) — lançamento opcional
        </button>
        {semPortalAberto &&
          semPortal.map((c) => (
            <LinhaSeguradora
              key={c.chave_mercado}
              config={c}
              limite={porChave.get(c.chave_mercado)}
              onEditar={() => setEmEdicao(c.chave_mercado)}
            />
          ))}
      </section>

      {configEmEdicao && (
        <EdicaoDialog
          key={configEmEdicao.chave_mercado}
          aberta={!!emEdicao}
          config={configEmEdicao}
          limite={porChave.get(configEmEdicao.chave_mercado)}
          salvando={salvar.isPending}
          onFechar={() => setEmEdicao(null)}
          onSalvar={async (valores) => {
            setSalvoEm(null);
            let consultaId = consulta?.id;
            if (!consultaId) {
              consultaId = await abrirManual.mutateAsync({
                clienteId: demanda.cliente_id,
                demandaId: demanda.id,
              });
            }
            try {
              await salvar.mutateAsync({
                consultaId,
                clienteId: demanda.cliente_id,
                demandaId: demanda.id,
                chaveMercado: configEmEdicao.chave_mercado,
                valores,
              });
              setEmEdicao(null);
              toast.success("Limite registrado.");
              setSalvoEm(new Date());
            } catch (e) {
              toast.error(mensagemDeErro(e));
            }
          }}
        />
      )}
    </div>
  );
}
