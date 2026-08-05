# Orçamento embutido na /novo + componente Nota

**Data:** 2026-08-05
**Status:** Aprovado em conversa (aguardando implementação)

## Objetivo

Criar um produto do zero passa a **fechar a venda na própria tela** (camada 4/4
da `/novo`), sem pular pra `/resultado`. O bloco de venda (por quanto vai vender
+ notinhas + Vendido/Só orçamento + cliente) vira um **componente compartilhado**
`Nota`, usado pela `/novo` (criar-do-zero) e pela `/resultado` (ver a conta,
fazer orçamento, vender de novo). Sem dois códigos de venda pra manter.

## Passo 1 — extrair `components/Nota.tsx` (refactor, sem mudar comportamento)

Move da `/resultado` pra dentro de `Nota` todo o bloco de orçamento e as
notinhas. A `/resultado` passa a só carregar dados e renderizar `<Nota>`.

**Props:**
- `produto`, `config`, `cores`, `empresa` — dados da peça e da conta.
- `vendas`, `clientes` — pra base de preço e pastilhas de recentes.
- `coresIniciais: string[]`, `clienteInicial: string` — sementes (URL/venda).
- `ehNovo`, `ehRepete` — banner de criação / modo repete.
- `somenteLeitura: boolean` — "A conta": mostra só as notinhas, sem editar nem
  vender.
- `salvando: boolean` — desabilita os botões enquanto o pai grava.
- `onVender(dados)` — `dados = { coresIds, produtoNome, preco, custo, cliente,
  jaPagou }`. O pai persiste e navega.
- `onSoOrcamento()` — o pai persiste (se preciso) e navega.

**O que o `Nota` mantém dentro:** estados `coresIds`, `valorFinal`, `cliente`,
`vendendo`, `mudouAlgo`, `nomeVenda`, `perguntandoPagou`; os derivados (`alvo`,
`resultado`, `resultadoNota`, `dadosOrcamento`, base, `podeIniciar`, `editando`);
o seletor de cor / resumo repete / campo de nome; `<PrecoVendido>`; as duas
notinhas; os botões e o passo revelado do cliente; o diálogo "Já te pagou?".

**O que fica no pai:** carregar dados, estados de erro/trava, e — em `onVender`
/ `onSoOrcamento` — a gravação no banco e a navegação.

**`/resultado` depois do passo 1:**
- Carrega produto/config/cores/vendas/clientes/empresa (como hoje).
- Renderiza `<Nota somenteLeitura={!ehOrcamento} ehNovo={ehNovo}
  ehRepete={ehRepete} coresIniciais={...} clienteInicial={clienteParam} .../>`.
- `onVender`: `acharOuCriarCliente` + `criarVenda` + `router.push` pra
  Vendidos/Falta (o que a `registrarVenda` faz hoje).
- `onSoOrcamento`: `router.push("/fabrica")`.

Comportamento idêntico ao de hoje — é refactor. Verificar com typecheck +
testes + build antes de seguir.

## Passo 2 — usar `Nota` na camada 4/4 da `/novo`

A `/novo` continua com os passos 1–3 (nome, cores+peso, tempo). O passo 4
("Quanto ficou?") passa a mostrar:

- O resumo que já existe: **custo pra fabricar** + **preço indicado**.
- Logo abaixo, `<Nota>` com a peça **em rascunho** (ainda não salva):
  `produto = { ...rascunho, precoVenda: 0 }`, `ehNovo`, `vendas=[]`,
  `coresIniciais = coresIds do rascunho`, `somenteLeitura=false`,
  `ehRepete=false`.
- **Some o botão "Salvar produto".** Quem fecha é o `Nota` (Vendido / Só
  orçamento).

**Persistência (salvar-ao-decidir):**
- `onSoOrcamento`: `criarProduto(rascunho)` → `router.push("/fabrica")`.
- `onVender(dados)`: `criarProduto(rascunho)` → `acharOuCriarCliente(cliente)` →
  `criarVenda({ produtoId, produtoNome: dados.produtoNome, preco, custo,
  coresIds, clienteId, pagoEm })` → `router.push` pra Vendidos/Falta.
- Erros: manter o tratamento atual do `salvar()` — `SemAssinaturaError` abre o
  diálogo "A fábrica ainda está trancada"; outros erros mostram aviso. O `Nota`
  só reflete `salvando` e não navega sozinho.
- Abandonar no meio (voltar/sair) **não grava nada** — `criarProduto` só corre
  dentro de `onVender`/`onSoOrcamento`.

O produto nasce com `precoVenda: 0` (como hoje); a venda carrega o valor final.

## Casos de borda

- **Sem cor / sem valor no passo 4:** o `Nota` bloqueia "Vendido" e explica
  (mesma regra `podeIniciar`).
- **Voltar do passo 4:** volta pro passo 3; nada foi salvo.
- **Assinatura vencida:** ao decidir, `criarProduto` lança `SemAssinaturaError`
  → diálogo de trava; nada é gravado (nem produto, nem venda).
- **`/resultado` "A conta"** (sem `cores`): `somenteLeitura` mostra só as
  notinhas — igual a hoje.
- **`/resultado` "Vender de novo"** (`repete=1`): `ehRepete` no `Nota` — igual à
  Fase 2.

## Testes

- Extração é refactor: `lib/*.test.ts` seguem verdes; typecheck + build validam a
  fiação.
- Sem lógica pura nova (a base de preço e o cálculo já são testados nos libs).
- Manual: criar peça → no passo 4 aparecem custo, preço, "por quanto vai vender",
  notinhas e os botões; "Vendido" salva peça + venda e cai em Vendidos; "Só
  orçamento" salva a peça e volta; "voltar" não salva nada. E a `/resultado`
  (A conta, Fazer orçamento, Vender de novo) continua igual.
