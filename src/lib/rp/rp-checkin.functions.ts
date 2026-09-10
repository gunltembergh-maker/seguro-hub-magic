import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipAutorizado, normalizarEntradaIp, normalizarIp } from "@/lib/rp/ip-match";

const InputSchema = z.object({ reserva_id: z.string().uuid() });

/**
 * Todos os IPs que a requisição carrega, em ordem de confiabilidade.
 * O primeiro item de x-forwarded-for é o cliente real; os demais são proxies.
 */
function ipsDaRequisicao() {
  const h = getRequest()?.headers;
  const brutos: Record<string, string> = {};
  const nomes = [
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-client-ip",
    "x-forwarded-for",
    "forwarded",
    "x-vercel-forwarded-for",
    "fly-client-ip",
  ];
  for (const n of nomes) {
    const v = h?.get(n);
    if (v) brutos[n] = v;
  }

  const candidatos: string[] = [];
  const push = (v?: string | null) => {
    if (!v) return;
    for (const parte of v.split(",")) {
      const ip = normalizarIp(parte.replace(/^for=/i, "").replace(/"/g, ""));
      if (ip && !candidatos.includes(ip)) candidatos.push(ip);
    }
  };

  // x-forwarded-for primeiro item = cliente real
  push(brutos["x-forwarded-for"]);
  push(brutos["cf-connecting-ip"]);
  push(brutos["true-client-ip"]);
  push(brutos["x-real-ip"]);
  push(brutos["x-client-ip"]);
  push(brutos["x-vercel-forwarded-for"]);
  push(brutos["fly-client-ip"]);
  push(brutos["forwarded"]);

  return { brutos, candidatos, principal: candidatos[0] ?? null };
}

/** Aceita array JSON, string separada por vírgula/quebra de linha ou JSON em texto. */
function listaDeIps(value: unknown): string[] {
  let v = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[")) {
      try {
        v = JSON.parse(t);
      } catch {
        /* mantém string */
      }
    }
  }
  const cru = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[,;\n]/)
      : [];
  return cru.map((p) => normalizarEntradaIp(String(p))).filter(Boolean);
}

/**
 * Registra o check-in da reserva. A validação do IP do escritório acontece
 * exclusivamente no servidor.
 */
export const fazerCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

    const { brutos, candidatos, principal } = ipsDaRequisicao();
    console.log("[rp-checkin] headers de IP:", JSON.stringify(brutos), "candidatos:", candidatos);

    const registrarNegado = async (motivo: string) => {
      try {
        await lavoroAdmin.from("user_activity_log").insert({
          user_id: context.userId,
          acao: "rp_checkin_negado",
          detalhes: {
            reserva_id: data.reserva_id,
            motivo,
            ip_detectado: principal,
            ips_candidatos: candidatos,
            headers: brutos,
          },
        });
      } catch {
        /* log não pode quebrar o check-in */
      }
    };

    if (!principal) {
      await registrarNegado("ip_nao_identificado");
      return {
        ok: false as const,
        erro: "Não foi possível identificar sua conexão. Tente novamente.",
        ip: null as string | null,
      };
    }

    // Sempre lido do banco a cada tentativa (sem cache de módulo/build).
    const { data: cfg } = await lavoroAdmin
      .from("hub_admin_settings")
      .select("value")
      .eq("key", "rp_ips_escritorio")
      .maybeSingle();

    const permitidos = listaDeIps(cfg?.value);
    const casado = candidatos.find((c) => ipAutorizado(c, permitidos)) ?? null;

    if (!casado) {
      await registrarNegado("ip_fora_da_lista");
      return {
        ok: false as const,
        erro: "Check-in disponível apenas conectado ao Wi-Fi do escritório.",
        ip: principal,
      };
    }

    const { data: resultado, error } = await lavoroAdmin.rpc("rp_registrar_checkin", {
      p_reserva_id: data.reserva_id,
      p_user_id: context.userId,
      p_ip: casado,
    });

    if (error) {
      await registrarNegado(`rpc: ${error.message}`);
      return { ok: false as const, erro: error.message, ip: principal };
    }

    return { ok: true as const, resultado, ip: principal };
  });
