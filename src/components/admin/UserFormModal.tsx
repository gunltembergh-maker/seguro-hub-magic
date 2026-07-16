import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { adminPrecadastrarUsuarioFull } from "@/lib/admin-precadastro.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const LAVORO_DOMAIN = "lavoroseguros.com.br";

function cpfMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return false;
  if (/^(\d)\1+$/.test(nums)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d1 === parseInt(nums[9]) && d2 === parseInt(nums[10]);
}

export interface UserFormInitial {
  isEdit?: boolean;
  user_id?: string;
  email?: string;
  full_name?: string | null;
  cpf?: string | null;
  perfil_id?: string | null;
  area?: string | null;
  gestor?: string | null;
  empresa?: string | null;
  tipo_usuario?: string | null;
  blocked?: boolean;
  active?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: UserFormInitial | null;
  onSaved: () => void;
}

export function UserFormModal({ open, onOpenChange, initial, onSaved }: Props) {
  const qc = useQueryClient();
  const isEdit = !!initial?.isEdit;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [area, setArea] = useState("");
  const [gestor, setGestor] = useState("");
  const [empresa, setEmpresa] = useState("Lavoro Seguros");
  const [tipoUsuario, setTipoUsuario] = useState<"interno" | "externo">("interno");
  const [blocked, setBlocked] = useState(false);
  const [active, setActive] = useState(true);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);

  const { data: perfis } = useQuery({
    queryKey: ["perfis-acesso-form"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfis_acesso").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setNome(initial?.full_name || "");
      setEmail(initial?.email || "");
      setCpf(initial?.cpf ? cpfMask(initial.cpf) : "");
      setPerfilId(initial?.perfil_id || "");
      setArea(initial?.area || "");
      setGestor(initial?.gestor || "");
      setEmpresa(initial?.empresa || "Lavoro Seguros");
      setTipoUsuario((initial?.tipo_usuario as "interno" | "externo") || "interno");
      setBlocked(!!initial?.blocked);
      setActive(initial?.active ?? true);
      setCpfError(null);
      setCpfValid(null);
    }
  }, [open, initial]);

  const handleCpfChange = (value: string) => {
    const masked = cpfMask(value);
    setCpf(masked);
    const digits = masked.replace(/\D/g, "");
    if (digits.length < 11) { setCpfValid(null); setCpfError(null); return; }
    if (!validarCPF(digits)) { setCpfValid(false); setCpfError("CPF inválido"); }
    else { setCpfValid(true); setCpfError(null); }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const clean = email.trim().toLowerCase();
      if (!clean || !nome.trim()) throw new Error("Nome e e-mail são obrigatórios");
      if (!/^\S+@\S+\.\S+$/.test(clean)) throw new Error("E-mail inválido");
      if (!perfilId) throw new Error("Selecione um perfil de acesso");
      const digits = cpf.replace(/\D/g, "");
      if (digits.length > 0 && (digits.length !== 11 || !validarCPF(digits))) {
        throw new Error("CPF inválido");
      }

      if (isEdit && initial?.user_id) {
        const { error } = await supabase.rpc("rpc_admin_update_user_full" as never, {
          _user_id: initial.user_id,
          _full_name: nome,
          _perfil_id: perfilId,
          _blocked: blocked,
          _active: active,
          _cpf: digits || null,
          _area: area || null,
          _gestor: gestor || null,
          _empresa: empresa || null,
        } as never);
        if (error) throw error;
      } else {
        await precadastrarFn({
          data: {
            email: clean,
            full_name: nome,
            perfil_id: perfilId,
            cpf: digits || null,
            area: area || null,
            gestor: gestor || null,
            empresa: empresa || null,
            tipo_usuario: tipoUsuario,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Usuário atualizado" : "Pré-cadastro criado");
      qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
      qc.invalidateQueries({ queryKey: ["admin-detalhe-usuario"] });
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error("Falha ao salvar", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Usuário" : "Pré-cadastrar Usuário"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do colaborador."
              : `Cadastre um colaborador com todos os dados. Prefira e-mails @${LAVORO_DOMAIN} para internos.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome Completo *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do colaborador" />
          </div>

          <div className="space-y-1">
            <Label>E-mail Corporativo *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`nome@${LAVORO_DOMAIN}`}
              disabled={isEdit}
            />
          </div>

          <div className="space-y-1">
            <Label>CPF</Label>
            <div className="relative">
              <Input
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                className={cpfError ? "border-destructive pr-9" : cpfValid ? "border-green-500 pr-9" : ""}
              />
              {cpfValid === true && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
              {cpfValid === false && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />}
            </div>
            {cpfError && <p className="text-xs text-destructive mt-1">{cpfError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Área</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex: Comercial - Garantia" />
            </div>
            <div className="space-y-1">
              <Label>Gestor Direto</Label>
              <Input value={gestor} onChange={(e) => setGestor(e.target.value)} placeholder="Ex: Gabriel Boyer" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Perfil de Acesso *</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {perfis?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Lavoro Seguros" />
            </div>
            {!isEdit && (
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={tipoUsuario} onValueChange={(v) => setTipoUsuario(v as "interno" | "externo")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno">Interno</SelectItem>
                    <SelectItem value="externo">Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isEdit && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Ativo</div>
                  <div className="text-xs text-muted-foreground">Usuário pode acessar o Hub</div>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Bloqueado</div>
                  <div className="text-xs text-muted-foreground">Impede o login imediatamente</div>
                </div>
                <Switch checked={blocked} onCheckedChange={setBlocked} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
