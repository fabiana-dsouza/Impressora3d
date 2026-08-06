# Renomear produto no catálogo

## Problema

No catálogo ("Meus produtos") não há como editar um produto depois de criado — só
criar (via /novo) e apagar. Vários produtos antigos ficaram com nome de cliente
(`Lucas`, `Jhonathan`, `Sr Alberto`…), herança de como a fábrica era usada antes,
e a criança não tem como corrigir isso sozinha.

## Objetivo

Deixar o próprio usuário renomear um produto direto no card do catálogo.

**Escopo:** só o nome. Editar cor/peso/tempo fica para depois (fora de escopo).

## Design

### Banco — `lib/db.ts`

Nova função `renomearProduto(id, nome)`:

- Atualiza `produtos.nome`.
- Sincroniza `vendas.produto_nome` de todas as vendas com aquele `produto_id`,
  para o nome na aba Vendidos bater com o catálogo.

Essa lógica já existe embutida no ramo `produtoId` de `renomearProdutoDaVenda`.
Extrair para `renomearProduto` e fazer `renomearProdutoDaVenda` delegar a ela
quando há produto — uma fonte de verdade só. O ramo de venda órfã (sem
`produtoId`) continua como está.

### Tela — `app/fabrica/page.tsx`

- Botão de etiqueta (`IconeEtiqueta`) ao lado da lixeira no topo do card do
  catálogo.
- Abre um `Dialogo` com input de texto (mesmo padrão do diálogo "Arrumar esta
  venda"), pré-preenchido com o nome atual, `maxLength={40}`.
- Estado novo: `renomeandoProduto: Produto | null` e `nomeProduto: string`.
- Handler `salvarNomeProduto`:
  - Atualização otimista: troca o nome em `produtos` e nas `vendas` daquele
    `produto_id` no estado da tela.
  - Chama `db.renomearProduto(id, nome)`.
  - Em erro, desfaz (restaura `produtos`/`vendas` anteriores) e mostra o aviso
    padrão — mesmo padrão de `salvarNomeProdutoVenda`.
  - Nome vazio (após `trim`) não salva.

## Fora de escopo

- Editar cor, peso ou tempo do produto.
- Menu agrupado de ações no card.
