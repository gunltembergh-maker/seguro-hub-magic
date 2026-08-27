import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { verifySuperAdmin } from "@/lib/super-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STORAGE_PREFIX = "hub-super-admin:";
const TTL_MS = 30 * 60 * 1000;

function unlockedNow(area: string) {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(STORAGE_PREFIX + area);
  if (!raw) return false;
  const ts = Number(raw);
  return Number.isFinite(ts) && Date.now() - ts < TTL_MS;
}

export function SuperAdminGate({
  area,
  titulo,
  children,
}: {
  area: string;
  titulo: string;
  children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const verify = useServerFn(verifySuperAdmin);

  // Lê a liberação da sessão apenas no cliente.
  if (!hydrated && typeof window !== "undefined") {
    setHydrated(true);
    if (unlockedNow(area)) setUnlocked(true);
  }

  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha.trim() || loading) return;
    setLoading(true);
    const n = tentativas + 1;
    setTentativas(n);
    try {
      const res = await verify({ data: { area, senha, tentativas: n } });
      if (res.ok) {
        sessionStorage.setItem(STORAGE_PREFIX + area, String(Date.now()));
        setUnlocked(true);
        setSenha("");
      } else {
        setSenha("");
        toast.error("Senha incorreta", {
          description: "O super administrador foi notificado por e-mail.",
        });
      }
    } catch (err) {
      toast.error("Não foi possível validar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
      <Card>
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-primary" />
          <CardTitle className="mt-2 text-lg">Área restrita</CardTitle>
          <p className="text-sm text-muted-foreground">
            {titulo} exige a senha do super administrador.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="super-admin-password">Senha do super administrador</Label>
              <Input
                id="super-admin-password"
                type="password"
                autoComplete="off"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading || !senha.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Desbloquear
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Tentativas incorretas geram alerta imediato por e-mail ao super administrador.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
