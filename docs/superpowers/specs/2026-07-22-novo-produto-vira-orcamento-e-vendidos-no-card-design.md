# Criar produto já cai no orçamento + "vendidos" no card

Data: 2026-07-22

## Contexto

Os commits recentes tiraram o cliente e o valor final do produto e levaram os
dois pra nota (`/resultado`), que só liga o modo orçamento quando recebe
`?cores`. Hoje o fluxo tem dois buracos:

1. **Depois de criar uma peça** (`/novo`), a criança cai numa notinha "só pra
   ver" (`/resultado?id=…&novo=1`, sem `?cores`): não dá pra dizer pra quem é,
   nem testar preço, nem vender. Ela precisa voltar pra fábrica e apertar "Fazer
   orçamento" pra fazer a primeira venda da peça que acabou de nascer.
2. **Na fábrica**, o card do produto não mostra quantas unidades daquela peça já
   foram vendidas, nem deixa ver quem comprou cada uma. Esse histórico só existe
   solto na aba Vendidos, sem agrupar por peça.

Esta spec cobre duas mudanças pequenas e relacionadas que fecham os dois
buracos, reaproveitando o que já existe e sem afrouxar nenhuma regra de preço.

## Parte A — Criar produto já cai no orçamento

### Mudança

Em [`app/novo/page.tsx`](../../../app/novo/page.tsx), a função `salvar()` hoje faz:

```ts
router.push(`/resultado?id=${produto.id}&novo=1`);
```

Passa a incluir as cores da peça, o que liga o modo orçamento que **já existe**
em `/resultado` (`ehOrcamento = coresParam !== null`):

```ts
const cores = produto.coresIds.join(",");
router.push(`/resultado?id=${produto.id}&novo=1&cores=${cores}`);
```

Nada mais muda no `/novo`. A peça sempre tem ≥1 cor (o passo 2 exige), então
`cores` nunca vem vazio.

### O que a criança vê depois de salvar

Exatamente o orçamento que já roda hoje quando ela vem de "Fazer orçamento",
mais o confete de peça nova:

- 🎉 confete de "produto criado" (o `novo=1` continua disparando)
- **"Pra quem é?"** — o nome digitado vai pra notinha do cliente
- **teste de negociação** ([`PrecoVendido`](../../../components/PrecoVendido.tsx)) —
  o valor já vem preenchido no preço indicado, porque a peça é nova e
  `precoBaseDaVenda` cai no sugerido quando não há venda anterior
- as duas notinhas ao vivo
- botões **Vendido / Apenas orçamento**

Sem regra de preço nova: `alvo`, `resultado`, `resultadoNota` e a base de valor
são os mesmos caminhos que o orçamento vindo de `/orcamento` já usa.

### Toque de festa (parte da entrega, não opcional)

Só quando `ehNovo && ehOrcamento`, uma frase curta acima do "Pra quem é?" pra
explicar por que a tela virou orçamento — senão o pulo do "salvei" pro "pra quem
é?" fica sem contexto:

> **{nome} entrou na fábrica!** Já quer fazer o primeiro orçamento?

Linguagem grande e simples (regra do projeto), sem emoji no texto (o confete já
faz a festa). Some quando `ehNovo` é falso (orçamento normal não mostra isso).

## Parte B — Contador "vendidos" + "ver quem comprou" no card

### Onde

No card de cada produto na aba **Meus produtos**
([`app/fabrica/page.tsx`](../../../app/fabrica/page.tsx)), entre o quadro de
lucro e os botões "A conta / Fazer orçamento". Aparece **só quando a peça tem 1
venda ou mais**; com zero vendas o card fica igual ao de hoje.

Uma linha-botão:

> **2 vendidos — ver quem comprou ›**  (singular: "1 vendido")

### Comportamento

Tocar abre uma janelinha (o [`Dialogo`](../../../components/Dialogo.tsx) já
existente, no modo "só fechar": sem `onConfirmar`, botão único "Entendi") com o
título `{nome} — 2 vendidos` e a lista de **cada unidade** daquela peça:

- nome de quem comprou (ou o "** falta o nome **" quando `clienteId` é nulo — só
  como texto aqui, sem editar)
- valor da venda (`brl(v.preco)`)
- status: **ganhou {lucro}** (pago) ou **falta pagar** (não pago), no mesmo
  vocabulário visual da aba Vendidos

É **só pra ver**. Receber, trocar nome e vender de novo continuam só na aba
Vendidos — a janelinha não duplica essas ações, pra não ter dois lugares
fazendo a mesma coisa.

### Dados

A fábrica já carrega `vendas` e `clientes` no efeito de migração, e já estão no
estado da tela mesmo na aba catálogo. Por peça:

```ts
const vendasDaPeca = vendas.filter((v) => v.produtoId === produto.id);
```

`vendasDaPeca.length` é o contador. Vendas de peças apagadas têm
`produtoId === null` e não entram em nenhuma peça — correto, o card só existe
pra peça que existe. Conta **todas** as vendas da peça (paga ou não): vender é
vender; o status de pagamento aparece por unidade dentro da janelinha.

O contador vem das linhas de `Venda`, nunca do campo velho `produto.vendidos`
(que já foi migrado pra linhas de venda).

### Componente novo

`components/EspecificacoesProduto.tsx` — presentational puro. Recebe as vendas
de uma peça + `clientes` + `cores` e desenha a lista compacta de unidades.
Reaproveita `brl`, `lucroDaVenda`, `recebido` ([`lib/vendas.ts`](../../../lib/vendas.ts)),
`acharCor` e o `Carretel`. Sem estado próprio, sem handlers de ação.

O `/fabrica` ganha um estado `vendoUnidadesDe: Produto | null` que controla a
janelinha, no mesmo padrão dos outros dialogs da tela (`apagando`, `nomeando`).

### Linguagem

"Especificações" é palavra de adulto; a regra inegociável do projeto é
zero-jargão pra 10 anos. O rótulo do card usa **"ver quem comprou"**. (Se a
usuária preferir a palavra original depois, é troca de string.)

## Base do valor no re-orçamento

Fica como já é: `precoBaseDaVenda` usa o **último** preço vendido daquela peça (a
venda mais recente por `criadoEm`), caindo no sugerido quando não houve venda. A
usuária descreveu "o que vendeu a primeira vez"; mantemos o último de propósito
— a peça lembra onde ela parou de negociar. Se ela pedir o primeiro preço fixo
pra sempre, é uma troca isolada dentro de `precoBaseDaVenda`. Nenhuma mudança
nesta entrega.

## O que NÃO muda

- `/orcamento` e o fluxo de orçamento vindo da fábrica ou de "vender de novo":
  intactos.
- Modo "só ver a conta" (`/resultado?id=…` sem `cores`, ex.: o link "A conta" do
  card): continua read-only.
- Aba Vendidos: continua a lista de todas as vendas com receber / trocar nome /
  vender de novo.
- Regras de preço (`lib/calc.ts`), margem mínima, arredondamento: intocadas.

## Arquivos afetados

- `app/novo/page.tsx` — redirect com `&cores=` no `salvar()`.
- `app/resultado/page.tsx` — frase de festa quando `ehNovo && ehOrcamento`.
- `app/fabrica/page.tsx` — linha "N vendidos — ver quem comprou" no card
  (quando `vendasDaPeca.length > 0`) + estado e `Dialogo` da janelinha.
- `components/EspecificacoesProduto.tsx` — **novo**, lista das unidades de uma
  peça.

## Testes

- `EspecificacoesProduto`: contagem/plural ("1 vendido" vs "2 vendidos"), nome
  ausente vira o texto de falta, status pago vs não pago, valor formatado.
- Agrupamento por peça em `/fabrica`: só mostra a linha com ≥1 venda; ignora
  vendas de `produtoId` nulo; conta pagas e não pagas.
- `/novo`: o redirect inclui `cores` com as cores da peça salva.
- Rodar a suíte existente (Vitest) pra garantir que nada de preço quebrou.
