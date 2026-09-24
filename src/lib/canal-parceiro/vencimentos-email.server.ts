import { mensagemDeErro } from "@/lib/erro";
// Alerta de vencimento de contrato de parceria para o jurídico e o comercial.
// Server-only: usa service role e o envio gerenciado do Hub.
//
// A RPC resolve a escada de avisos (60/30/15 dias e diário a partir de 10,
// inclusive depois de vencido), quem recebe e o que já foi avisado. O sender
// só envia para os destinatarios da linha e marca com o tipo_aviso da linha:
// a marcação é o que impede o aviso diário de virar spam.

type Pendente = {
  contrato_id: string;
  canal_id: string | null;
  parceiro: string | null;
  razao_social: string | null;
  cnpj: string | null;
  arquivo_nome: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  dias_para_vencer: number | null;
  tipo_aviso: string | null;
  vencido: boolean | null;
  destinatarios: string[] | null;
  repasse_acumulado: number | null;
  renovacao_automatica: boolean | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
};

const dataBR = (iso: string | null) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";

const moedaBR = (v: number | null) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number | null) =>
  v == null ? "—" : `${Math.round(Number(v) * 100)}%`;

const percentuaisRepasse = (p: Pendente) => {
  const demais = p.pct_demais == null;
  return (
    `Benefícios ${pct(p.pct_beneficios)} · Garantia ${pct(p.pct_garantia)} · ` +
    `Demais ${pct(demais ? p.pct_garantia : p.pct_demais)}${demais ? " (herdado)" : ""}`
  );
};

export async function avisarVencimentosPendentes(): Promise<
  { ok: true; enviados: number; falhas?: number } | { ok: false; erro: string }
> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const { emailsTreinamento, PREFIXO_TREINO } = await import("@/lib/canal-parceiro/avisos-email.server");
  let treinamento: string[] | null;
  try {
    treinamento = await emailsTreinamento(lavoroAdmin);
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }

  const { data, error } = await lavoroAdmin.rpc(
    "rpc_canal_parceiro_vencimentos_pendentes" as never,
    { p_dias: 60 } as never,
  );
  if (error) return { ok: false, erro: error.message };

  const pendentes = (data ?? []) as Pendente[];
  if (pendentes.length === 0) return { ok: true, enviados: 0 };

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  let enviados = 0;
  let falhas = 0;

  for (const p of pendentes) {
    const destinatarios = (p.destinatarios ?? []).filter(
      (d): d is string => typeof d === "string" && d.includes("@"),
    );
    if (destinatarios.length === 0) continue;

    const tipoAviso = p.tipo_aviso ?? "VENCE_60";

    for (const destinatario of destinatarios) {
      const messageId = crypto.randomUUID();
      const envios = treinamento ?? [destinatario];
      try {
        let algumOk = false;
        for (const destinoReal of envios) {
        const resultado = await sendTemplateEmail("canal-parceiro-vencimento", destinoReal, {
          idempotencyKey: treinamento ? `${messageId}-${destinoReal}` : messageId,
          assuntoPrefixo: treinamento ? PREFIXO_TREINO : undefined,
          templateData: {
            parceiro: p.parceiro ?? "—",
            razaoSocial: p.razao_social ?? "—",
            cnpj: p.cnpj && p.cnpj.trim() ? p.cnpj : "CNPJ não cadastrado",
            vigenciaInicio: dataBR(p.vigencia_inicio),
            vigenciaFim: dataBR(p.vigencia_fim),
            diasParaVencer: Number(p.dias_para_vencer ?? 0),
            arquivoNome: p.arquivo_nome ?? "—",
            repasseAcumulado: moedaBR(p.repasse_acumulado),
            percentuais: percentuaisRepasse(p),
            renovacaoAutomatica: p.renovacao_automatica,
            tipoAviso,
            vencido: p.vencido === true,
          },
        });

        if (resultado.sent) algumOk = true;
        }
        if (!algumOk) {
          falhas += 1;
          continue;
        }

        const { error: erroMarca } = await lavoroAdmin.rpc(
          "canal_parceiro_marcar_aviso" as never,
          {
            p_contrato_id: p.contrato_id,
            p_tipo: tipoAviso,
            p_destinatario: destinatario,
            p_message_id: messageId,
          } as never,
        );
        if (erroMarca) {
          console.error("[canal-parceiro-vencimentos] falha ao marcar aviso", erroMarca.message);
        }
        enviados += 1;
      } catch (e) {
        falhas += 1;
        console.error(
          "[canal-parceiro-vencimentos] falha no envio",
          p.contrato_id,
          mensagemDeErro(e),
        );
      }
    }
  }

  return { ok: true, enviados, falhas };
}
