// Aba do comercial: fila das demandas de Garantia aguardando retorno dele.
// Corte de verdade: a RPC devolve vazio e a server function recusa sem a permissão.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PaginaHub } from "@/components/hub/pagina-hub";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasPermission } from "@/hooks/use-meu-perfil";
import { supabase } from "@/integrations/supabase/client";
import { responderComercial } from "@/lib/garantia/comercial.functions";
import { TAMANHO_MAXIMO_BYTES } from "@/lib/garantia/documentos-regra";
import { mensagemDeErro } from "@/lib/erro";

export const Route = createFileRoute("/_authenticated/garantia_/comercial")({
  component: ComercialPage,
  head: () => ({
    meta: [
      { title: "Comercial · Garantia | Hub Lavoro Seguros" },
      { name: "description", content: "Fila das demandas de Garantia aguardando retorno do comercial." },
      { property: "og:title", content: "Comercial · Garantia | Hub Lavoro Seguros" },
      { property: "og:description", content: "Demandas de Garantia aguardando o retorno do comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface ItemFila {
  demanda_id: string;
  numero: string | null;
  legenda: string | null;
  cliente_nome: string | null;
  status_nome: string;
  aguardando_desde: string | null;
  o_que_falta: string | null;
}

const CHAVE = ["garantia", "fila-comercial"];

const ERROS: Record<string, string> = {
  sem_permissao: "Você não tem acesso à aba do comercial.",
  demanda_nao_aguarda_comercial: "Esta demanda não está mais aguardando o comercial.",
  arquivo_grande: "Um dos arquivos passa de 20 MB.",
  falha_upload: "Não foi possível enviar o arquivo.",
};

function ComercialPage() {
  const perfil = useMeuPerfilEfetivo();
  const pode = hasPermission(perfil, "menu_garantia_comercial");
  const [aberto, setAberto] = useState<ItemFila | null>(null);
  const { data: fila = [], isLoading } = useQuery({
    queryKey: CHAVE,
    enabled: pode,
    queryFn: async (): Promise<ItemFila[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("rpc_garantia_fila_comercial");
      if (error) throw error;
      return (data ?? []) as ItemFila[];
    },
  });

  if (!pode) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A aba do comercial de Garantia é restrita. Solicite a liberação a um administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PaginaHub
      trilha={["Garantia"]}
      titulo="Comercial"
      subtitulo="Demandas de Garantia aguardando seu retorno"
      acoes={
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Ajuda: fila do comercial" className="text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm text-muted-foreground">
            Aqui aparecem as demandas em que o corretor está esperando algo do comercial, a mais antiga primeiro.
            Abra a demanda, responda o que foi pedido e anexe os documentos. O corretor é avisado e decide se a pendência foi resolvida.
          </PopoverContent>
        </Popover>
      }
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : fila.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma demanda aguardando o comercial no momento.</p>
      ) : (
        <ul className="space-y-2" data-tour="gar-fila-comercial">
          {fila.map((i) => (
            <li key={i.demanda_id}>
              <button type="button" onClick={() => setAberto(i)}
                className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 break-words font-medium">
                    {[i.numero, i.legenda].filter(Boolean).join(" · ") || "Demanda de Garantia"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Aguardando desde {i.aguardando_desde ? new Date(i.aguardando_desde).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{i.cliente_nome ?? "Cliente não informado"} · {i.status_nome}</p>
                {i.o_que_falta && (
                  <p className="mt-2 whitespace-pre-line rounded-md bg-muted/50 p-2 text-sm">{i.o_que_falta}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto && <DialogoRetorno item={aberto} onFechar={() => setAberto(null)} />}
    </PaginaHub>
  );
}

function paraBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function DialogoRetorno({ item, onFechar }: { item: ItemFila; onFechar: () => void }) {
  const qc = useQueryClient();
  const enviarFn = useServerFn(responderComercial);
  const [resposta, setResposta] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const grande = arquivos.some((f) => f.size > TAMANHO_MAXIMO_BYTES);

  const enviar = async () => {
    setEnviando(true);
    try {
      const anexos = await Promise.all(
        arquivos.map(async (f) => ({
          nome_arquivo: f.name,
          mime_type: f.type || "application/octet-stream",
          tamanho_bytes: f.size,
          base64: await paraBase64(f),
        })),
      );
      const r = await enviarFn({ data: { demanda_id: item.demanda_id, resposta: resposta.trim(), anexos } });
      if (!r.ok) {
        toast.error(r.detalhe ?? ERROS[r.erro] ?? "Não foi possível enviar o retorno.");
        return;
      }
      toast.success("Retorno enviado ao corretor.");
      qc.invalidateQueries({ queryKey: CHAVE });
      onFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar o retorno."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{[item.numero, item.legenda].filter(Boolean).join(" · ") || "Demanda de Garantia"}</DialogTitle>
        </DialogHeader>
        {item.o_que_falta && <p className="whitespace-pre-line rounded-md bg-muted/50 p-2 text-sm">{item.o_que_falta}</p>}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Resposta *</Label>
            <Textarea rows={4} maxLength={2000} value={resposta} onChange={(e) => setResposta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Anexos</Label>
            <Input type="file" multiple onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} />
            {grande && <p className="text-xs text-destructive">Cada arquivo pode ter até 20 MB.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!resposta.trim() || grande || enviando} onClick={() => void enviar()}>
            {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Enviar retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
