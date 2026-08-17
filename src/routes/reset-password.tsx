import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoBranca from "@/assets/logo-branca.png.asset.json";
import fundoPredio from "@/assets/fundo-login-predio.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir senha · Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Defina uma nova senha para acessar o Hub Lavoro Seguros com seu e-mail corporativo.",
      },
      { property: "og:title", content: "Definir senha · Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Crie uma nova senha de acesso ao Hub Lavoro Seguros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha definida com sucesso");
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      toast.error("Não foi possível definir a senha", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a1e2c]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${fundoPredio.url})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(6,20,32,0.55) 0%, rgba(6,20,32,0.75) 100%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute left-8 top-8 z-10">
        <img src={logoBranca.url} alt="Lavoro Seguros" className="h-10 w-auto" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-24">
        <div className="w-full max-w-[440px] rounded-2xl border border-[#B8DCE9]/60 bg-[#DDECF3]/95 p-8 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <h1 className="text-center font-display text-xl font-semibold tracking-tight text-[#14405C]">
            Definir nova senha
          </h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Escolha uma senha para acessar o Hub com seu e-mail corporativo.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                Nova senha
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">
                Confirmar senha
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full justify-center gap-2 bg-[#14405C] text-white hover:bg-[#0f3149]"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar senha
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Acesso restrito Lavoro Seguros
          </div>
        </div>
      </div>
    </div>
  );
}
