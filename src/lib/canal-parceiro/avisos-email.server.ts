// Avisos por e-mail do Canal Parceiros: repasse (pedido, resposta, cobrança),
// conferência de contrato e alteração de percentual.
//
// Server-only: usa service role e o envio gerenciado do Hub. O aviso só é
// marcado depois que o envio dá certo — falhou, a rodada seguinte tenta de novo.
// Nenhum link para arquivo: todos os botões levam para a tela do Hub.
import { mensagemDeErro } from "@/lib/erro";
import { SITE_URL } from "@/lib/email-templates/_shared";

// O servidor roda em UTC: tudo formatado no horário de Brasília.
// Data pura (YYYY-MM-DD) ancorada ao meio-dia para nunca trocar de dia.
const dataBR = (iso: string | null | undefined) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";

const dataHoraBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

const moedaBR = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Percentuais vêm do banco como fração (0.30 → "30%"). */
const pctBR = (v: number | null | undefined) =>
  v == null
    ? "—"
    : `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const simNao = (v: boolean | null | undefined) => (v == null ? "—" : v ? "sim" : "não");

type Destinatarios = string[] | null;

type RepassePendente = {
  tipo: string;
  demanda_id: string;
  parceiro: string | null;
  ciclo: string | null;
  linhas: number | null;
  valor_total: number | null;
  data_prevista: string | null;
  dias_de_atraso: number | null;
  solicitante_nome: string | null;
  solicitante_email: string | null;
  financeiro_nome: string | null;
  situacao?: string | null;
  observacao: string | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type VerificacaoPendente = {
  contrato_id: string;
  parceiro: string | null;
  arquivo_nome: string | null;
  situacao: string | null;
  motivo: string | null;
  origem_leitura: string | null;
  declarado_assinado: boolean | null;
  assinatura_lida: boolean | null;
  enviado_por_nome: string | null;
  enviado_em: string | null;
  repasse_acumulado: number | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type AlteracaoPendente = {
  tipo: string;
  alteracao_id: string;
  parceiro: string | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  pct_beneficios_contrato: number | null;
  pct_garantia_contrato: number | null;
  pct_demais_contrato: number | null;
  minimo: number | null;
  vigencia_fim: string | null;
  justificativa: string | null;
  diretor_email: string | null;
  anexo_nome: string | null;
  solicitante_nome: string | null;
  solicitado_em: string | null;
  situacao: string | null;
  aprovador_nome: string | null;
  observacao: string | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type LiberacaoPendente = {
  tipo: string;
  liberacao_id: string;
  parceiro: string | null;
  ciclo: string | null;
  justificativa: string | null;
  nome_de_acordo: string | null;
  email_de_acordo: string | null;
  anexo_nome: string | null;
  solicitante_nome: string | null;
  solicitante_email: string | null;
  solicitado_em: string | null;
  situacao: string | null;
  aprovador_nome: string | null;
  observacao: string | null;
  prazo_em: string | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type ContratoDecisaoPendente = {
  contrato_id: string;
  parceiro: string | null;
  arquivo_nome: string | null;
  situacao: string | null;
  motivo: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  enviado_por_nome: string | null;
  corrigido_por_nome: string | null;
  corrigido_em: string | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type DocPendente = {
  tipo: "NF_ENVIADA" | "NF_DECIDIDA" | "PAGAMENTO" | string;
  documento_id: string;
  demanda_id: string;
  canal_id: string | null;
  parceiro: string | null;
  chave_planilha: string | null;
  ciclo: string | null;
  ciclo_ano: number | null;
  ciclo_mes: number | null;
  situacao: string | null;
  numero_nf: string | null;
  valor_nf: number | null;
  valor_autorizado: number | null;
  valor_diverge: boolean | null;
  data_emissao: string | null;
  data_prevista: string | null;
  data_pagamento: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  motivo: string | null;
  enviado_por_nome: string | null;
  conferido_por_nome: string | null;
  assinatura_nome: string | null;
  assinatura_area: string | null;
  destinatarios: Destinatarios;
  destinatarios_anexos: Destinatarios;
  base_path: string | null;
  base_nome: string | null;
  comercial_ja_enviado?: boolean | null;
  anexos_ja_enviados?: boolean | null;
};

type Envio = {
  template: string;
  assunto: string;
  destinatarios: string[];
  dados: Record<string, unknown>;
};

const RODAPE = "aviso automático do Canal Parceiros";

function telaFinanceiro(demandaId: string) {
  return `${SITE_URL}/financeiro/fluxo-diario?demanda=${demandaId}`;
}

function telaComercial(demandaId?: string) {
  return demandaId
    ? `${SITE_URL}/comercial/canal-parceiros?demanda=${demandaId}`
    : `${SITE_URL}/comercial/canal-parceiros`;
}

function mudancas(a: AlteracaoPendente) {
  const linhas: { rotulo: string; valor: string }[] = [];
  const par = [
    ["Benefícios", a.pct_beneficios, a.pct_beneficios_contrato],
    ["Garantia", a.pct_garantia, a.pct_garantia_contrato],
    ["Demais ramos", a.pct_demais, a.pct_demais_contrato],
  ] as const;
  for (const [rotulo, pedido, contrato] of par) {
    if (pedido == null) continue;
    linhas.push({ rotulo, valor: `${pctBR(contrato)} para ${pctBR(pedido)}` });
  }
  if (a.minimo != null) linhas.push({ rotulo: "Mínimo por ciclo", valor: moedaBR(a.minimo) });
  if (a.vigencia_fim) linhas.push({ rotulo: "Nova vigência até", valor: dataBR(a.vigencia_fim) });
  return linhas;
}

export async function enviarAvisosCanalParceiro(): Promise<
  { ok: true; enviados: number; falhas?: number } | { ok: false; erro: string }
> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const [repasse, verificacoes, alteracoes, liberacoes, decisoesContrato, docs] = await Promise.all([
    lavoroAdmin.rpc("canal_repasse_emails_pendentes" as never, {} as never),
    lavoroAdmin.rpc("canal_parceiro_verificacoes_para_email" as never, {} as never),
    lavoroAdmin.rpc("canal_parceiro_alteracoes_para_email" as never, {} as never),
    lavoroAdmin.rpc("canal_liberacao_emails_pendentes" as never, {} as never),
    lavoroAdmin.rpc("canal_parceiro_contrato_decisoes_para_email" as never, {} as never),
    lavoroAdmin.rpc("canal_repasse_docs_emails_pendentes" as never, {} as never),
  ]);

  const erro =
    repasse.error ??
    verificacoes.error ??
    alteracoes.error ??
    liberacoes.error ??
    decisoesContrato.error ??
    docs.error;
  if (erro) return { ok: false, erro: erro.message };

  const filaRepasse = (repasse.data ?? []) as RepassePendente[];
  const filaVerificacao = (verificacoes.data ?? []) as VerificacaoPendente[];
  const filaAlteracao = (alteracoes.data ?? []) as AlteracaoPendente[];

  const filaLiberacao = (liberacoes.data ?? []) as LiberacaoPendente[];
  const filaContratoDecisao = (decisoesContrato.data ?? []) as ContratoDecisaoPendente[];
  const filaDocs = (docs.data ?? []) as DocPendente[];

  if (
    filaRepasse.length === 0 &&
    filaVerificacao.length === 0 &&
    filaAlteracao.length === 0 &&
    filaLiberacao.length === 0 &&
    filaContratoDecisao.length === 0 &&
    filaDocs.length === 0
  ) {
    return { ok: true, enviados: 0 };
  }

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  let enviados = 0;
  let falhas = 0;

  /** Envia para todos os destinatários; só devolve true se todos saíram. */
  async function despachar(
    e: Envio,
    contexto: string,
    /** Prefixo estável da idempotência (fila de documentos): `${documento_id}-${tipo}`. */
    chaveEstavel?: string,
  ): Promise<string | null> {
    const destinos = (e.destinatarios ?? []).filter((d) => typeof d === "string" && d.includes("@"));
    if (destinos.length === 0) {
      console.error(`[canal-parceiro-avisos] sem destinatários`, contexto);
      return null;
    }
    const messageId = crypto.randomUUID();
    let algumOk = false;
    for (const destino of destinos) {
      try {
        const r = await sendTemplateEmail(e.template, destino, {
          idempotencyKey: chaveEstavel ? `${chaveEstavel}-${destino}` : `${messageId}-${destino}`,
          templateData: {
            assunto: e.assunto,
            eyebrowTexto: "Canal Parceiros",
            rodape: RODAPE,
            preview: e.assunto,
            ...e.dados,
          },
        });
        if (r.sent) algumOk = true;
      } catch (err) {
        console.error(
          "[canal-parceiro-avisos] falha no envio",
          contexto,
          destino,
          mensagemDeErro(err),
        );
      }
    }
    return algumOk ? messageId : null;
  }

  // ---------- Fila 1: repasse ----------
  for (const r of filaRepasse) {
    const ciclo = r.ciclo ?? "—";
    const parceiro = r.parceiro ?? "—";
    let envio: Envio;

    if (r.tipo === "SOLICITACAO") {
      envio = {
        template: "canal-repasse-solicitacao",
        assunto: `Autorizar repasse de ${parceiro}, ciclo ${ciclo}`,
        destinatarios: r.destinatarios ?? [],
        dados: {
          assinaturaNome: r.assinatura_nome,
          assinaturaArea: r.assinatura_area,
          titulo: "Autorização de repasse",
          paragrafos: [
            `${r.solicitante_nome ?? "O Comercial"} conferiu a relação de repasse de **${parceiro}** do ciclo ${ciclo} e pede sua autorização para o envio ao parceiro, para emissão da nota fiscal.`,
          ],
          destaque: {
            titulo: moedaBR(r.valor_total),
            subtitulo: `${Number(r.linhas ?? 0)} parcelas`,
          },
          observacao: r.observacao
            ? { rotulo: `Observação de ${r.solicitante_nome ?? "quem pediu"}`, texto: r.observacao }
            : null,
          botao: { rotulo: "Ver solicitação", href: telaFinanceiro(r.demanda_id) },
          notaFinal:
            "Na tela você confere o valor, autoriza e informa a data prevista do pagamento. O prazo de resposta é de 24 horas; sem resposta o pedido cai e o Comercial precisa enviar de novo.",
        },
      };
    } else if (r.tipo === "RESPOSTA") {
      const aprovada = (r.situacao ?? "").toUpperCase() !== "RECUSADA" && !!r.data_prevista;
      envio = {
        template: "canal-repasse-resposta",
        assunto: `Financeiro respondeu o repasse de ${parceiro}, ciclo ${ciclo}`,
        destinatarios: r.destinatarios ?? [],
        dados: {
          assinaturaNome: r.assinatura_nome,
          assinaturaArea: r.assinatura_area,
          titulo: "Resposta do Financeiro",
          paragrafos: [
            aprovada
              ? `${r.financeiro_nome ?? "O Financeiro"} autorizou o envio da relação de **${parceiro}**, ciclo ${ciclo}. Pagamento previsto para ${dataBR(r.data_prevista)}, após o recebimento da nota fiscal.`
              : `${r.financeiro_nome ?? "O Financeiro"} não aprovou o envio da relação de **${parceiro}**, ciclo ${ciclo}.`,
          ],
          destaque: { titulo: moedaBR(r.valor_total), subtitulo: `${Number(r.linhas ?? 0)} parcelas` },
          itens: aprovada
            ? [
                { rotulo: "1", valor: "Abra Comercial > Canal Parceiros e localize o parceiro" },
                { rotulo: "2", valor: "Clique em Exportar ao parceiro: o arquivo sai sem prêmio e sem comissão da Lavoro" },
                { rotulo: "3", valor: "Envie o arquivo ao parceiro e peça a nota fiscal" },
                { rotulo: "4", valor: "Quando a nota chegar, clique em Enviar nota fiscal na linha do parceiro" },
                { rotulo: "5", valor: "O Financeiro confere a nota e paga até a data prevista" },
              ]
            : undefined,
          observacao:
            !aprovada && r.observacao
              ? { rotulo: "Observação do Financeiro", texto: r.observacao }
              : null,
          botao: { rotulo: "Ver solicitação", href: telaComercial(r.demanda_id) },
        },
      };
    } else {
      const atraso = Number(r.dias_de_atraso ?? 0);
      envio = {
        template: "canal-repasse-cobranca",
        assunto: `Hoje é o dia do repasse de ${parceiro}`,
        destinatarios: r.destinatarios ?? [],
        dados: {
          assinaturaNome: r.assinatura_nome,
          assinaturaArea: r.assinatura_area,
          titulo: "Pagamento previsto para hoje",
          paragrafos: [
            `O pagamento do repasse de **${parceiro}**, ciclo ${ciclo}, ${
              atraso > 0
                ? `estava previsto para ${dataBR(r.data_prevista)} (há ${atraso} dia(s))`
                : `está previsto para ${dataBR(r.data_prevista)}`
            }. A nota fiscal já foi aprovada. Depois de pagar, registre o pagamento com o comprovante.`,
          ],
          destaque: { titulo: moedaBR(r.valor_total), subtitulo: `${Number(r.linhas ?? 0)} parcelas` },
          botao: { rotulo: "Registrar pagamento", href: telaFinanceiro(r.demanda_id) },
          notaFinal:
            "Com o comprovante anexado, o Hub dá baixa e envia o comprovante ao Comercial e ao middle office.",
        },
      };
    }

    const messageId = await despachar(envio, `repasse ${r.tipo} ${r.demanda_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    const { error: erroMarca } = await lavoroAdmin.rpc("canal_repasse_marcar_email" as never, {
      p_demanda_id: r.demanda_id,
      p_tipo: r.tipo,
      p_message_id: messageId,
    } as never);
    if (erroMarca) console.error("[canal-parceiro-avisos] falha ao marcar repasse", erroMarca.message);
    enviados += 1;
  }

  // ---------- Fila 2: conferência de contrato ----------
  for (const v of filaVerificacao) {
    const parceiro = v.parceiro ?? "—";
    const envio: Envio = {
      template: "canal-parceiro-conferencia",
      assunto: `Conferir contrato de ${parceiro}`,
      destinatarios: v.destinatarios ?? [],
      dados: {
        assinaturaNome: v.assinatura_nome,
        assinaturaArea: v.assinatura_area,
        titulo: "Contrato para conferência",
        paragrafos: [
          `Um contrato precisa da sua conferência. ${v.enviado_por_nome ?? "Alguém do Comercial"} enviou **${v.arquivo_nome ?? "o arquivo"}** em ${dataHoraBR(v.enviado_em)}.`,
        ],
        itens: [
          { rotulo: "Situação", valor: v.situacao ?? "—" },
          { rotulo: "Motivo", valor: v.motivo ?? "—" },
          { rotulo: "Como foi lido", valor: v.origem_leitura ?? "—" },
          {
            rotulo: "Declarado assinado / assinatura lida no arquivo",
            valor: `${simNao(v.declarado_assinado)} / ${simNao(v.assinatura_lida)}`,
          },
          { rotulo: "Repasse acumulado travado", valor: moedaBR(v.repasse_acumulado) },
        ],
        botao: { rotulo: "Ver solicitação", href: telaComercial() },
        notaFinal: "Na tela você abre o documento por um link temporário e decide.",
      },
    };

    const destinos = (v.destinatarios ?? []).filter((d) => typeof d === "string" && d.includes("@"));
    const messageId = await despachar(envio, `verificacao ${v.contrato_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    for (const destino of destinos) {
      const { error: erroMarca } = await lavoroAdmin.rpc("canal_parceiro_marcar_aviso" as never, {
        p_contrato_id: v.contrato_id,
        p_tipo: "VERIFICAR",
        p_destinatario: destino,
        p_message_id: messageId,
      } as never);
      if (erroMarca)
        console.error("[canal-parceiro-avisos] falha ao marcar conferência", erroMarca.message);
    }
    enviados += 1;
  }

  // ---------- Fila 3: alteração de percentual ----------
  for (const a of filaAlteracao) {
    const parceiro = a.parceiro ?? "—";
    const itens = mudancas(a);
    let envio: Envio;

    if (a.tipo === "PEDIDO") {
      envio = {
        template: "canal-parceiro-alteracao-pedido",
        assunto: `Aprovar alteração de percentual de ${parceiro}`,
        destinatarios: a.destinatarios ?? [],
        dados: {
          assinaturaNome: a.assinatura_nome,
          assinaturaArea: a.assinatura_area,
          titulo: "Alteração de percentual",
          paragrafos: [
            `${a.solicitante_nome ?? "O Comercial"} pediu alteração de percentual de **${parceiro}**, com De Acordo de ${a.diretor_email ?? "—"}.`,
          ],
          itens: [...itens, { rotulo: "Anexo com o De Acordo", valor: a.anexo_nome ?? "—" }],
          observacao: a.justificativa
            ? { rotulo: "Justificativa", texto: a.justificativa }
            : null,
          botao: { rotulo: "Ver solicitação", href: telaComercial() },
        },
      };
    } else {
      const aprovada = (a.situacao ?? "").toUpperCase() === "APROVADA";
      envio = {
        template: "canal-parceiro-alteracao-decisao",
        assunto: `Alteração de percentual de ${parceiro}: ${a.situacao ?? "decidida"}`,
        destinatarios: a.destinatarios ?? [],
        dados: {
          assinaturaNome: a.assinatura_nome,
          assinaturaArea: a.assinatura_area,
          titulo: "Alteração de percentual decidida",
          paragrafos: [
            `${a.aprovador_nome ?? "A diretoria"} ${aprovada ? "aprovou" : "recusou"} a alteração de percentual de **${parceiro}**.`,
          ],
          itens,
          observacao: a.observacao ? { rotulo: "Observação", texto: a.observacao } : null,
          botao: { rotulo: "Ver solicitação", href: telaComercial() },
        },
      };
    }

    const messageId = await despachar(envio, `alteracao ${a.tipo} ${a.alteracao_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    const { error: erroMarca } = await lavoroAdmin.rpc(
      "canal_parceiro_marcar_email_alteracao" as never,
      {
        p_alteracao_id: a.alteracao_id,
        p_tipo: a.tipo,
        p_message_id: messageId,
      } as never,
    );
    if (erroMarca)
      console.error("[canal-parceiro-avisos] falha ao marcar alteração", erroMarca.message);
    enviados += 1;
  }

  // ---------- Fila 4: liberação sem contrato ----------
  for (const l of filaLiberacao) {
    const parceiro = l.parceiro ?? "—";
    const ciclo = l.ciclo ?? "—";
    let envio: Envio;

    if (l.tipo === "PEDIDO") {
      const solicitante = l.solicitante_nome ?? "O Comercial";
      envio = {
        template: "canal-parceiro-liberacao-pedido",
        assunto: `Liberar repasse sem contrato de ${parceiro}, ciclo ${ciclo}`,
        destinatarios: l.destinatarios ?? [],
        dados: {
          assinaturaNome: l.assinatura_nome,
          assinaturaArea: l.assinatura_area,
          titulo: "Liberação sem contrato",
          paragrafos: [
            `${solicitante} pediu liberação de repasse de **${parceiro}** no ciclo ${ciclo}, sem contrato assinado, com De Acordo de ${l.nome_de_acordo ?? "—"} (${l.email_de_acordo ?? "—"}).`,
          ],
          itens: [{ rotulo: "Anexo com o De Acordo", valor: l.anexo_nome ?? "—" }],
          observacao: l.justificativa
            ? { rotulo: `Justificativa de ${l.solicitante_nome ?? "quem pediu"}`, texto: l.justificativa }
            : null,
          botao: { rotulo: "Ver solicitação", href: telaComercial() },
          notaFinal:
            "O Financeiro tem até 24 horas para responder. Sem resposta, o pedido cai e o Comercial precisa pedir de novo.",
        },
      };
    } else {
      const situacao = (l.situacao ?? "").toUpperCase();
      const aprovador = l.aprovador_nome ?? "O Financeiro";
      const paragrafo =
        situacao === "APROVADA"
          ? `${aprovador} aprovou a liberação de **${parceiro}**, ciclo ${ciclo}. O parceiro está destravado e você já pode enviar o pedido de repasse ao Financeiro.`
          : situacao === "EXPIRADA"
            ? `O pedido de liberação de **${parceiro}**, ciclo ${ciclo}, caiu por falta de resposta em 24 horas. Se ainda for necessário, peça de novo.`
            : `${aprovador} não aprovou a liberação de **${parceiro}**, ciclo ${ciclo}.`;
      envio = {
        template: "canal-parceiro-liberacao-decisao",
        assunto: `Liberação sem contrato de ${parceiro}: ${l.situacao ?? "decidida"}`,
        destinatarios: l.destinatarios ?? [],
        dados: {
          assinaturaNome: l.assinatura_nome,
          assinaturaArea: l.assinatura_area,
          titulo: "Resposta da liberação sem contrato",
          paragrafos: [paragrafo],
          observacao: l.observacao
            ? { rotulo: "Observação de quem decidiu", texto: l.observacao }
            : null,
          botao: { rotulo: "Ver solicitação", href: telaComercial() },
        },
      };
    }

    const messageId = await despachar(envio, `liberacao ${l.tipo} ${l.liberacao_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    const { error: erroMarca } = await lavoroAdmin.rpc("canal_liberacao_marcar_email" as never, {
      p_liberacao_id: l.liberacao_id,
      p_tipo: l.tipo,
      p_message_id: messageId,
    } as never);
    if (erroMarca)
      console.error("[canal-parceiro-avisos] falha ao marcar liberação", erroMarca.message);
    enviados += 1;
  }

  // ---------- Fila 5: decisão do contrato ----------
  for (const c of filaContratoDecisao) {
    const parceiro = c.parceiro ?? "—";
    const ativo = (c.situacao ?? "").toUpperCase() === "ATIVO";
    const quem = c.corrigido_por_nome ?? "O administrador";
    const envio: Envio = {
      template: "canal-parceiro-contrato-decisao",
      assunto: `Contrato de ${parceiro}: ${c.situacao ?? "decidido"}`,
      destinatarios: c.destinatarios ?? [],
      dados: {
        assinaturaNome: c.assinatura_nome,
        assinaturaArea: c.assinatura_area,
        titulo: "Resposta do contrato enviado",
        paragrafos: [
          ativo
            ? `${quem} conferiu e liberou o contrato de **${parceiro}**. O repasse deste parceiro está liberado.`
            : `${quem} não liberou o contrato de **${parceiro}**.`,
        ],
        itens: [
          { rotulo: "Arquivo", valor: c.arquivo_nome ?? "—" },
          { rotulo: "Vigência", valor: `${dataBR(c.vigencia_inicio)} a ${dataBR(c.vigencia_fim)}` },
          { rotulo: "Benefícios", valor: pctBR(c.pct_beneficios) },
          { rotulo: "Garantia", valor: pctBR(c.pct_garantia) },
          { rotulo: "Demais ramos", valor: pctBR(c.pct_demais) },
        ],
        observacao: c.motivo ? { rotulo: "Motivo", texto: c.motivo } : null,
        botao: { rotulo: "Ver solicitação", href: telaComercial() },
      },
    };

    const destinos = (c.destinatarios ?? []).filter((d) => typeof d === "string" && d.includes("@"));
    const messageId = await despachar(envio, `contrato decisao ${c.contrato_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    for (const destino of destinos) {
      const { error: erroMarca } = await lavoroAdmin.rpc("canal_parceiro_marcar_aviso" as never, {
        p_contrato_id: c.contrato_id,
        p_tipo: "DECISAO",
        p_destinatario: destino,
        p_message_id: messageId,
      } as never);
      if (erroMarca)
        console.error("[canal-parceiro-avisos] falha ao marcar decisão de contrato", erroMarca.message);
    }
    enviados += 1;
  }

  // ---------- Fila 6: documentos do repasse (nota fiscal e pagamento) ----------
  for (const d of filaDocs) {
    const parceiro = d.parceiro ?? "parceiro";
    const ciclo = d.ciclo ?? "atual";
    const comum = { assinaturaNome: d.assinatura_nome, assinaturaArea: d.assinatura_area };
    let messageId: string | null = null;

    if (d.tipo === "NF_ENVIADA") {
      messageId = await despachar(
        {
          template: "canal-repasse-nf-enviada",
          assunto: `Conferir nota fiscal de ${parceiro}, ciclo ${ciclo}`,
          destinatarios: d.destinatarios ?? [],
          dados: {
            ...comum,
            titulo: "Nota fiscal para conferência",
            paragrafos: [
              `${d.enviado_por_nome ?? "O Comercial"} enviou a nota fiscal de **${parceiro}** do ciclo ${ciclo} para sua conferência.`,
            ],
            alerta: d.valor_diverge ? "O valor da nota é diferente do valor autorizado." : null,
            itens: [
              { rotulo: "Número da nota", valor: d.numero_nf ?? "não informado" },
              { rotulo: "Valor da nota", valor: moedaBR(d.valor_nf) },
              { rotulo: "Valor autorizado", valor: moedaBR(d.valor_autorizado) },
              { rotulo: "Emissão", valor: d.data_emissao ? dataBR(d.data_emissao) : "não informada" },
            ],
            botao: { rotulo: "Conferir nota", href: telaFinanceiro(d.demanda_id) },
            notaFinal: "Na tela você baixa a nota, aprova ou recusa com o motivo.",
          },
        },
        `docs NF_ENVIADA ${d.documento_id}`,
        `${d.documento_id}-${d.tipo}`,
      );
    } else if (d.tipo === "NF_DECIDIDA") {
      const aprovada = (d.situacao ?? "").toUpperCase() === "APROVADA";
      const quem = d.conferido_por_nome ?? "O Financeiro";
      messageId = await despachar(
        {
          template: "canal-repasse-nf-decidida",
          assunto: aprovada
            ? `Nota fiscal de ${parceiro} aprovada`
            : `Nota fiscal de ${parceiro} recusada`,
          destinatarios: d.destinatarios ?? [],
          dados: {
            ...comum,
            titulo: aprovada ? "Nota fiscal aprovada" : "Nota fiscal recusada",
            paragrafos: [
              aprovada
                ? `${quem} aprovou a nota fiscal ${d.numero_nf ?? ""} de **${parceiro}**, ciclo ${ciclo}. O pagamento está previsto para ${dataBR(d.data_prevista)}.`
                : `${quem} recusou a nota fiscal ${d.numero_nf ?? ""} de **${parceiro}**, ciclo ${ciclo}. Peça ao parceiro uma nota corrigida e envie de novo pelo Hub.`,
            ],
            observacao: !aprovada && d.motivo ? { rotulo: "Motivo", texto: d.motivo } : null,
            botao: { rotulo: "Ver no Hub", href: telaComercial(d.demanda_id) },
          },
        },
        `docs NF_DECIDIDA ${d.documento_id}`,
        `${d.documento_id}-${d.tipo}`,
      );
    } else if (d.tipo === "PAGAMENTO") {
      // Dois envios independentes, cada um marcado com o próprio tipo.
      const marcar = async (tipo: string, id: string) => {
        const { error } = await lavoroAdmin.rpc("canal_repasse_docs_marcar_email" as never, {
          p_documento_id: d.documento_id,
          p_tipo: tipo,
          p_message_id: id,
        } as never);
        if (error) console.error("[canal-parceiro-avisos] falha ao marcar documento", tipo, error.message);
      };
      let algum = false;
      let falhou = false;

      if (!d.comercial_ja_enviado) {
        const id = await despachar(
          {
            template: "canal-repasse-pagamento",
            assunto: `Repasse de ${parceiro} pago, ciclo ${ciclo}`,
            destinatarios: d.destinatarios ?? [],
            dados: {
              ...comum,
              titulo: "Repasse pago",
              paragrafos: [
                `O Financeiro registrou o pagamento do repasse de **${parceiro}**, ciclo ${ciclo}, em ${dataBR(d.data_pagamento)}.`,
              ],
              destaque: { titulo: moedaBR(d.valor_autorizado), subtitulo: "valor autorizado" },
              botao: { rotulo: "Baixar comprovante no Hub", href: telaComercial(d.demanda_id) },
              notaFinal: "O comprovante fica guardado em Documentos do parceiro.",
            },
          },
          `docs PAGAMENTO comercial ${d.documento_id}`,
          `${d.documento_id}-PAGAMENTO`,
        );
        if (id) {
          await marcar("PAGAMENTO", id);
          algum = true;
        } else falhou = true;
      }

      if (!d.anexos_ja_enviados) {
        const ok = await enviarPagamentoComAnexos(d, lavoroAdmin);
        if (ok) {
          await marcar("PAGAMENTO_ANEXOS", `${d.documento_id}-PAGAMENTO_ANEXOS`);
          algum = true;
        } else falhou = true;
      }

      if (algum) enviados += 1;
      if (falhou) falhas += 1;
      continue;
    } else {
      console.error("[canal-parceiro-avisos] tipo de documento desconhecido", d.tipo);
      continue;
    }

    if (!messageId) {
      falhas += 1;
      continue;
    }
    const { error: erroMarca } = await lavoroAdmin.rpc("canal_repasse_docs_marcar_email" as never, {
      p_documento_id: d.documento_id,
      p_tipo: d.tipo,
      p_message_id: messageId,
    } as never);
    if (erroMarca)
      console.error("[canal-parceiro-avisos] falha ao marcar documento", erroMarca.message);
    enviados += 1;
  }

  return { ok: true, enviados, falhas };
}


/* ------------------------------------------------------------------ anexos */

const BUCKET_DOCS = "canal-parceiros-documentos";
const REMETENTE_ANEXOS = "naoresponda@lavoroseguros.com.br";
// Mesmo limite do envio com anexos da Garantia Judicial (sendMail do Graph ~4 MB).
const LIMITE_ANEXOS_BASE64 = 3 * 1024 * 1024;

const MIME_POR_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  xml: "application/xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function paraBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  return btoa(bin);
}

/**
 * E-mail ao middle office com comprovante e base anexados.
 * Mesmo transporte da Garantia Judicial (Microsoft Graph sendMail com fileAttachment).
 * Só devolve true se saiu para todos os destinatários.
 */
async function enviarPagamentoComAnexos(
  d: DocPendente,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<boolean> {
  const destinos = (d.destinatarios_anexos ?? []).filter((x) => typeof x === "string" && x.includes("@"));
  if (destinos.length === 0) {
    console.error("[canal-parceiro-avisos] pagamento sem destinatários de anexos", d.documento_id);
    return false;
  }
  if (!d.arquivo_path) {
    console.error("[canal-parceiro-avisos] pagamento sem comprovante", d.documento_id);
    return false;
  }
  try {
    type Anexo = { name: string; contentType: string; contentBytes: string };
    const baixar = async (path: string, nome: string): Promise<Anexo> => {
      const { data, error } = await admin.storage.from(BUCKET_DOCS).download(path);
      if (error || !data) throw new Error(`arquivo ausente: ${path}`);
      const ext = (path.split(".").pop() || "").toLowerCase();
      return {
        name: nome,
        contentType: MIME_POR_EXT[ext] ?? "application/octet-stream",
        contentBytes: paraBase64(await data.arrayBuffer()),
      };
    };
    const comprovante = await baixar(d.arquivo_path, d.arquivo_nome || "comprovante");
    const base = d.base_path ? await baixar(d.base_path, d.base_nome || "base-do-repasse.xlsx") : null;

    // Limite: comprovante + base; se passar, só o comprovante; se nem ele cabe, sem anexos.
    let anexos: Anexo[] = [];
    let avisoLimite: string | null = null;
    if (comprovante.contentBytes.length > LIMITE_ANEXOS_BASE64) {
      avisoLimite = "Os arquivos ficaram acima do limite de anexo e estão disponíveis com o Financeiro no Hub.";
    } else if (base && comprovante.contentBytes.length + base.contentBytes.length > LIMITE_ANEXOS_BASE64) {
      anexos = [comprovante];
      avisoLimite = "A base ficou acima do limite de anexo e está disponível com o Financeiro no Hub.";
    } else {
      anexos = base ? [comprovante, base] : [comprovante];
    }
    const baseAnexada = anexos.length === 2;

    const parceiro = d.parceiro ?? "parceiro";
    const ciclo = d.ciclo ?? "atual";
    const assunto = `Comprovante e base do repasse de ${parceiro}, ciclo ${ciclo}`;
    const [{ render }, React, { AvisoCanalParceiroEmail }, { obterTokenGraph }] = await Promise.all([
      import("@react-email/render"),
      import("react"),
      import("@/lib/email-templates/canal-parceiro-avisos"),
      import("@/lib/graph/graph-token.server"),
    ]);
    const html = await render(
      React.createElement(AvisoCanalParceiroEmail, {
        eyebrowTexto: "Canal Parceiros",
        titulo: "Comprovante e base do repasse",
        preview: assunto,
        rodape: RODAPE,
        paragrafos: [
          `Segue o comprovante de pagamento do repasse de **${parceiro}**, ciclo ${ciclo}, pago em ${dataBR(d.data_pagamento)}, e a base do repasse.`,
        ],
        itens: [
          { rotulo: "Valor pago", valor: moedaBR(d.valor_autorizado) },
          { rotulo: "Nota fiscal", valor: d.numero_nf ?? "não informado" },
        ],
        notaFinal:
          avisoLimite ??
          (baseAnexada ? null : "A base não foi anexada; ela está disponível no Hub com o Financeiro."),
        assinaturaNome: d.assinatura_nome,
        assinaturaArea: d.assinatura_area,
      }),
    );

    const token = await obterTokenGraph();
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(REMETENTE_ANEXOS)}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject: assunto,
            body: { contentType: "HTML", content: html },
            from: { emailAddress: { address: REMETENTE_ANEXOS } },
            toRecipients: destinos.map((address) => ({ emailAddress: { address } })),
            attachments: anexos.map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", ...a })),
          },
          saveToSentItems: true,
        }),
      },
    );
    if (!resp.ok) {
      let codigo = "erro_desconhecido";
      try {
        const corpo = (await resp.json()) as { error?: { code?: string; message?: string } };
        codigo = String(corpo?.error?.code || corpo?.error?.message || codigo).slice(0, 120);
      } catch {
        /* sem JSON */
      }
      console.error("[canal-parceiro-avisos] Graph sendMail falhou", resp.status, codigo);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[canal-parceiro-avisos] falha no envio com anexos", d.documento_id, mensagemDeErro(err));
    return false;
  }
}
