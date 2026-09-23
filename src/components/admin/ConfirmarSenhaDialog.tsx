import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { confirmarSenhaPropria } from "@/lib/confirmar-senha.functions";
import { mensagemDeErro } from "@/lib/erro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmarSenhaDialog({
  aberto,
  area,
  alvo,
  titulo = "Confirme sua senha",
  descricao,
  onConfirmado,
  onFechar,
}: {
  aberto: boolean;
  area: string;
  alvo?: string | null;
  titulo?: string;
  descricao?: React.ReactNode;
  onConfirmado: () => void;
  onFechar: () => void;
}) {
  const confirmar = useServerFn(confirmarSenhaPropria);
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) { setSenha(""); setErro(null); setValidando(false); }
  }, [aberto]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!senha || validando) return;
    setValidando(true);
    setErro(null);
    try {
      const r = await confirmar({ data: { area, senha, alvo: alvo ?? null } });
      if (r.ok) {
        setSenha("");
        onConfirmado();
      } else {
        setErro("Senha incorreta");
        setSenha("");
      }
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSenha("");
    } finally {
      setValidando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !validando) onFechar(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] min-w-0 sm:max-w-sm">
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> {titulo}
            </DialogTitle>
            <DialogDescription className="break-words">
              {descricao ?? "Digite a sua senha do Hub para continuar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Esta ação será registrada em auditoria em nome de quem confirmar a senha.
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={validando}>Cancelar</Button>
            <Button type="submit" disabled={!senha || validando}>
              {validando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmarSenhaDialog;
