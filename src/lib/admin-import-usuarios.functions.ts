import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Row = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  cpf: z.string().nullable().optional(),
  perfil: z.string().min(1),
  area: z.string().nullable().optional(),
  gestor: z.string().nullable().optional(),
  empresa: z.string().nullable().optional(),
  tipo_usuario: z.enum(["interno", "externo"]).default("interno"),
  times_receita: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  blocked: z.boolean().default(false),
});

const Input = z.object({ linhas: z.array(Row).min(1).max(500) });

export type ImportResultado = {
  email: string;
  status: "criado" | "ignorado" | "erro";
  detalhe?: string;
};

const TIMES_VALIDOS = new Set(["TODOS", "GARANTIA", "BENEFICIOS", "DEMAIS_RAMOS"]);

export const adminImportarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }): Promise<{ resultados: ImportResultado[] }> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem importar usuários.");

    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

    const { data: perfis, error: perfisErr } = await lavoroAdmin
      .from("perfis_acesso")
      .select("id, nome");
    if (perfisErr) throw new Error(perfisErr.message);
    const perfilPorNome = new Map(
      (perfis ?? []).map((p) => [p.nome.trim().toLowerCase(), p.id as string]),
    );

    const emails = data.linhas.map((l) => l.email.trim().toLowerCase());
    const { data: existentes, error: exErr } = await lavoroAdmin
      .from("profiles")
      .select("email")
      .in("email", emails);
    if (exErr) throw new Error(exErr.message);
    const jaExiste = new Set((existentes ?? []).map((p) => (p.email ?? "").toLowerCase()));

    const resultados: ImportResultado[] = [];

    for (const linha of data.linhas) {
      const email = linha.email.trim().toLowerCase();
      try {
        if (jaExiste.has(email)) {
          resultados.push({ email, status: "ignorado", detalhe: "Já cadastrado — nada foi alterado" });
          continue;
        }
        const perfilId = perfilPorNome.get(linha.perfil.trim().toLowerCase());
        if (!perfilId) {
          resultados.push({ email, status: "erro", detalhe: `Perfil "${linha.perfil}" não existe` });
          continue;
        }
        const cpf = (linha.cpf ?? "").replace(/\D/g, "") || null;
        if (cpf && cpf.length !== 11) {
          resultados.push({ email, status: "erro", detalhe: "CPF inválido" });
          continue;
        }
        const times = (linha.times_receita ?? [])
          .map((t) => t.trim().toUpperCase())
          .filter((t) => TIMES_VALIDOS.has(t));

        const { data: created, error: createErr } = await lavoroAdmin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name: linha.full_name },
        });
        if (createErr || !created?.user) {
          resultados.push({ email, status: "erro", detalhe: createErr?.message ?? "Falha no Auth" });
          continue;
        }

        const { error: upErr } = await lavoroAdmin.from("profiles").upsert(
          {
            user_id: created.user.id,
            email,
            full_name: linha.full_name,
            perfil_id: perfilId,
            cpf,
            area: linha.area ?? null,
            gestor: linha.gestor ?? null,
            empresa: linha.empresa ?? null,
            tipo_usuario: linha.tipo_usuario,
            times_receita: times,
            blocked: linha.blocked,
            active: linha.active,
            primeiro_acesso: true,
          },
          { onConflict: "user_id" },
        );
        if (upErr) {
          await lavoroAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
          resultados.push({ email, status: "erro", detalhe: upErr.message });
          continue;
        }
        jaExiste.add(email);
        resultados.push({ email, status: "criado" });
      } catch (e) {
        resultados.push({ email, status: "erro", detalhe: (e as Error).message });
      }
    }

    return { resultados };
  });
