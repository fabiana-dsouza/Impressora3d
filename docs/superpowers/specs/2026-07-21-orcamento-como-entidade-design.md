# Orçamento como entidade — Fase 1

Data: 2026-07-21

**Substitui** [2026-07-20-nome-do-cliente-design.md](2026-07-20-nome-do-cliente-design.md),
que ficou obsoleto: aquele spec tratava o nome do cliente como texto solto na
notinha, com um histórico só pra não redigitar. O modelo mudou — o orçamento
virou uma entidade própria, com dono, cor e preço.

Continua [2026-07-19-notinha-do-cliente-design.md](2026-07-19-notinha-do-cliente-design.md),
que criou a notinha exportável. Aquele spec continua válido.

## Problema

A notinha do cliente diz o que é a peça e quanto custa, mas não pra quem é. E
o app não guarda pra quem ela vendeu o quê: `produtos.vendidos` é um contador
sem nome e sem data.

Na prática ela vende a mesma peça pra várias pessoas, em cores diferentes e às
vezes por preços diferentes. Hoje isso não cabe no modelo: existe UMA peça com
UM preço e um contador.

## Escopo: por que duas fases

O pedido completo era: orçamento com cliente, lista, vender de novo, renomear
cliente, marcar VENDI/NÃO VENDI, e o cofrinho somando preço real em vez de
`lucro × quantidade`.

Isso colide com o que já existe. `produtos.vendidos` e a aba "Já vendi" são um
modelo de venda que funciona e tem dado real gravado (a família usa o app). O
item que os unifica exige **migrar contadores existentes** — transformar
"3 vendidos" em três linhas exigiria inventar cliente e data que ninguém
registrou.

Então:

- **Fase 1 (este spec):** orçamento vira entidade, com cliente, cor e preço.
  Lista, vender de novo, renomear cliente. **Não encosta** em
  `produtos.vendidos`, no "Vendi 1!" nem no cofrinho — seguem funcionando em
  paralelo.
- **Fase 2 (spec futuro):** marcar VENDI / NÃO VENDI, cofrinho por preço real,
  migração dos contadores, aposentadoria do "Vendi 1!".

Separadas porque a fase 2 mexe em feature existente com dado real. Juntas, um
bug na lista nova e um bug na migração chegariam no mesmo dia.

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| O que fica guardado quando ela orça? | **Cada venda é um item.** A peça é a receita; cada orçamento é uma linha com seu cliente |
| Por onde nasce um orçamento? | **Pela peça**, em "Meus produtos". Um caminho só |
| O `/novo` pergunta o cliente? | **Não.** Continua só criando a peça, exatamente como hoje |
| Preço e cor recalculam ou congelam? | **Calcula na criação, depois congela** |
| Dá pra renomear cliente? | **Sim**, e conserta todos os orçamentos dele de uma vez |

## O fluxo

Em **"Meus produtos"**, cada peça ganha **"Fazer orçamento"** ao lado do
"Vendi 1!" existente. Abre `/orcamento`:

```
Pra quem é?
┌──────────────────────────────┐
│ Tio Fernando                 │
└──────────────────────────────┘
( Maria ) ( João ) ( Vovó )
      ↑ toca e preenche

Qual cor dessa vez?
( Roxo + Verde )  ← já vem a da peça
( trocar as cores )

        [ Fazer a notinha ]
```

- Rótulo interrogativo, como o resto do app ("Qual é o nome do seu produto?").
- Placeholder `Ex: Maria`, `maxLength` 24.
- Pastilhas: os **6 clientes mais recentes**, mais novo primeiro, mínimo 48px de
  altura. Sem clientes, a fileira não é renderizada.
- A cor vem preenchida com a da peça; mexer é opcional. O seletor é **o mesmo
  do passo 2 do `/novo`**, reaproveitado sem redesenhar: grade de `Carretel`
  clicáveis que alternam seleção, borda `neon` no escolhido, e o aviso de "você
  misturou N cores, vou usar o preço médio" quando houver duas ou mais.
- Cliente é **obrigatório** aqui: um orçamento sem dono não tem por que existir
  nesta tela (a notinha sem nome continua possível pelo caminho antigo,
  `/resultado?id=<produto>`).

Confirmar cria o orçamento e leva pra `/resultado?orcamento=<id>`, que mostra as
duas notinhas — a do cliente agora endereçada.

O preço gravado sai de `calcularProduto({ ...produto, coresIds: escolhidas },
config, cores)` — a função que já existe, alimentada com as cores desta venda em
vez das cores da peça. Não há regra de cálculo nova: as travas de margem mínima,
arredondamento e preço nunca abaixo do custo continuam sendo as de `lib/calc.ts`.

**Aba nova em `/fabrica`: "Meus orçamentos"**, mais novo primeiro:

```
  Tio Fernando
  Dinossauro Roxo · Verde            R$ 5,00
  [ ver a notinha ]  [ vender de novo ]

  Vó
  Dinossauro Roxo · Azul             R$ 6,50
  [ ver a notinha ]  [ vender de novo ]
```

**"Vender de novo"** abre `/orcamento` já preenchido com aquele cliente e aquela
cor. Ela troca o que quiser; sai um orçamento **novo**. O antigo fica intacto.

**Renomear cliente:** tocar no nome dele na lista abre `Dialogo` com um campo.
Salvar atualiza a linha do cliente, e todos os orçamentos dele acompanham.

## Congelar vs. linkar

O orçamento congela **preço, cores e nome da peça**. Linka **o cliente**.

A assimetria é deliberada:

- **Preço, cor e nome da peça são o que ela prometeu naquele dia.** Se ela orça
  o dinossauro verde pro Tio por R$ 5 e depois sobe o preço do filamento, o
  orçamento do Tio continua dizendo R$ 5. Sem congelar, o histórico se reescreve
  sozinho a cada mexida na configuração e ela nunca sabe por quanto vendeu.
- **O nome da peça congela junto** pro registro sobreviver a apagar a peça.
  Importa mais na fase 2, quando o cofrinho passar a contar dinheiro a partir
  dessas linhas.
- **O cliente é link** porque renomear "Marai" pra "Maria" precisa consertar
  todos os orçamentos dele de uma vez.

O preço de cada orçamento é **calculado na hora de criar**, com a cor escolhida
e a configuração vigente — não copiado do orçamento anterior. Depois disso, não
muda mais.

```
Tio Fernando  ·  verde  ·  R$ 5,00     ← congelado
      │
      └── "vender de novo" → troca pra azul
                ▼
Vó            ·  azul   ·  R$ 6,50     ← calculado agora, congelado agora
```

## O banco

`supabase/schema.sql`, acrescentado **no fim do arquivo**, idempotente, no estilo
do resto. Padrão de `produtos`: `primary key (user_id, id)`, RLS ligada, quatro
políticas separadas, INSERT travado em `assinatura_ativa()`.

```sql
-- ---------- Clientes ----------
-- O nome é editável, então a chave é um id de verdade, não o nome.
create table if not exists public.clientes (
  id        text not null,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, id)
);

-- Dois "Maria" seriam duas pastilhas idênticas na tela.
create unique index if not exists clientes_nome_unico
  on public.clientes (user_id, lower(nome));

-- ---------- Orçamentos ----------
create table if not exists public.orcamentos (
  id           text not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Link fraco: serve pro "vender de novo". Se a peça sumir, o orçamento
  -- sobrevive porque o nome dela está congelado logo abaixo.
  produto_id   text,
  produto_nome text not null,
  cliente_id   text not null,
  cores_ids    jsonb   not null default '[]',
  preco        numeric not null default 0,
  criado_em    timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, cliente_id)
    references public.clientes (user_id, id) on delete cascade
);

create index if not exists orcamentos_usuario_data
  on public.orcamentos (user_id, criado_em desc);

alter table public.clientes   enable row level security;
alter table public.orcamentos enable row level security;

drop policy if exists "dono ve clientes" on public.clientes;
drop policy if exists "dono edita clientes" on public.clientes;
drop policy if exists "dono apaga clientes" on public.clientes;
drop policy if exists "cria cliente com assinatura" on public.clientes;

create policy "dono ve clientes" on public.clientes
  for select using (auth.uid() = user_id);
create policy "dono edita clientes" on public.clientes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga clientes" on public.clientes
  for delete using (auth.uid() = user_id);
create policy "cria cliente com assinatura" on public.clientes
  for insert with check (auth.uid() = user_id and public.assinatura_ativa());

drop policy if exists "dono ve orcamentos" on public.orcamentos;
drop policy if exists "dono edita orcamentos" on public.orcamentos;
drop policy if exists "dono apaga orcamentos" on public.orcamentos;
drop policy if exists "cria orcamento com assinatura" on public.orcamentos;

create policy "dono ve orcamentos" on public.orcamentos
  for select using (auth.uid() = user_id);
create policy "dono edita orcamentos" on public.orcamentos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga orcamentos" on public.orcamentos
  for delete using (auth.uid() = user_id);
create policy "cria orcamento com assinatura" on public.orcamentos
  for insert with check (auth.uid() = user_id and public.assinatura_ativa());
```

**Por que `produto_id` não tem FK:** um FK composto com `on delete set null`
zeraria `user_id` junto, que é `not null`. Resolver exigiria a sintaxe
`set null (produto_id)`, de Postgres 15+. Como o nome da peça já está congelado,
um id solto que aponta pra nada é tratado na aplicação: sem peça, o botão
"vender de novo" não aparece. Mais simples e sem depender de versão.

**O FK do cliente tem `on delete cascade`, e a fase 1 não tem como apagar
cliente** — então ele nunca dispara. Se a fase 2 acrescentar apagar cliente,
**revisitar**: cascatear ali destruiria histórico de venda.

**Aviso:** `supabase/schema.sql` tem alterações não commitadas. A migração entra
no fim do arquivo sem tocar no trecho pendente, mas confira antes de rodar.

## Arquitetura

### `lib/clientes.ts` (criar) — normalização, pura

```ts
/** "  MARIA   SILVA " → "maria silva". Só pra comparar/deduplicar. */
export function chaveDoCliente(nome: string): string;

/** "  Maria   Silva " → "Maria Silva". O que aparece na tela. */
export function nomeLimpo(nome: string): string;
```

As duas colapsam espaço interno, não só as pontas. Nome que normaliza pra vazio
não é cliente — quem chama recusa antes de gravar.

### `lib/types.ts` (modificar)

```ts
export interface Cliente { id: string; nome: string; criadoEm: number; }

export interface Orcamento {
  id: string;
  produtoId: string | null;
  produtoNome: string;
  clienteId: string;
  coresIds: string[];
  preco: number;
  criadoEm: number;
}
```

### `lib/db.ts` (modificar) — funções novas

```ts
export async function lerClientes(): Promise<Cliente[]>;
/** Acha pelo nome normalizado ou cria. Devolve o id. */
export async function acharOuCriarCliente(nome: string): Promise<string>;
export async function renomearCliente(id: string, nome: string): Promise<void>;
export async function lerOrcamentos(): Promise<Orcamento[]>;
export async function criarOrcamento(o: Omit<Orcamento, "id" | "criadoEm">): Promise<string>;
```

Ids via `crypto.randomUUID()`, como o resto do app.

### `app/orcamento/page.tsx` (criar)

As duas perguntas. Aceita `?produto=<id>` (fazer orçamento) e
`?de=<orcamentoId>` (vender de novo, que pré-preenche cliente e cores).

### `app/fabrica/page.tsx` (modificar)

Terceira aba "Meus orçamentos", botão "Fazer orçamento" em cada peça, e o
renomear cliente via `Dialogo`.

### `app/resultado/page.tsx` (modificar)

Passa a aceitar `?orcamento=<id>` além do `?id=<produto>` de hoje. Com
`orcamento`, usa o preço e as cores congelados e o nome do cliente; sem ele,
comporta-se exatamente como hoje.

### `lib/orcamento.ts` e `lib/notinha-desenho.ts` (modificar)

`DadosOrcamento` ganha `cliente: string` (`""` = sem linha). Um bloco condicional
a mais em `percorrer()`, no formato do bloco de `cores` que já existe: desenha só
se houver nome, e o `y` avança **fora** do `if (pintar)` pras duas passadas
seguirem em sincronia.

Na notinha: `PARA MARIA` em caixa alta, na tinta escura (`--papel-tinta`), abaixo
de "orçamento" e antes do tracejado. Nome que não couber é cortado com
reticências pela `quebrarEmLinhas` com `maxLinhas: 1`.

**O teste que trava `DadosOrcamento` numa lista fechada de campos passa de 5 pra
6 chaves, continuando fechado** (`toEqual`, não "contém"). É essa rigidez que faz
um campo de custo quebrar o teste no dia que alguém acrescentar.

## O que a fase 1 não faz

- Não altera `produtos.vendidos`, o "Vendi 1!" nem o cofrinho.
- Não marca orçamento como vendido — isso é fase 2.
- Não apaga cliente nem orçamento.
- Não mexe no `/novo`.

## Verificação

- Vitest em `lib/clientes.test.ts`: normalização (maiúscula, pontas, espaço
  interno duplicado, vazio, só espaços) e que nomes que exibem igual colapsam
  pra mesma chave.
- Vitest em `lib/orcamento.test.ts`: a lista fechada de campos, agora com 6.
- Print com Playwright em 1440/820/390 via rota `/preview` temporária: notinha
  com nome, sem nome, e com nome de 24 caracteres. **Desfazer a rota depois.**
- Conferir à mão: criar dois orçamentos da mesma peça em cores diferentes e
  confirmar que o primeiro **não** mudou de preço nem de cor.
- Conferir à mão: renomear um cliente e ver os orçamentos dele acompanharem.

## Limitações aceitas

- Orçamento não tem como ser apagado na fase 1. Um feito por engano fica na
  lista até a fase 2 dar conta disso.
- Apagar uma peça deixa o `produto_id` do orçamento apontando pra nada. O
  registro sobrevive pelo nome congelado, mas o "vender de novo" some daquele
  orçamento.
- A tela `/orcamento` exige cliente. Quem quiser a notinha sem nome usa o
  caminho antigo (`/resultado?id=<produto>`), que continua existindo.
