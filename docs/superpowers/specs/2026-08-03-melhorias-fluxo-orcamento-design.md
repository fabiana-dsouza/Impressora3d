# Melhorias no fluxo: revender, orçamento em uma tela, plano e onboarding

**Data:** 2026-08-03
**Status:** Aprovado (aguardando revisão do spec)

## Problema

Reanálise dos fluxos de orçamento, revenda, login e compra revelou quatro
incômodos, todos de **fluxo** (a infra — catraca de assinatura, webhook do
Mercado Pago, normalização de Gmail — está sólida):

1. **Revender custa dígito repetido.** Quando a mesma cliente quer outro igual,
   o caminho é Meus produtos → Fazer orçamento → escolher cor → digitar o nome
   dela de novo. A `/orcamento` até tem uma lógica de herdar cliente+cores de
   uma venda anterior (`?de=`), mas ela foi **desligada de propósito** numa
   decisão anterior ("vender de novo saiu daqui — vender é em Meus produtos",
   [ListaVendidos.tsx:209-211](../../../components/ListaVendidos.tsx#L209-L211)),
   e o código ficou órfão. Decisão desta rodada: **reviver** o atalho.
2. **Orçamento gasta uma tela só pra escolher cor.** O fluxo é card →
   [`/orcamento`](../../../app/orcamento/page.tsx) (só escolhe cor) →
   [`/resultado`](../../../app/resultado/page.tsx). A `/resultado` **já sabe**
   recalcular por cor via `?cores=` — tanto que criar peça nova já pula a
   `/orcamento` inteira. A tela do meio é um passo a mais sem ganho.
3. **O plano some na confirmação de email.** Quem cria conta e precisa
   confirmar o email escolheu um plano na vitrine, mas o
   [`emailRedirectTo`](../../../app/login/page.tsx#L231) não carrega esse plano.
   A pessoa confirma o email e cai em `/planos` do zero.
4. **Primeiro produto pode sair com preço errado.** Ao ligar a fábrica, o
   estado vazio ([fabrica](../../../app/fabrica/page.tsx#L386-L398)) manda criar
   o primeiro produto direto — mas ele usa impressora e cores **padrão**, então
   o preço pode não bater com a realidade dela até configurar.

## Modelo novo

### A `/orcamento` deixa de existir; a escolha de cor vira parte da nota

A `/resultado` já é a nota e já recalcula por cor. Ela absorve a escolha de cor
que hoje mora na `/orcamento`, e a `/orcamento` é **apagada**. O contrato de URL
que separa os dois modos da nota **não muda**: a presença do parâmetro `cores`
continua sendo o sinal de "modo orçamento" vs. "só ver a conta".

### Revender vira uma URL pré-preenchida, sem indireção

Como a `/orcamento` some, o atalho "Vender de novo" **não usa** o antigo `?de=`.
O card já tem a `Venda` e a lista de `clientes` em mãos, então ele monta direto:

```
/resultado?id=<produtoId>&cores=<coresIds>&cliente=<nome da cliente>
```

A `/resultado` já lê `cliente` de parâmetro
([resultado.tsx:57](../../../app/resultado/page.tsx#L57)) e já pré-preenche o
valor final pela última venda daquela peça
([precoBaseDaVenda](../../../lib/vendas.ts#L49-L62)). Ou seja: cliente, cores e
valor já chegam prontos, sem código novo de resolução. A lógica órfã do `?de=`
morre junto com a página.

## Fluxo

```
ANTES:
  Fábrica ──"Fazer orçamento"──▶ /orcamento (escolhe cor) ──▶ /resultado (a nota)

DEPOIS:
  Fábrica ──"Fazer orçamento"──▶ /resultado (a nota, com o seletor de cor dentro)
  Fábrica ──"ver quem comprou" ──▶ [Vender de novo] ──▶ /resultado (cliente+cores prontos)
```

## Mudanças por tela

### 1. Revender — [components/EspecificacoesProduto.tsx](../../../components/EspecificacoesProduto.tsx) + [app/fabrica/page.tsx](../../../app/fabrica/page.tsx)

- `EspecificacoesProduto` ganha uma prop `onVenderDeNovo: (venda: Venda) => void`
  e, em cada linha de unidade, um botão/atalho **"Vender de novo"** (alvo de
  toque ≥ 48px, no padrão dos outros botões).
- `fabrica` liga essa prop no `Dialogo` de "ver quem comprou"
  ([fabrica:562-576](../../../app/fabrica/page.tsx#L562-L576)):
  `onVenderDeNovo={(v) => router.push(...)}`, montando a URL com o `produtoId`,
  `coresIds` da venda e o nome resolvido em
  `clientes.find(c => c.id === v.clienteId)?.nome`.
- Venda sem cliente (ex.: migração do contador antigo, `clienteId === null`):
  o botão ainda aparece e leva pro orçamento com cores prontas e o campo de
  cliente vazio — nada quebra.
- Atualizar os comentários que diziam "vender de novo saiu daqui de propósito"
  ([ListaVendidos.tsx:209-211](../../../components/ListaVendidos.tsx#L209-L211),
  [EspecificacoesProduto.tsx:10-12](../../../components/EspecificacoesProduto.tsx#L10-L12))
  pra refletir a decisão nova.

### 2. Orçamento em uma tela só

**[app/fabrica/page.tsx](../../../app/fabrica/page.tsx):** o botão "Fazer
orçamento" do card ([fabrica:490-495](../../../app/fabrica/page.tsx#L490-L495))
passa a apontar pra `/resultado?id=<produto.id>&cores=<produto.coresIds>` em vez
de `/orcamento?produto=<id>`. (Com `coresIds` vazio, manda `cores=` mesmo assim,
pra sinalizar modo orçamento — o seletor deixa ela escolher lá dentro.)

**[app/resultado/page.tsx](../../../app/resultado/page.tsx):** a escolha de cor
passa a ser editável dentro da nota, no modo orçamento.

- Hoje `coresParam` é lido direto da URL e alimenta `alvo`
  ([resultado.tsx:59-126](../../../app/resultado/page.tsx#L59-L126)). Passa a
  existir um estado `coresIds` (string[]), **semeado** a partir de `coresParam`
  (ou `produto.coresIds` se o param vier vazio). `alvo` deriva desse estado.
- `ehOrcamento` continua vindo da **presença** do parâmetro `cores`
  ([resultado.tsx:63](../../../app/resultado/page.tsx#L63)) — inalterado. "A
  conta" (sem `cores`) segue só leitura.
- Adicionar o **seletor de cores** dentro do bloco de orçamento, logo antes de
  "Pra quem é?" ([resultado.tsx:255-301](../../../app/resultado/page.tsx#L255-L301)):
  a mesma grade de carretéis + o aviso "você misturou N cores" que hoje vivem na
  [/orcamento](../../../app/orcamento/page.tsx#L138-L171). Trocar a cor recalcula
  custo/lucro e as notinhas ao vivo (já reativo por `alvo`).
- O valor final (`valorFinal`) **não** re-semeia ao trocar cor — quem manda nele
  é ela (`baseDefinida` ref, [resultado.tsx:138-145](../../../app/resultado/page.tsx#L138-L145)).
  Trocar a cor muda o custo e, portanto, o ganha/perde exibido; o preço digitado
  permanece. Comportamento desejado.
- **Foco inicial:** hoje o campo de cliente tem `autoFocus={!clienteParam}`
  ([resultado.tsx:272](../../../app/resultado/page.tsx#L272)). Com o seletor de
  cor agora acima dele, esse autofoco rolaria a tela pra baixo, escondendo as
  cores. Tirar o `autoFocus` do campo de cliente no modo orçamento (a peça já
  chega com cor, então a ordem visual — escolher cor, depois quem é — deve
  guiar; nada de pular pro fim).

**Apagar** [app/orcamento/page.tsx](../../../app/orcamento/page.tsx) por
inteiro. Nada mais aponta pra `/orcamento` depois das mudanças acima. `lib/orcamento.ts`
(`montarOrcamento`) **permanece** — é usado pela `/resultado`. `lib/rotas.ts` não
muda (`/orcamento` nunca esteve na lista de rotas públicas).

### 3. Plano sobrevive à confirmação de email — [app/login/page.tsx](../../../app/login/page.tsx)

- Em `criar()`, quando há um `plano`, incluir o destino no redirect do email:
  `emailRedirectTo: ${origin}/auth/callback?next=${encodeURIComponent('/planos?plano=' + plano)}`
  ([login.tsx:226-233](../../../app/login/page.tsx#L226-L233)). **Sem `auto=1`** —
  a decisão foi 1 clique deliberado, não abrir o pagamento sozinho.
- Sem plano, mantém o `emailRedirectTo` atual (cai em `/fabrica`, que devolve
  pra `/planos`).
- O [`/auth/callback`](../../../app/auth/callback/route.ts#L36-L42) já segue um
  `next` interno com segurança (`startsWith('/')` e não `//`). Nenhuma mudança lá.

**[app/planos/page.tsx](../../../app/planos/page.tsx):** pra o "1 clique" ter
sentido, a página passa a **destacar** o plano escolhido quando `plano` vem no
param mesmo sem `auto=1`:

- Ler `plano` do param independente do `auto`.
- Se presente e a assinatura não está ativa, mostrar um aviso suave ("Você
  escolheu o plano X — é só confirmar") e realçar o card/botão desse plano.
- O disparo automático (`planoAuto`, exige `auto=1`) fica **inalterado**.

> **Nota de consistência:** o caminho de cadastro *sem* confirmação de email
> (`data.session` presente, [login.tsx:235-238](../../../app/login/page.tsx#L235-L238))
> continua com `auto=1` (abre o pagamento sozinho) — ali a pessoa acabou de
> clicar "Criar conta e assinar" e está no fluxo ativo, então o auto-open é
> esperado. Só o caminho que vem de um link de email usa o 1-clique. Se quiser
> alinhar os dois depois, é uma linha.

### 4. Empurrãozinho de configuração — [app/fabrica/page.tsx](../../../app/fabrica/page.tsx)

- No estado vazio do catálogo
  ([fabrica:386-398](../../../app/fabrica/page.tsx#L386-L398)), abaixo do "Aperte
  o botão verde", adicionar uma dica **não bloqueante** com dois atalhos:
  **⚙️ Ajustar a impressora** (`/config`) e **🧵 Minhas cores** (`/cores`).
- Aparece só quando `produtos.length === 0` (e sem `erro`). Some sozinha quando
  existe o primeiro produto — sem flag de "dispensado", sem persistência (YAGNI).
- Os padrões continuam válidos: a dica convida, não obriga.

## Casos de borda

- **"A conta" / peça recém-criada** (sem `cores`): só leitura, como hoje — o
  seletor de cor não aparece.
- **`cores=` vazio** (card com peça sem cor salva): modo orçamento liga, o
  seletor semeia vazio e ela escolhe; "Fazer a notinha" já não existe como tela
  separada, então o `podeSeguir` some — a validação de "escolha uma cor" passa a
  valer pro botão "Vendido" (que já exige custo/preço coerentes).
- **Vender de novo de uma venda sem cliente:** cores prontas, cliente vazio,
  funciona como orçamento normal.
- **Confirmar email sem ter escolhido plano:** cai em `/fabrica` → `/planos`
  (comportamento atual), sem destaque de plano.
- **Link de email antigo (sem `next`):** `/auth/callback` cai no default
  `/fabrica` — inalterado.

## Arquivos afetados

- [app/orcamento/page.tsx](../../../app/orcamento/page.tsx) — **apagado**.
- [app/resultado/page.tsx](../../../app/resultado/page.tsx) — cores viram estado
  editável + seletor no bloco de orçamento.
- [app/fabrica/page.tsx](../../../app/fabrica/page.tsx) — "Fazer orçamento" aponta
  pra `/resultado`; liga `onVenderDeNovo`; dica de configuração no estado vazio.
- [components/EspecificacoesProduto.tsx](../../../components/EspecificacoesProduto.tsx)
  — botão "Vender de novo" por unidade + prop nova.
- [components/ListaVendidos.tsx](../../../components/ListaVendidos.tsx) — só
  atualizar o comentário sobre "vender de novo".
- [app/login/page.tsx](../../../app/login/page.tsx) — plano no `emailRedirectTo`.
- [app/planos/page.tsx](../../../app/planos/page.tsx) — destacar o plano escolhido
  sem `auto=1`.
- Sem mudança em `lib/db`, tipos, `calcularProduto`, `montarOrcamento`, schema ou
  migrações.

## Testes

- **Sem lógica pura nova.** Revender é montagem de URL na `fabrica`; a fusão da
  `/orcamento` é reuso do que a `/resultado` já calcula; o plano é um parâmetro a
  mais no redirect. Nada disso adiciona uma função testável nova.
- `lib/orcamento.test.ts`, `lib/vendas.test.ts` e `lib/calc-produto.test.ts`
  continuam válidos e devem seguir verdes (nenhuma regra de preço muda).
- Se algum tester de página existir referenciando `/orcamento`, remover junto.
- **Verificação manual:**
  1. Card → "Fazer orçamento" → cai direto na nota, troca a cor, custo/lucro
     mudam ao vivo, marca "Vendido".
  2. "ver quem comprou" → "Vender de novo" → nota abre com a cliente e as cores
     daquela venda; valor já vem da última venda.
  3. Criar conta com plano anual + email de confirmação → clicar no link → cair
     em `/planos` com o anual em destaque, 1 clique pra assinar.
  4. Fábrica vazia mostra os atalhos de impressora e cores.
