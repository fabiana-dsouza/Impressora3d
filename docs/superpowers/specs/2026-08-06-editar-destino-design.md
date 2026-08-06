# Editar destino (pra mim / de graça) de registros que já existem

## Problema

O `destino` de uma venda (`venda` / `mim` / `graca`) só pode ser escolhido no
momento de registrar, na tela "Pra quem é?" da nota. Quem usou a fábrica antes
dessa feature tem todos os registros como `venda` normal e não consegue marcar
retroativamente que uma peça foi feita pra si mesma ou dada de graça. E, mesmo
depois da feature, marcar "pra mim" exige passar pelo orçamento inteiro.

## Objetivo

Dois pontos de entrada, ambos usando a coluna `destino` que já existe (sem
tabela nova, sem migração):

1. **Reclassificar** um registro que já existe (venda antiga → pra mim / de
   graça, e o inverso, reversível).
2. **Registrar direto do card do catálogo** uma unidade "pra mim" ou "de graça",
   sem passar pelo orçamento.

## Design

### Banco — `lib/db.ts`

Nova função `mudarDestinoVenda(id, destino)`:

- Atualiza só a coluna `vendas.destino` (`.update({ destino }).eq("id").eq("user_id")`).
- Mesmo padrão de `marcarPago` / `marcarNaoPago`.

O registrar do card reusa `criarVenda` (já existe) — nada novo pra isso.

### Parte 1 — Reclassificar no diálogo "Arrumar esta venda"

`app/fabrica/page.tsx`, diálogo `editando`:

- Dois botões de destino, sempre apontando pros **outros** dois destinos:
  - hoje `venda` → `[Foi pra mim]` `[Dei de graça]`
  - hoje `mim` → `[Foi uma venda]` `[Dei de graça]`
  - hoje `graca` → `[Foi uma venda]` `[Foi pra mim]`
- Handler `reclassificar(venda, destino)`: atualização otimista em `vendas`
  (troca só o `destino` da linha) + `db.mudarDestinoVenda`; rollback + aviso
  padrão em erro. Fecha o diálogo.
- **Regra de dados:** mexe **só no `destino`**. `pagoEm`, `preco` e `custo`
  congelados ficam intactos — o registro só troca de aba. Se virar venda de novo
  e a data de pagamento não bater, o próprio "ainda não me pagou" corrige.
- Esconder o botão "ainda não me pagou" quando o registro **não** é venda
  (`ehVenda(editando) && recebido(editando)`), senão apareceria num "pra mim".
- Título do diálogo adapta: "Arrumar esta venda" (venda) vs "Arrumar este
  registro" (mim/graca).

### Parte 1b — Alcançar o diálogo pela aba "Fiz para mim"

`components/ListaFizParaMim.tsx`:

- Ganha prop `onEditar(venda)` e um botão *Editar* por linha (mesmo visual do
  botão da `ListaVendidos`).
- `app/fabrica/page.tsx` passa `onEditar={(v) => { setEditando(v); setNomeProdutoVenda(v.produtoNome); }}`
  para o `<ListaFizParaMim>` — reusa o mesmo estado/diálogo.

Assim toda reclassificação é reversível pelo mesmo lugar.

### Parte 2 — Registrar do card do catálogo

`app/fabrica/page.tsx`, card do produto (aba catálogo):

- Botão discreto "fiz uma sem vender ›" (abaixo de "A conta / Fazer orçamento").
- Abre um `Dialogo` novo (estado `fazendoSemVender: { produto, resultado } | null`):
  - Dois botões: **É pra mim mesma** (`IconeUsuario`) e **Dei de graça**
    (`IconeCoracao`).
  - "É pra mim mesma" → registra na hora (`destino: "mim"`, sem nome).
  - "Dei de graça" → revela um campo de nome **opcional** ("Pra quem? (opcional)")
    + botão registrar; `destino: "graca"`, com `clienteId` só se ela escreveu
    nome (`acharOuCriarCliente`), igual ao fluxo da nota.
- Handler `registrarSemVenda(produto, resultado, destino, nome)`:
  - Cria via `criarVenda`: `produtoNome: produto.nome`, `coresIds: produto.coresIds`,
    `preco: resultado.precoVenda`, `custo: resultado.custoTotal` (congelados),
    `pagoEm: Date.now()` (nasce quitada), `destino`.
  - Insere a nova venda no estado `vendas` de forma otimista; em erro remove e
    mostra aviso. (O `id`/`criadoEm` real vem do `criarVenda`.)
  - Confetinho (`setFesta`) ao registrar, igual ao "Recebi!".

## Fora de escopo

- Editar cor/peso/tempo do produto (continua fora, como no spec anterior).
- Pedir nome no card quando é "pra mim" (é ela mesma — nunca tem nome).
