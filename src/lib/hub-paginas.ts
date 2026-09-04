/**
 * Catálogo de páginas do Hub, agrupado por área.
 * Usado pelos Comunicados para o admin escolher onde o popup aparece.
 * Ao liberar uma página nova no menu, adicione-a aqui.
 */
export interface PaginaHub {
  rota: string;
  nome: string;
}

export interface GrupoPaginas {
  grupo: string;
  paginas: PaginaHub[];
}

export const HUB_PAGINAS: GrupoPaginas[] = [
  {
    grupo: "Geral",
    paginas: [
      { rota: "/inicio", nome: "Início" },
      { rota: "/hub", nome: "Hub (visão geral)" },
    ],
  },
  {
    grupo: "Financeiro",
    paginas: [
      { rota: "/financeiro", nome: "Financeiro (página da área)" },
      { rota: "/financeiro/fluxo-diario", nome: "Fluxo Diário" },
    ],
  },
  {
    grupo: "Jurídico",
    paginas: [
      { rota: "/juridico", nome: "Jurídico (página da área)" },
      { rota: "/juridico/analise-background", nome: "Background Check" },
    ],
  },
  {
    grupo: "Outras áreas",
    paginas: [
      { rota: "/operacional", nome: "Operacional" },
      { rota: "/middle", nome: "Middle" },
      { rota: "/facilities", nome: "Facilities" },
    ],
  },
  {
    grupo: "Garantia",
    paginas: [
      { rota: "/garantia", nome: "Garantia (página do ramo)" },
      { rota: "/garantia/analise-limite", nome: "Operacional (Análise de Limite)" },
      { rota: "/garantia/analise-background", nome: "Análise de Processos" },
    ],
  },
  {
    grupo: "Benefícios",
    paginas: [
      { rota: "/beneficios", nome: "Benefícios" },
      { rota: "/beneficios/clientes", nome: "Benefícios · Clientes" },
      { rota: "/beneficios/cadastros", nome: "Benefícios · Cadastros" },
    ],
  },
  {
    grupo: "Demais Ramos",
    paginas: [{ rota: "/demais-ramos", nome: "Demais Ramos" }],
  },
  {
    grupo: "Dashboards",
    paginas: [
      { rota: "/dashboard/receita", nome: "Receita" },
      { rota: "/dashboard/receita-caixa", nome: "Receita Caixa" },
      { rota: "/dashboard/receita-executivo", nome: "Resumo Executivo" },
      { rota: "/dashboard/report-fechamento", nome: "Report Fechamento" },
    ],
  },
  {
    grupo: "Admin",
    paginas: [
      { rota: "/admin/usuarios", nome: "Usuários" },
      { rota: "/admin/perfis", nome: "Perfis" },
      { rota: "/admin/comunicados", nome: "Comunicados" },
      { rota: "/admin/importar-bases", nome: "Importar Bases" },
      { rota: "/admin/uso", nome: "Relatório de Uso" },
      { rota: "/admin/configuracoes", nome: "Configurações" },
      { rota: "/admin/emails", nome: "E-mails · Envio e testes" },
      { rota: "/admin/emails/schedules", nome: "E-mails · Agendamentos" },
      { rota: "/admin/emails/log", nome: "E-mails · Log" },
    ],
  },
];

export const HUB_PAGINAS_MAP = new Map<string, string>(
  HUB_PAGINAS.flatMap((g) => g.paginas.map((p) => [p.rota, `${g.grupo} · ${p.nome}`] as [string, string])),
);
