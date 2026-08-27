import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import {
  escopoFrase,
  escopoSufixo,
  filtrarBreakdown,
  normalizeTimes,
  semAcessoReceita,
} from "@/lib/receita-escopo";

/**
 * Escopo de receita do usuário logado (Times: Garantia / Benefícios / Demais Ramos).
 * - ADMIN => vê tudo
 * - 'TODOS' no array => vê tudo
 * - array vazio/nulo => NÃO vê receita nenhuma
 */
export function useEscopoReceita() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = !!perfil?.roles?.includes("ADMIN");
  const raw = perfil?.times_receita;
  const semAcesso = !isAdmin && semAcessoReceita(raw);
  const times = isAdmin ? [] : normalizeTimes(raw);
  const restrito = times.length > 0;

  return {
    times,
    restrito,
    semAcesso,
    frase: restrito ? escopoFrase(times) : "",
    sufixo: restrito ? escopoSufixo(times) : "",
    filtrar: <T extends { label: string }>(rows: T[]) =>
      semAcesso ? [] : restrito ? filtrarBreakdown(rows, times) : rows,
  };
}
