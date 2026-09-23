import { createClient } from "@supabase/supabase-js";
import { lavoroAdmin } from "@/integrations/supabase/lavoro-admin.server";

interface Entrada {
  area: string;
  senha: string;
  alvo?: string | null;
}

interface Contexto {
  userId: string;
  claims?: { email?: string } | Record<string, unknown>;
}

/** Valida a senha do próprio usuário com um client descartável e registra em auditoria. */
export async function confirmarSenhaDoUsuario(data: Entrada, context: Contexto) {
  let email = (context.claims as { email?: string } | undefined)?.email ?? null;
  if (!email) {
    const { data: u } = await lavoroAdmin.auth.admin.getUserById(context.userId);
    email = u?.user?.email ?? null;
  }

  let ok = false;
  if (email) {
    const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "https://primmycdkkiziyhqkkkv.supabase.co";
    const anon =
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
      process.env["SUPABASE_PUBLISHABLE_KEY"] ??
      process.env["VITE_SUPABASE_ANON_KEY"];
    if (!anon) throw new Error("Configuração de autenticação ausente no servidor.");
    const descartavel = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storage: undefined },
    });
    const { data: s, error } = await descartavel.auth.signInWithPassword({ email, password: data.senha });
    ok = !error && s?.user?.id === context.userId;
    if (s?.session) await descartavel.auth.signOut({ scope: "local" }).catch(() => {});
  }

  await lavoroAdmin.from("user_activity_log").insert({
    user_id: context.userId,
    acao: ok ? "senha_confirmada" : "senha_confirmada_falha",
    detalhes: ok ? { area: data.area, alvo: data.alvo ?? null } : { area: data.area },
  } as never);

  return { ok };
}
