# Fase 2 — revender um produto existente, com variações

**Data:** 2026-08-05
**Status:** Aprovado em conversa (aguardando implementação)

## Ideia

Revender é o **corta-caminho** da venda: a peça já existe, então em vez de
recriar tudo, a nota abre **repetindo a última venda** (mesma cor, mesmo valor)
e ela só confirma. Se algo mudou, um botão **"Mudou algo?"** abre pra editar
**nome, cor e valor** daquela venda. A variação fica **na linha da venda** — o
produto no catálogo não se multiplica.

Escopo: revenda de produto **já finalizado**, a partir do "Vender de novo" que
já existe na lista de unidades. A criação-do-zero (Fase 1) não muda.

## Modelo de dados

Nenhuma mudança. A [`Venda`](../../../lib/types.ts) já congela por linha:
`produtoNome`, `coresIds`, `preco`, `custo`. Uma variação é só uma venda com o
mesmo `produtoId` e um `produtoNome`/`coresIds`/`preco` próprios. Sem migração.

- **Nome da variação** ("Chaveiro" → "Chaveiro do Batman"): fica **só na
  venda** (`produtoNome`). O produto no catálogo continua "Chaveiro".
- **"Vendido N vezes"** = contar as vendas com aquele `produtoId`
  ([`vendasDaPeca`](../../../lib/vendas.ts)), que já é como o card conta.

## Fluxo

```
Meus produtos → "ver quem comprou" → [Vender de novo]
   → /resultado?id=…&cores=…&cliente=…&repete=1

/resultado (modo repete):
   Repetindo: Chaveiro · 🔵 azul · R$ 12,00
   [ Mudou algo? ]                      ← abre editar nome / cor / valor
   [ Vendido por R$ 12,00 ] [ Só orçamento ]
        └─► Pra quem é? (pré-preenchido com quem comprou; dá pra trocar)
            → "Já te pagou?" → grava no MESMO produto
```

## Mudanças por arquivo

### [app/fabrica/page.tsx](../../../app/fabrica/page.tsx)

- `onVenderDeNovo` acrescenta `&repete=1` na URL (o resto — `id`, `cores`,
  `cliente` — já monta hoje).

### [lib/vendas.ts](../../../lib/vendas.ts) + [lib/vendas.test.ts](../../../lib/vendas.test.ts)

- `rotuloVendidos(n)` passa a devolver **"vendido N vez/vezes"** (era "N
  vendido(s)"). Atualizar as duas asserções do teste.

### [app/resultado/page.tsx](../../../app/resultado/page.tsx)

- `ehRepete = ehOrcamento && params.get("repete") === "1"`.
- Estados novos: `mudouAlgo` (bool, `false`) e `nomeVenda` (string, semeado com
  `produto.nome` quando a peça carrega).
- `editando = !ehRepete || mudouAlgo` — controla se os editores aparecem.
  - **`ehRepete && !mudouAlgo`**: mostra um **resumo** ("Repetindo: {nome} ·
    {cores} · {brl(base)}") + botão **"Mudou algo?"** (`setMudouAlgo(true)`). O
    seletor de cor e o `<PrecoVendido>` ficam escondidos.
  - **`editando`**: mostra o seletor de cor e o `<PrecoVendido>` como hoje; e,
    **só no repete**, um campo de **nome da variação** (semeado com
    `nomeVenda`). Na criação-do-zero nada muda (editores sempre visíveis, sem
    campo de nome).
- `registrarVenda` passa `produtoNome: ehRepete ? nomeVenda.trim() || produto.nome : produto.nome`.
- O bloco de decisão (Vendido/Só orçamento + revelar cliente) é o mesmo da Fase
  1. Cliente já vem semeado com quem comprou (via `cliente` param), editável.

### [components/EspecificacoesProduto.tsx](../../../components/EspecificacoesProduto.tsx)

- Cada linha passa a mostrar a **variação**: título = `v.produtoNome` (o nome
  daquela venda), subtítulo = `{cliente ?? "** falta o nome **"} · {brl(preco)}`.
  A cor (carretéis) e o chip de status continuam. O "Vender de novo" continua.
- Assim, ao tocar no produto, ela vê todas as variações vendidas (nome, cor,
  valor, cliente).

## Casos de borda

- **"Vender de novo" de venda sem cliente** (migrada): `cliente` vem vazio; no
  passo do cliente ela preenche. Igual à Fase 1.
- **Repete sem mudar nada:** `produtoNome`/`coresIds`/`preco` = os da última
  venda; a nova venda é idêntica, só com data e (talvez) cliente novos.
- **Mudou o nome pra vazio:** cai no `produto.nome` (o `|| produto.nome`).
- **"Fazer orçamento" do card** (sem `repete`): segue a Fase 1 normal, editores
  visíveis, sem resumo nem "Mudou algo?".
- **Só ver a conta** (sem `cores`): inalterado.

## Testes

- `rotuloVendidos`: atualizar as duas asserções pra "vendido 1 vez" / "vendido 2
  vezes".
- Resto de `lib/*.test.ts`: verde (nada de regra de preço/venda muda).
- Manual: Vender de novo → resumo aparece → confirmar direto grava igual; e
  Mudou algo? → troca cor/nome/valor → grava a variação; card mostra "vendido N
  vezes"; tocar no produto lista as variações.
