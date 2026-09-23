import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { enviarCodigoSenhaAprovacao } from "@/lib/confirmar-senha.functions";
import { mensagemDeErro } from "@/lib/erro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Tela = "carregando" | "criar" | "confirmar" | "esqueci";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

function horaBrasilia(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function primeira<T>(d: unknown): T | null {
  if (Array.isArray(d)) return (d[0] as T) ?? null;
  return (d as T) ?? null;
}

export function ConfirmarSenhaDialog({
  aberto,
  area,
  alvo,
  titulo = "Confirme sua senha de aprovação",
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
  const enviarCodigo = useServerFn(enviarCodigoSenhaAprovacao);
  const [tela, setTela] = useState<Tela>("carregando");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [codigo, setCodigo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueadaAte, setBloqueadaAte] = useState<string | null>(null);
  const [emailMascarado, setEmailMascarado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);

  function limparCampos() {
    setSenha(""); setSenha2(""); setCodigo(""); setErro(null);
  }

  useEffect(() => {
    if (!aberto) {
      limparCampos();
      setTela("carregando"); setProcessando(false); setBloqueadaAte(null);
      setEmailMascarado(null); setEspera(0);
      return;
    }
    let vivo = true;
    (async () => {
      const { data, error } = await rpc("rpc_senha_aprovacao_status");
      if (!vivo) return;
      if (error) { setErro(mensagemDeErro(error)); setTela("confirmar"); return; }
      const s = primeira<{ definida: boolean; bloqueada_ate: string | null }>(data);
      const bloq = s?.bloqueada_ate && new Date(s.bloqueada_ate) > new Date() ? s.bloqueada_ate : null;
      setBloqueadaAte(bloq);
      setTela(s?.definida ? "confirmar" : "criar");
    })();
    return () => { vivo = false; };
  }, [aberto]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function pedirCodigo() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarCodigo();
      setEmailMascarado(r.email_mascarado);
      setEspera(60);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  function irPara(t: Tela) {
    limparCampos();
    setTela(t);
    if (t === "esqueci") void pedirCodigo();
  }

  function validarNova(): boolean {
    if (senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres"); return false; }
    if (senha !== senha2) { setErro("As senhas não conferem"); return false; }
    return true;
  }

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (processando) return;
    setErro(null);
    const p_alvo = alvo ?? null;
    try {
      if (tela === "criar") {
        if (!validarNova()) return;
        setProcessando(true);
        const { data, error } = await rpc("rpc_senha_aprovacao_criar", { p_senha: senha, p_area: area, p_alvo });
        if (error) throw error;
        if (data === false) { setErro("Não foi possível criar a senha"); return; }
        limparCampos();
        onConfirmado();
      } else if (tela === "confirmar") {
        if (!senha || bloqueadaAte) return;
        setProcessando(true);
        const { data, error } = await rpc("rpc_senha_aprovacao_confirmar", { p_senha: senha, p_area: area, p_alvo });
        if (error) throw error;
        const r = primeira<{ ok: boolean; motivo: string; bloqueada_ate: string | null }>(data);
        setSenha("");
        if (r?.ok || r?.motivo === "OK") { limparCampos(); onConfirmado(); return; }
        if (r?.motivo === "BLOQUEADA") {
          setBloqueadaAte(r.bloqueada_ate);
          setErro(r.bloqueada_ate ? `Muitas tentativas. Tente de novo às ${horaBrasilia(r.bloqueada_ate)}` : "Muitas tentativas. Tente de novo mais tarde");
        } else if (r?.motivo === "SEM_SENHA") {
          irPara("criar");
        } else {
          setErro("Senha incorreta");
        }
      } else if (tela === "esqueci") {
        if (!/^\d{6}$/.test(codigo)) { setErro("Informe o código de 6 dígitos"); return; }
        if (!validarNova()) return;
        setProcessando(true);
        const { data, error } = await rpc("rpc_senha_aprovacao_redefinir", {
          p_codigo: codigo, p_nova_senha: senha, p_area: area, p_alvo,
        });
        if (error) throw error;
        const r = primeira<{ ok: boolean; motivo: string }>(data);
        if (r?.ok || r?.motivo === "OK") {
          toast.success("Senha de aprovação redefinida");
          limparCampos();
          setBloqueadaAte(null);
          onConfirmado();
        } else if (r?.motivo === "CODIGO_EXPIRADO") {
          setErro("Código expirado. Peça um novo.");
        } else {
          setErro("Código incorreto");
        }
      }
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setProcessando(false);
    }
  }

  const avisoBloqueio = tela === "confirmar" && bloqueadaAte && !erro
    ? `Muitas tentativas. Tente de novo às ${horaBrasilia(bloqueadaAte)}`
    : null;

  let cabecalho: { t: React.ReactNode; d: React.ReactNode } = { t: titulo, d: descricao ?? "Digite a sua senha de aprovação para continuar." };
  if (tela === "criar") cabecalho = {
    t: "Crie sua senha de aprovação",
    d: "É a primeira vez que você aprova algo no Hub. Crie uma senha de aprovação. Ela é diferente da senha de login e será pedida sempre que você aprovar algo.",
  };
  if (tela === "esqueci") cabecalho = {
    t: "Esqueci minha senha",
    d: emailMascarado
      ? `Enviamos um código de 6 dígitos para ${emailMascarado}. Ele vale por 15 minutos.`
      : enviando ? "Enviando o código para o seu e-mail…" : "Peça um código para criar uma nova senha de aprovação.",
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !processando) onFechar(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] min-w-0 sm:max-w-sm">
        <form onSubmit={enviar} className="min-w-0 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0" /> {cabecalho.t}
            </DialogTitle>
            <DialogDescription className="break-words">{cabecalho.d}</DialogDescription>
          </DialogHeader>

          {tela === "carregando" ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {tela === "esqueci" && (
                <Input
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                  value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  placeholder="Código de 6 dígitos"
                />
              )}
              <Input
                type="password"
                autoComplete={tela === "confirmar" ? "current-password" : "new-password"}
                autoFocus={tela !== "esqueci"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={tela === "confirmar" ? "Senha de aprovação" : "Nova senha"}
                disabled={tela === "confirmar" && !!bloqueadaAte}
              />
              {tela !== "confirmar" && (
                <Input
                  type="password" autoComplete="new-password"
                  value={senha2} onChange={(e) => setSenha2(e.target.value)}
                  placeholder="Repetir senha"
                />
              )}
              {(erro || avisoBloqueio) && <p className="text-sm text-destructive break-words">{erro ?? avisoBloqueio}</p>}
              {tela === "confirmar" && (
                <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => irPara("esqueci")} disabled={processando}>
                  Esqueci minha senha
                </button>
              )}
              {tela === "esqueci" && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => irPara("confirmar")} disabled={processando}>
                    Voltar
                  </button>
                  <Button type="button" variant="outline" size="sm" onClick={pedirCodigo} disabled={enviando || espera > 0 || processando}>
                    {enviando && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {espera > 0 ? `Reenviar código (${espera}s)` : "Reenviar código"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">Esta ação será registrada em auditoria em seu nome.</p>
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={processando}>Cancelar</Button>
            <Button
              type="submit"
              disabled={processando || tela === "carregando" || (tela === "confirmar" && (!senha || !!bloqueadaAte))}
            >
              {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tela === "criar" ? "Criar e continuar" : tela === "esqueci" ? "Salvar e continuar" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmarSenhaDialog;
