// Aba "Documentos" do detalhe da demanda.
//
// Nada é apagado: versão nova supera a anterior, que fica recolhida e marcada
// como substituída. O bucket é privado — todo download é por URL assinada de
// 60 segundos. Os anexos do formulário judicial aparecem como somente leitura
// e apontam para o bucket de origem, sem cópia.

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/erro";
import { ConfirmarExclusaoDialog } from "@/components/garantia/confirmar-exclusao";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  baixarDocumento,
  useAnalisesDaDemanda,
  useDocumentosDaDemanda,
  useEnviarDocumento,
  useVincularAnexosJudiciais,
  type DocumentoDemanda,
} from "@/hooks/use-garantia-documentos";
import { totalCosseguro, useAtualizarDemanda, type DemandaLista } from "@/hooks/use-garantia-negociacao";
import {
  ROTULO_GRUPO_DOC,
  TAMANHO_MAXIMO_BYTES,
  pendenciasDaDemanda,
  perguntaIA,
  podeAnalisarPorIA,
  rotuloTipoDocumento,
  tiposDaEntrada,
  tiposDisponiveis,
  type GrupoDocumento,
} from "@/lib/garantia/documentos-regra";
import { dataHora } from "@/lib/garantia/formato";

function tamanhoLegivel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function DefinirTipoDocumento({ doc, produto }: { doc: DocumentoDemanda; produto: string }) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  return (
    <Select
      disabled={salvando}
      onValueChange={async (v) => {
        setSalvando(true);
        try {
          // substituido_por_id volta a nulo: o arquivo deixa de ser uma versão de "outro"
          // e passa a contar como documento do tipo escolhido.
          const { error } = await supabase
            .from("garantia_documentos")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ tipo: v, substituido_por_id: null } as any)
            .eq("id", doc.id);
          if (error) throw error;
          toast.success("Tipo definido.");
          qc.invalidateQueries({ queryKey: ["garantia", "documentos"] });
          qc.invalidateQueries({ queryKey: ["garantia", "analises-ia"] });
          qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
          qc.invalidateQueries({ queryKey: ["garantia", "fila-comercial"] });
          qc.invalidateQueries({ queryKey: ["garantia-painel"] });
        } catch (e) {
          toast.error(mensagemDeErro(e, "Não foi possível definir o tipo."));
        } finally {
          setSalvando(false);
        }
      }}
    >
      <SelectTrigger className="h-8 w-48">
        <SelectValue placeholder="Definir tipo" />
      </SelectTrigger>
      <SelectContent>
        {tiposDaEntrada(produto)
          .filter((t) => t.valor !== "outro")
          .map((t) => (
            <SelectItem key={t.valor} value={t.valor}>
              {t.rotulo}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function ItemDocumento({
  doc,
  substituido,
  produto,
}: {
  doc: DocumentoDemanda;
  substituido: boolean;
  produto?: string;
}) {
  const [baixando, setBaixando] = useState(false);
  const [desanexarAberto, setDesanexarAberto] = useState(false);
  const [desanexando, setDesanexando] = useState(false);
  const qc = useQueryClient();
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={substituido ? "text-muted-foreground line-through" : "font-medium"}>
            {doc.nome_arquivo}
          </span>
          <Badge variant="outline">v{doc.versao}</Badge>
          {substituido && <Badge variant="secondary">substituída</Badge>}
          {doc.tipo === "outro" && doc.externo !== true && produto && (
            <DefinirTipoDocumento doc={doc} produto={produto} />
          )}
          {doc.externo && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> fluxo judicial · somente leitura
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {dataHora(doc.criado_em)}
          {doc.tamanho_bytes ? ` · ${tamanhoLegivel(doc.tamanho_bytes)}` : ""}
        </p>
        {doc.observacao && <p className="text-xs text-muted-foreground">{doc.observacao}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={baixando}
        onClick={async () => {
          setBaixando(true);
          try {
            await baixarDocumento(doc);
          } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível baixar."));
          } finally {
            setBaixando(false);
          }
        }}
      >
        {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>
      {doc.id && (
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          aria-label="Desanexar"
          title="Desanexar"
          onClick={() => setDesanexarAberto(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      </div>
      <ConfirmarExclusaoDialog
        aberto={desanexarAberto}
        titulo={`Desanexar “${doc.nome_arquivo}”?`}
        descricao="O documento sai deste card. O arquivo fica guardado para auditoria. Se houver uma versão anterior, ela volta a valer."
        rotuloConfirmar="Desanexar"
        pendente={desanexando}
        onFechar={() => setDesanexarAberto(false)}
        onConfirmar={async (motivo) => {
          setDesanexando(true);
          try {
            const { error } = await (supabase as any).rpc("rpc_garantia_desanexar_documento", {
              _documento_id: doc.id,
              _motivo: motivo,
            });
            if (error) throw error;
            toast.success("Documento desanexado.");
            qc.invalidateQueries({ queryKey: ["garantia", "documentos"] });
            qc.invalidateQueries({ queryKey: ["garantia", "analises-ia"] });
            qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
            setDesanexarAberto(false);
          } catch (e) {
            toast.error(mensagemDeErro(e));
          } finally {
            setDesanexando(false);
          }
        }}
      />
    </div>
  );
}

function TresEstados({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-normal">{rotulo}</Label>
      <Select
        value={valor === null ? "nao_respondido" : valor ? "sim" : "nao"}
        onValueChange={(v) => onChange(v === "nao_respondido" ? null : v === "sim")}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nao_respondido">Não respondido</SelectItem>
          <SelectItem value="sim">Sim</SelectItem>
          <SelectItem value="nao">Não</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function AbaDocumentos({
  demanda,
  tipoInicial,
  ocultarIA = false,
}: {
  demanda: DemandaLista;
  /** Tipo pré-selecionado (a etapa 7 abre a aba já com "Minuta" escolhida). */
  tipoInicial?: string;
  /** O fluxo focado reserva a IA para a próxima rodada, sem remover a função existente da aba secundária. */
  ocultarIA?: boolean;
}) {
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const { data: analises = [] } = useAnalisesDaDemanda(demanda.id);
  const enviar = useEnviarDocumento(demanda.id);
  const vincular = useVincularAnexosJudiciais(demanda.id, demanda.solicitacao_id);
  const atualizar = useAtualizarDemanda();

  const [tipo, setTipo] = useState<string>(tipoInicial ?? "");
  const [comIA, setComIA] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const vinculouRef = useRef(false);

  // Referencia os anexos do formulário judicial na primeira abertura. Nenhum
  // arquivo é copiado, movido ou renomeado no bucket de origem.
  useEffect(() => {
    if (!demanda.solicitacao_id || vinculouRef.current) return;
    vinculouRef.current = true;
    vincular.mutate(undefined, { onError: () => undefined });
  }, [demanda.solicitacao_id, vincular]);

  const tipos = useMemo(
    () => tiposDisponiveis(demanda.produto, demanda.fase),
    [demanda.produto, demanda.fase],
  );

  const porTipo = useMemo(() => {
    const mapa = new Map<string, DocumentoDemanda[]>();
    for (const d of docs) {
      const lista = mapa.get(d.tipo) ?? [];
      lista.push(d);
      mapa.set(d.tipo, lista);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => b.versao - a.versao);
    return mapa;
  }, [docs]);

  const tiposPresentes = useMemo(
    () => new Set(docs.filter((d) => !d.substituido_por_id).map((d) => d.tipo)),
    [docs],
  );

  const pendencias = useMemo(
    () =>
      pendenciasDaDemanda(
        {
          produto: demanda.produto,
          exige_cadastro: demanda.exige_cadastro,
          balancos_assinados: demanda.balancos_assinados,
          dre_assinados: demanda.dre_assinados,
          precisa_nomeacao: demanda.precisa_nomeacao,
          precisa_ccg: demanda.precisa_ccg,
          importancia_segurada: demanda.importancia_segurada,
          cosseguro_total: totalCosseguro(demanda),
          cadastro_dispensado_motivo: demanda.cadastro_dispensado_motivo,
        },
        tiposPresentes,
      ),
    [demanda, tiposPresentes],
  );

  const salvarCampo = (campo: string, valor: boolean | null) =>
    atualizar.mutate(
      { id: demanda.id, valores: { [campo]: valor } },
      { onError: () => toast.error("Não foi possível salvar a resposta.") },
    );

  const enviarArquivo = async (arquivo: File) => {
    if (!tipo) {
      toast.error("Escolha o tipo do documento antes de enviar.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      toast.error("O arquivo passa de 20 MB, que é o teto por anexo. Reduza ou divida o documento.");
      return;
    }
    try {
      const doc = await enviar.mutateAsync({
        arquivo,
        tipo,
        produto: demanda.produto,
        solicitarIA: comIA,
      });
      toast.success(`Documento anexado como versão ${doc.versao}.`);
      setComIA(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    }
  };

  const grupos: GrupoDocumento[] = ["origem", "cadastro", "apolice"];

  return (
    <div className="space-y-5 text-sm">
      {/* Envio */}
      <div className="space-y-3 rounded-md border p-3">
        <div className="space-y-1">
          <Label>Tipo do documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Escolha o tipo" />
            </SelectTrigger>
            <SelectContent>
              {grupos.map((g) => {
                const itens = tipos.filter((t) => t.grupo === g);
                if (!itens.length) return null;
                return (
                  <SelectGroup key={g}>
                    <SelectLabel>{ROTULO_GRUPO_DOC[g]}</SelectLabel>
                    {itens.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const arquivo = e.dataTransfer.files?.[0];
            if (arquivo) void enviarArquivo(arquivo);
          }}
          className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center ${
            arrastando ? "border-[#338B85] bg-[#338B85]/5" : "border-border"
          }`}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground">
            Arraste o arquivo aqui ou escolha no computador. Até 20 MB por arquivo.
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void enviarArquivo(arquivo);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={enviar.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Escolher arquivo
          </Button>
        </div>

        {!ocultarIA && podeAnalisarPorIA(tipo) && (
          <label className="flex items-start gap-2">
            <Checkbox checked={comIA} onCheckedChange={(v) => setComIA(v === true)} />
            <span>
              {perguntaIA(tipo)}
              <span className="block text-xs text-muted-foreground">
                O pedido fica registrado e pode ser aberto na etapa de análise da demanda.
              </span>
            </span>
          </label>
        )}
      </div>

      {/* Pedidos de análise */}
      {analises.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-semibold text-[#14405C]">Análise por IA</h4>
          {analises.map((a) => (
            <p key={a.id} className="text-muted-foreground">
              {a.situacao === "solicitada"
                ? "Análise solicitada — abra a etapa de análise da demanda para iniciar."
                : `Situação: ${a.situacao}`}{" "}
              · {dataHora(a.criado_em)}
              {a.aplicada ? " · campos aplicados na demanda" : ""}
            </p>
          ))}
        </div>
      )}

      <Separator />

      {/* Painel de conferência */}
      <div className="space-y-3 rounded-md border p-3">
        <h4 className="font-semibold text-[#14405C]">Conferência de documentos</h4>

        {demanda.exige_cadastro && (
          <div className="flex flex-wrap gap-4">
            <TresEstados
              rotulo="Os balanços estão assinados tanto pelo representante legal quanto pelo contador?"
              valor={demanda.balancos_assinados}
              onChange={(v) => salvarCampo("balancos_assinados", v)}
            />
            <TresEstados
              rotulo="Os DRE estão assinados tanto pelo representante legal quanto pelo contador?"
              valor={demanda.dre_assinados}
              onChange={(v) => salvarCampo("dre_assinados", v)}
            />
          </div>
        )}

        {!['1', '2', '3'].includes(demanda.etapa) && (
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={demanda.precisa_nomeacao}
                onCheckedChange={(v) => salvarCampo("precisa_nomeacao", v === true)}
              />
              Esse caso precisa de nomeação?
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={demanda.precisa_ccg}
                onCheckedChange={(v) => salvarCampo("precisa_ccg", v === true)}
              />
              Esse caso precisa de CCG?
            </label>
          </div>
        )}

        {pendencias.length === 0 ? (
          <p className="text-[#338B85]">Nenhuma pendência de documento.</p>
        ) : (
          <ul className="space-y-1">
            {pendencias.map((p, i) => (
              <li key={i} className="rounded-md border-l-2 border-amber-400 pl-2">
                <span className="font-medium">
                  Etapa {p.etapa}: {p.texto}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {p.bloqueia ? "Impede o avanço — " : "Não impede o avanço — "}
                  {p.motivo}.
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      {/* Lista por tipo */}
      {porTipo.size === 0 ? (
        <p className="text-muted-foreground">Nenhum documento anexado ainda.</p>
      ) : (
        <div className="space-y-4">
          {[...porTipo.entries()].map(([t, lista]) => {
            if (t === "outro") {
              return (
                <section key={t} className="space-y-2">
                  <div>
                    <h4 className="font-semibold text-[#14405C]">Sem tipo definido</h4>
                    <p className="text-xs text-muted-foreground">Defina o tipo para contar nas pendências da fase.</p>
                  </div>
                  {lista.map((d) => (
                    <ItemDocumento key={d.id} doc={d} substituido={false} produto={demanda.produto} />
                  ))}
                </section>
              );
            }
            const [atual, ...anteriores] = lista;
            if (!atual) return null;
            const aberto = !!expandido[t];
            return (
              <section key={t} className="space-y-2">
                <h4 className="font-semibold text-[#14405C]">{rotuloTipoDocumento(t)}</h4>
                <ItemDocumento doc={atual} substituido={false} />
                {anteriores.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setExpandido((e) => ({ ...e, [t]: !aberto }))}
                    >
                      {aberto ? "Ocultar" : "Mostrar"} {anteriores.length} versão(ões) anterior(es) —
                      nada é apagado
                    </button>
                    {aberto &&
                      anteriores.map((d) => (
                        <ItemDocumento key={d.id} doc={d} substituido />
                      ))}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
