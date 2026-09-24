// Textos de ajuda do pipeline de Garantia, por etapa. Texto em dado, não em JSX:
// o "?" do cartão e do modal lê daqui. Aviso de consequência (impedimento,
// pendência, "A IA pode errar") NÃO mora aqui — é resposta a uma ação.

export interface AjudaFase {
  titulo: string;
  paraQueServe: string;
  comoPreencher: string[];
  paraAvancar: string;
}

export const AJUDA_POR_ETAPA: Record<string, AjudaFase> = {
  "1": {
    titulo: "Análise da demanda",
    paraQueServe:
      "É onde a demanda ganha forma. O documento já chegou junto com o registro da entrada; aqui a IA lê e o corretor confere.",
    comoPreencher: [
      "Selecione quais documentos a IA deve ler — contrato, edital e processo vão juntos; DRE e balanço são leitura separada, não misture as duas.",
      "Rode a análise e confira campo a campo antes de aplicar: o que já tem valor não é sobrescrito sozinho.",
      "O que a IA não achou, preencha à mão.",
      "Se faltar documento e ele estiver com o comercial, use “Solicitar ao comercial” — isso avisa o time comercial e a situação muda sozinha; quando ele responde, volta para você.",
    ],
    paraAvancar:
      "Pelo menos um documento de contrato anexado (edital, contrato ou processo; na fiança, o contrato de locação).",
  },
  "3": {
    titulo: "Consulta a mercado",
    paraQueServe: "Descobrir quanto cada seguradora libera de limite para este cliente.",
    comoPreencher: [
      "10 seguradoras respondem por API e são preenchidas sozinhas.",
      "8 têm portal e são lançadas à mão.",
      "As outras 17 não têm portal e são opcionais — pode lançar, não trava nada.",
      "Use “Salvar limites” para gravar o que lançou.",
      "“Não consultado” é falha técnica da consulta, nunca recusa da seguradora, e não conta como negativa em lugar nenhum.",
    ],
    paraAvancar:
      "As 18 com portal precisam ter resposta registrada. A consulta vale 12 meses; dentro do prazo, ela é reaproveitada sem refazer. Fiança locatícia não passa por esta fase.",
  },
  "3b": {
    titulo: "Cadastro",
    paraQueServe:
      "Só aparece quando nenhuma seguradora com portal cobre sozinha a importância segurada. Serve para a seguradora reanalisar o cliente e liberar mais limite.",
    comoPreencher: [
      "Três saídas, e qualquer uma resolve.",
      "Anexar um documento — basta um entre DRE, balanço e alteração contratual, não são três nem um de cada.",
      "Montar cosseguro, dividindo o risco entre seguradoras até a soma alcançar a importância segurada.",
      "Ou seguir sem os documentos, escrevendo o motivo.",
      "Responda as duas perguntas de assinatura: a seguradora devolve balanço e DRE sem a assinatura do representante legal e do contador.",
    ],
    paraAvancar: "Uma das três saídas concluída.",
  },
  "4": {
    titulo: "Cotação",
    paraQueServe: "Registrar o que as seguradoras responderam.",
    comoPreencher: [
      "Uma linha por cotação, com taxa, prêmio e comissão.",
      "Marque a escolhida — é ela que define o prêmio e a comissão que entram no pipeline e no painel.",
    ],
    paraAvancar: "Uma cotação marcada como escolhida.",
  },
  "5": {
    titulo: "Proposta",
    paraQueServe: "Levar a proposta ao cliente e registrar a resposta.",
    comoPreencher: [
      "Anexe o comparativo enviado.",
      "Sem follow-up automático: a cobrança é do corretor.",
    ],
    paraAvancar:
      "“Registrar aceite do cliente” gera o código GAR e leva a demanda ao CRM. Se o cliente não fechar, “Registrar perda” com o motivo — nada é apagado, e demanda perdida pode ser reaberta.",
  },
  "6": {
    titulo: "Curadoria",
    paraQueServe: "Conferir o que veio da negociação antes de pedir a minuta. Nada é redigitado.",
    comoPreencher: [
      "O checklist mostra só o que falta.",
      "Responda se o caso precisa de CCG — o padrão é não.",
    ],
    paraAvancar: "Com CCG marcado, o documento assinado anexado.",
  },
  "7": {
    titulo: "Minuta",
    paraQueServe: "Conferir o texto da apólice antes da emissão.",
    comoPreencher: [
      "Anexe a minuta; versão nova não apaga a anterior.",
      "Confirme seguradora, prêmio e taxa herdados da cotação.",
      "Registre a aprovação do cliente com data e forma.",
    ],
    paraAvancar:
      "Minuta anexada e aprovação do cliente registrada; quando o segurado exige texto próprio, também o aceite dele.",
  },
  "8": {
    titulo: "Emissão",
    paraQueServe: "Lançar a apólice emitida.",
    comoPreencher: [
      "Anexe a apólice e o boleto.",
      "A IA lê a apólice e sugere número, vigência, objeto, importância segurada e prêmio.",
      "Comissão em % é manual; o valor é calculado.",
      "No seguro garantia são obrigatórios tomador e segurado; na fiança locatícia, locador e locatário.",
    ],
    paraAvancar: "Apólice e boleto anexados e a apólice lançada.",
  },
  "9": {
    titulo: "Financeiro",
    paraQueServe: "Acompanhar o pagamento do prêmio e o recebimento da comissão.",
    comoPreencher: ["Vencimento do boleto, status do prêmio, comissão recebida e repasse quando houver."],
    paraAvancar:
      "Esta fase não conta tempo. O relógio da demanda terminou quando a apólice foi enviada ao financeiro. Prêmio não pago não cancela apólice — o financeiro cobra.",
  },
};
// A etapa "2" foi fundida com a "1": histórico antigo lê o mesmo texto.
AJUDA_POR_ETAPA["2"] = AJUDA_POR_ETAPA["1"];

export const ajudaDaEtapa = (etapa: string): AjudaFase | null => AJUDA_POR_ETAPA[etapa] ?? null;

export const FLUXO_INTEIRO: string[] = [
  "A demanda entra pela Entrada de Demandas, que é a porta única de todos os ramos, sempre com pelo menos um documento — sem documento não há o que analisar. De lá ela vira um card em Análise da demanda e segue por Consulta a mercado, Cadastro quando necessário, Cotação e Proposta. O aceite do cliente gera o código GAR e leva ao CRM, onde ela passa por Curadoria, Minuta, Emissão e Financeiro até virar apólice vigente.",
  "Cada fase tem uma situação — com quem a bola está parada agora — que se troca no topo do card com um clique. Mover de fase é outra coisa: são os botões da direita, e voltar de fase pede um motivo, porque voltar é como se conserta o que saiu errado. Fiança locatícia segue o mesmo caminho, só pulando a consulta a mercado, que as APIs das seguradoras não atendem.",
  "A troca entre corretor e comercial é automática: ao usar “Solicitar ao comercial” a demanda passa a aguardar o comercial, e quando ele responde na aba dele ela volta sozinha para o corretor.",
  "Nada é apagado: demanda perdida vira estado e pode ser reaberta; apólice encerrada sai da carteira e fica no histórico.",
];
