import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BeneficiosShell } from "@/components/beneficios/beneficios-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReferencia, useSalvarReferencia, type TabelaRef } from "@/hooks/use-beneficios";

export const Route = createFileRoute("/_authenticated/beneficios/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros de referência — Benefícios | Hub Lavoro" },
      { name: "description", content: "Seguradoras, canais e coberturas usados nos contratos de Benefícios." },
      { property: "og:title", content: "Cadastros de referência — Benefícios" },
      { property: "og:description", content: "Seguradoras, canais e coberturas usados nos contratos de Benefícios." },
    ],
  }),
  component: CadastrosPage,
});

const NAVY = "#14405C";

function CadastrosPage() {
  const [aba, setAba] = useState<TabelaRef>("seguradoras");
  const [editando, setEditando] = useState<{ id?: string; nome: string; ativo: boolean } | null>(null);

  return (
    <BeneficiosShell
      titulo="Cadastros de referência"
      trilha={["Cadastros"]}
      acoes={
        <Button onClick={() => setEditando({ nome: "", ativo: true })} style={{ background: "#00BAF2" }} className="text-white">
          + Novo registro
        </Button>
      }
    >
      <Tabs value={aba} onValueChange={(v) => setAba(v as TabelaRef)}>
        <TabsList>
          <TabsTrigger value="seguradoras">Seguradoras</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="coberturas">Coberturas</TabsTrigger>
        </TabsList>
        {(["seguradoras", "canais", "coberturas"] as TabelaRef[]).map((t) => (
          <TabsContent key={t} value={t}>
            <Tabela tabela={t} onEditar={setEditando} />
          </TabsContent>
        ))}
      </Tabs>

      <EditorModal tabela={aba} registro={editando} onClose={() => setEditando(null)} />
    </BeneficiosShell>
  );
}

function Tabela({
  tabela,
  onEditar,
}: {
  tabela: TabelaRef;
  onEditar: (r: { id: string; nome: string; ativo: boolean }) => void;
}) {
  const { data, isLoading } = useReferencia(tabela);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="p-4 text-left">Nome</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4" />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="p-4 font-semibold" style={{ color: NAVY }}>{r.nome}</td>
              <td className="p-4">
                <Badge variant={r.ativo ? "secondary" : "outline"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
              </td>
              <td className="p-4 text-right">
                <button className="text-[#00BAF2] hover:underline" onClick={() => onEditar(r)}>Editar</button>
              </td>
            </tr>
          ))}
          {!isLoading && !(data ?? []).length && (
            <tr><td colSpan={3} className="p-10 text-center text-gray-500">Nenhum registro.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditorModal({
  tabela,
  registro,
  onClose,
}: {
  tabela: TabelaRef;
  registro: { id?: string; nome: string; ativo: boolean } | null;
  onClose: () => void;
}) {
  const salvar = useSalvarReferencia(tabela);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [carregado, setCarregado] = useState<string | null>(null);

  if (registro && carregado !== (registro.id ?? "novo")) {
    setCarregado(registro.id ?? "novo");
    setNome(registro.nome);
    setAtivo(registro.ativo);
  }

  const submit = async () => {
    if (!nome.trim()) return toast.error("Informe o nome.");
    try {
      await salvar.mutateAsync({ id: registro?.id, nome: nome.trim(), ativo });
      toast.success("Registro salvo.");
      setCarregado(null);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={!!registro} onOpenChange={(v) => { if (!v) { setCarregado(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display" style={{ color: NAVY }}>
            {registro?.id ? "Editar registro" : "Novo registro"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo (desmarcar desativa sem excluir)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setCarregado(null); onClose(); }}>Cancelar</Button>
          <Button onClick={submit} disabled={salvar.isPending} style={{ background: "#00BAF2" }} className="text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
