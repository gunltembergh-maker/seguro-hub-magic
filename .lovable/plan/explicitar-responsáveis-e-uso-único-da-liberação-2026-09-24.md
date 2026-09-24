# Explicitar responsáveis e uso único da liberação

## Alterações
- Ampliar os dados de situação usados nas telas do Canal Parceiros com responsável, próximo passo, estado da liberação, data de uso e possibilidade de cobrança.
- Exibir, em parceiros bloqueados, selo por responsável, orientação do banco e o novo estado “Contrato em conferência”.
- Identificar liberações aprovadas como válidas para uma exportação e liberações já usadas com a data e a opção de pedir novamente.
- Adicionar a ação “Cobrar”, usando a nova função do banco, exibindo a resposta real e atualizando situação e notificações.
- Acrescentar o aviso e a confirmação obrigatória de uso único ao pedido de liberação.
- Antes de exportar ao parceiro com liberação, pedir confirmação; depois, informar que a liberação foi usada e atualizar situação e notificações.
- Atualizar apenas os textos dos e-mails de pedido e aprovação indicados.

## Detalhes técnicos
- Reutilizar `rpc_canal_parceiro_situacao`, `rpc_canal_parceiro_cobrar_pendencia` e as chaves de cache existentes.
- Usar `mensagemDeErro` para erros do banco.
- Não criar migration, não alterar banco e não mexer em fluxos fora do Canal Parceiros.
- Validar compilação e os estados visíveis possíveis na prévia autenticada.
