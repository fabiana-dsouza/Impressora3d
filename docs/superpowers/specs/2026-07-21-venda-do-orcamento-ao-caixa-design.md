# Da notinha ao caixa: venda como entidade

Data: 2026-07-21

**Substitui dois specs**, ambos obsoletos porque o modelo mudou enquanto a
conversa avançava:

- [2026-07-20-nome-do-cliente-design.md](2026-07-20-nome-do-cliente-design.md) —
  tratava o cliente como texto solto na notinha.
- [2026-07-21-orcamento-como-entidade-design.md](2026-07-21-orcamento-como-entidade-design.md) —
  guardava o orçamento como entidade e adiava o dinheiro pra uma "fase 2".

Continua válido: [2026-07-19-notinha-do-cliente-design.md](2026-07-19-notinha-do-cliente-design.md),
que criou a notinha exportável.

## Problema

Duas coisas que o app não sabe hoje:

1. **Pra quem ela vendeu.** `produtos.vendidos` é um contador sem nome e sem
   data. A notinha do cliente também não diz pra quem é.
2. **Se o dinheiro entrou.** O cofrinho conta a venda no instante em que ela
   aperta "Vendi 1!", mas na vida real o pagamento às vezes vem depois. O
   cofrinho mostra dinheiro que ela ainda não tem.

Some a isso que ela vende a mesma peça pra várias pessoas, em cores diferentes e
por preços diferentes — o que não cabe num modelo de uma peça com um preço e um
contador.

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| O orçamento fica salvo? | **Não.** Ela decide na hora; orçamento é só o papel passando na tela |
| Por onde nasce? | **Pela peça**, em "Meus produtos". Um caminho só |
| O `/novo` pergunta o cliente? | **Não.** Continua só criando a peça |
| Cliente é obrigatório? | **Sim**, na tela de fazer orçamento |
| Preço e custo recalculam? | **Calcula na criação, depois congela** |
| Quando entra no cofrinho? | **Só quando ela marca que recebeu** — vender ≠ receber |
| E o "Vendi 1!" de hoje? | **Sai.** A aba "Já vendi" vira "Vendidos" |
| E o que já está registrado? | **Convertido em vendas pagas**, com o cofrinho valendo igual |

## O fluxo

```
Meus produtos → Dinossauro → [ Fazer orçamento ]
                                    │
                       cliente (obrigatório) + cor
                                    │
                            a notinha na tela
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                   [ Não vendi ]           [ Vendi! ]
                   nada é salvo          nasce a venda
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │  VENDIDOS             │
                                    │  Tio Fernando  R$ 5   │
                                    │  falta pagar [Recebi!]│
                                    └───────────────────────┘
                                                │
                                        marcou "recebi"
                                                ▼
                                       entra no cofrinho
```

### `/orcamento` — as duas perguntas

Aberta por "Fazer orçamento" em cada peça de "Meus produtos".

```
Pra quem é?
┌──────────────────────────────┐
│ Tio Fernando                 │
└──────────────────────────────┘
( Maria ) ( João ) ( Vovó )
      ↑ toca e preenche

Qual cor dessa vez?
[ grade de carretéis, a da peça já marcada ]

        [ Fazer a notinha ]
```

- Rótulo interrogativo, como o resto do app ("Qual é o nome do seu produto?").
- Placeholder `Ex: Maria`, `maxLength` 24. **Cliente é obrigatório**: sem nome, o
  botão não avança.
- Pastilhas: os **6 clientes mais recentes**, mínimo 48px de altura. Sem
  clientes, a fileira não é renderizada.
- Seletor de cor: **o mesmo do passo 2 do `/novo`**, reaproveitado sem
  redesenhar — grade de `Carretel` que alternam seleção, borda `neon` no
  escolhido, e o aviso de "misturou N cores, vou usar o preço médio".
- Aceita `?produto=<id>` e `?de=<vendaId>` (vender de novo, que pré-preenche
  cliente e cores).

### `/resultado` — a notinha e a decisão

Recebe `?id=<produto>&cliente=<nome>&cores=<id1,id2>` (ids de cor separados por
vírgula, na ordem escolhida). Mostra as duas notinhas
como hoje, com a do cliente agora endereçada, e embaixo:

```
[ Vendi! ]        [ Não vendi ]
```

- **Não vendi** volta pra fábrica. Nada é gravado — nem a venda, nem o cliente.
- **Vendi!** grava o cliente (se novo) e a venda, e leva pra aba Vendidos.

Sem o parâmetro `cliente`, a página se comporta **exatamente como hoje**: as
duas notinhas, sem os botões de decisão. É o caminho de quem só quer olhar a
notinha de uma peça.

O preço e o custo saem de `calcularProduto({ ...produto, coresIds: escolhidas },
config, cores)` — a função que já existe, alimentada com as cores desta venda.
**Não há regra de cálculo nova:** margem mínima, arredondamento e piso de custo
continuam sendo os de `lib/calc.ts`.

### Aba "Vendidos"

Substitui a aba "Já vendi". Mais novo primeiro.

```
VENDIDOS

  ** falta o nome **          ← toca e escreve
  Dinossauro Roxo    R$ 15,21  ✓ recebido

  Tio Fernando       [editar]
  Dinossauro Roxo    R$ 5,00   ⏳ falta pagar  [ Recebi! ]
```

- **`** falta o nome **` é o botão**, não enfeite. Toca e abre a mesma escolha de
  cliente (com as pastilhas de quem já existe).
- **`[editar]` em todas as vendas**, não só nas migradas: quem escreve "Marai"
  hoje precisa poder consertar amanhã.
- Renomear um cliente pela edição conserta **todas** as vendas dele de uma vez —
  é por isso que cliente é link e não cópia.
- **"Vender de novo"** abre `/orcamento?de=<id>` já preenchido. Sai uma venda
  nova; a antiga fica intacta.
- O cofrinho no topo soma **só as vendas com pagamento recebido**.

## Congelar vs. linkar

A venda congela **preço, custo, cores e nome da peça**. Linka **o cliente**.

- **Preço e custo são o que aconteceu naquele dia.** O cofrinho mostra lucro, não
  faturamento — então congelar só o preço não bastaria: o lucro daquela venda
  mudaria sozinho quando o preço do filamento mudasse. Congelando os dois,
  `lucro = preco - custo` fica escrito em pedra.
- **O nome da peça congela** pro registro sobreviver a apagar a peça.
- **O cliente é link** porque renomear precisa consertar tudo de uma vez.

```
Tio Fernando  ·  verde  ·  R$ 5,00     ← congelado
      │
      └── "vender de novo" → troca pra azul
                ▼
Vó            ·  azul   ·  R$ 6,50     ← calculado agora, congelado agora
```

## O banco

`supabase/schema.sql`, acrescentado **no fim do arquivo**, idempotente, no estilo
do resto: `primary key (user_id, id)`, RLS ligada, quatro políticas separadas,
INSERT travado em `assinatura_ativa()`.

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

-- ---------- Vendas ----------
create table if not exists public.vendas (
  id           text not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produto_id   text,                        -- link fraco: só pro "vender de novo"
  produto_nome text not null,               -- congelado
  cliente_id   text,                        -- NULO = "** falta o nome **"
  cores_ids    jsonb   not null default '[]',
  preco        numeric not null default 0,  -- congelado
  custo        numeric not null default 0,  -- congelado
  pago_em      timestamptz,                 -- NULO = falta pagar
  criado_em    timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists vendas_usuario_data
  on public.vendas (user_id, criado_em desc);

-- ---------- Migrações já feitas ----------
-- Tabela própria, e NÃO uma coluna em `perfis`: aquela tabela tem
-- `grant update (nome_empresa)` de propósito, como trava de segurança.
-- Alargar o grant pra caber um flag de conveniência enfraqueceria a trava.
create table if not exists public.migracoes (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome     text not null,
  feita_em timestamptz not null default now(),
  primary key (user_id, nome)
);

alter table public.clientes  enable row level security;
alter table public.vendas    enable row level security;
alter table public.migracoes enable row level security;

drop policy if exists "dono ve migracoes" on public.migracoes;
drop policy if exists "dono marca migracoes" on public.migracoes;

create policy "dono ve migracoes" on public.migracoes
  for select using (auth.uid() = user_id);
create policy "dono marca migracoes" on public.migracoes
  for insert with check (auth.uid() = user_id);

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

drop policy if exists "dono ve vendas" on public.vendas;
drop policy if exists "dono edita vendas" on public.vendas;
drop policy if exists "dono apaga vendas" on public.vendas;
drop policy if exists "cria venda com assinatura" on public.vendas;

create policy "dono ve vendas" on public.vendas
  for select using (auth.uid() = user_id);
create policy "dono edita vendas" on public.vendas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga vendas" on public.vendas
  for delete using (auth.uid() = user_id);
create policy "cria venda com assinatura" on public.vendas
  for insert with check (auth.uid() = user_id and public.assinatura_ativa());
```

### Por que nenhum dos dois links tem FK no banco

`produto_id` e `cliente_id` são referências gerenciadas pela aplicação, não
`foreign key`. Duas razões, e a segunda é a que manda:

1. Um FK composto com `on delete set null` zeraria `user_id` junto, que é
   `not null`. Contornar exigiria `set null (coluna)`, sintaxe de Postgres 15+.
2. **Nada fora da tabela `vendas` pode destruir histórico de dinheiro.** Um FK
   com cascata faria apagar uma peça — ou um cliente — apagar vendas junto. O
   nome da peça já está congelado; sem cliente, a linha aparece como
   `** falta o nome **`, que é justamente o estado editável.

## A migração

Cada `vendidos = 3` vira **3 linhas de venda marcadas como pagas**, com
`cliente_id` nulo (aparecem como `** falta o nome **`, prontas pra ela nomear).

**A migração roda na aplicação, não em SQL.** O preço de um produto sem
`preco_venda` explícito depende de margem mínima, arredondamento em múltiplos de
R$ 0,50 e piso de custo — regras que vivem em `lib/calc.ts` e são testadas lá.
Reescrevê-las em SQL criaria uma segunda fonte da verdade sobre preço, que é
exatamente o tipo de duplicação que faz dois números divergirem em silêncio.

Roda uma vez por conta, guardada por uma linha em `migracoes`
(`nome = 'vendas-do-contador'`), no primeiro carregamento de `/fabrica` e
**antes** de a aba Vendidos ler as vendas — senão a primeira renderização
mostraria a lista vazia e o cofrinho zerado antes de encher.

Usa `calcularProduto` — a mesma função da tela — pra obter `preco` e `custo` de
cada linha.

O flag mora em tabela própria porque `perfis` tem `grant update (nome_empresa)`
como trava de segurança deliberada; acrescentar coluna lá exigiria alargar esse
grant.

### O critério de aceite

**O cofrinho tem que mostrar o mesmo valor antes e depois da migração.**

Não é uma meta aproximada, é uma identidade que se prova:

- Antes: `Σ (resultado.lucro × produto.vendidos)`
- Depois: `Σ (preco − custo)` sobre as vendas pagas
- E `resultado.lucro = precoVenda − custoTotal`, com `preco`/`custo` de cada
  linha vindos do mesmo `calcularProduto`

Logo os dois somatórios são o mesmo número. Se na tela não baterem, a migração
está errada — e é um número só, conferível a olho.

**O contador `vendidos` não é apagado.** Fica parado, sem ninguém ler. Se a
migração sair errada, dá pra refazer a partir dele; apagar seria queimar a
ponte. Some da tela, não do banco.

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

### `lib/vendas.ts` (criar) — o dinheiro, puro

```ts
export function lucroDaVenda(v: Venda): number;          // preco - custo
export function recebido(v: Venda): boolean;             // pago_em != null
export function totalNoCaixa(vendas: Venda[]): number;   // só as recebidas
export function totalAReceber(vendas: Venda[]): number;  // só as pendentes
```

Sem DOM e sem Supabase, testável no Vitest. **É aqui que o cofrinho vira uma
função pura** — hoje ele é uma expressão solta dentro do JSX de `/fabrica`, e
por isso nunca teve teste.

### `lib/types.ts` (modificar)

```ts
export interface Cliente { id: string; nome: string; criadoEm: number; }

export interface Venda {
  id: string;
  produtoId: string | null;
  produtoNome: string;
  clienteId: string | null;   // null = falta o nome
  coresIds: string[];
  preco: number;
  custo: number;
  pagoEm: number | null;      // null = falta pagar
  criadoEm: number;
}
```

### `lib/db.ts` (modificar) — funções novas

```ts
export async function lerClientes(): Promise<Cliente[]>;
export async function acharOuCriarCliente(nome: string): Promise<string>;
export async function renomearCliente(id: string, nome: string): Promise<void>;
export async function lerVendas(): Promise<Venda[]>;
export async function criarVenda(v: Omit<Venda, "id" | "criadoEm">): Promise<string>;
export async function marcarPago(id: string): Promise<void>;
export async function definirClienteDaVenda(vendaId: string, clienteId: string): Promise<void>;
export async function migrarVendasAntigas(): Promise<void>;  // no-op se já migrou
```

Ids via `crypto.randomUUID()`, como o resto do app.

### `app/orcamento/page.tsx` (criar)

As duas perguntas. Aceita `?produto=<id>` e `?de=<vendaId>`.

### `app/resultado/page.tsx` (modificar)

Aceita `?cliente=<nome>&cores=<ids>` além do `?id=` de hoje. Com `cliente`,
mostra os botões de decisão; sem ele, é a tela de hoje.

### `app/fabrica/page.tsx` (modificar)

- "Fazer orçamento" em cada peça.
- Aba "Já vendi" → "Vendidos", lendo `vendas` em vez do contador.
- Sai o botão "Vendi 1!" e o de desfazer venda.
- Cofrinho passa a usar `totalNoCaixa`, e ganha o "a receber" ao lado.
- Dispara `migrarVendasAntigas()` no primeiro carregamento.

### `lib/orcamento.ts` e `lib/notinha-desenho.ts` (modificar)

`DadosOrcamento` ganha `cliente: string` (`""` = sem linha). Um bloco condicional
a mais em `percorrer()`, no formato do bloco de `cores` que já existe: desenha só
se houver nome, com o `y` avançando **fora** do `if (pintar)` pras duas passadas
seguirem em sincronia.

Na notinha: `PARA MARIA` em caixa alta, na tinta escura (`--papel-tinta`), abaixo
de "orçamento" e antes do tracejado. Nome que não couber é cortado com
reticências por `quebrarEmLinhas` com `maxLinhas: 1`.

**O teste que trava `DadosOrcamento` numa lista fechada de campos passa de 5 pra
6 chaves, continuando fechado** (`toEqual`, não "contém"). É essa rigidez que faz
um campo de custo quebrar o teste no dia que alguém acrescentar.

## Verificação

- Vitest em `lib/clientes.test.ts`: normalização (maiúscula, pontas, espaço
  interno duplicado, vazio, só espaços) e que nomes exibidos iguais colapsam pra
  mesma chave.
- Vitest em `lib/vendas.test.ts`: lucro por venda, caixa só com as recebidas,
  a receber só com as pendentes, lista vazia, e venda com prejuízo.
- Vitest em `lib/orcamento.test.ts`: a lista fechada de campos, agora com 6.
- Print com Playwright em 1440/820/390 via rota `/preview` temporária: notinha
  com nome, sem nome, e com nome de 24 caracteres. **Desfazer a rota depois.**
- À mão, e é o mais importante: **anotar o valor do cofrinho antes de migrar e
  conferir que é idêntico depois.**
- À mão: duas vendas da mesma peça em cores diferentes; conferir que a primeira
  não mudou de preço nem de cor.
- À mão: renomear um cliente e ver todas as vendas dele acompanharem.
- À mão: marcar "recebi" e ver o valor sair de "a receber" e entrar no cofrinho.

## Limitações aceitas

- **`cliente` e `cores` viajam na URL** de `/resultado`, então aparecem no
  histórico do navegador. São nome próprio e ids de cor, num app de uso pessoal;
  aceito em troca de reusar a tela de resultado em vez de duplicá-la.
- **Venda não tem como ser apagada.** Uma criada por engano fica na lista. Pode
  ser corrigida no nome e no pagamento, mas não removida.
- **Orçamento recusado não deixa rastro.** Ela não tem como saber depois pra quem
  ofereceu e não vendeu — foi a escolha de "decide na hora", que evita uma lista
  de pendências que ninguém limpa.
- **A migração inventa a data**: as vendas convertidas ficam com a data da peça,
  não a da venda real, que nunca foi registrada.
