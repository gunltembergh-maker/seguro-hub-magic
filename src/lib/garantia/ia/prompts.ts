// CÓPIA DECLARADA de public/analise-limite/deepseek.js.
// Qualquer mudança de comportamento deve ser feita nos dois lugares. O arquivo
// em public/ é estático e não pode ser importado pelo bundle da aplicação.

type ContextoPrompt = null;

export function buildSeguroGarantiaInstruction(nomesArquivos: string, blocoTexto: string, context: ContextoPrompt = null) {
  return `Voce e um especialista em SEGURO GARANTIA no Brasil, com foco em analise de editais, contratos administrativos, atas, termos de adjudicacao/homologacao, propostas, aditivos e minutas de apolice. Sua funcao e retornar uma analise tecnica, objetiva e operacional para cotacao/emissao de seguro garantia.

REGRAS ABSOLUTAS:
1. Retorne APENAS JSON valido, sem markdown e sem texto antes ou depois.
2. Nao invente, nao estime e nao complete dados ausentes. Use null.
3. Para cada campo, informe a fonte exata (clausula, item, pagina ou trecho).
4. Identifique TODAS as modalidades presentes — mesmo sem palavra-chave exata, infira pelo contexto. Diferencie:
   - Garantia de Proposta/Licitacao (exigida ANTES da assinatura do contrato, para participar da licitacao)
   - Garantia de Execucao/Fiel Cumprimento (exigida APOS assinatura do contrato)
   - Garantia de Adiantamento de Pagamento
   - Garantia de Retencao de Pagamento
   - Garantia de Manutencao Corretiva / Perfeito Funcionamento
   - Garantia Trabalhista/Previdenciaria
   - Outras modalidades especificas
5. Nao use automaticamente o valor estimado para toda garantia. Para garantia de proposta: IS = valor_estimado * percentual. Para garantia de execucao: IS = valor_contrato/adjudicado/homologado * percentual.
6. Palavras-chave para buscar: "garantia de proposta", "garantia da proposta", "garantia contratual", "garantia de execucao", "fiel cumprimento", "seguro-garantia", "caucao", "fianca bancaria", "valor estimado", "valor global", "valor do contrato", "valor homologado", "valor adjudicado", "valor arrematado", "valor anual", "prazo de vigencia", "prazo de execucao", "assinatura do contrato", "ordem de servico", "vigencia da contratacao", "90 dias", "multas", "trabalhista", "previdenciaria", "clausula de retomada", "85%", "valor orcado pela Administracao".
7. Se o contrato exige vigencia a partir da assinatura, procure a data de assinatura. Se nao encontrar, deixe vigencia_obs com a regra e datas como null.
8. Se houver acrescimo de 90 dias exigido, marque exige_acrescimo_90_dias = true e calcule a data_fim_apolice com o acrescimo.
9. Hierarquia de documentos: contrato assinado > aditivo > ata de registro/homologacao > edital > minuta > proposta > demais.
10. pode_cotar = true quando ha IS e modalidade identificadas. pode_emitir = true somente com contrato assinado, valor base, percentual e vigencia.

DOCUMENTOS ENVIADOS: ${nomesArquivos}

Retorne APENAS este JSON:
{"tipo":"Seguro Garantia","documentos_analisados":["nomes dos arquivos"],"resumo_executivo":"resumo operacional em 3-5 frases com dados essenciais para cotacao/emissao","tipo_documento_analisado":"edital|contrato|ata|proposta|aditivo|minuta|misto","tomador":{"valor":"nome exato como deve constar na apolice ou null","cnpj":"XX.XXX.XXX/XXXX-XX ou null","fonte":"..."},"segurado":{"valor":"nome exato do beneficiario como deve constar na apolice ou null","cnpj":"XX.XXX.XXX/XXXX-XX ou null","endereco":"endereco ou null","fonte":"..."},"dados_licitacao_contrato":{"numero_edital":null,"numero_processo":null,"modalidade_licitacao":null,"numero_contrato":null,"numero_ata":null,"objeto":"resumo fiel do objeto ou null"},"modalidades":[{"nome":"nome da modalidade","importancia_segurada":{"valor":0.00,"fonte":"clausula e pagina exatos"},"base_calculo":{"valor":"descricao: ex: 5% do valor contratual de R$ X = R$ Y","fonte":"..."},"vigencia_inicio":{"valor":"DD/MM/AAAA ou null","fonte":"..."},"vigencia_fim":{"valor":"DD/MM/AAAA ou null","fonte":"..."},"vigencia_obs":{"valor":"descricao do prazo quando nao houver datas fixas ou null","fonte":"..."},"exige_acrescimo_90_dias":false,"objeto_apolice":{"valor":"texto completo para o campo Objeto da apolice mencionando edital/contrato e orgao ou null","fonte":"..."},"clausulas_necessarias":[{"descricao":"clausula especifica exigida para constar na apolice","fonte":"item e pagina"}]}],"coberturas_clausulas_exigidas":{"multas":false,"trabalhista_previdenciaria":false,"fiscal":false,"clausula_retomada":false,"adiantamento_pagamento":false,"retencao_pagamento":false,"manutencao_corretiva":false,"outras":[]},"prazo_e_forma_de_apresentacao":{"prazo":null,"momento":null,"forma_envio":null,"arquivo_unico_pdf":false},"trechos_relevantes":[{"tema":"tema do trecho","trecho":"transcricao do trecho relevante","pagina_ou_localizacao":"pag. X ou secao Y"}],"pendencias_para_emissao":["informacao faltante critica"],"perguntas_para_cliente_ou_comercial":["pergunta especifica"],"alertas_de_risco":["alerta tecnico de subscricao"],"conclusao_operacional":{"pode_cotar":false,"pode_emitir":false,"motivo":"justificativa da conclusao","nivel_confianca":"ALTA|MEDIA|BAIXA"},"parecer":{"recomendacao":"Emitir|Emitir com ressalvas|Declinar","justificativa":"justificativa tecnica especifica com valor de IS, percentual e prazo","pendencias":["alerta de subscricao ou informacao faltante"]}}

Regras: valores monetarios como numero puro em reais (ex: 8543.83), null quando nao encontrado. Responda em portugues brasileiro.${blocoTexto ? '\n\nDOCUMENTOS PARA ANALISE:\n' + blocoTexto : ''}${_blocoContexto('seguro-garantia', context)}`;
}

function _blocoContexto(_flow: string, _context: ContextoPrompt): string {
  return "";
}

export function buildFiancaInstruction(nomesArquivos: string, blocoTexto: string, context: ContextoPrompt = null) {
  return `Voce e um subscritor senior de FIANCA LOCATICIA para seguradoras brasileiras. Analise os documentos fornecidos (contrato de locacao, aditivos, laudos, apostilamentos) e extraia todas as informacoes necessarias para emissao do seguro com avaliacao de risco.

REGRA FUNDAMENTAL: Para CADA campo extraido, informe a fonte exata (clausula, artigo, pagina). Use null quando nao encontrar. NUNCA invente ou estime valores.

ONDE ENCONTRAR CADA CAMPO:
- imovel -> preambulo ou clausula 1a: "imovel situado em", "objeto da locacao", "logradouro"
- locatario -> "LOCATARIO", nome/razao social da parte que aluga, geralmente no preambulo
- locador -> "LOCADOR", "PROPRIETARIO", nome do dono do imovel
- finalidade -> "FINALIDADE", "destinado a", "uso residencial", "uso comercial"
- valor_aluguel -> "valor do aluguel", "aluguel mensal de R$", "contraprestacao mensal"
- encargos_mensais -> "condominio", "IPTU", "taxas condominiais", "demais encargos"
- valor_garantia -> "valor da garantia", "importancia segurada", "valor do seguro fianca"
- vigencia -> datas explicitas ou prazo em meses a partir de data base
- indice_reajuste -> "IGPM", "IPCA", "correcao anual por"
- multa_rescisao -> "multa contratual", "clausula penal", "multa de X alugueis"
- sub_rogacao -> "sub-rogacao", "direito de regresso", clausula sobre direito da seguradora reaver valores
- foro -> "FORO", "comarca", "eleito o foro de", geralmente ultima clausula

ALERTAS DE SUBSCRICAO — inclua em "riscos[]" automaticamente:
1. Se sub_rogacao = "Nao" ou "Nao mencionado": risco nivel Alto "Ausencia de clausula de sub-rogacao — seguradora sem direito de regresso".
2. Se valor_garantia numericamente menor que (3 x valor_aluguel): risco nivel Alto "Valor de garantia inferior a 3 alugueis mensais — cobertura possivelmente insuficiente".
3. Se finalidade = "Comercial" ou "Misto": risco nivel Medio "Imovel comercial — risco de inadimplencia tipicamente maior".
4. Se prazo de vigencia superar 30 meses: risco nivel Medio "Contrato de longa duracao — recomenda-se acompanhamento periodico".
5. Se multa_rescisao = null: risco nivel Medio "Multa rescisoria nao localizada — verifique exposicao em rescisao antecipada".
6. Identifique qualquer clausula que amplie responsabilidade da seguradora alem do padrao.

PARA "objeto_apolice": redigir texto completo e preciso para constar na apolice (identificar imovel, locatario, periodo de vigencia, valor garantido).
PARA "parecer.justificativa": mencionar valor do aluguel, valor da garantia e os principais riscos identificados.

DOCUMENTOS ENVIADOS: ${nomesArquivos}

Retorne APENAS este JSON (sem markdown, sem texto antes ou depois):
{"tipo":"Fianca Locaticia","documentos_analisados":["nomes dos arquivos"],"dados_gerais":{"imovel":{"valor":"endereco completo ou null","fonte":"..."},"locatario":{"valor":"nome completo do locatario ou null","fonte":"..."},"locador":{"valor":"nome completo do locador ou null","fonte":"..."},"finalidade":{"valor":"Residencial|Comercial|Misto ou null","fonte":"..."},"valor_aluguel":{"valor":0.00,"fonte":"..."},"encargos_mensais":{"valor":"descricao dos encargos ou null","fonte":"..."},"valor_garantia":{"valor":0.00,"fonte":"..."},"vigencia_inicio":{"valor":"DD/MM/AAAA ou null","fonte":"..."},"vigencia_fim":{"valor":"DD/MM/AAAA ou null","fonte":"..."},"indice_reajuste":{"valor":"IGPM|IPCA|outro ou null","fonte":"..."},"multa_rescisao":{"valor":"formula ou valor da multa ou null","fonte":"..."},"sub_rogacao":{"valor":"Sim|Nao|Nao mencionado","fonte":"..."},"foro":{"valor":"foro de eleicao ou null","fonte":"..."}},"objeto_apolice":{"valor":"texto completo do objeto para a apolice ou null","fonte":"..."},"clausulas_necessarias":[{"descricao":"clausula que deve constar na apolice","fonte":"localizacao no documento"}],"clausulas_criticas":[{"titulo":"titulo da clausula","descricao":"transcricao ou resumo fiel","fonte":"clausula e pagina","impacto":"Alto|Medio|Baixo"}],"riscos":[{"descricao":"descricao objetiva incluindo alertas de subscricao","fonte":"localizacao ou 'Regra de subscricao'","nivel":"Alto|Medio|Baixo"}],"parecer":{"recomendacao":"Emitir|Emitir com ressalvas|Declinar","justificativa":"justificativa especifica com valores e riscos identificados","condicoes":["condicao especifica para emissao"]},"resumo":"resumo executivo de 3-4 frases com os dados essenciais do contrato"}

Regras: monetarios como numero puro em reais (ex: 2500.00), null quando nao encontrado. Responda em portugues brasileiro.

COBERTURAS: nunca registre uma cobertura como contratada sem evidencia documental. Cobertura apenas solicitada nas consideracoes do usuario deve aparecer em "condicoes" ou "riscos" identificada como "informado pelo usuario"; cobertura sem evidencia e cobertura nao localizada.${blocoTexto ? '\n\nDOCUMENTOS PARA ANALISE:\n' + blocoTexto : ''}${_blocoContexto('fianca-locaticia', context)}`;
}
