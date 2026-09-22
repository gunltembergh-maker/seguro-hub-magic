// Datas do ciclo de repasse — compartilhado entre Financeiro e Comercial.
export function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
const chaveData = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function ehDiaUtil(d: Date, feriados: Set<string>) {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !feriados.has(chaveData(d));
}

/** Data do repasse: dia 10 do ciclo ou, se não for útil, o dia útil mais próximo (empate = o anterior). */
export function dataRepasseDoCiclo(ano: number, mes: number, feriados: Set<string>) {
  const base = new Date(ano, mes - 1, 10);
  if (ehDiaUtil(base, feriados)) return base;
  for (let i = 1; i <= 15; i++) {
    const antes = new Date(ano, mes - 1, 10 - i);
    if (ehDiaUtil(antes, feriados)) return antes;
    const depois = new Date(ano, mes - 1, 10 + i);
    if (ehDiaUtil(depois, feriados)) return depois;
  }
  return base;
}

export const soData = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Ciclo padrão: o corrente até a data de pagamento; depois dela, rola para o mês seguinte. */
export function cicloPadrao(feriados: Set<string>) {
  const hoje = soData(nowBRT());
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const pagamento = soData(dataRepasseDoCiclo(ano, mes, feriados));
  if (hoje <= pagamento) return { ano, mes };
  const prox = new Date(ano, mes, 1);
  return { ano: prox.getFullYear(), mes: prox.getMonth() + 1 };
}
