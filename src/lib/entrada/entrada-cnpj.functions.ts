// Consulta do cartão CNPJ para a Entrada de Demandas.
//
// A permissão é conferida NO BANCO (pode_entrada_demandas), não na interface:
// a interface é conveniência, o servidor é o portão. A URL da fonte, o corpo
// da resposta upstream e o stack trace ficam só no log do servidor — o cliente
// recebe apenas um código de erro.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ cnpj: z.string().min(11).max(30) });

export const consultarCnpjEntrada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const digitos = data.cnpj.replace(/\D+/g, "");
    if (digitos.length !== 14) {
      return { ok: false as const, erro: "cnpj_invalido" as const };
    }

    const { data: pode, error: erroPerm } = await context.supabase.rpc("pode_entrada_demandas");
    if (erroPerm || pode !== true) {
      return { ok: false as const, erro: "sem_permissao" as const };
    }

    try {
      const { buscarCadastro } = await import("@/lib/cadastro/cnpj-receita.server");
      const cadastro = await buscarCadastro(digitos);
      // 404 na fonte é resposta legítima: CNPJ fora da base, não é falha.
      if (!cadastro) return { ok: false as const, erro: "nao_encontrado" as const };
      return { ok: true as const, cadastro };
    } catch (err) {
      console.error("[entrada-cnpj] falha ao consultar cadastro público:", err);
      return { ok: false as const, erro: "indisponivel" as const };
    }
  });
