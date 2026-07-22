# Valor final por venda + cliente na nota

**Data:** 2026-07-22
**Status:** Aprovado (aguardando revisão do spec)

## Problema

Dois incômodos no fluxo de vender:

1. **Preço congelado na peça.** No último passo de criar peça
   ([app/novo/page.tsx](../../../app/novo/page.tsx)), o card "Por quanto você
   vendeu?" ([components/PrecoVendido.tsx](../../../components/PrecoVendido.tsx))
   grava o valor em `produto.precoVenda`. A criança usa esse campo pra **testar**
   um preço ("ganha/perde"), mas o teste vira o preço definitivo da peça — mesmo
   sem venda de verdade. E na hora do orçamento não há onde digitar o valor final
   daquela venda.

2. **Cliente no lugar errado.** Hoje o orçamento
   ([app/orcamento/page.tsx](../../../app/orcamento/page.tsx)) começa mostrando o
   nome do **produto** como título e logo pede **"Pra quem é?"** (o cliente),
   misturando as duas coisas. O começo do orçamento deveria ser só sobre o
   **produto**; o cliente deveria ser preenchido depois, na **nota**.

## Modelo novo

### Preço: por venda, não por peça

O preço final passa a ser **por venda**. A peça "lembra" o preço olhando pro
histórico de vendas:

- **Peça nunca vendida** → base = **preço indicado** (o que a calculadora sugere).
- **Peça já vendida antes** → base = **preço da última venda** dessa mesma peça.
- A base vem preenchida na nota, a criança ajusta, e esse valor vai pra notinha.

A base é derivada das vendas de verdade. Logo **"Apenas orçamento" não altera a
base** — só uma venda registrada muda o valor que aparece da próxima vez.

**Retrocompatível:** `calcularProduto` já retorna o preço sugerido quando
`produto.precoVenda === 0` ([lib/calc-produto.ts:56](../../../lib/calc-produto.ts)).
Peças novas serão salvas com `precoVenda: 0`. Peças antigas (com preço congelado
> 0) usam esse valor como base até a primeira venda nova. Nenhuma migração é
necessária.

### Cliente: sai do orçamento, entra na nota

- O **orçamento** ([/orcamento](../../../app/orcamento/page.tsx)) fica só sobre o
  **produto** + as cores. Nada de cliente.
- A **nota** ([/resultado](../../../app/resultado/page.tsx)) ganha o campo do
  cliente (com os atalhos de clientes recentes), o campo do valor final e a
  decisão de vender.

## Fluxo

```
Fábrica  ──"Fazer orçamento"──▶  /orcamento (só produto + cor)  ──▶  /resultado (a nota)
                                                                      ├─ Pra quem é?  (cliente)
                                                                      ├─ Qual o valor final?
                                                                      ├─ notinhas ao vivo
                                                                      └─ [Vendido] [Apenas orçamento]
```

## Mudanças por tela

### 1. Criar peça — [app/novo/page.tsx](../../../app/novo/page.tsx)

- Remover o card `<PrecoVendido>` do passo final.
- O passo final ("Quanto ficou?") vira um **resumo só de leitura**: custo pra
  fabricar + preço indicado + botão "Salvar peça". Sem campo de preço.
- Salvar o produto com `precoVenda: 0`.
- Remover o estado `precoVendido`, o pré-preenchimento em `avancar()`
  ([app/novo/page.tsx:135-137](../../../app/novo/page.tsx)) e a validação "Põe por
  quanto você vendeu!" em `salvar()`.

### 2. Fazer orçamento — [app/orcamento/page.tsx](../../../app/orcamento/page.tsx)

- **Remover a seção "Pra quem é?"** (input do cliente + pastilhas de recentes).
- Deixar **explícito que o nome exibido é o do produto**: um cabeçalho rotulado
  ("Orçamento de" + nome do produto em destaque) no lugar do título solto de hoje.
- `podeSeguir` passa a exigir só cor: `coresIds.length > 0`.
- `seguir()` monta `/resultado` com `id` e `cores`. No caso "Vender de novo"
  (`?de=`), resolve o nome do cliente anterior e passa junto como `cliente=` pra
  nota já vir preenchida.
- O carregamento de clientes só permanece pra resolver o nome no caso `de=`.

### 3. A nota — [app/resultado/page.tsx](../../../app/resultado/page.tsx)

**Modo orçamento vs. ver a conta.** A tela é "modo orçamento" (mostra cliente +
valor final + botões de vender) quando vem do orçamento — sinalizado pela presença
do parâmetro `cores`. Sem `cores` (link "A conta" da fábrica, `?novo=1` do /novo)
ela fica **só leitura**, como hoje: mostra as notinhas com a base, sem campos nem
botões de vender.

No modo orçamento:

- Carregar `db.lerVendas()` e `db.lerClientes()` junto com produto/config/cores.
- **Cliente:** estado `cliente` (string), inicializado com o parâmetro `cliente`
  (vazio se não houver). Campo de texto + pastilhas de recentes (top N por
  `usadoEm`), mesmo padrão que hoje vive no /orcamento. Atualiza a notinha ao vivo.
- **Valor final:** calcular a **base** — última venda com `produtoId === id` (mais
  recente por `criadoEm`) → `.preco`; se não houver, `resultado.precoVenda`
  (sugerido). Estado `valorFinal` (string), inicializado com a base quando os dados
  carregam. Renderizar `<PrecoVendido>` (ganha/perde ao vivo) ligado a `valorFinal`.
- **Notinhas ao vivo** refletem os dois campos:
  - `resultado` efetivo = `{ ...resultado, precoVenda: n, lucro: n - custoTotal }`
    (`n = Number(valorFinal) || 0`) pra
    [NotinhaInterna](../../../components/NotinhaInterna.tsx).
  - `dadosOrcamento.preco = n` e `dadosOrcamento.cliente = nomeLimpo(cliente)` pra
    [NotinhaCliente](../../../components/NotinhaCliente.tsx).
- **Botões "Vendido" / "Apenas orçamento"** no lugar de "Vendi! / Não vendi":
  - **Vendido** — exige cliente preenchido (`nomeLimpo(cliente).length > 0`) e
    `n > 0`. Faz `acharOuCriarCliente(cliente)` + `criarVenda({ ..., preco: n })`
    e vai pra `/fabrica?aba=vendidos`. Se faltar cliente, avisar de forma amigável.
  - **Apenas orçamento** — volta pra `/fabrica` sem registrar nada.

## Copy

- `PrecoVendido` hoje diz "Por quanto você vendeu?". O título vira prop (default
  mantém o texto atual); a nota usa **"Qual o valor final?"** com subtítulo "É esse
  valor que vai na notinha."
- Cliente na nota: **"Pra quem é?"** (mesma copy de hoje).
- Orçamento: cabeçalho **"Orçamento de"** + nome do produto.

## Casos de borda

- **Ver a conta / peça recém-criada** (sem `cores`): só leitura, notinhas com a
  base, sem campos nem botões — como hoje.
- **Cliente vazio no modo orçamento:** notinha do cliente sai sem a linha "para
  ..." (comportamento já existente de `montarOrcamento`). "Apenas orçamento"
  funciona; "Vendido" fica bloqueado até ter nome.
- **`valorFinal` vazio / 0:** o ganha/perde mostra o estado atual; "Vendido" não
  registra com preço 0.
- **"Vender de novo"** (`?de=`): cliente e valor já vêm preenchidos (cliente via
  parâmetro, valor via última venda), que é o comportamento desejado.

## Arquivos afetados

- [app/novo/page.tsx](../../../app/novo/page.tsx) — remove o campo de preço do
  último passo.
- [app/orcamento/page.tsx](../../../app/orcamento/page.tsx) — tira o cliente,
  deixa explícito o produto.
- [app/resultado/page.tsx](../../../app/resultado/page.tsx) — campo do cliente,
  campo do valor final, notinhas ao vivo, botões novos.
- [components/PrecoVendido.tsx](../../../components/PrecoVendido.tsx) — título como
  prop (mudança pequena, retrocompatível).
- Sem mudança em tipos, `lib/db`, `calcularProduto` ou migrações.

## Testes

- `calcularProduto` com `precoVenda: 0` já é coberto
  ([lib/calc-produto.test.ts](../../../lib/calc-produto.test.ts)) — continua válido.
- A escolha da base (última venda vs. sugerido) é lógica pura, boa de extrair numa
  função testável, ex.: `precoBaseDaVenda(vendas, produtoId, precoSugerido)`.
- Verificação manual: criar peça (sem pedir preço) → orçamento (só produto+cor) →
  nota mostra indicado → preencher cliente → Vendido por outro valor → novo
  orçamento da mesma peça já vem com esse valor.
