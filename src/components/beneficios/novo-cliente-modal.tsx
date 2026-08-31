import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCriarCliente, useReferencia } from "@/hooks/use-beneficios";

const PORTES = ["Micro", "Pequena", "Média", "Grande"];

export function NovoClienteModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tipo, setTipo] = useState<"PJ" | "PF">("PJ");
  const [form, setForm] = useState<Record<string, string>>({});
  const [migrou, setMigrou] = useState(false);
  const canais = useReferencia("canais");
  const criar = useCriarCliente();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.nome_razao_social || !form.cpf_cnpj || !form.canal_id) {
      toast.error("Preencha nome, documento e canal.");
      return;
    }
    try {
      const r = await criar.mutateAsync({
        tipo_pessoa: tipo,
        nome_razao_social: form.nome_razao_social,
        cpf_cnpj: form.cpf_cnpj,
        porte_empresa: tipo === "PJ" ? (form.porte_empresa ?? null) : null,
        cidade: form.cidade ?? null,
        estado: form.estado ?? null,
        telefone: form.telefone ?? null,
        email: form.email ?? null,
        email_copia: form.email_copia ?? null,
        contato_principal: form.contato_principal ?? null,
        canal_id: form.canal_id,
      });
      toast.success(`Cliente salvo — nº ${(r as { numero_cliente: string }).numero_cliente}`);
      setForm({});
      setMigrou(false);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl" style={{ color: "#14405C" }}>
            Novo cliente
          </DialogTitle>
          <DialogDescription>
            O número do cliente na Lavoro é gerado automaticamente ao salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-gray-500">Tipo de pessoa</Label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              {(["PJ", "PF"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
                    tipo === t
                      ? "border-[#14405C] bg-[#14405C] text-white"
                      : "border-gray-300 text-gray-700 hover:border-[#00BAF2]",
                  )}
                >
                  {t === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{tipo === "PJ" ? "Razão social" : "Nome completo"}</Label>
            <Input
              value={form.nome_razao_social ?? ""}
              onChange={(e) => set("nome_razao_social", e.target.value)}
              placeholder={tipo === "PJ" ? "Ex.: Nutriplus Distribuidora S.A." : "Ex.: Marcelo Tadeu Vieira"}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{tipo === "PJ" ? "CNPJ" : "CPF"}</Label>
              <Input
                value={form.cpf_cnpj ?? ""}
                onChange={(e) => set("cpf_cnpj", e.target.value)}
                placeholder={tipo === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"}
              />
            </div>
            {tipo === "PJ" && (
              <div>
                <Label>Porte da empresa</Label>
                <Select value={form.porte_empresa} onValueChange={(v) => set("porte_empresa", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PORTES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} placeholder="Ex.: Campinas" />
            </div>
            <div>
              <Label>Estado</Label>
              <Input maxLength={2} value={form.estado ?? ""} onChange={(e) => set("estado", e.target.value.toUpperCase())} placeholder="SP" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 90000-0000" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={form.canal_id} onValueChange={(v) => set("canal_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(canais.data ?? []).filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Contato principal</Label>
            <Input value={form.contato_principal ?? ""} onChange={(e) => set("contato_principal", e.target.value)} placeholder="Nome de quem responde pelo cliente" />
          </div>

          <div>
            <Label>E-mail principal</Label>
            <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="contato@empresa.com.br" />
          </div>

          <div>
            <Label>E-mail adicional para cópia (opcional)</Label>
            <Input value={form.email_copia ?? ""} onChange={(e) => set("email_copia", e.target.value)} placeholder="financeiro@empresa.com.br" />
          </div>

          <label className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <Checkbox checked={migrou} onCheckedChange={(v) => setMigrou(v === true)} />
            Este cliente migrou de outra corretora (não veio direto para a Lavoro)
          </label>
          <p className="text-xs text-gray-500">
            A migração é registrada no contrato criado para este cliente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={criar.isPending} style={{ background: "#00BAF2" }} className="text-white">
            Salvar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
