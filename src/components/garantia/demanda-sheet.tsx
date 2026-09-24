// Detalhe da demanda de Garantia: Dados · Origem · Histórico.
//
// Documentos, Limites e IA entram nas partes seguintes — aqui não há aba
// vazia esperando conteúdo.
//
// Corte de visibilidade: contagem de tempo e SLA são assunto da gerência.
// Sem `menu_garantia_painel` esses elementos simplesmente NÃO são
// renderizados (não são escondidos por CSS).

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Ban, Check, Loader2, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useResponsaveis } from "@/hooks/use-entrada-demandas";
import { AbaLimites } from "@/components/garantia/aba-limites";
import { AbaDocumentos } from "@/components/garantia/aba-documentos";
import { AbaCotacoes } from "@/components/garantia/aba-cotacoes";
import { AbaCuradoria } from "@/components/garantia/aba-curadoria";
import { AbaMinuta } from "@/components/garantia/aba-minuta";
import { AbaApolice } from "@/components/garantia/aba-apolice";
import { AnaliseContratoDialog } from "@/components/garantia/analise-contrato-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { TIPOS_IA_CONTRATO, fluxoDaSelecao, rotuloTipoDocumento as rotuloTipoDocIA } from "@/lib/garantia/documentos-regra";
import { BlocoRetornoCrm, MotivoDialog } from "@/components/garantia/retorno-crm";
import { SolicitarDocumentoComercial } from "@/components/garantia/solicitar-documento";
import {
  useAprovacoesMinuta,
  useCotacoes,
  useRegistrarAceite,
  useSeguradoDaDemanda,
} from "@/hooks/use-garantia-crm";
import { useAnalisesDaDemanda, useDocumentosDaDemanda, type DocumentoDemanda } from "@/hooks/use-garantia-documentos";
import {
  useConsultaAtual,
  useLimitesDaConsulta,
  useSeguradorasConfig,
} from "@/hooks/use-garantia-limites";


import {
  MOTIVOS_PERDA,
  impedimentoDaTransicao,
  colunasDoCatalogo,
  useAtualizarDemanda,
  useBuscaSegurados,
  useCompletarTriagem,
  useCriarSegurado,
  useHistoricoDemanda,
  useOrigemDaDemanda,
  useRegistrarPerda,
  useTrocarStatus,
  useVoltarEtapa,
  totalCosseguro,
  type DemandaLista,
  type StatusCatalogo,
} from "@/hooks/use-garantia-negociacao";
import { mensagemDeErro } from "@/lib/erro";
import { consultarCnpjEntrada } from "@/lib/entrada/entrada-cnpj.functions";
import { pendenciasDaDemanda } from "@/lib/garantia/documentos-regra";
import { BlocoCadastro } from "@/components/garantia/bloco-cadastro";
import { BlocoCocorretagem } from "@/components/garantia/bloco-cocorretagem";
import { AjudaFase } from "@/components/garantia/ajuda-fase";
import { fluxoIADoTipo } from "@/lib/garantia/documentos-regra";
import { supabase } from "@/integrations/supabase/client";
import type { AnaliseIA } from "@/lib/garantia/garantia-ia";
import { resumirConsulta } from "@/lib/garantia/limites-regra";
import {
  A_DEFINIR,
  MODALIDADES,
  ROTULO_PRODUTO,
  TIPOS_ALTERACAO,
  TIPOS_MOVIMENTO,
  dataCurta,
  dataHora,
  duracaoLegivel,
  moeda,
  rotuloEtapa,
  rotuloComQuem,
  rotuloModalidade,
} from "@/lib/garantia/formato";

const soDigitos = (v: string) => v.replace(/\D+/g, "");

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}

const ouDefinir = (v: string | null | undefined) =>
  v && v.trim() ? v : <span className="text-muted-foreground">{A_DEFINIR}</span>;

/* ------------------------------------------------------------------ */
/* Seletor de segurado / locador                                      */
/* ------------------------------------------------------------------ */

function SeletorSegurado({
  produto,
  seguradoId,
  seguradoNome,
  onEscolher,
}: {
  produto: string;
  seguradoId: string | null;
  seguradoNome: string | null;
  onEscolher: (id: string, nome: string, publicoPrivado: string | null) => void;
}) {
  const rotulo = produto === "fianca_locaticia" ? "Locador" : "Segurado";
  const [termo, setTermo] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const { data: achados = [], isFetching } = useBuscaSegurados(termo);

  return (
    <div className="space-y-2">
      <Label>{rotulo} *</Label>
      {seguradoId ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{seguradoNome}</span>
          <Button variant="ghost" size="sm" onClick={() => onEscolher("", "", null)}>
            Trocar
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={`Buscar ${rotulo.toLowerCase()} por nome ou documento`}
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setNovoAberto(true)}>
              Cadastrar novo
            </Button>
          </div>
          {isFetching && <p className="text-xs text-muted-foreground">Buscando…</p>}
          {achados.length > 0 && (
            <div className="max-h-44 space-y-1 overflow-auto rounded-md border border-border p-1">
              {achados.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onEscolher(s.id, s.nome, s.publico_privado);
                    setTermo("");
                  }}
                >
                  <span className="font-medium">{s.nome}</span>{" "}
                  <span className="text-muted-foreground">{s.cpf_cnpj}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <NovoSeguradoDialog
        aberto={novoAberto}
        rotulo={rotulo}
        onFechar={() => setNovoAberto(false)}
        onCriado={(s) => {
          onEscolher(s.id, s.nome, s.publico_privado);
          setNovoAberto(false);
        }}
      />
    </div>
  );
}

function NovoSeguradoDialog({
  aberto,
  rotulo,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  rotulo: string;
  onFechar: () => void;
  onCriado: (s: { id: string; nome: string; publico_privado: string | null }) => void;
}) {
  const [tipo, setTipo] = useState("PJ");
  const [doc, setDoc] = useState("");
  const [nome, setNome] = useState("");
  const [pubPriv, setPubPriv] = useState("privado");
  const [consultando, setConsultando] = useState(false);
  const criar = useCriarSegurado();

  const consultar = async () => {
    const digitos = soDigitos(doc);
    if (digitos.length !== 14) {
      toast.message("Informe um CNPJ com 14 dígitos para consultar.");
      return;
    }
    setConsultando(true);
    try {
      const r = await consultarCnpjEntrada({ data: { cnpj: digitos } });
      if (!r.ok) {
        const msgs: Record<string, string> = {
          sem_permissao: "Você não tem permissão para consultar o cadastro público.",
          nao_encontrado: "CNPJ não encontrado na base pública. Preencha os dados à mão.",
          indisponivel: "A consulta pública está indisponível agora. Preencha os dados à mão.",
          cnpj_invalido: "CNPJ inválido.",
        };
        toast.message(msgs[r.erro] ?? "Não foi possível consultar.");
        return;
      }
      setNome(r.cadastro.razao_social ?? nome);
    } finally {
      setConsultando(false);
    }
  };

  const salvar = async () => {
    if (!nome.trim() || !soDigitos(doc)) {
      toast.error("Nome e documento são obrigatórios.");
      return;
    }
    try {
      const s = await criar.mutateAsync({
        tipo_pessoa: tipo,
        cpf_cnpj: soDigitos(doc),
        nome: nome.trim(),
        publico_privado: pubPriv,
      });
      onCriado(s);
      setDoc("");
      setNome("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar {rotulo.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Com CNPJ, a consulta ao cadastro público preenche a razão social.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Público ou privado</Label>
              <Select value={pubPriv} onValueChange={setPubPriv}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publico">Público</SelectItem>
                  <SelectItem value="privado">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>CPF / CNPJ</Label>
            <div className="flex gap-2">
              <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Somente números" />
              {tipo === "PJ" && (
                <Button type="button" variant="outline" onClick={consultar} disabled={consultando}>
                  {consultando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar"}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nome / razão social</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={criar.isPending}>
            {criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Completar triagem                                                  */
/* ------------------------------------------------------------------ */

function TriagemDialog({
  aberto,
  demanda,
  onFechar,
}: {
  aberto: boolean;
  demanda: DemandaLista;
  onFechar: () => void;
}) {
  const locaticia = demanda.produto === "fianca_locaticia";
  const { data: pessoas = [] } = useResponsaveis();
  const completar = useCompletarTriagem();

  const [seguradoId, setSeguradoId] = useState<string | null>(demanda.segurado_id);
  const [seguradoNome, setSeguradoNome] = useState<string | null>(demanda.segurado?.nome ?? null);
  const [pubPriv, setPubPriv] = useState(demanda.publico_privado ?? "");
  const [modalidade, setModalidade] = useState(demanda.modalidade ?? (locaticia ? "locaticia" : ""));
  const [movimento, setMovimento] = useState(demanda.tipo_movimento ?? "novo");
  const [alteracao, setAlteracao] = useState(demanda.tipo_alteracao ?? "");
  const [is, setIs] = useState(demanda.importancia_segurada?.toString() ?? "");
  const [pct, setPct] = useState(demanda.percentual_garantia?.toString() ?? "");
  const [objeto, setObjeto] = useState(demanda.objeto ?? "");
  const [vigencia, setVigencia] = useState(demanda.vigencia_exigida ?? "");
  const [respTecnico, setRespTecnico] = useState(demanda.responsavel_tecnico_id ?? "");

  const salvar = async () => {
    if (!seguradoId) {
      toast.error(`Informe o ${locaticia ? "locador" : "segurado"} para fechar a triagem.`);
      return;
    }
    if (!is.trim()) {
      toast.error("A importância segurada é obrigatória.");
      return;
    }
    if (movimento === "endosso" && !alteracao) {
      toast.error("Endosso precisa do tipo de alteração.");
      return;
    }
    try {
      await completar.mutateAsync({
        id: demanda.id,
        dados: {
          segurado_id: seguradoId,
          publico_privado: pubPriv || null,
          modalidade: locaticia ? "locaticia" : modalidade || null,
          tipo_movimento: movimento || null,
          tipo_alteracao: movimento === "endosso" ? alteracao || null : null,
          importancia_segurada: Number(is.replace(",", ".")),
          percentual_garantia: pct.trim() ? Number(pct.replace(",", ".")) : null,
          objeto: objeto.trim() || null,
          vigencia_exigida: vigencia.trim() || null,
          // Data limite vem da leitura do edital e o responsável pelo cliente
          // é copiado do cadastro na criação; os dois ficam na aba Dados.
          responsavel_tecnico_id: respTecnico || null,
        },
      });
      toast.success("Conferência concluída. Para mudar de etapa, use “Mover card para fase”.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a triagem.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Completar triagem</DialogTitle>
          <DialogDescription>
            Os dados vindos da Entrada aparecem só para conferência: quem corrige a entrada é a
            tela de Entrada de Demandas.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <Linha rotulo="Cliente" valor={demanda.cliente?.nome ?? A_DEFINIR} />
          <Linha rotulo="Chegada" valor={dataHora(demanda.chegada_em)} />
          <Linha rotulo="Canal" valor={demanda.canal?.nome ?? A_DEFINIR} />
          <Linha rotulo="Produto" valor={ROTULO_PRODUTO[demanda.produto] ?? demanda.produto} />
        </div>

        <div className="space-y-4">
          <SeletorSegurado
            produto={demanda.produto}
            seguradoId={seguradoId}
            seguradoNome={seguradoNome}
            onEscolher={(id, nome, pp) => {
              setSeguradoId(id || null);
              setSeguradoNome(nome || null);
              if (pp) setPubPriv(pp);
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Segurado público ou privado</Label>
              <Select value={pubPriv} onValueChange={setPubPriv}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publico">Público</SelectItem>
                  <SelectItem value="privado">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Modalidade</Label>
              {locaticia ? (
                <Input value="Locatícia" readOnly disabled />
              ) : (
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Tipo de movimento</Label>
              <Select value={movimento} onValueChange={setMovimento}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MOVIMENTO.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {movimento === "endosso" && (
              <div className="space-y-1">
                <Label>Tipo de alteração</Label>
                <Select value={alteracao} onValueChange={setAlteracao}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_ALTERACAO.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Apólice anterior (renovação/endosso) fica preparada no banco, mas
                sem seletor: a tela de apólice ainda não existe e um seletor
                quebrado é pior que um campo ausente. */}
            <div className="space-y-1">
              <Label>Importância segurada *</Label>
              <Input value={is} onChange={(e) => setIs(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>% de garantia sobre o contrato</Label>
              <Input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Opcional" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Vigência exigida</Label>
              <Input value={vigencia} onChange={(e) => setVigencia(e.target.value)} placeholder="Ex.: 24 meses" />
            </div>
            <div className="space-y-1">
              <Label>Responsável técnico</Label>
              <Select value={respTecnico} onValueChange={setRespTecnico}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pessoas.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Objeto</Label>
            <Textarea value={objeto} onChange={(e) => setObjeto(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={completar.isPending}>
            {completar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Concluir triagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Registrar perda                                                    */
/* ------------------------------------------------------------------ */

function PerdaDialog({
  aberto,
  demanda,
  onFechar,
}: {
  aberto: boolean;
  demanda: DemandaLista;
  onFechar: () => void;
}) {
  const registrar = useRegistrarPerda();
  const [motivo, setMotivo] = useState("");
  const [premio, setPremio] = useState(demanda.premio_estimado?.toString() ?? "");
  const [comissao, setComissao] = useState(demanda.comissao_estimada?.toString() ?? "");
  const [concorrente, setConcorrente] = useState("");
  const [retomar, setRetomar] = useState("");
  const [obs, setObs] = useState("");

  const salvar = async () => {
    if (!motivo) {
      toast.error("O motivo da perda é obrigatório.");
      return;
    }
    try {
      await registrar.mutateAsync({
        demanda,
        perda: {
          motivo,
          premio_estimado: premio.trim() ? Number(premio.replace(",", ".")) : null,
          comissao_estimada: comissao.trim() ? Number(comissao.replace(",", ".")) : null,
          concorrente: concorrente.trim() || null,
          data_retomar: retomar || null,
          observacao: obs.trim() || null,
        },
      });
      toast.success("Perda registrada. A demanda continua no Hub, agora como perdida.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a perda.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar perda</DialogTitle>
          <DialogDescription>
            Nada é apagado: a demanda passa para a fase perdida e pode ser reaberta depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <Linha rotulo="Etapa perdida" valor={rotuloEtapa(demanda.etapa)} />
            <Linha rotulo="Status perdido" valor={demanda.status_atual} />
          </div>
          <div className="space-y-1">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_PERDA.map((m) => (
                  <SelectItem key={m.codigo} value={m.codigo}>{m.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Prêmio estimado</Label>
              <Input value={premio} onChange={(e) => setPremio(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Comissão estimada</Label>
              <Input value={comissao} onChange={(e) => setComissao(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Concorrente</Label>
              <Input value={concorrente} onChange={(e) => setConcorrente(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tentar de novo em</Label>
              <Input type="date" value={retomar} onChange={(e) => setRetomar(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button variant="destructive" onClick={salvar} disabled={registrar.isPending}>
            {registrar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Legenda editável                                                   */
/* ------------------------------------------------------------------ */

function EditorLegenda({ demanda }: { demanda: DemandaLista }) {
  const atualizar = useAtualizarDemanda();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(demanda.legenda ?? "");

  useEffect(() => {
    setValor(demanda.legenda ?? "");
    setEditando(false);
  }, [demanda.id, demanda.legenda]);

  const atalhos = [
    { rotulo: demanda.produto === "fianca_locaticia" ? "Locador" : "Segurado", texto: demanda.segurado?.nome },
    { rotulo: "Nº do processo", texto: demanda.numero_processo },
    { rotulo: "Nº do contrato", texto: demanda.numero_contrato },
  ].filter((a): a is { rotulo: string; texto: string } => !!a.texto?.trim());

  const acrescentar = (t: string) => {
    setEditando(true);
    setValor((v) => (v.trim() ? `${v} · ${t.trim()}` : t.trim()));
  };

  const salvar = async () => {
    if (!valor.trim()) {
      toast.error("A legenda não pode ficar vazia.");
      return;
    }
    try {
      await atualizar.mutateAsync({ id: demanda.id, valores: { legenda: valor.trim() } });
      toast.success("Legenda atualizada.");
      setEditando(false);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  };

  const restaurar = async () => {
    try {
      await atualizar.mutateAsync({ id: demanda.id, valores: { legenda_manual: false } });
      toast.success("Legenda restaurada para o padrão.");
      setEditando(false);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  };

  return (
    <div className="min-w-0">
      {!editando ? (
        <Button size="icon" variant="ghost" onClick={() => setEditando(true)} aria-label="Editar legenda">
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <div className="mt-3 min-w-0 space-y-2 rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Legenda</Label>
            <span className="text-xs text-muted-foreground">{demanda.numero}</span>
          </div>
          <div className="flex min-w-0 gap-2">
        <Input
          className="min-w-0 flex-1"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
          <Button size="icon" onClick={salvar} disabled={atualizar.isPending} aria-label="Salvar legenda">
            {atualizar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Cancelar"
            onClick={() => {
              setValor(demanda.legenda ?? "");
              setEditando(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {atalhos.map((a) => (
              <Button key={a.rotulo} size="sm" variant="outline" onClick={() => acrescentar(a.texto)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {a.rotulo}
              </Button>
            ))}
            {demanda.legenda_manual && (
              <Button size="sm" variant="ghost" onClick={restaurar} disabled={atualizar.isPending}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Restaurar padrão
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {demanda.legenda_manual
              ? "Legenda editada à mão: ela não se atualiza mais sozinha. Use Restaurar padrão para voltar a número · cliente."
              : "Legenda padrão (número · cliente), atualizada sozinha. Ao editar à mão, ela deixa de se atualizar."}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aba Dados (edição)                                                 */
/* ------------------------------------------------------------------ */

function AbaDados({ demanda }: { demanda: DemandaLista }) {
  const { data: pessoas = [] } = useResponsaveis();
  const atualizar = useAtualizarDemanda();
  const locaticia = demanda.produto === "fianca_locaticia";

  const [f, setF] = useState({
    modalidade: demanda.modalidade ?? "",
    publico_privado: demanda.publico_privado ?? "",
    tipo_movimento: demanda.tipo_movimento ?? "",
    tipo_alteracao: demanda.tipo_alteracao ?? "",
    importancia_segurada: demanda.importancia_segurada?.toString() ?? "",
    percentual_garantia: demanda.percentual_garantia?.toString() ?? "",
    objeto: demanda.objeto ?? "",
    vigencia_exigida: demanda.vigencia_exigida ?? "",
    data_limite: demanda.data_limite ?? "",
    responsavel_cliente_id: demanda.responsavel_cliente_id ?? "",
    responsavel_tecnico_id: demanda.responsavel_tecnico_id ?? "",
    premio_estimado: demanda.premio_estimado?.toString() ?? "",
    comissao_estimada: demanda.comissao_estimada?.toString() ?? "",
    observacao: demanda.observacao ?? "",
    numero_processo: demanda.numero_processo ?? "",
    numero_contrato: demanda.numero_contrato ?? "",
  });

  useEffect(() => {
    setF({
      modalidade: demanda.modalidade ?? "",
      publico_privado: demanda.publico_privado ?? "",
      tipo_movimento: demanda.tipo_movimento ?? "",
      tipo_alteracao: demanda.tipo_alteracao ?? "",
      importancia_segurada: demanda.importancia_segurada?.toString() ?? "",
      percentual_garantia: demanda.percentual_garantia?.toString() ?? "",
      objeto: demanda.objeto ?? "",
      vigencia_exigida: demanda.vigencia_exigida ?? "",
      data_limite: demanda.data_limite ?? "",
      responsavel_cliente_id: demanda.responsavel_cliente_id ?? "",
      responsavel_tecnico_id: demanda.responsavel_tecnico_id ?? "",
      premio_estimado: demanda.premio_estimado?.toString() ?? "",
      comissao_estimada: demanda.comissao_estimada?.toString() ?? "",
      observacao: demanda.observacao ?? "",
      numero_processo: demanda.numero_processo ?? "",
      numero_contrato: demanda.numero_contrato ?? "",
    });
  }, [demanda]);

  const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

  const salvar = async () => {
    try {
      await atualizar.mutateAsync({
        id: demanda.id,
        valores: {
          modalidade: locaticia ? "locaticia" : f.modalidade || null,
          publico_privado: f.publico_privado || null,
          tipo_movimento: f.tipo_movimento || null,
          tipo_alteracao: f.tipo_movimento === "endosso" ? f.tipo_alteracao || null : null,
          importancia_segurada: num(f.importancia_segurada),
          percentual_garantia: num(f.percentual_garantia),
          objeto: f.objeto.trim() || null,
          vigencia_exigida: f.vigencia_exigida.trim() || null,
          data_limite: f.data_limite || null,
          responsavel_cliente_id: f.responsavel_cliente_id || null,
          responsavel_tecnico_id: f.responsavel_tecnico_id || null,
          premio_estimado: num(f.premio_estimado),
          comissao_estimada: num(f.comissao_estimada),
          observacao: f.observacao.trim() || null,
          numero_processo: f.numero_processo.trim() || null,
          numero_contrato: f.numero_contrato.trim() || null,
        },
      });
      toast.success("Dados da demanda atualizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/40 p-3">
        <Linha rotulo="Cliente" valor={demanda.cliente?.nome ?? A_DEFINIR} />
        <Linha
          rotulo={locaticia ? "Locador" : "Segurado"}
          valor={ouDefinir(demanda.segurado?.nome ?? null)}
        />
        <Linha rotulo="Produto" valor={ROTULO_PRODUTO[demanda.produto] ?? demanda.produto} />
        <Linha rotulo="Etapa" valor={rotuloEtapa(demanda.etapa)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Modalidade</Label>
          {locaticia ? (
            <Input value="Locatícia" readOnly disabled />
          ) : (
            <Select value={f.modalidade} onValueChange={(v) => setF({ ...f, modalidade: v })}>
              <SelectTrigger><SelectValue placeholder={A_DEFINIR} /></SelectTrigger>
              <SelectContent>
                {MODALIDADES.map((m) => (
                  <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1">
          <Label>Segurado público ou privado</Label>
          <Select value={f.publico_privado} onValueChange={(v) => setF({ ...f, publico_privado: v })}>
            <SelectTrigger><SelectValue placeholder={A_DEFINIR} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="publico">Público</SelectItem>
              <SelectItem value="privado">Privado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tipo de movimento</Label>
          <Select value={f.tipo_movimento} onValueChange={(v) => setF({ ...f, tipo_movimento: v })}>
            <SelectTrigger><SelectValue placeholder={A_DEFINIR} /></SelectTrigger>
            <SelectContent>
              {TIPOS_MOVIMENTO.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {f.tipo_movimento === "endosso" && (
          <div className="space-y-1">
            <Label>Tipo de alteração</Label>
            <Select value={f.tipo_alteracao} onValueChange={(v) => setF({ ...f, tipo_alteracao: v })}>
              <SelectTrigger><SelectValue placeholder={A_DEFINIR} /></SelectTrigger>
              <SelectContent>
                {TIPOS_ALTERACAO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Importância segurada</Label>
          <Input
            value={f.importancia_segurada}
            placeholder={A_DEFINIR}
            inputMode="decimal"
            onChange={(e) => setF({ ...f, importancia_segurada: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>% de garantia sobre o contrato</Label>
          <Input
            value={f.percentual_garantia}
            placeholder={A_DEFINIR}
            inputMode="decimal"
            onChange={(e) => setF({ ...f, percentual_garantia: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Vigência exigida</Label>
          <Input
            value={f.vigencia_exigida}
            placeholder={A_DEFINIR}
            onChange={(e) => setF({ ...f, vigencia_exigida: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Data limite</Label>
          <Input type="date" value={f.data_limite} onChange={(e) => setF({ ...f, data_limite: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Responsável pelo cliente</Label>
          <Select
            value={f.responsavel_cliente_id}
            onValueChange={(v) => setF({ ...f, responsavel_cliente_id: v })}
          >
            <SelectTrigger><SelectValue placeholder={A_DEFINIR} /></SelectTrigger>
            <SelectContent>
              {pessoas.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Responsável técnico</Label>
          <Select
            value={f.responsavel_tecnico_id}
            onValueChange={(v) => setF({ ...f, responsavel_tecnico_id: v })}
          >
            <SelectTrigger><SelectValue placeholder={A_DEFINIR} /></SelectTrigger>
            <SelectContent>
              {pessoas.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Prêmio estimado</Label>
          <Input
            value={f.premio_estimado}
            placeholder={A_DEFINIR}
            inputMode="decimal"
            onChange={(e) => setF({ ...f, premio_estimado: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Comissão estimada</Label>
          <Input
            value={f.comissao_estimada}
            placeholder={A_DEFINIR}
            inputMode="decimal"
            onChange={(e) => setF({ ...f, comissao_estimada: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Nº do processo</Label>
          <Input value={f.numero_processo} placeholder={A_DEFINIR} onChange={(e) => setF({ ...f, numero_processo: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Nº do contrato</Label>
          <Input value={f.numero_contrato} placeholder={A_DEFINIR} onChange={(e) => setF({ ...f, numero_contrato: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Objeto</Label>
        <Textarea value={f.objeto} placeholder={A_DEFINIR} rows={3} onChange={(e) => setF({ ...f, objeto: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Observação</Label>
        <Textarea value={f.observacao} placeholder={A_DEFINIR} rows={3} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
      </div>

      <Button onClick={salvar} disabled={atualizar.isPending}>
        {atualizar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar dados
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Abas Origem e Histórico                                            */
/* ------------------------------------------------------------------ */

function AbaOrigem({ demanda }: { demanda: DemandaLista }) {
  const { data: origem, isLoading } = useOrigemDaDemanda(demanda.entrada_id);

  const tempoCadastro = useMemo(() => {
    const ms = new Date(demanda.cadastrado_em).getTime() - new Date(demanda.chegada_em).getTime();
    if (!Number.isFinite(ms) || ms < 0) return A_DEFINIR;
    return duracaoLegivel(Math.floor(ms / 1000));
  }, [demanda.cadastrado_em, demanda.chegada_em]);

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md border border-border p-3">
        <Linha rotulo="Protocolo da entrada" valor={ouDefinir(origem?.protocolo ?? null)} />
        <Linha rotulo="Chegada" valor={dataHora(demanda.chegada_em)} />
        <Linha rotulo="Origem" valor={ouDefinir(origem?.origem ?? null)} />
        <Linha rotulo="Canal" valor={ouDefinir(demanda.canal?.nome ?? origem?.canal?.nome ?? null)} />
        <Linha rotulo="Cadastrada em" valor={dataHora(demanda.cadastrado_em)} />
        <Linha rotulo="Entre chegada e cadastro" valor={tempoCadastro} />
        <Linha rotulo="Assunto" valor={ouDefinir(origem?.assunto ?? null)} />
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando a entrada de origem…</p>}
      {!demanda.entrada_id && !demanda.solicitacao_id && (
        <p className="text-muted-foreground">
          Esta demanda não veio da Entrada de Demandas nem do formulário público.
        </p>
      )}

      {demanda.solicitacao_id && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="font-medium">Veio do formulário público de Garantia Judicial.</p>
          <p className="mt-1 text-muted-foreground">
            A solicitação original é consultada no Formulário Admin — esta tela não altera nada lá.
          </p>
          <Link
            to="/garantia/formulario-admin"
            className="mt-2 inline-block font-semibold text-primary underline-offset-4 hover:underline"
          >
            Abrir o Formulário Admin
          </Link>
        </div>
      )}
    </div>
  );
}

function AbaHistorico({
  demanda,
  catalogo,
  podeVerTempo,
}: {
  demanda: DemandaLista;
  catalogo: StatusCatalogo[];
  podeVerTempo: boolean;
}) {
  const { data: itens = [], isLoading } = useHistoricoDemanda(demanda.id);
  const nomeStatus = (c: string) => catalogo.find((s) => s.codigo === c)?.nome ?? c;

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando o histórico…</p>;
  if (!itens.length) return <p className="text-sm text-muted-foreground">Ainda não há movimentações registradas.</p>;

  return (
    <ol className="space-y-3">
      {itens.map((h) => (
        <li key={h.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{nomeStatus(h.status_codigo)}</span>
            <span className="text-muted-foreground">{dataHora(h.inicio)}</span>
          </div>
          {/* Sem menu_garantia_painel, a duração não é renderizada. */}
          {podeVerTempo && (
            <p className="mt-1 text-xs text-muted-foreground">
              {h.fim ? `Permaneceu ${duracaoLegivel(h.duracao_segundos)}` : "Status atual"}
            </p>
          )}
          {h.observacao && <p className="mt-1 text-xs text-muted-foreground">{h.observacao}</p>}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Diálogo focado na fase atual                                       */
/* ------------------------------------------------------------------ */

const CAMPOS_ANALISE =
  "id, demanda_id, documento_id, documentos_ids, fluxo, situacao, resumo, resultado, campos_sugeridos, aplicada, aplicada_por, aplicada_em, erro_mensagem, solicitada_por, criado_em, atualizado_em, job_id";

const mesmoConjunto = (a: string[] | null | undefined, b: string[]) =>
  !!a && a.length === b.length && b.every((id) => a.includes(id));

/**
 * Bloco de IA da Análise da demanda: o corretor escolhe o que a IA lê. O
 * prompt sai da seleção (contrato ou financeiro), nunca de um seletor.
 */
const DOCS_VAZIO: DocumentoDemanda[] = [];

function AnaliseTecnica({ demanda }: { demanda: DemandaLista }) {
  const { data } = useDocumentosDaDemanda(demanda.id);
  const docs = data ?? DOCS_VAZIO;
  const { data: analises = [], refetch } = useAnalisesDaDemanda(demanda.id);
  const [aberta, setAberta] = useState(false);
  const [analiseSelecionada, setAnaliseSelecionada] = useState<AnaliseIA | null>(null);
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const criandoRef = useRef<Promise<AnaliseIA> | null>(null);

  // Versão substituída e anexo externo (só leitura, outro bucket) não entram.
  const vigentes = useMemo(
    () => docs.filter((d) => !d.substituido_por_id && !d.externo && d.caminho),
    [docs],
  );
  // Padrão: só os de contrato marcados. Documento novo recebe o padrão; o que
  // a pessoa já mexeu fica como ela deixou.
  useEffect(() => {
    setMarcados((atual) => {
      const faltando = vigentes.filter((d) => !(d.id in atual));
      if (!faltando.length) return atual;
      const prox = { ...atual };
      for (const d of faltando) prox[d.id] = TIPOS_IA_CONTRATO.includes(d.tipo);
      return prox;
    });
  }, [vigentes]);

  const escolhidos = vigentes.filter((d) => marcados[d.id]);
  const ids = escolhidos.map((d) => d.id);
  const decisao = fluxoDaSelecao(escolhidos.map((d) => d.tipo), demanda.produto);
  const erroSelecao = escolhidos.length && "erro" in decisao ? decisao.erro : null;
  const principal = escolhidos[0] as DocumentoDemanda | undefined;
  const analise = analises.find((a) => mesmoConjunto(a.documentos_ids, ids) && ["solicitada", "processando", "concluida", "erro"].includes(a.situacao)) ?? null;

  const criar = async (): Promise<AnaliseIA> => {
    if (!principal || "erro" in decisao) throw new Error("erro" in decisao ? decisao.erro : "Selecione os documentos.");
    const { data: sessao } = await supabase.auth.getUser();
    const { data: criada, error } = await supabase.from("garantia_analises_ia").insert({
      demanda_id: demanda.id,
      documento_id: principal.id,
      documentos_ids: ids,
      fluxo: decisao.fluxo,
      situacao: "solicitada",
      solicitada_por: sessao.user?.id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).select(CAMPOS_ANALISE).single();
    if (error) throw error;
    await refetch();
    return criada as unknown as AnaliseIA;
  };

  const obterOuCriar = async (): Promise<AnaliseIA> => {
    if (criandoRef.current) return criandoRef.current;
    const p = (async () => {
      const { data: existentes } = await supabase.from("garantia_analises_ia")
        .select(CAMPOS_ANALISE)
        .eq("demanda_id", demanda.id)
        .in("situacao", ["solicitada", "processando", "concluida"])
        .order("criado_em", { ascending: false });
      const igual = ((existentes ?? []) as unknown as AnaliseIA[]).find((a) => mesmoConjunto(a.documentos_ids, ids));
      return igual ?? criar();
    })();
    criandoRef.current = p;
    try { return await p; } finally { criandoRef.current = null; }
  };

  return (
    <div className="space-y-4">
      <AbaDocumentos demanda={demanda} ocultarIA />
      <div className="space-y-3 rounded-md border border-dashed p-3">
        <p className="text-sm font-medium">O que a IA deve ler</p>
        {vigentes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum documento anexado nesta demanda.</p>
        ) : (
          <ul className="space-y-1.5">
            {vigentes.map((d) => (
              <li key={d.id}>
                <label className="flex min-w-0 items-start gap-2 text-sm">
                  <Checkbox
                    checked={!!marcados[d.id]}
                    onCheckedChange={(v) => setMarcados((m) => ({ ...m, [d.id]: v === true }))}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{rotuloTipoDocIA(d.tipo)}</span>
                    <span className="block break-all text-xs text-muted-foreground">{d.nome_arquivo}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {erroSelecao && (
          <p className="flex gap-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{erroSelecao}</p>
        )}
        <Button
          disabled={!escolhidos.length || !!erroSelecao}
          onClick={async () => {
            try { setAnaliseSelecionada(await obterOuCriar()); setAberta(true); } catch (e) { toast.error(mensagemDeErro(e)); }
          }}
        >
          Analisar com IA
        </Button>
        <p className="text-xs text-muted-foreground">A IA pode errar. Confira os dados antes de aplicar.</p>
      </div>
      {aberta && principal && (
        <AnaliseContratoDialog
          aberto
          onFechar={() => setAberta(false)}
          demanda={demanda}
          documento={principal}
          analise={analiseSelecionada ?? analise}
          onNovaAnalise={criar}
        />
      )}
    </div>
  );
}

function ConteudoDaFase({
  demanda,
  catalogo,
  podeVerTempo,
  onTriagem,
  onAceite,
  onPerda,
}: {
  demanda: DemandaLista;
  catalogo: StatusCatalogo[];
  podeVerTempo: boolean;
  onTriagem: () => void;
  onAceite: () => void;
  onPerda: () => void;
}) {
  // Etapa fundida "Análise da demanda": documentos, IA e conferência, nesta ordem.
  if (demanda.etapa === "1" || demanda.etapa === "2") {
    return (
      <div className="space-y-4">
        <AnaliseTecnica demanda={demanda} />
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={demanda.triagem_completa ? "outline" : "default"} onClick={onTriagem}>
              {demanda.triagem_completa ? "Revisar conferência dos dados" : "Conferir dados da demanda"}
            </Button>
            <SolicitarDocumentoComercial demanda={demanda} />
          </div>
        </div>
      </div>
    );
  }
  if (demanda.etapa === "3" && demanda.produto !== "fianca_locaticia") return <AbaLimites demanda={demanda} />;
  if (demanda.etapa === "3b")
    return (
      <div className="space-y-4">
        <BlocoCadastro demanda={demanda} />
        <BlocoCocorretagem demandaId={demanda.id} />
        <AbaDocumentos demanda={demanda} />
      </div>
    );
  if (demanda.etapa === "4") return <AbaCotacoes demanda={demanda} />;
  if (demanda.etapa === "5") {
    return (
      <div className="space-y-4">
        <AbaDocumentos demanda={demanda} tipoInicial="comparativo" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAceite}>Registrar aceite do cliente</Button>
          <Button variant="destructive" onClick={onPerda}>Registrar perda</Button>
        </div>
      </div>
    );
  }
  if (demanda.etapa === "6") return <AbaCuradoria demanda={demanda} />;
  if (demanda.etapa === "7") {
    return (
      <div className="space-y-5">
        <AbaDocumentos demanda={demanda} tipoInicial="minuta" ocultarIA />
        <AbaMinuta demanda={demanda} catalogo={catalogo} moverAoReceberMinuta={false} />
      </div>
    );
  }
  if (["8", "9"].includes(demanda.etapa)) {
    return (
      <div className="space-y-5">
        {demanda.etapa === "8" && <AbaDocumentos demanda={demanda} tipoInicial="apolice" />}
        <AbaApolice demanda={demanda} podeVerTempo={podeVerTempo} />
      </div>
    );
  }
  return <AbaDados demanda={demanda} />;
}

export function DemandaSheet({
  demanda,
  catalogo,
  podeVerTempo,
  onFechar,
}: {
  demanda: DemandaLista | null;
  catalogo: StatusCatalogo[];
  podeVerTempo: boolean;
  onFechar: () => void;
}) {
  const [triagemAberta, setTriagemAberta] = useState(false);
  const [perdaAberta, setPerdaAberta] = useState(false);
  const trocar = useTrocarStatus();
  const voltar = useVoltarEtapa();
  const [retornoPara, setRetornoPara] = useState<StatusCatalogo | null>(null);
  const aceite = useRegistrarAceite();
  const demandaId = demanda?.id ?? "";
  const clienteId = demanda?.cliente_id ?? null;
  const { data: docs = [] } = useDocumentosDaDemanda(demandaId);
  const { data: consulta } = useConsultaAtual(clienteId, !!demanda && demanda.produto !== "fianca_locaticia");
  const { data: limites = [] } = useLimitesDaConsulta(consulta?.id ?? null);
  const { data: seguradorasConfig = [] } = useSeguradorasConfig();
  const { data: cotacoes = [] } = useCotacoes(demandaId);
  const { data: aprovacoes = [] } = useAprovacoesMinuta(demandaId);
  const { data: segurado } = useSeguradoDaDemanda(demanda?.segurado_id ?? null);

  const registrarAceite = async (id: string) => {
    try {
      const r = await aceite.mutateAsync(id);
      toast.success(`Aceite registrado. Esta demanda agora é ${r.codigo} e está no CRM, em curadoria.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o aceite.");
    }
  };

  if (!demanda) return null;

  const statusAtual = catalogo.find((s) => s.codigo === demanda.status_atual);
  const tiposPresentes = new Set(docs.filter((d) => !d.substituido_por_id).map((d) => d.tipo));
  const pendencias = pendenciasDaDemanda(
    { ...demanda, cosseguro_total: totalCosseguro(demanda) },
    tiposPresentes,
  ).filter((p) => p.etapa === demanda.etapa);
  const resumoMercado = resumirConsulta(seguradorasConfig, limites, demanda.importancia_segurada);
  const contextoMercado = {
    consultaValida: !!consulta && new Date(consulta.valida_ate).getTime() > Date.now(),
    completa: resumoMercado.completa,
    faltantes: resumoMercado.faltantes,
  };
  const contextoCrm = {
    temCotacaoEscolhida: cotacoes.some((c) => c.escolhida),
    temMinuta: tiposPresentes.has("minuta"),
    aprovouCliente: aprovacoes.some((a) => a.quem === "cliente"),
    aprovouSegurado: aprovacoes.some((a) => a.quem === "segurado"),
    seguradoExigeTexto: !!segurado?.exige_texto_proprio,
  };
  // Destino = mudança de ETAPA. Um botão por etapa, apontando para o status
  // interno de entrada dela. Status da etapa atual e de etapa "qualquer" não
  // são destino: são situação (quem está com a bola), no seletor do topo.
  const colunas = colunasDoCatalogo(catalogo.filter((s) => s.ativo && s.fase === demanda.fase));
  const posicaoAtual = colunas.find((c) => c.etapa === demanda.etapa)?.posicao ?? 0;
  const destinos = colunas
    .filter((c) => c.etapa !== demanda.etapa && c.entrada)
    .filter((c) => !(demanda.produto === "fianca_locaticia" && c.etapa === "3"))
    .map((c) => ({ coluna: c, destino: c.entrada as StatusCatalogo }));
  const impedimentos = destinos.map(({ coluna, destino }) => ({
    coluna,
    destino,
    retorno: coluna.posicao < posicaoAtual,
    impedimento: impedimentoDaTransicao(demanda, destino, contextoMercado, tiposPresentes, contextoCrm, statusAtual),
  }));
  const impedimentosDaFase = [...new Set(impedimentos.filter((i) => !i.retorno).map((i) => i.impedimento).filter(Boolean))];
  const tudoPronto = pendencias.length === 0 && impedimentosDaFase.length === 0;
  const situacoes = catalogo
    .filter((s) => s.ativo && s.fase === demanda.fase && (s.etapa === demanda.etapa || s.etapa === "qualquer"))
    .sort((a, b) => a.ordem - b.ordem);

  const mudarEtapa = async (coluna: (typeof colunas)[number], destino: StatusCatalogo) => {
    const impedimento = impedimentoDaTransicao(demanda, destino, contextoMercado, tiposPresentes, contextoCrm, statusAtual);
    if (impedimento) {
      toast.error(impedimento);
      return;
    }
    // Voltar de etapa pede motivo (vai para o histórico).
    if (coluna.posicao < posicaoAtual) {
      setRetornoPara(destino);
      return;
    }
    try {
      await trocar.mutateAsync({ demanda, destino });
      toast.success(`Demanda movida para ${rotuloEtapa(coluna.etapa, colunas)}.`);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível mover a demanda."));
    }
  };

  // Troca de situação dentro da mesma etapa: um clique, sem motivo, sem trava.
  const mudarSituacao = async (codigo: string) => {
    const destino = situacoes.find((s) => s.codigo === codigo);
    if (!destino || codigo === demanda.status_atual) return;
    try {
      await trocar.mutateAsync({ demanda, destino });
      toast.success(`Situação: “${destino.nome}”.`);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível mudar a situação."));
    }
  };

  return (
    <Dialog open={!!demanda} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl min-w-0 overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="min-w-0 pr-8">
          <div className="flex min-w-0 items-start gap-1">
            <span className="pt-1.5"><AjudaFase etapa={demanda.etapa} /></span>
            <DialogTitle className="min-w-0 break-words text-left">
              {demanda.legenda ?? demanda.cliente?.nome ?? "Demanda"}
            </DialogTitle>
            <EditorLegenda demanda={demanda} />
          </div>
          <DialogDescription className="text-left">
            {ROTULO_PRODUTO[demanda.produto] ?? demanda.produto} ·{" "}
            {rotuloModalidade(demanda.modalidade)} · {rotuloEtapa(demanda.etapa, colunas)}
            {demanda.codigo ? ` · ${demanda.codigo}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <aside className="min-w-0 space-y-3 lg:order-2">
            <h3 className="font-semibold text-[#14405C]">Mover card para fase</h3>
            {impedimentos.map(({ coluna, destino, retorno, impedimento }) => (
              <div key={coluna.etapa} className="space-y-1">
                <Button
                  className={`h-auto min-h-10 w-full justify-between whitespace-normal text-left ${
                    tudoPronto && !impedimento && !retorno ? "bg-[#338B85] hover:bg-[#338B85]/90" : ""
                  }`}
                  variant={retorno ? "outline" : "default"}
                  disabled={!!impedimento || trocar.isPending}
                  onClick={() => mudarEtapa(coluna, destino)}
                >
                  <span>{retorno ? "Voltar para " : ""}{rotuloEtapa(coluna.etapa, colunas)}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Button>
                {impedimento && !impedimentosDaFase.includes(impedimento) && (
                  <p className="text-xs text-destructive">{impedimento}</p>
                )}
              </div>
            ))}
            {!impedimentos.length && (
              <p className="text-xs text-muted-foreground">Nenhuma outra etapa disponível.</p>
            )}
            {demanda.fase === "crm" && <BlocoRetornoCrm demandaId={demanda.id} />}
            <MotivoDialog
              aberto={!!retornoPara}
              titulo={`Voltar para “${retornoPara?.nome ?? ""}”`}
              descricao="Voltar de etapa exige um motivo curto. Ele fica registrado no histórico da demanda."
              rotuloConfirmar="Voltar"
              pendente={voltar.isPending}
              onFechar={() => setRetornoPara(null)}
              onConfirmar={async (motivo) => {
                if (!retornoPara) return;
                try {
                  await voltar.mutateAsync({ demandaId: demanda.id, destino: retornoPara.codigo, motivo });
                  toast.success(`Demanda voltou para “${retornoPara.nome}”.`);
                  setRetornoPara(null);
                } catch (e) {
                  toast.error(mensagemDeErro(e));
                }
              }}
            />
          </aside>

          <main className="min-w-0 space-y-5 lg:order-1">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#14405C] hover:bg-[#14405C]">Etapa: {rotuloEtapa(demanda.etapa, colunas)}</Badge>
              </div>
              <div className="min-w-0 space-y-1" data-tour="gar-situacao">
                <Label>Com quem está agora</Label>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Select value={demanda.status_atual} onValueChange={mudarSituacao} disabled={trocar.isPending}>
                    <SelectTrigger className="w-full min-w-0 sm:w-80"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {situacoes.map((s) => (
                        <SelectItem key={s.codigo} value={s.codigo}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {statusAtual?.com_quem && (
                    <span className="text-xs text-muted-foreground">{rotuloComQuem(statusAtual.com_quem)}</span>
                  )}
                </div>
              </div>
              {podeVerTempo && statusAtual?.sla_horas != null && (
                <p className="text-xs text-muted-foreground">SLA da fase: {statusAtual.sla_horas} h</p>
              )}
              <div>
                <h3 className="font-semibold text-[#14405C]">O que falta nesta fase</h3>
                {pendencias.length ? (
                  <ul className="mt-2 space-y-2">
                    {pendencias.map((p, i) => (
                      <li key={`${p.etapa}-${p.tipo ?? i}`} className={`flex items-start gap-2 rounded-md border p-3 text-sm ${p.bloqueia ? "border-amber-300 bg-amber-50 text-amber-900" : "bg-muted/40 text-muted-foreground"}`}>
                        {p.bloqueia ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
                        <span>{p.texto}<span className="mt-1 block text-xs">Motivo: {p.motivo}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : impedimentosDaFase.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[#338B85]"><Check className="h-4 w-4" /> Tudo pronto nesta fase</p>
                ) : null}
                {impedimentosDaFase.map((impedimento) => (
                  <p key={impedimento} className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{impedimento}</span>
                  </p>
                ))}
              </div>
            </div>
            <ConteudoDaFase
              demanda={demanda}
              catalogo={catalogo}
              podeVerTempo={podeVerTempo}
              onTriagem={() => setTriagemAberta(true)}
              onAceite={() => registrarAceite(demanda.id)}
              onPerda={() => setPerdaAberta(true)}
            />
          </main>
        </div>

        <Separator />

        <Tabs defaultValue="dados" className="min-w-0">
          <div className="w-full overflow-x-auto">
            <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="dados">Dados completos</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            {demanda.produto === "seguro_garantia" && (
              <TabsTrigger value="limites">Limites</TabsTrigger>
            )}
            <TabsTrigger value="cotacoes">Cotações</TabsTrigger>
            <TabsTrigger value="origem">Origem</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="dados" className="mt-4">
            <AbaDados demanda={demanda} />
          </TabsContent>
          <TabsContent value="documentos" className="mt-4">
            {/* Na etapa da minuta, a aba já abre com o tipo "Minuta" escolhido. */}
            <AbaDocumentos demanda={demanda} tipoInicial={demanda.etapa === "7" ? "minuta" : undefined} />
          </TabsContent>
          <TabsContent value="cotacoes" className="mt-4">
            <AbaCotacoes demanda={demanda} />
          </TabsContent>
          {demanda.produto === "seguro_garantia" && (
            <TabsContent value="limites" className="mt-4">
              <AbaLimites demanda={demanda} />
            </TabsContent>
          )}
          <TabsContent value="origem" className="mt-4">
            <AbaOrigem demanda={demanda} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <AbaHistorico demanda={demanda} catalogo={catalogo} podeVerTempo={podeVerTempo} />
          </TabsContent>
        </Tabs>


        <div className="text-xs text-muted-foreground">
          Importância segurada: {moeda(demanda.importancia_segurada)} · Data limite:{" "}
          {dataCurta(demanda.data_limite)}
        </div>

        <TriagemDialog aberto={triagemAberta} demanda={demanda} onFechar={() => setTriagemAberta(false)} />
        <PerdaDialog aberto={perdaAberta} demanda={demanda} onFechar={() => setPerdaAberta(false)} />
      </DialogContent>
    </Dialog>
  );
}

export { Linha as LinhaDetalhe };
export function SeloProduto({ produto }: { produto: string }) {
  return (
    <Badge variant={produto === "fianca_locaticia" ? "secondary" : "default"}>
      {ROTULO_PRODUTO[produto] ?? produto}
    </Badge>
  );
}
