// Detalhe da demanda de Garantia: Dados · Origem · Histórico.
//
// Documentos, Limites e IA entram nas partes seguintes — aqui não há aba
// vazia esperando conteúdo.
//
// Corte de visibilidade: contagem de tempo e SLA são assunto da gerência.
// Sem `menu_garantia_painel` esses elementos simplesmente NÃO são
// renderizados (não são escondidos por CSS).

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Ban, Check, Loader2, Search } from "lucide-react";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useResponsaveis } from "@/hooks/use-entrada-demandas";
import { AbaLimites } from "@/components/garantia/aba-limites";
import { AbaDocumentos } from "@/components/garantia/aba-documentos";
import { AbaCotacoes } from "@/components/garantia/aba-cotacoes";
import { AbaCuradoria } from "@/components/garantia/aba-curadoria";
import { AbaMinuta } from "@/components/garantia/aba-minuta";
import { useRegistrarAceite } from "@/hooks/use-garantia-crm";


import {
  MOTIVOS_PERDA,
  impedimentoDaTransicao,
  useAtualizarDemanda,
  useBuscaSegurados,
  useCompletarTriagem,
  useCriarSegurado,
  useHistoricoDemanda,
  useOrigemDaDemanda,
  useRegistrarPerda,
  useTrocarStatus,
  type DemandaLista,
  type StatusCatalogo,
} from "@/hooks/use-garantia-negociacao";
import { consultarCnpjEntrada } from "@/lib/entrada/entrada-cnpj.functions";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar {rotulo.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Com CNPJ, a consulta ao cadastro público preenche a razão social.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
  const [dataLimite, setDataLimite] = useState(demanda.data_limite ?? "");
  const [respCliente, setRespCliente] = useState(demanda.responsavel_cliente_id ?? "");
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
    if (!dataLimite) {
      toast.error("A data limite é obrigatória: é ela que organiza a fila.");
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
          data_limite: dataLimite,
          responsavel_cliente_id: respCliente || null,
          responsavel_tecnico_id: respTecnico || null,
        },
      });
      toast.success("Triagem concluída. A demanda seguiu para a análise técnica.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a triagem.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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

          <div className="grid gap-3 md:grid-cols-2">
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
              <Label>Data limite * (sessão, assinatura ou prazo judicial)</Label>
              <Input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Responsável pelo cliente</Label>
              <Select value={respCliente} onValueChange={setRespCliente}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pessoas.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
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
          <div className="grid gap-3 md:grid-cols-2">
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

      <div className="grid gap-3 md:grid-cols-2">
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
/* Sheet                                                              */
/* ------------------------------------------------------------------ */

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
  const aceite = useRegistrarAceite();

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

  const mudarStatus = async (codigo: string) => {
    const destino = catalogo.find((s) => s.codigo === codigo);
    if (!destino) return;
    const impedimento = impedimentoDaTransicao(demanda, destino);
    if (impedimento) {
      toast.error(impedimento);
      return;
    }
    try {
      await trocar.mutateAsync({ demanda, destino });
      toast.success(`Status alterado para “${destino.nome}”.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mudar o status.");
    }
  };

  return (
    <Sheet open={!!demanda} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-left">
            {demanda.cliente?.nome ?? "Demanda"}
          </SheetTitle>
          <SheetDescription className="text-left">
            {ROTULO_PRODUTO[demanda.produto] ?? demanda.produto} ·{" "}
            {rotuloModalidade(demanda.modalidade)} · {rotuloEtapa(demanda.etapa)}
            {demanda.codigo ? ` · ${demanda.codigo}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {!demanda.triagem_completa && (
            <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Triagem incompleta</p>
                <p>Enquanto a etapa 1 não estiver fechada, a demanda não avança de coluna.</p>
                <Button size="sm" className="mt-2" onClick={() => setTriagemAberta(true)}>
                  Completar triagem
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={demanda.status_atual} onValueChange={mudarStatus} disabled={trocar.isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {catalogo.map((s) => (
                  <SelectItem key={s.codigo} value={s.codigo}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {podeVerTempo && statusAtual?.sla_horas != null && (
              <p className="text-xs text-muted-foreground">
                SLA do status: {statusAtual.sla_horas} h
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {demanda.fase === "negociacao" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={aceite.isPending}
                onClick={() => registrarAceite(demanda.id)}
                title="Gera o código GAR e leva a demanda para o CRM, em curadoria."
              >
                {aceite.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Registrar aceite do cliente
              </Button>
            ) : (
              <Badge variant="outline" className="self-center">
                {demanda.codigo ? `Aceito · ${demanda.codigo}` : "Aceito"}
              </Badge>
            )}
            <Button variant="destructive" size="sm" onClick={() => setPerdaAberta(true)}>
              Registrar perda
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <Tabs defaultValue="dados" className="flex-1">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            {/* Fiança locatícia não faz consulta a mercado: a aba nem aparece. */}
            {demanda.produto === "seguro_garantia" && (
              <TabsTrigger value="limites">Limites</TabsTrigger>
            )}
            <TabsTrigger value="cotacoes">Cotações</TabsTrigger>
            {/* Abas do CRM: mesma demanda, outra fase — o detalhe é o mesmo. */}
            {demanda.fase === "crm" && <TabsTrigger value="curadoria">Curadoria</TabsTrigger>}
            {demanda.fase === "crm" && <TabsTrigger value="minuta">Minuta</TabsTrigger>}
            <TabsTrigger value="origem">Origem</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
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
          {demanda.fase === "crm" && (
            <TabsContent value="curadoria" className="mt-4">
              <AbaCuradoria demanda={demanda} />
            </TabsContent>
          )}
          {demanda.fase === "crm" && (
            <TabsContent value="minuta" className="mt-4">
              <AbaMinuta demanda={demanda} catalogo={catalogo} />
            </TabsContent>
          )}


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


        <div className="mt-4 text-xs text-muted-foreground">
          Importância segurada: {moeda(demanda.importancia_segurada)} · Data limite:{" "}
          {dataCurta(demanda.data_limite)}
        </div>

        <TriagemDialog aberto={triagemAberta} demanda={demanda} onFechar={() => setTriagemAberta(false)} />
        <PerdaDialog aberto={perdaAberta} demanda={demanda} onFechar={() => setPerdaAberta(false)} />
      </SheetContent>
    </Sheet>
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
