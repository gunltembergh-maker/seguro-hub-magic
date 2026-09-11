/** Tipos e utilitários compartilhados do módulo Reserva de Posições. */

export interface RpParametros {
  rp_janela_antecedencia_dias: number;
  rp_tolerancia_checkin_min: number;
  rp_checkin_liberado_antes_min: number;
  rp_horario_funcionamento: { inicio: string; fim: string };
  rp_enviar_email_usuario: boolean;
  rp_emails_rh?: string[];
  rp_ips_escritorio?: string[];
}

export interface RpReservaGrade {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  nome: string | null;
  minha: boolean;
}

export interface RpPosicaoGrade {
  id: string;
  numero: number;
  apelido: string | null;
  bloco: "fundo" | "frente" | string;
  ativa: boolean;
  fixa: boolean;
  fixa_nome: string | null;
  reservas: RpReservaGrade[];
}

export interface RpMinhaReserva {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  posicao_numero: number;
  posicao_apelido?: string | null;
}

export interface RpReservaRetorno {
  id: string;
  nome: string;
  posicao_numero: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  /** Dono da reserva (retornado pelo cancelamento). */
  user_id?: string | null;
  /** Justificativa quando o cancelamento é feito com motivo (telas administrativas). */
  motivo?: string | null;
  cancelado_por_terceiro?: boolean;
  /** true quando o cancelamento foi feito com justificativa (admin/RH). */
  tem_motivo?: boolean;
  /** Nome de quem cancelou (retornado pela RPC). */
  cancelado_por_nome?: string | null;
}


export const hhmm = (h?: string | null) => (h ?? "").slice(0, 5);

/**
 * Sempre devolve DD/MM/AAAA. Aceita ISO (AAAA-MM-DD) ou um valor que já venha
 * formatado em DD/MM/AAAA (caso das RPCs de reserva) — nesse caso não reformata.
 */
export const dataBR = (valor?: string | null) => {
  const v = (valor ?? "").trim();
  if (!v) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return v;
};

export const isoDeData = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const primeiroNome = (nome?: string | null) => (nome ?? "").trim().split(/\s+/)[0] ?? "";

/** Gera opções de horário em passos de 30 minutos dentro da janela informada. */
export function opcoesHorario(inicio: string, fim: string): string[] {
  const toMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(inicio); m <= toMin(fim); m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export const STATUS_LABEL: Record<string, string> = {
  reservada: "Reservada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  expirada: "Expirada",
  concluida: "Concluída",
};

export const STATUS_CLASSE: Record<string, string> = {
  reservada: "bg-sky-100 text-sky-800 border-sky-200",
  confirmada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelada: "bg-rose-100 text-rose-800 border-rose-200",
  expirada: "bg-amber-100 text-amber-900 border-amber-200",
  concluida: "bg-slate-100 text-slate-700 border-slate-200",
};

export const mensagemErro = (e: unknown) =>
  (e as any)?.message ?? "Não foi possível concluir a operação. Tente novamente.";
