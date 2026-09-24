// Entrada de Demandas: porta única de registro do Hub, de qualquer ramo.
//
// Só Garantia tem pipeline hoje. Demanda de outro ramo fica registrada e
// retida — é melhor ter o registro do que perder a demanda por não ter tela.

import { mensagemDeErro } from "@/lib/erro";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  Inbox,
  Loader2,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PaginaHub } from "@/components/hub/pagina-hub";
import {
  TAMANHO_MAXIMO_BYTES,
  rotuloTipoDocumento,
  tiposContratoObrigatorios,
  tiposDaEntrada,
} from "@/lib/garantia/documentos-regra";

import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission, hasRole } from "@/hooks/use-meu-perfil";
import { consultarCnpjEntrada } from "@/lib/entrada/entrada-cnpj.functions";
import {
  soDigitosDoc,
  useBuscaClientes,
  useCanais,
  useCriarCanal,
  useCriarCliente,
  useCriarEntrada,
  useDuplicidadeCliente,
  useEntradas,
  useResponsaveis,
  useRotearEntradaGarantia,
  type ClienteHub,
  type EntradaLista,
  type FiltrosEntradas,
  type ProdutoGarantia,
  type RamoEntrada,
} from "@/hooks/use-entrada-demandas";

const RAMOS: { valor: RamoEntrada; rotulo: string }[] = [
  { valor: "garantia", rotulo: "Garantia" },
  { valor: "beneficios", rotulo: "Benefícios" },
  { valor: "demais_ramos", rotulo: "Demais Ramos" },
  { valor: "credito", rotulo: "Crédito" },
  { valor: "outro", rotulo: "Outro" },
];

const ORIGENS = [
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "indicacao", rotulo: "Indicação" },
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "outro", rotulo: "Outro" },
];

const rotuloRamo = (r: string) => RAMOS.find((x) => x.valor === r)?.rotulo ?? r;
const rotuloProduto = (p: string | null) =>
  p === "seguro_garantia" ? "Seguro Garantia" : p === "fianca_locaticia" ? "Fiança Locatícia" : "";

function mascaraDoc(v: string) {
  const d = soDigitosDoc(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

const fmtDataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** Valor inicial do campo datetime-local: agora, no fuso local. */
function agoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function duracaoHumana(deISO: string, ateISO: string) {
  const ms = new Date(ateISO).getTime() - new Date(deISO).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}min`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function EntradaDemandas() {
  const [filtros, setFiltros] = useState<FiltrosEntradas>({});
  const [aberto, setAberto] = useState(false);
  const entradas = useEntradas(filtros);

  return (
    <PaginaHub
      trilha={["Hub Lavoro"]}
      titulo="Entrada de Demandas"
      subtitulo="Porta única de registro: toda demanda do Hub entra por aqui, de qualquer ramo."
      acoes={
        <Button onClick={() => setAberto(true)} className="w-full bg-[#14405C] hover:bg-[#14405C]/90 sm:w-auto">
          <Plus className="mr-1 h-4 w-4" />
          Registrar entrada
        </Button>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 space-y-1">
            <Label>Ramo</Label>
            <Select
              value={filtros.ramo ?? "todos"}
              onValueChange={(v) => setFiltros((f) => ({ ...f, ramo: v === "todos" ? undefined : v }))}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {RAMOS.map((r) => (
                  <SelectItem key={r.valor} value={r.valor}>{r.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Destino</Label>
            <Select
              value={filtros.destino ?? "todos"}
              onValueChange={(v) => setFiltros((f) => ({ ...f, destino: v === "todos" ? undefined : v }))}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="roteada">Roteada</SelectItem>
                <SelectItem value="retida">Retida</SelectItem>
                <SelectItem value="descartada">Descartada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label>De</Label>
            <Input
              type="date"
              value={filtros.de?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, de: e.target.value ? `${e.target.value}T00:00:00` : undefined }))
              }
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Até</Label>
            <Input
              type="date"
              value={filtros.ate?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, ate: e.target.value ? `${e.target.value}T23:59:59` : undefined }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entradas registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {entradas.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (entradas.data?.length ?? 0) === 0 ? (
            <div className="grid place-items-center gap-3 py-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#14405C]/10 text-[#14405C]">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma entrada registrada ainda.
              </p>
              <Button onClick={() => setAberto(true)} variant="outline">
                Registrar a primeira
              </Button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead className="hidden lg:table-cell">Chegada</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ramo</TableHead>
                    <TableHead className="hidden lg:table-cell">Canal</TableHead>
                    <TableHead className="hidden lg:table-cell">Assunto</TableHead>
                    <TableHead>Destino</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entradas.data!.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.protocolo}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs lg:table-cell">{fmtDataHora(e.chegada_em)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{e.cliente?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.cliente ? mascaraDoc(e.cliente.cpf_cnpj) : ""}
                        </div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground lg:hidden">
                          {e.assunto ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rotuloRamo(e.ramo)}
                        {e.produto && (
                          <div className="text-xs text-muted-foreground">{rotuloProduto(e.produto)}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">{e.canal?.nome ?? "—"}</TableCell>
                      <TableCell className="hidden max-w-[240px] truncate text-sm lg:table-cell">{e.assunto ?? "—"}</TableCell>
                      <TableCell>
                        {e.destino === "roteada" ? (
                          <Badge className="bg-[#338B85] hover:bg-[#338B85]">Roteada</Badge>
                        ) : e.destino === "retida" && e.ramo === "garantia" ? (
                          <CelulaPendencia entrada={e} />
                        ) : e.destino === "retida" ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-700">
                            Retida · ramo sem fluxo no Hub
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Descartada</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogRegistro aberto={aberto} onFechar={() => setAberto(false)} />
      </div>
    </PaginaHub>
  );
}

// ───────────────────── Pendência de roteamento (Garantia) ─────────────────

/**
 * Entrada de Garantia que ficou retida: a demanda não chegou a abrir.
 * Nada foi perdido — o botão refaz só a etapa da demanda, sem criar entrada
 * nova.
 */
function CelulaPendencia({ entrada }: { entrada: EntradaLista }) {
  const rotear = useRotearEntradaGarantia();

  async function tentar() {
    if (!entrada.cliente?.id || !entrada.produto) {
      return toast.error("Entrada sem cliente ou produto: não dá para abrir a demanda.");
    }
    try {
      await rotear.mutateAsync({
        entrada_id: entrada.id,
        produto: entrada.produto as ProdutoGarantia,
        cliente_id: entrada.cliente.id,
        chegada_em: entrada.chegada_em,
        canal_id: entrada.canal?.id ?? null,
      });
      toast.success(`Entrada ${entrada.protocolo} roteada para Garantia.`);
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  if (entrada.demanda_id) {
    // A demanda existe; faltou o documento. Rotear de novo criaria outra.
    return (
      <div className="space-y-1">
        <Badge variant="outline" className="border-destructive text-destructive">
          Retida · demanda sem documento
        </Badge>
        {entrada.motivo_retencao && (
          <p className="max-w-[240px] text-xs text-muted-foreground">{entrada.motivo_retencao}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Badge variant="outline" className="border-destructive text-destructive">
        Retida · demanda não aberta
      </Badge>
      {entrada.motivo_retencao && (
        <p className="max-w-[240px] text-xs text-muted-foreground">{entrada.motivo_retencao}</p>
      )}
      <Button size="sm" variant="outline" onClick={tentar} disabled={rotear.isPending}>
        {rotear.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <ArrowRight className="mr-1 h-3 w-3" />
        )}
        Tentar rotear de novo
      </Button>
    </div>
  );
}

// ───────────────────────── Formulário de registro ─────────────────────────

function DialogRegistro({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const perfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(perfil, "ADMIN");
  const podeCanal = isAdmin || hasPermission(perfil, "entrada_cadastrar_canal");

  const [cliente, setCliente] = useState<ClienteHub | null>(null);
  const [cadastrando, setCadastrando] = useState(false);

  const [chegada, setChegada] = useState(agoraLocal());
  const [origem, setOrigem] = useState("email");
  const [canalId, setCanalId] = useState<string>("");
  const [novoCanal, setNovoCanal] = useState("");
  const [ramo, setRamo] = useState<RamoEntrada>("garantia");
  const [produto, setProduto] = useState<ProdutoGarantia | "">("");
  const [assunto, setAssunto] = useState("");
  const [observacao, setObservacao] = useState("");
  const [anexos, setAnexos] = useState<{ arquivo: File; tipo: string }[]>([]);
  const [resultado, setResultado] = useState<{ protocolo: string; chegada: string; registro: string } | null>(null);

  const canais = useCanais();
  const criarCanal = useCriarCanal();
  const criarEntrada = useCriarEntrada();
  const duplicidade = useDuplicidadeCliente(cliente?.id ?? null);

  const futuro = useMemo(() => new Date(chegada).getTime() > Date.now() + 60_000, [chegada]);

  function limpar() {
    setCliente(null);
    setCadastrando(false);
    setChegada(agoraLocal());
    setOrigem("email");
    setCanalId("");
    setNovoCanal("");
    setRamo("garantia");
    setProduto("");
    setAssunto("");
    setObservacao("");
    setAnexos([]);
    setResultado(null);
  }

  // Sem documento não é demanda: exige pelo menos um, de qualquer tipo (muitas
  // vezes só há o que o comercial mandou). O documento do contrato é exigido
  // depois, para sair da Análise da demanda (pendenciasAnaliseDemanda).
  const ehGarantia = ramo === "garantia";
  const razaoBloqueio = !ehGarantia
    ? null
    : !produto
      ? "Escolha o produto para anexar os documentos."
      : anexos.length === 0
        ? "Anexe pelo menos um documento."
        : anexos.some((a) => !a.tipo)
          ? "Escolha o tipo de cada arquivo anexado."
          : null;

  function adicionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const novos: { arquivo: File; tipo: string }[] = [];
    for (const f of Array.from(lista)) {
      if (f.size > TAMANHO_MAXIMO_BYTES) {
        toast.error(`${f.name} passa de 20 MB, que é o teto por anexo.`);
        continue;
      }
      novos.push({ arquivo: f, tipo: "" });
    }
    setAnexos((a) => [...a, ...novos]);
  }

  async function salvar() {
    if (razaoBloqueio) return toast.error(razaoBloqueio);
    if (!cliente) return toast.error("Escolha o cliente.");
    if (!assunto.trim()) return toast.error("Informe o assunto.");
    if (futuro) return toast.error("A chegada não pode estar no futuro.");
    if (ramo === "garantia" && !produto) return toast.error("Escolha o produto de Garantia.");

    try {
      const r = await criarEntrada.mutateAsync({
        ramo,
        produto: ramo === "garantia" ? (produto as ProdutoGarantia) : null,
        cliente_id: cliente.id,
        chegada_em: new Date(chegada).toISOString(),
        origem,
        canal_id: canalId || null,
        assunto: assunto.trim(),
        observacao: observacao.trim() || null,
        anexos: ehGarantia ? anexos : undefined,
      });
      setResultado({
        protocolo: r.entrada.protocolo,
        chegada: r.entrada.chegada_em,
        registro: r.entrada.registrado_em,
      });
      if (r.falhaAnexo) {
        toast.error(
          `Entrada ${r.entrada.protocolo} registrada e demanda criada, mas sem documento: ${r.falhaAnexo} Anexe pela aba Documentos da demanda.`,
          { duration: 12000 },
        );
      } else {
        toast.success(`Entrada ${r.entrada.protocolo} registrada.`);
      }
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  async function cadastrarCanal() {
    const nome = novoCanal.trim();
    if (!nome) return;
    try {
      const id = await criarCanal.mutateAsync(nome);
      setCanalId(id);
      setNovoCanal("");
      toast.success("Canal cadastrado.");
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) { limpar(); onFechar(); }
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar entrada</DialogTitle>
          <DialogDescription>
            O registro vale para qualquer ramo. Garantia segue direto para o pipeline; os demais
            ficam retidos.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <Alert>
              <AlertTitle>Entrada {resultado.protocolo} registrada</AlertTitle>
              <AlertDescription>
                Entre a chegada e o cadastro passaram{" "}
                <strong>{duracaoHumana(resultado.chegada, resultado.registro)}</strong>.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={limpar}>Registrar outra</Button>
              <Button onClick={() => { limpar(); onFechar(); }} className="bg-[#14405C] hover:bg-[#14405C]/90">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <BlocoCliente
              cliente={cliente}
              onEscolher={setCliente}
              cadastrando={cadastrando}
              setCadastrando={setCadastrando}
            />

            {cliente && (duplicidade.data?.entradas.length || duplicidade.data?.demandas.length) ? (
              <Alert className="border-amber-500/50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Este cliente já tem registro recente</AlertTitle>
                <AlertDescription className="space-y-1 text-xs">
                  {duplicidade.data.entradas.map((e) => (
                    <div key={e.id}>
                      Entrada {e.protocolo} · {rotuloRamo(e.ramo)} · {fmtDataHora(e.registrado_em)}
                    </div>
                  ))}
                  {duplicidade.data.demandas.map((d) => (
                    <div key={d.id}>Demanda em aberto {d.codigo ?? "(sem código)"} · {d.status_atual}</div>
                  ))}
                  <div className="pt-1">É só um aviso: pode seguir e registrar mesmo assim.</div>
                </AlertDescription>
              </Alert>
            ) : null}

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Chegada da demanda *</Label>
                <Input
                  type="datetime-local"
                  value={chegada}
                  max={agoraLocal()}
                  onChange={(e) => setChegada(e.target.value)}
                />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  É quando o contato chegou — é daqui que o relógio da demanda começa a contar.
                </p>
                {futuro && <p className="text-xs text-destructive">A chegada não pode estar no futuro.</p>}
              </div>

              <div className="space-y-1">
                <Label>Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label>Canal</Label>
                <Select value={canalId} onValueChange={setCanalId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                  <SelectContent>
                    {(canais.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {podeCanal && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Cadastrar canal novo"
                      value={novoCanal}
                      onChange={(e) => setNovoCanal(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cadastrarCanal}
                      disabled={!novoCanal.trim() || criarCanal.isPending}
                    >
                      Cadastrar
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Ramo *</Label>
                <Select value={ramo} onValueChange={(v) => setRamo(v as RamoEntrada)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RAMOS.map((r) => (
                      <SelectItem key={r.valor} value={r.valor}>{r.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ramo === "garantia" ? (
                <div className="space-y-1">
                  <Label>Produto *</Label>
                  <Select value={produto} onValueChange={(v) => { setProduto(v as ProdutoGarantia); setAnexos((l) => l.map((a) => (tiposDaEntrada(v).some((t) => t.valor === a.tipo) ? a : { ...a, tipo: "" }))); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seguro_garantia">Seguro Garantia</SelectItem>
                      <SelectItem value="fianca_locaticia">Fiança Locatícia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="sm:col-span-1">
                  <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    Este ramo ainda não tem fluxo próprio no Hub. A demanda fica registrada e retida.
                  </p>
                </div>
              )}

              <div className="space-y-1 sm:col-span-2">
                <Label>Assunto *</Label>
                <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Documentos{ehGarantia ? " *" : ""}</Label>
                {!ehGarantia ? (
                  <p className="text-xs text-muted-foreground">
                    Este ramo fica retido sem demanda, e documento sem demanda não teria onde ficar: aqui não se anexa.
                  </p>
                ) : (
                  <>
                    <Input
                      type="file"
                      multiple
                      disabled={!produto}
                      onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = ""; }}
                    />
                    {anexos.length > 0 && (
                      <ul className="space-y-2">
                        {anexos.map((a, i) => (
                          <li key={`${a.arquivo.name}-${i}`} className="flex min-w-0 flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center">
                            <span className="min-w-0 flex-1 break-all text-sm">{a.arquivo.name}</span>
                            <Select
                              value={a.tipo}
                              onValueChange={(v) => setAnexos((l) => l.map((x, j) => (j === i ? { ...x, tipo: v } : x)))}
                            >
                              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Tipo do documento" /></SelectTrigger>
                              <SelectContent>
                                {tiposDaEntrada(produto).map((t) => (
                                  <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setAnexos((l) => l.filter((_, j) => j !== i))}
                            >
                              Remover
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Anexe pelo menos um documento, de qualquer tipo (edital, contrato, DRE, balanço, alteração
                      contratual). Até 20 MB por arquivo.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label>Observação</Label>
                <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
              {razaoBloqueio && <p className="mr-auto text-xs text-destructive">{razaoBloqueio}</p>}
              <Button variant="outline" onClick={() => { limpar(); onFechar(); }}>Cancelar</Button>
              <Button
                onClick={salvar}
                disabled={criarEntrada.isPending || !!razaoBloqueio}
                className="bg-[#14405C] hover:bg-[#14405C]/90"
              >
                {criarEntrada.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Registrar entrada
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Bloco do cliente ─────────────────────────────

function BlocoCliente({
  cliente,
  onEscolher,
  cadastrando,
  setCadastrando,
}: {
  cliente: ClienteHub | null;
  onEscolher: (c: ClienteHub | null) => void;
  cadastrando: boolean;
  setCadastrando: (v: boolean) => void;
}) {
  const [termo, setTermo] = useState("");
  const busca = useBuscaClientes(termo);
  const responsaveis = useResponsaveis();

  const nomeResponsavel = (id: string | null) =>
    responsaveis.data?.find((r) => r.user_id === id)?.nome ?? (id ? "—" : "não definido");

  if (cliente) {
    return (
      <div className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-[#14405C]" />
              {cliente.nome}
            </div>
            <div className="text-xs text-muted-foreground">
              {mascaraDoc(cliente.cpf_cnpj)}
              {cliente.municipio ? ` · ${cliente.municipio}/${cliente.uf ?? ""}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              Responsável: {nomeResponsavel(cliente.responsavel_id)}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEscolher(null)}>Trocar</Button>
        </div>
      </div>
    );
  }

  if (cadastrando) {
    return (
      <CadastroCliente
        onPronto={(c) => { onEscolher(c); setCadastrando(false); }}
        onCancelar={() => setCadastrando(false)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <Label>Cliente *</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por nome ou CPF/CNPJ"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>
      {termo.trim().length >= 2 && (
        <div className="max-h-52 overflow-y-auto rounded-md border">
          {busca.isLoading ? (
            <div className="p-3 text-xs text-muted-foreground">Buscando…</div>
          ) : (busca.data?.length ?? 0) === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Nenhum cliente encontrado.</div>
          ) : (
            busca.data!.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onEscolher(c)}
                className="flex w-full items-center justify-between gap-2 border-b p-2 text-left text-sm last:border-b-0 hover:bg-muted"
              >
                <span>
                  {c.nome}
                  <span className="block text-xs text-muted-foreground">{mascaraDoc(c.cpf_cnpj)}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setCadastrando(true)}>
        <UserPlus className="mr-1 h-4 w-4" />
        Cadastrar cliente novo
      </Button>
    </div>
  );
}

// ─────────────────────────── Cadastro de cliente ───────────────────────────

const VAZIO = {
  cpf_cnpj: "",
  nome: "",
  nome_fantasia: "",
  email: "",
  telefone: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "",
  cnae: "",
  cnae_descricao: "",
  porte: "",
  capital_social: "",
  situacao_cadastral: "",
  data_abertura: "",
  natureza_juridica: "",
};

function CadastroCliente({
  onPronto,
  onCancelar,
}: {
  onPronto: (c: ClienteHub) => void;
  onCancelar: () => void;
}) {
  const perfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(perfil, "ADMIN");
  const podeResponsavel = isAdmin || hasPermission(perfil, "entrada_definir_responsavel");

  const [f, setF] = useState({ ...VAZIO });
  const [responsavel, setResponsavel] = useState<string>("");
  const [consultando, setConsultando] = useState(false);
  const [veioDaReceita, setVeioDaReceita] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cartao, setCartao] = useState<any>(null);
  const [duplicado, setDuplicado] = useState<ClienteHub | null>(null);

  const responsaveis = useResponsaveis();
  const criar = useCriarCliente();
  const digitos = soDigitosDoc(f.cpf_cnpj);
  const ehPJ = digitos.length > 11;
  const buscaDoc = useBuscaClientes(digitos.length >= 3 ? digitos : "");

  const set = (k: keyof typeof VAZIO, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function consultar() {
    if (digitos.length !== 14) return;
    const jaExiste = (buscaDoc.data ?? []).find((c) => c.cpf_cnpj === digitos);
    if (jaExiste) { setDuplicado(jaExiste); return; }

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
      const c = r.cadastro;
      setCartao(c);
      setVeioDaReceita(true);
      setF((p) => ({
        ...p,
        nome: c.razao_social ?? p.nome,
        nome_fantasia: c.nome_fantasia ?? "",
        email: c.email ?? "",
        telefone: c.telefone ?? "",
        logradouro: c.logradouro ?? "",
        numero: c.numero ?? "",
        complemento: c.complemento ?? "",
        bairro: c.bairro ?? "",
        cep: c.cep ?? "",
        municipio: c.municipio ?? "",
        uf: c.uf ?? "",
        cnae: c.cnae ?? "",
        cnae_descricao: c.cnae_descricao ?? "",
        porte: c.porte ?? "",
        capital_social: c.capital_social != null ? String(c.capital_social) : "",
        situacao_cadastral: c.situacao_cadastral ?? "",
        data_abertura: c.data_abertura ?? "",
        natureza_juridica: c.natureza_juridica ?? "",
      }));
    } finally {
      setConsultando(false);
    }
  }

  async function salvar() {
    if (digitos.length !== 11 && digitos.length !== 14) return toast.error("CPF ou CNPJ inválido.");
    if (!f.nome.trim()) return toast.error("Informe o nome ou a razão social.");
    const jaExiste = (buscaDoc.data ?? []).find((c) => c.cpf_cnpj === digitos);
    if (jaExiste) { setDuplicado(jaExiste); return; }

    try {
      const novo = await criar.mutateAsync({
        tipo_pessoa: ehPJ ? "PJ" : "PF",
        cpf_cnpj: digitos,
        nome: f.nome.trim(),
        nome_fantasia: f.nome_fantasia || null,
        email: f.email || null,
        telefone: f.telefone || null,
        logradouro: f.logradouro || null,
        numero: f.numero || null,
        complemento: f.complemento || null,
        bairro: f.bairro || null,
        cep: f.cep || null,
        municipio: f.municipio || null,
        uf: f.uf || null,
        cnae: f.cnae || null,
        cnae_descricao: f.cnae_descricao || null,
        porte: f.porte || null,
        capital_social: f.capital_social ? Number(f.capital_social) : null,
        situacao_cadastral: f.situacao_cadastral || null,
        data_abertura: f.data_abertura || null,
        natureza_juridica: f.natureza_juridica || null,
        dados_cartao_cnpj: veioDaReceita ? cartao : null,
        cartao_atualizado_em: veioDaReceita ? new Date().toISOString() : null,
        cartao_fonte: veioDaReceita ? "rfb" : "manual",
        responsavel_id: podeResponsavel && responsavel ? responsavel : null,
      });
      onPronto(novo);
    } catch (err) {
      const msg = mensagemDeErro(err);
      if (msg.includes("responsável")) {
        toast.error("Você não tem permissão para definir o responsável pelo cliente.");
      } else if (msg.includes("duplicate key") || msg.includes("cpf_cnpj")) {
        toast.error("Já existe um cliente com este documento.");
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Cadastrar cliente novo</h3>
        <Button variant="ghost" size="sm" onClick={onCancelar}>Voltar à busca</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>CPF / CNPJ *</Label>
          <div className="flex gap-2">
            <Input
              value={mascaraDoc(f.cpf_cnpj)}
              onChange={(e) => set("cpf_cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
            />
            <Button
              type="button"
              variant="outline"
              onClick={consultar}
              disabled={digitos.length !== 14 || consultando}
            >
              {consultando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar"}
            </Button>
          </div>
          {digitos.length === 11 && (
            <p className="text-xs text-muted-foreground">
              Para CPF não há consulta automática: preencha os campos à mão.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label>{ehPJ ? "Razão social *" : "Nome *"}</Label>
          <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} />
        </div>

        {duplicado && (
          <div className="sm:col-span-2">
            <Alert className="border-amber-500/50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Este documento já está cadastrado</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2 text-xs">
                <span>{duplicado.nome}</span>
                <Button size="sm" variant="outline" onClick={() => onPronto(duplicado)}>
                  Usar este cliente
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {veioDaReceita && (
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Dados trazidos do cadastro público da Receita. Pode corrigir qualquer campo à mão.
          </p>
        )}

        <div className="space-y-1">
          <Label>Nome fantasia</Label>
          <Input value={f.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Telefone</Label>
          <Input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>CEP</Label>
          <Input value={f.cep} onChange={(e) => set("cep", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Logradouro</Label>
          <Input value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Número</Label>
          <Input value={f.numero} onChange={(e) => set("numero", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Complemento</Label>
          <Input value={f.complemento} onChange={(e) => set("complemento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Bairro</Label>
          <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Município</Label>
          <Input value={f.municipio} onChange={(e) => set("municipio", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>UF</Label>
          <Input maxLength={2} value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
        </div>
        <div className="space-y-1">
          <Label>CNAE</Label>
          <Input value={f.cnae} onChange={(e) => set("cnae", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Descrição do CNAE</Label>
          <Input value={f.cnae_descricao} onChange={(e) => set("cnae_descricao", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Porte</Label>
          <Input value={f.porte} onChange={(e) => set("porte", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Capital social</Label>
          <Input
            type="number"
            value={f.capital_social}
            onChange={(e) => set("capital_social", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Situação cadastral</Label>
          <Input value={f.situacao_cadastral} onChange={(e) => set("situacao_cadastral", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Data de abertura</Label>
          <Input type="date" value={f.data_abertura} onChange={(e) => set("data_abertura", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Natureza jurídica</Label>
          <Input value={f.natureza_juridica} onChange={(e) => set("natureza_juridica", e.target.value)} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Responsável pelo cliente</Label>
          {podeResponsavel ? (
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger><SelectValue placeholder="Sem responsável definido" /></SelectTrigger>
              <SelectContent>
                {(responsaveis.data ?? []).map((r) => (
                  <SelectItem key={r.user_id} value={r.user_id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              Não definido. Definir o responsável exige permissão específica.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button onClick={salvar} disabled={criar.isPending} className="bg-[#338B85] hover:bg-[#338B85]/90">
          {criar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Salvar cliente
        </Button>
      </div>
    </div>
  );
}
