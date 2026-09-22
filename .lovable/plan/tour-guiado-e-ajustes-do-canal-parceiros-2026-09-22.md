# Tour guiado e ajustes do Canal Parceiros

## Resultado
- Exibir pop-ups do tipo Tour como uma sequência guiada sobre a própria tela, mantendo comunicados atuais inalterados.
- Permitir ao administrador criar, ordenar e editar os passos do tour.
- Marcar os pontos indicados nas telas Comercial e Financeiro.
- Mostrar o percentual de repasse na tabela Comercial e a assinatura correta nos e-mails.

## Implementação
1. Criar o tour com filtragem de alvos indisponíveis, recorte do fundo, posicionamento com inversão automática, atualização em rolagem/redimensionamento e atalhos de teclado. Pular, concluir e não mostrar novamente dispensarão o tour antes de fechá-lo.
2. Integrar o novo tipo ao carregamento sequencial dos pop-ups, preservando integralmente o cartão de comunicado.
3. Adicionar somente os atributos `data-tour` solicitados; nas listas, marcar ações apenas na primeira linha.
4. Ampliar o formulário de Comunicados com tipo e editor ordenável de passos; enviar `p_tipo` e `p_passos`, e identificar tours na listagem.
5. Montar em `CanalParceirosTela` o mapa normalizado dos três percentuais e renderizar a nova coluna com valores distintos e detalhamento por ramo.
6. Consumir `assinatura_nome` e `assinatura_area` nas três filas de e-mail e omitir a linha quando ambos estiverem vazios.

## Detalhes técnicos
- Nenhuma migration, RPC, regra de negócio ou arquivo de exportação será alterado.
- O tour será renderizado em camada fixa e usará as cores semânticas existentes do Hub.
- Elementos ausentes ou sem área visível serão ignorados; a numeração refletirá apenas os passos disponíveis.
- A validação incluirá `bunx tsgo --noEmit` e testes visuais/interativos nas duas telas e no editor de Comunicados.
