# Valor final por venda (não por peça)

**Data:** 2026-07-22
**Status:** Aprovado (aguardando revisão do spec)

## Problema

Hoje o preço de venda fica **congelado na peça**. No último passo de criar peça
([app/novo/page.tsx](../../../app/novo/page.tsx)), o card "Por quanto você
vendeu?" ([components/PrecoVendido.tsx](../../../components/PrecoVendido.tsx))
grava o valor em `produto.precoVenda`.

Na prática a criança usa esse campo pra **testar** um preço e ver se vale a pena
("ganha/perde"). Mas esse teste vira o preço definitivo da peça, mesmo quando não
foi uma venda de verdade. E na hora de fazer o orçamento pra um cliente
([app/orcamento/page.tsx](../../../app/orcamento/page.tsx) →
[app/resultado/page.tsx](../../../app/resultado/page.tsx)) não existe onde digitar
o valor final daquela venda — a notinha sempre usa o preço congelado.

## Modelo novo

O preço final passa a ser **por venda**, não uma propriedade da peça. A peça
"lembra" o preço olhando pro histórico de vendas:

- **Peça nunca vendida** → base = **preço indicado** (o que a calculadora sugere).
- **Peça já vendida antes** → base = **preço da última venda** dessa mesma peça.
- A base vem preenchida, a criança ajusta na hora, e esse valor vai pra notinha.

A base é derivada das vendas de verdade. Logo **"Apenas orçamento" não altera a
base** — só uma venda registrada muda o valor que aparece da próxima vez.

### Retrocompatível

`calcularProduto` já retorna o preço sugerido quando `produto.precoVenda === 0`
([lib/calc-produto.ts:56](../../../lib/calc-produto.ts)). Peças novas serão salvas
com `precoVenda: 0`. Peças antigas (com preço congelado > 0) continuam usando esse
valor como base até a primeira venda nova. Nenhuma migração de dados é necessária.

## Mudanças por tela

### 1. Criar peça — [app/novo/page.tsx](../../../app/novo/page.tsx)

- Remover o card `<PrecoVendido>` do passo final.
- O passo final ("Quanto ficou?") vira um **resumo só de leitura**: custo pra
  fabricar + preço indicado + botão "Salvar peça". Sem campo de preço.
- Salvar o produto com `precoVenda: 0` (a base vira o preço indicado).
- Remover o estado `precoVendido`, o pré-preenchimento em `avancar()`
  ([app/novo/page.tsx:135-137](../../../app/novo/page.tsx)) e a validação
  "Põe por quanto você vendeu!" em `salvar()`.

### 2. A nota — [app/resultado/page.tsx](../../../app/resultado/page.tsx)

- Carregar as vendas (`db.lerVendas()`) junto com produto/config/cores.
- Calcular a **base**: última venda com `produtoId === id` (mais recente por
  `criadoEm`) → `.preco`; se não houver, `resultado.precoVenda` (sugerido).
- Novo estado `valorFinal` (string), inicializado com a base quando os dados
  carregam.
- Renderizar `<PrecoVendido>` no topo (reaproveitado), com o "ganha/perde" ao
  vivo, ligado a `valorFinal`.
- As duas notinhas passam a refletir `valorFinal` ao vivo:
  - `resultado` efetivo = `{ ...resultado, precoVenda: n, lucro: n - custoTotal }`
    (onde `n = Number(valorFinal) || 0`), passado pra
    [NotinhaInterna](../../../components/NotinhaInterna.tsx).
  - `dadosOrcamento.preco = n` pra
    [NotinhaCliente](../../../components/NotinhaCliente.tsx).
- Trocar os botões "Vendi! / Não vendi" por **"Vendido" / "Apenas orçamento"**:
  - **Vendido** → `criarVenda({ ..., preco: n })` (usa `valorFinal`, não
    `resultado.precoVenda`), depois vai pra `/fabrica?aba=vendidos`. Continua
    exigindo o nome do cliente (o fluxo do orçamento já garante).
  - **Apenas orçamento** → volta pra `/fabrica` sem registrar nada.

### 3. Fazer orçamento — [app/orcamento/page.tsx](../../../app/orcamento/page.tsx)

- Sem mudança. Continua "pra quem + qual cor". O preço agora é definido na tela
  da nota, onde dá pra ver a notinha mudando ao vivo.

## Copy

`PrecoVendido` hoje diz "Por quanto você vendeu?". Como agora ele também serve
pra um orçamento que talvez não vire venda, o título vira prop (default mantém o
texto atual) e a tela da nota usa **"Qual o valor final?"** com o subtítulo
"É esse valor que vai na notinha."

## Casos de borda

- **Peça recém-criada** (`/resultado?novo=1`, sem cliente): sem venda no histórico
  → base = preço indicado. Os botões de venda só aparecem quando há cliente (como
  hoje), então esse caso continua sendo só a pré-visualização da notinha.
- **`valorFinal` vazio / 0**: o "ganha/perde" mostra o estado atual; o botão
  "Vendido" não deve registrar preço 0 (reaproveitar a checagem já existente).
- **Reentrar numa peça já vendida** (via "Vender de novo"): a base já vem do preço
  da última venda, que é exatamente o comportamento desejado.

## Arquivos afetados

- [app/novo/page.tsx](../../../app/novo/page.tsx) — remove o campo de preço do
  último passo.
- [app/resultado/page.tsx](../../../app/resultado/page.tsx) — campo de valor final,
  notinhas ao vivo, botões novos.
- [components/PrecoVendido.tsx](../../../components/PrecoVendido.tsx) — título como
  prop (mudança pequena, retrocompatível).
- Sem mudança em tipos, `lib/db`, `calcularProduto` ou migrações.

## Testes

- `calcularProduto` com `precoVenda: 0` já é coberto
  ([lib/calc-produto.test.ts](../../../lib/calc-produto.test.ts)) — continua válido.
- A escolha da base (última venda vs. sugerido) é lógica pura e boa de extrair
  numa função testável, ex.: `precoBaseDaVenda(vendas, produtoId, precoSugerido)`.
- Verificação manual: criar peça (sem pedir preço) → orçamento → nota mostra
  indicado → Vendido por outro valor → novo orçamento da mesma peça já vem com
  esse valor.
