// Normalização da consulta de mercado — porte literal de public/analise-limite/app.js.
//
// REGRA: a lógica aqui é cópia fiel da tela (Garantia → Análise de Limite).
// Nada foi "melhorado", corrigido ou otimizado de propósito: a planilha do
// e-mail precisa concordar campo a campo com o que o time vê na tela.
// Qualquer ajuste de comportamento deve ser feito nos dois lugares ao mesmo tempo.

// ── Tipos ────────────────────────────────────────────────────────────────

export type StatusKey =
  | "aprovado"
  | "nomeado"
  | "sem_limite"
  | "bloqueado"
  | "filial"
  | "sem_resposta"
  | "instavel"
  | "erro";

export type MktStatus = "aprovado" | "concorrente" | "declinado" | "filial" | "erro_portal";

export interface ModalidadeBruta {
  label: string;
  segurado?: string | null;
  valor: number | null | undefined;
  taxa: number | string | null | undefined;
}

export interface ModalidadeCondensada {
  label: string;
  limite: string;
  taxa: string;
}

export interface NormalizadoSeguradora {
  statusKey: StatusKey;
  modalidades: ModalidadeBruta[];
  mensagem?: string | undefined;
  nomeTomador?: string | null | undefined;
  cnpjTomador?: string | null | undefined;
}

export interface ResultadoSeguradoraBruto {
  seguradora?: string;
  status?: string;
  erro?: string;
  dados?: unknown;
}

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Catálogo de seguradoras (mesmo de app.js: MKT_SEGURADORAS) ───────────

export const MKT_SEGURADORAS: { key: string; label: string; apiKey: string | null; portal: boolean }[] = [
  { key: "akad", label: "AKAD", apiKey: null, portal: true },
  { key: "allianz", label: "ALLIANZ", apiKey: null, portal: false },
  { key: "alm", label: "ALM", apiKey: null, portal: true },
  { key: "austral", label: "AUSTRAL", apiKey: null, portal: false },
  { key: "avla", label: "AVLA", apiKey: "avla", portal: true },
  { key: "axa", label: "AXA", apiKey: "axa", portal: true },
  { key: "berkley", label: "BERKLEY", apiKey: null, portal: true },
  { key: "btg", label: "BTG", apiKey: null, portal: false },
  { key: "cesce", label: "CESCE", apiKey: null, portal: false },
  { key: "chubb", label: "CHUBB", apiKey: null, portal: false },
  { key: "darwin", label: "DARWIN", apiKey: null, portal: false },
  { key: "daycoval", label: "DAYCOVAL", apiKey: null, portal: true },
  { key: "essor", label: "ESSOR", apiKey: "essor", portal: true },
  { key: "ezze", label: "EZZE", apiKey: null, portal: true },
  { key: "fairfax", label: "FAIRFAX", apiKey: null, portal: true },
  { key: "fairway", label: "FAIRWAY", apiKey: null, portal: false },
  { key: "fator", label: "FATOR", apiKey: "fator", portal: true },
  { key: "finanguard", label: "FINANGUARD", apiKey: null, portal: false },
  { key: "hdi", label: "HDI", apiKey: null, portal: false },
  { key: "jns", label: "JNS", apiKey: "jns", portal: true },
  { key: "junto", label: "JUNTO", apiKey: "junto", portal: true },
  { key: "kovr", label: "KOVR", apiKey: null, portal: false },
  { key: "liberty", label: "LIBERTY", apiKey: null, portal: false },
  { key: "mapfre", label: "MAPFRE", apiKey: null, portal: false },
  { key: "mitsui", label: "MITISUI", apiKey: "mitsui", portal: true },
  { key: "newe", label: "NEWE", apiKey: "newe", portal: true },
  { key: "now", label: "NOW SEGUROS", apiKey: "now", portal: true },
  { key: "pottencial", label: "POTTENCIAL", apiKey: null, portal: true },
  { key: "sombrero", label: "SOMBRERO", apiKey: "sombrero", portal: true },
  { key: "sompo", label: "SOMPO", apiKey: null, portal: false },
  { key: "sudaseg", label: "SUDASEG", apiKey: null, portal: false },
  { key: "swissre", label: "SWISS RE", apiKey: null, portal: false },
  { key: "thinkseg", label: "THINKSEG", apiKey: null, portal: false },
  { key: "tokio", label: "TOKIO", apiKey: null, portal: true },
  { key: "zurich", label: "ZURICH", apiKey: null, portal: false },
];

// ── Auxiliares de formatação (app.js: parseNum, fmtBRL, formatTcTaxaPercent) ──

export function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  // Já é número (célula numérica): devolve como está, sem reformatar.
  if (typeof val === "number") return val;
  // String: formato brasileiro "R$ 1.234,56" ou "1.234,56".
  const s = String(val).trim();
  if (!s) return 0;
  let cleaned = s.replace(/[R$\s]/g, "");
  // Com vírgula é formato BR: tira os pontos, vírgula vira ponto decimal.
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  // Senão pode ser "1234.56" (US/cru) ou "1.500" (milhar BR). Heurística:
  // exatamente um ponto seguido de 1-2 dígitos no fim → decimal; senão, milhar.
  else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length === 2 && (parts[1] as string).length <= 2) {
      // ponto decimal: mantém como está
    } else {
      cleaned = cleaned.replace(/\./g, "");
    }
  }
  return parseFloat(cleaned) || 0;
}

export function fmtBRL(v: unknown): string {
  return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseTcTaxaPercentValue(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;

  const cleaned = s.replace("%", "").replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function formatTcTaxaPercent(val: unknown): string {
  const taxa = parseTcTaxaPercentValue(val);
  if (taxa === null) return "";
  return taxa.toFixed(2).replace(".", ",") + "%";
}

// A capacidade de uma seguradora é o maior limite dentre suas modalidades.
// O total de mercado é calculado depois, somando essa capacidade por seguradora.
export function maiorLimiteModalidade(
  modalidades: { value?: unknown; limite?: unknown }[] | null | undefined,
): number {
  return (modalidades || []).reduce((maior: number, modalidade) => {
    const valor = parseNum(modalidade && (modalidade.value ?? modalidade.limite));
    return Math.max(maior, valor || 0);
  }, 0);
}

// ── Consulta de Limites por Seguradora ───────────────────────────────────

// Um limite explicitamente zerado não deve aparecer na UI — mas valor ausente
// (null/undefined, ex.: Junto sem cotação de taxa) ainda é informativo e permanece.
export function isZeroLimite(valor: unknown): boolean {
  return valor !== null && valor !== undefined && Number(valor) === 0;
}

// Mensagem padrão exibida no card quando a seguradora não libera nenhum limite ao
// tomador — substitui jargão bruto de seguradora (ex.: "tomador deve estar Aprovado e
// dentro da Data de Validade") por um texto único e direto para o usuário final.
export const LIM_SEM_LIMITE_MSG = "Sem limite liberado ao tomador.";

// Mensagens de erro/negócio das seguradoras chegam em texto livre — classifica por
// palavra-chave antes de decidir o badge. Ordem de prioridade importa (seção 6.5 do guia
// de integração): "nomeado com outro corretor" > timeout > instabilidade > bloqueado > erro.
export function classifyErrorMessage(message: unknown): StatusKey {
  const t = String(message || "").toLowerCase();
  if (t.includes("cadastro de filial") || /\bfilial\b/.test(t)) return "filial";
  // AVLA: o tomador existe, mas não está associado ao corretor autenticado.
  // É a mesma ação operacional de um tomador nomeado com outro corretor.
  if (
    t.includes("policyholder does not belong to the broker") ||
    (t.includes("tomador") && t.includes("pertence") && (t.includes("corretor") || t.includes("broker")))
  )
    return "nomeado";
  // Precisa das duas partes juntas ("nomeado" + "corretor"/"broker") — uma mensagem de
  // bloqueio que apenas cita "corretora" (ex.: "bloqueado para esta corretora") não é
  // o mesmo aviso de negócio de tomador nomeado com outro corretor.
  if (t.includes("nomead") && (t.includes("corretor") || t.includes("broker"))) return "nomeado";
  // Junto: "Corretor não possui permissão para visualizar o Tomador." — mesma família
  // de "nomeado com outro corretor" (o tomador já pertence a outro corretor de registro
  // na seguradora), só que sem a palavra "nomeado" nessa formulação específica.
  if (t.includes("corretor") && t.includes("permiss")) return "nomeado";
  if (t.includes("tempo limite") || t.includes("timeout") || t.includes("respond")) return "sem_resposta";
  if (
    ["motor de crédito", "motor de credito", "problema ao rodar", "instável", "instavel", "indisponív", "indisponiv"].some(
      (kw) => t.includes(kw),
    )
  )
    return "instavel";
  if (
    t.includes("limits_not_found") ||
    t.includes("não possui limite") ||
    t.includes("nao possui limite") ||
    t.includes("does not have a limit available")
  )
    return "sem_limite";
  // "Risco negado por questões técnicas" (JNS): é decisão de negócio (risco negado),
  // não instabilidade passageira do motor — o "por questões técnicas" aqui é o jargão
  // da própria JNS para negativa de crédito, não um convite a tentar de novo. Badge
  // neutro "Sem limite", não âmbar "Instável" nem vermelho "Erro".
  if (t.includes("negado") && (t.includes("técnic") || t.includes("tecnic"))) return "sem_limite";
  if (t.includes("bloquead")) return "bloqueado";
  return "erro";
}

// Cada seguradora tem um formato de resposta próprio — normaliza para
// { statusKey, modalidades[], mensagem, nomeTomador, cnpjTomador }
export function normalizeLimiteResultado(r: ResultadoSeguradoraBruto): NormalizadoSeguradora {
  if (r.status !== "ok") {
    const mensagem = r.erro || "Falha na consulta.";
    return { statusKey: classifyErrorMessage(mensagem), modalidades: [], mensagem };
  }
  const key = r.seguradora;
  if (key === "jns") return normalizeLimiteJns(r.dados as Any);
  if (key === "junto") return normalizeLimiteJunto(r.dados as Any);
  if (key === "fator") return normalizeLimiteFator(r.dados as Any);
  if (key === "avla") return normalizeLimiteAvla(r.dados as Any);
  if (["essor", "sombrero", "newe", "mitsui", "axa", "now"].includes(key as string))
    return normalizeLimiteOnpoint(r.dados as Any);
  return { statusKey: "erro", modalidades: [], mensagem: "Seguradora desconhecida." };
}

export function normalizeLimiteJns(d: Any): NormalizadoSeguradora {
  const nomeTomador = d && (d.name || d.issuerName);
  const cnpjTomador = d && d.document;
  // DELIBERADO: lê apenas `product_limits` e ignora o array `limits`, mesmo
  // quando ele vem preenchido. É exatamente o que a tela faz hoje; mudar aqui
  // faria a planilha divergir do card da JNS.
  const produtos: ModalidadeBruta[] = (((d && d.product_limits) || []) as Any[])
    .map((p: Any) => ({
      label: String(p.product_name || "").trim(),
      segurado: String(p.product_branch || "").replace(/^SEGURADO:\s*/i, ""),
      valor: p.limit_available ?? p.approvedLimit,
      taxa: p.tax ?? p.feePercent,
    }))
    .filter((m) => !isZeroLimite(m.valor));

  if (!produtos.length) {
    const msg = d && d.message;
    const cls = msg ? classifyErrorMessage(msg) : "sem_limite";
    return {
      statusKey: cls === "instavel" ? "instavel" : "sem_limite",
      modalidades: [],
      mensagem: msg || "Nenhum limite disponível.",
      nomeTomador,
      cnpjTomador,
    };
  }
  return { statusKey: "aprovado", modalidades: produtos, nomeTomador, cnpjTomador };
}

export function normalizeLimiteJunto(d: Any): NormalizadoSeguradora {
  const lista: Any[] = Array.isArray(d) ? d : [];
  const modalidades: ModalidadeBruta[] = [];
  lista.forEach((mod: Any) => {
    ((mod.submodalities || []) as Any[]).forEach((sub: Any) => {
      const valor = sub.limitAvailable ?? null;
      if (isZeroLimite(valor)) return;
      const descricao = String(mod.description || "").trim();
      const descricaoNormalizada = descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      modalidades.push({
        // As submodalidades da Junto repetem coberturas técnicas (como
        // "Com Salvamento"). Para o mercado, exibe-se a modalidade principal
        // e preservam-se o limite e a taxa devolvidos pela API.
        label: /fianca\s+locatic/i.test(descricaoNormalizada) ? "Financeira — " + descricao : descricao,
        segurado: mod.isJudicial ? "Judicial" : null,
        valor,
        taxa: sub.rate ?? null,
      });
    });
  });
  if (!modalidades.length) {
    return { statusKey: "sem_limite", modalidades: [], mensagem: "Nenhuma modalidade habilitada para este tomador." };
  }
  const semValor = modalidades.every((m) => m.valor === null || m.valor === undefined);
  return {
    statusKey: "aprovado",
    modalidades,
    mensagem: semValor
      ? "Tomador habilitado. Não foi possível obter o valor de limite por modalidade nesta consulta."
      : undefined,
  };
}

export function normalizeLimiteOnpoint(d: Any): NormalizadoSeguradora {
  const payload = Array.isArray(d) && d.length === 1 ? d[0] : d;
  const item = payload && Array.isArray(payload.Response) ? payload.Response[0] : null;

  if (item) {
    const nomeTomador = item.PolicyHolderName || null;
    const cnpjTomador = item.PolicyHolderCnpj || null;

    if (item.CanSetupAProposal && Array.isArray(item.LimitsAndRates)) {
      // Usa apenas AvailableLimit; LimitRevised é deliberadamente ignorado,
      // igual à tela.
      const modalidades: ModalidadeBruta[] = (item.LimitsAndRates as Any[])
        .filter(Boolean)
        .map((m: Any) => ({
          // BranchName é o setor Público/Privado devolvido pela Onpoint e
          // precisa participar do rótulo para não fundir capacidades distintas.
          label: [m.ModalityGroupName, m.BranchName, m.ModalityName].filter(Boolean).join(" — "),
          segurado: m.BranchName || null,
          valor: m.AvailableLimit,
          taxa: m.Tax,
        }))
        .filter((m) => !isZeroLimite(m.valor));
      if (modalidades.length) return { statusKey: "aprovado", modalidades, nomeTomador, cnpjTomador };
    }

    const motivo = ((item.Reasons || []) as Any[]).join(" ");
    const cls = classifyErrorMessage(motivo);
    return {
      statusKey: cls === "erro" ? "sem_limite" : cls,
      modalidades: [],
      mensagem: motivo || "Tomador não aprovado nas regras de crédito da seguradora.",
      nomeTomador,
      cnpjTomador,
    };
  }

  // Algumas respostas de negócio chegam sem "Response", apenas { Errors: [...] }
  const errors: Any[] = payload && Array.isArray(payload.Errors) ? payload.Errors : [];
  if (errors.length) {
    const motivo = errors.join(" ");
    const cls = classifyErrorMessage(motivo);
    return { statusKey: cls === "erro" ? "sem_limite" : cls, modalidades: [], mensagem: motivo };
  }

  return { statusKey: "erro", modalidades: [], mensagem: "Resposta inesperada da seguradora." };
}

export function labelModalidadeFator(linha: Any): string {
  const grupo = String(linha.NomeGrupoSubLimite || "").trim();
  // A API da Fator pode enviar a classificação pública/privada na
  // submodalidade, com nomes de campo diferentes entre versões.
  const camposSubmodalidade = [
    "NomeSubLimite",
    "NomeSubModalidade",
    "NomeSubmodalidade",
    "NomeModalidade",
    "DescricaoSubLimite",
    "DescricaoSubModalidade",
    "DescricaoModalidade",
    "TipoSubLimite",
    "TipoModalidade",
    "Setor",
    "Segmento",
    "PublicoPrivado",
  ];
  const detalhes = [
    ...new Set(
      camposSubmodalidade
        .map((campo) => String(linha[campo] || "").trim())
        .filter(Boolean)
        .filter((valor) => valor.toLocaleUpperCase("pt-BR") !== grupo.toLocaleUpperCase("pt-BR")),
    ),
  ];
  return [grupo, ...detalhes].filter(Boolean).join(" — ");
}

export function normalizeLimiteFator(d: Any): NormalizadoSeguradora {
  if (!d) return { statusKey: "erro", modalidades: [], mensagem: "Resposta inesperada da seguradora." };

  // cd_retorno !== 0 é sempre resposta de negócio (sem limite, nomeado etc.), nunca erro técnico.
  // O texto bruto da Fator (ex.: "tomador deve estar Aprovado e dentro da Data de Validade")
  // é jargão interno da seguradora — só é exibido ao usuário quando acionável (nomeado com
  // outro corretor); nos demais casos de negócio, mostramos a mensagem padrão "sem limite".
  const codigo = Number(d.cd_retorno);
  if (codigo !== 0) {
    const msg = d.nm_retorno || "Corretor não associado ao tomador nesta seguradora.";
    const cls = classifyErrorMessage(msg);
    return cls === "nomeado"
      ? { statusKey: "nomeado", modalidades: [], mensagem: msg }
      : { statusKey: "sem_limite", modalidades: [], mensagem: LIM_SEM_LIMITE_MSG };
  }

  const linhas: Any[] = Array.isArray(d.DadosTomador) ? d.DadosTomador : [];
  const modalidades: ModalidadeBruta[] = linhas
    .map((l: Any) => ({
      label: labelModalidadeFator(l),
      valor: l.ValorLimiteDisponivel ?? l.ValorLimiteTotalSemCCG ?? l.ValorLimiteTotal,
      taxa: l.ValorTaxa,
    }))
    .filter((m) => !isZeroLimite(m.valor));

  const nomeTomador = linhas[0] && linhas[0].NomePessoa;
  if (!modalidades.length) {
    return { statusKey: "sem_limite", modalidades: [], mensagem: LIM_SEM_LIMITE_MSG, nomeTomador };
  }
  return { statusKey: "aprovado", modalidades, nomeTomador };
}

export function normalizeLimiteAvla(d: Any): NormalizadoSeguradora {
  if (!d || typeof d !== "object") {
    return { statusKey: "erro", modalidades: [], mensagem: "Resposta inesperada da seguradora." };
  }
  const nomeTomador = d.nome || null;
  const cnpjTomador = d.document || null;
  const modalidades: ModalidadeBruta[] = ((Array.isArray(d.limites) ? d.limites : []) as Any[])
    .map((limite: Any) => ({
      label: String(limite.nome_modalidade || "").trim(),
      valor: limite.limite_disponivel ?? limite.limite_total,
      taxa: limite.taxa ?? null,
    }))
    .filter((modalidade) => !isZeroLimite(modalidade.valor));

  if (!modalidades.length) {
    return {
      statusKey: "sem_limite",
      modalidades: [],
      mensagem: "Sem limite liberado ao tomador.",
      nomeTomador,
      cnpjTomador,
    };
  }
  return { statusKey: "aprovado", modalidades, nomeTomador, cnpjTomador };
}

// Resultado automático da API (normalizeLimiteResultado, mesma lógica por
// seguradora da antiga Consulta de Limites) → status do novo modelo de 5.
export function mapNormStatusToMkt(statusKey: string): MktStatus {
  const map: Record<string, MktStatus> = {
    aprovado: "aprovado",
    nomeado: "concorrente",
    sem_limite: "declinado",
    bloqueado: "declinado",
    filial: "filial",
    sem_resposta: "erro_portal",
    instavel: "erro_portal",
    erro: "erro_portal",
  };
  return map[statusKey] || "erro_portal";
}

// APIs como AXA e JNS devolvem muitas submodalidades com a mesma condição.
// No card automático, uma linha por categoria + limite + taxa é suficiente;
// entradas manuais nunca passam por esta condensação.
export function categoriaModalidadeMercado(label: unknown): string {
  const original = String(label || "").trim();
  const categoriaOriginal = (original.split(/\s+[—-]\s+/)[0] || original).trim();
  const normalizada = categoriaOriginal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
  const completa = original
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
  const setor = /\bPUBLIC[OA]\b|SETOR\s+PUBLICO/.test(completa)
    ? " Público"
    : /\bPRIVAD[OA]\b|SETOR\s+PRIVADO/.test(completa)
      ? " Privado"
      : "";

  // Judicial/recursal é uma linha autônoma mesmo quando algum conector a
  // anexa a um grupo comercial genérico (caso da Fator). Já Trabalhista ou
  // Previdenciária, sem "recursal", continua sendo cobertura contratual
  // quando vier sob Executante/Fornecedor/Prestador.
  if (/JUDICIAL|ARBITRAL|RECURSAL|CIVIL/.test(normalizada)) return "Judiciais";
  if (/JUDICIAL|ARBITRAL|RECURSAL|CIVIL/.test(completa)) return "Judiciais";

  // Quando a API entrega grupo e submodalidade, o grupo tem precedência:
  // "Estruturadas — Executante Concessionário" não é Tradicional apenas por
  // conter a palavra Executante.
  if (/ESTRUTURAD/.test(normalizada)) return "Estruturadas" + setor;
  if (/FINANCEIR/.test(normalizada)) return "Financeira" + setor;
  if (/TRADICIONAL/.test(normalizada)) return "Tradicional" + setor;

  // JNS, Junto e Fator nem sempre devolvem o grupo comercial no texto da
  // modalidade. Estes nomes compõem o portfólio de Garantia Tradicional;
  // só serão agrupados se limite e taxa também forem idênticos.
  if (
    /TRADICIONAL|LICIT|CONCORREN|CONSTRUTOR|FORNECEDOR|PREST(?:ADOR)?|EXECUTANTE|ADIANTAMENTO|MANUTENCAO|RETENCAO|GARANTIA\s+DE\s+PAGAMENTO|COMPRA\s+E\s+VENDA|FINEP|PERFORMANCE/.test(
      completa,
    )
  ) {
    return "Tradicional" + setor;
  }
  // Trabalhista sem vínculo com uma cobertura contratual é garantia judicial.
  if (/TRABALH|PREVIDENC/.test(completa)) return "Judiciais";
  return categoriaOriginal || original;
}

// Mostra o motivo de haver duas condições para a mesma categoria, sem expor
// cada submodalidade repetida. Ex.: "Judiciais — Trabalhista e Recursal".
export function qualificadorModalidadeMercado(label: unknown, categoria: unknown): string {
  const partes = String(label || "")
    .trim()
    .split(/\s+[—-]\s+/)
    .filter(Boolean);
  const principal = partes.shift() || "";
  const detalhe = partes.join(" — ").trim();
  const base = String(categoria || "").replace(/\s+(Público|Privado)$/i, "");

  if (base === "Judiciais") {
    return detalhe || principal.replace(/^Judicia(?:l|is)\s*/i, "").trim();
  }
  if (base === "Tradicional") {
    return detalhe || principal.replace(/^Tradicional\s*/i, "").trim();
  }
  if (base === "Financeira") {
    return detalhe || principal.replace(/^Financeira\s*/i, "").trim();
  }
  return "";
}

export function condensarModalidadesMercado(
  modalidades: ModalidadeBruta[] | null | undefined,
): ModalidadeCondensada[] {
  const grupos = new Map<
    string,
    { categoria: string; limite: string; taxa: string; labelsOriginais: string[] }
  >();
  (modalidades || []).forEach((modalidade) => {
    const labelOriginal = String(modalidade.label || "").trim();
    const categoria = categoriaModalidadeMercado(labelOriginal);
    const limite =
      modalidade.valor !== null && modalidade.valor !== undefined && modalidade.valor > 0
        ? fmtBRL(modalidade.valor)
        : "";
    const taxa =
      modalidade.taxa !== null && modalidade.taxa !== undefined && modalidade.taxa !== ""
        ? formatTcTaxaPercent(modalidade.taxa)
        : "";
    // Sem valor e sem taxa não há condição comum comprovável: preserva a linha.
    const chave =
      limite || taxa
        ? [categoria.toLocaleUpperCase("pt-BR"), limite, taxa].join("|")
        : `sem-condicao|${labelOriginal}|${grupos.size}`;
    const grupo = grupos.get(chave) || {
      categoria: categoria || labelOriginal,
      limite,
      taxa,
      labelsOriginais: [] as string[],
    };
    grupo.labelsOriginais.push(labelOriginal);
    grupos.set(chave, grupo);
  });

  // Um qualificador só é necessário quando há mais de uma condição (limite ou
  // taxa) dentro da mesma categoria. Assim JNS segue com um único
  // "Tradicional", enquanto Junto explica os dois Tradicionais/Judiciais.
  const condicoesPorCategoria = new Map<string, number>();
  grupos.forEach((grupo) => {
    condicoesPorCategoria.set(grupo.categoria, (condicoesPorCategoria.get(grupo.categoria) || 0) + 1);
  });

  return Array.from(grupos.values()).map((grupo) => {
    let label = grupo.categoria;
    const categoriaBase = String(grupo.categoria).replace(/\s+(Público|Privado)$/i, "");
    const isJudicial = categoriaBase === "Judiciais";
    const isFinanceira = categoriaBase === "Financeira";
    const submodalidades = [
      ...new Set(
        grupo.labelsOriginais
          .map((original) => qualificadorModalidadeMercado(original, grupo.categoria))
          .filter(Boolean),
      ),
    ];
    if (
      (condicoesPorCategoria.get(grupo.categoria) || 0) > 1 ||
      ((isJudicial || isFinanceira) && submodalidades.length)
    ) {
      if (submodalidades.length) label += " — " + submodalidades.join(", ");
    }
    return { label, limite: grupo.limite, taxa: grupo.taxa };
  });
}

// ── Resumo estruturado (uso servidor: planilha e e-mail) ─────────────────

export type GrupoResumo = "com_limite" | "sem_limite" | "nao_consultado";

export interface SeguradoraResumo {
  key: string;
  label: string;
  grupo: GrupoResumo;
  statusKey: StatusKey;
  statusMkt: MktStatus;
  capacidade: number;
  capacidadeFmt: string;
  modalidades: ModalidadeCondensada[];
  modalidadesAntes: number;
  mensagem: string;
}

export interface ResumoMercado {
  cnpj: string | null;
  consultadoEm: string | null;
  nomeTomadorSugerido: string | null;
  seguradoras: SeguradoraResumo[];
  com_limite: SeguradoraResumo[];
  sem_limite: SeguradoraResumo[];
  nao_consultado: SeguradoraResumo[];
}

// Três grupos, decisão fechada: uma falha técnica (nao_consultado) nunca pode
// parecer recusa comercial (sem_limite).
function grupoDoStatus(statusKey: StatusKey): GrupoResumo {
  if (statusKey === "aprovado") return "com_limite";
  if (statusKey === "sem_limite" || statusKey === "bloqueado" || statusKey === "nomeado" || statusKey === "filial")
    return "sem_limite";
  return "nao_consultado"; // sem_resposta, instavel, erro
}

export function resumirResultadoMercado(resultadoMercado: unknown): ResumoMercado {
  const data = (resultadoMercado || {}) as Any;
  const resultados: ResultadoSeguradoraBruto[] = Array.isArray(data.resultados) ? data.resultados : [];

  let nomeTomadorSugerido: string | null = null;
  const seguradoras: SeguradoraResumo[] = [];

  resultados.forEach((r) => {
    const entry = MKT_SEGURADORAS.find((s) => s.apiKey === r.seguradora);
    if (!entry) return;
    const norm = normalizeLimiteResultado(r);
    // Mesma regra da tela: primeiro nome não vazio que aparecer.
    if (norm.nomeTomador && !nomeTomadorSugerido) nomeTomadorSugerido = norm.nomeTomador;

    const modalidades = condensarModalidadesMercado(norm.modalidades);
    const capacidade = maiorLimiteModalidade(modalidades);

    seguradoras.push({
      key: entry.key,
      label: entry.label,
      grupo: grupoDoStatus(norm.statusKey),
      statusKey: norm.statusKey,
      statusMkt: mapNormStatusToMkt(norm.statusKey),
      capacidade,
      capacidadeFmt: capacidade > 0 ? fmtBRL(capacidade) : "",
      modalidades,
      modalidadesAntes: (norm.modalidades || []).length,
      mensagem: norm.mensagem || "",
    });
  });

  return {
    cnpj: typeof data.cnpj === "string" ? data.cnpj : null,
    consultadoEm: typeof data.consultadoEm === "string" ? data.consultadoEm : null,
    nomeTomadorSugerido,
    seguradoras,
    com_limite: seguradoras.filter((s) => s.grupo === "com_limite"),
    sem_limite: seguradoras.filter((s) => s.grupo === "sem_limite"),
    nao_consultado: seguradoras.filter((s) => s.grupo === "nao_consultado"),
  };
}
