import { useMeuPerfil } from "@/hooks/use-meu-perfil";
import { escopoFrase, escopoSufixo, filtrarBreakdown, normalizeTimes } from "@/lib/receita-escopo";

/**
 * Escopo de receita do usuário logado (Times: Garantia / Benefícios / Demais Ramos).
 * ADMIN ou usuário sem times definidos => sem restrição (comportamento atual).
 */
export function useEscopoReceita() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = !!perfil?.roles?.includes("ADMIN");
  const times = isAdmin ? [] : normalizeTimes(perfil?.times_receita);
  const restrito = times.length > 0;

  return {
    times,
    restrito,
    frase: restrito ? escopoFrase(times) : "",
    sufixo: restrito ? escopoSufixo(times) : "",
    filtrar: <T extends { label: string }>(rows: T[]) => (restrito ? filtrarBreakdown(rows, times) : rows),
  };
}
