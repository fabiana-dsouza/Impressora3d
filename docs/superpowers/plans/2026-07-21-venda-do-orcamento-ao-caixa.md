# Da notinha ao caixa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o orçamento numa esteira que vai da peça até o caixa: escolher cliente e cor, mandar a notinha endereçada, marcar se vendeu, e só contar o dinheiro no cofrinho quando ela marcar que recebeu.

**Architecture:** Duas tabelas novas (`clientes`, `vendas`) mais uma de controle (`migracoes`). O orçamento **não** é persistido — passa pela URL até a decisão. Ao marcar "Vendi!", nasce uma linha de venda com preço e custo **congelados**, para o lucro daquela venda nunca mudar quando o preço do filamento mudar. O dinheiro só entra no cofrinho quando `pago_em` deixa de ser nulo. Os contadores `produtos.vendidos` existentes são convertidos em vendas pagas por uma migração que roda uma vez por conta.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Supabase (Postgres + RLS), Vitest. **Nenhuma dependência nova.**

Spec: [`docs/superpowers/specs/2026-07-21-venda-do-orcamento-ao-caixa-design.md`](../specs/2026-07-21-venda-do-orcamento-ao-caixa-design.md)

## Global Constraints

- **Nenhuma dependência nova.**
- **A notinha do cliente nunca mostra** custo, energia, desgaste, embalagem, reserva, custo total, margem ou lucro.
- **Público-alvo é uma criança de 10 anos:** botões com no mínimo 48px de altura, zero jargão, pt-BR com vírgula no decimal.
- **Nada de emoji** em botão, rótulo, erro ou título de bloco. Emoji só em ponto de festa (hoje são 4 no app inteiro; o 🎉 do cofrinho é um deles e permanece).
- **Nada de `alert()`/`confirm()`** — avisos usam `components/Dialogo.tsx`.
- **Dinheiro** sempre via `brl()` de `lib/format.ts`.
- **Ids** sempre via `novoId()` de `lib/format.ts` (usa `crypto.randomUUID()`).
- **Nenhuma regra de preço nova.** Margem mínima, arredondamento em múltiplos de R$ 0,50 e piso de custo continuam só em `lib/calc.ts`.
- **Migração roda uma vez por conta**, guardada por `migracoes`, e **não apaga `produtos.vendidos`**.
- **Não alargar `grant update (nome_empresa) on public.perfis`** — é trava de segurança deliberada.
- **SQL idempotente**, acrescentado no fim de `supabase/schema.sql`, sem tocar no trecho já pendente ali.
- Comentários e identificadores em pt-BR, seguindo o código existente.
- Testes: `npm test` (Vitest). **Nunca rodar `npm run build` com o dev server ligado** — compartilham `.next/` e corrompem.

## Correções ao spec

Duas coisas que o spec não previu e este plano resolve:

1. **`clientes` precisa de `usado_em`.** O spec pede "6 clientes mais recentes", mas quando o modelo passou de `orcamentos` para `vendas` a coluna de uso se perdeu. Sem ela, "recente" viraria "criado recentemente", e uma cliente antiga que compra toda semana nunca apareceria. A coluna volta, atualizada a cada venda criada.
2. **`chaveDoCliente` normaliza igual ao índice SQL: só minúscula, sem tirar acento.** O índice é `lower(nome)`. Se o TypeScript tirasse acento e o índice não, "José" não seria encontrado na busca e estouraria violação de unicidade no insert logo depois — erro raro e confuso.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/types.ts` (modificar) | Tipos `Cliente` e `Venda`. |
| `lib/clientes.ts` (criar) | Normalização de nome. Puro, sem DOM. |
| `lib/clientes.test.ts` (criar) | Testa a normalização e o alinhamento com o índice SQL. |
| `lib/vendas.ts` (criar) | O **dinheiro**, puro: lucro por venda, caixa, a receber, e as linhas da migração. |
| `lib/vendas.test.ts` (criar) | Testa o dinheiro — inclusive a identidade do cofrinho na migração. |
| `supabase/schema.sql` (modificar) | Tabelas `clientes`, `vendas`, `migracoes` + RLS. |
| `lib/db.ts` (modificar) | Ida e volta ao Supabase para clientes, vendas e a migração. |
| `lib/orcamento.ts` (modificar) | `DadosOrcamento` ganha `cliente`. |
| `lib/notinha-desenho.ts` (modificar) | A linha `PARA MARIA` no desenho. |
| `components/NotinhaCliente.tsx` (modificar) | Repassa o cliente ao desenho. |
| `app/orcamento/page.tsx` (criar) | As duas perguntas: pra quem e qual cor. |
| `app/resultado/page.tsx` (modificar) | Aceita `cliente`/`cores` e mostra a decisão. |
| `components/ListaVendidos.tsx` (criar) | A aba Vendidos inteira — tirada de `/fabrica`, que já tem 458 linhas. |
| `app/fabrica/page.tsx` (modificar) | "Fazer orçamento", troca a aba, tira o "Vendi 1!", dispara a migração. |

---

### Task 1: Tipos e normalização de nome (`lib/clientes.ts`)

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/clientes.ts`
- Test: `lib/clientes.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface Cliente { id: string; nome: string; criadoEm: number; usadoEm: number }`
  - `interface Venda { id: string; produtoId: string | null; produtoNome: string; clienteId: string | null; coresIds: string[]; preco: number; custo: number; pagoEm: number | null; criadoEm: number }`
  - `nomeLimpo(nome: string): string`
  - `chaveDoCliente(nome: string): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/clientes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nomeLimpo, chaveDoCliente } from "./clientes";

describe("limpar o nome do cliente", () => {
  it("tira espaço das pontas", () => {
    expect(nomeLimpo("  Maria  ")).toBe("Maria");
  });

  it("colapsa espaço no meio", () => {
    expect(nomeLimpo("Maria   Silva")).toBe("Maria Silva");
  });

  it("mantém a grafia que ela escolheu", () => {
    expect(nomeLimpo("tio FERNANDO")).toBe("tio FERNANDO");
  });

  it("nome só de espaço vira vazio", () => {
    expect(nomeLimpo("   ")).toBe("");
    expect(nomeLimpo("")).toBe("");
  });
});

describe("chave de comparação do cliente", () => {
  it("é minúscula", () => {
    expect(chaveDoCliente("Tio Fernando")).toBe("tio fernando");
  });

  it("as três formas de escrever Maria caem na mesma chave", () => {
    const chaves = ["maria", "Maria", "  MARIA  "].map(chaveDoCliente);
    expect(new Set(chaves).size).toBe(1);
    expect(chaves[0]).toBe("maria");
  });

  // O índice do banco é `lower(nome)` e NÃO tira acento. Se a chave daqui
  // tirasse, a busca não acharia "José" e o insert seguinte estouraria
  // violação de unicidade — erro raro e difícil de entender.
  it("NÃO tira acento, pra bater com o lower(nome) do índice", () => {
    expect(chaveDoCliente("José")).toBe("josé");
    expect(chaveDoCliente("José")).not.toBe("jose");
  });

  it("nome que vira vazio devolve vazio (quem chama recusa)", () => {
    expect(chaveDoCliente("   ")).toBe("");
  });

  it("o que exibe igual compara igual", () => {
    expect(chaveDoCliente("Maria  Silva")).toBe(chaveDoCliente("maria silva"));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/clientes.test.ts`
Expected: FAIL — `Failed to resolve import "./clientes"`.

- [ ] **Step 3: Escrever `lib/clientes.ts`**

```ts
/**
 * O nome do cliente tem duas formas: a que aparece na tela (do jeito que ela
 * escreveu) e a que serve pra comparar (pra "Maria" e "maria" não virarem
 * dois clientes).
 */

/** Tira espaço das pontas e colapsa o do meio. */
function semEspacoSobrando(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

/** "  Maria   Silva " → "Maria Silva". É o que vai pra tela e pra notinha. */
export function nomeLimpo(nome: string): string {
  return semEspacoSobrando(nome);
}

/**
 * "  MARIA   SILVA " → "maria silva". Só pra comparar e deduplicar.
 *
 * Minúscula e nada além disso, DE PROPÓSITO: o índice único do banco é
 * `lower(nome)`. Se aqui tirasse acento e lá não, procurar "José" não
 * acharia a linha existente e o insert seguinte quebraria na unicidade.
 */
export function chaveDoCliente(nome: string): string {
  return semEspacoSobrando(nome).toLowerCase();
}
```

- [ ] **Step 4: Acrescentar os tipos em `lib/types.ts`**

No fim do arquivo:

```ts
/** Alguém pra quem ela vende. O nome é editável, por isso o id é separado. */
export interface Cliente {
  id: string;
  nome: string;
  criadoEm: number;
  /** Última vez que ela vendeu pra essa pessoa — ordena as pastilhas. */
  usadoEm: number;
}

/**
 * Uma venda que aconteceu.
 *
 * `preco` e `custo` são CONGELADOS na hora da venda: o cofrinho mostra lucro,
 * e sem congelar os dois o lucro de uma venda antiga mudaria sozinho quando o
 * preço do filamento mudasse.
 */
export interface Venda {
  id: string;
  /** Link fraco: só serve pro "vender de novo". Nulo se a peça foi apagada. */
  produtoId: string | null;
  /** Congelado, pro registro sobreviver a apagar a peça. */
  produtoNome: string;
  /** Nulo = "** falta o nome **", que é o estado editável. */
  clienteId: string | null;
  coresIds: string[];
  preco: number;
  custo: number;
  /** Nulo = falta pagar. Só conta no cofrinho depois de preenchido. */
  pagoEm: number | null;
  criadoEm: number;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- lib/clientes.test.ts && npx tsc --noEmit`
Expected: 11 testes passando, sem erro de tipo.

- [ ] **Step 6: Commitar**

```bash
git add lib/clientes.ts lib/clientes.test.ts lib/types.ts
git commit -m "Tipos de cliente e venda, e a normalização do nome"
```

---

### Task 2: O dinheiro, puro (`lib/vendas.ts`)

**Files:**
- Create: `lib/vendas.ts`
- Test: `lib/vendas.test.ts`

**Interfaces:**
- Consumes: `Venda`, `Produto`, `Config`, `Cor` de `lib/types.ts`; `calcularProduto` de `lib/calc-produto.ts`.
- Produces:
  - `lucroDaVenda(v: Venda): number`
  - `recebido(v: Venda): boolean`
  - `totalNoCaixa(vendas: Venda[]): number`
  - `totalQueTeDevem(vendas: Venda[]): number`
  - `linhasDaMigracao(produtos: Produto[], config: Config, cores: Cor[]): NovaVenda[]`
  - `type NovaVenda = Omit<Venda, "id" | "criadoEm">`

**Por que este arquivo existe:** hoje o cofrinho é uma expressão solta dentro do JSX de `app/fabrica/page.tsx` (`calculos.reduce((s, c) => s + c.resultado.lucro * (c.produto.vendidos || 0), 0)`), e por isso nunca teve teste. Tirando o dinheiro pra uma função pura, ele passa a ser testável — e é aqui que a identidade do cofrinho na migração vira um teste automático em vez de uma conferência a olho.

**Atenção à assimetria proposital:** `totalNoCaixa` soma **lucro** (é o "ganho de verdade" que o cofrinho sempre mostrou), enquanto `totalQueTeDevem` soma **preço** (é quanto de dinheiro as pessoas ainda vão entregar na mão dela). São grandezas diferentes de propósito, e a tela rotula cada uma.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/vendas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  lucroDaVenda,
  recebido,
  totalNoCaixa,
  totalQueTeDevem,
  linhasDaMigracao,
} from "./vendas";
import { calcularProduto } from "./calc-produto";
import { CONFIG_PADRAO } from "./defaults";
import type { Cor, Produto, Venda } from "./types";

function venda(over: Partial<Venda> = {}): Venda {
  return {
    id: "v1",
    produtoId: "p1",
    produtoNome: "Dinossauro",
    clienteId: "c1",
    coresIds: ["roxo"],
    preco: 25,
    custo: 10,
    pagoEm: null,
    criadoEm: 0,
    ...over,
  };
}

describe("lucro de uma venda", () => {
  it("é o preço menos o custo, os dois congelados", () => {
    expect(lucroDaVenda(venda({ preco: 25, custo: 10 }))).toBe(15);
  });

  it("venda no prejuízo dá lucro negativo", () => {
    expect(lucroDaVenda(venda({ preco: 8, custo: 10 }))).toBe(-2);
  });
});

describe("recebido", () => {
  it("sem pagoEm, ainda não recebeu", () => {
    expect(recebido(venda({ pagoEm: null }))).toBe(false);
  });

  it("com pagoEm, recebeu", () => {
    expect(recebido(venda({ pagoEm: 1700000000000 }))).toBe(true);
  });
});

describe("o cofrinho", () => {
  it("lista vazia é zero", () => {
    expect(totalNoCaixa([])).toBe(0);
  });

  // A regra que a usuária pediu: vender não é receber.
  it("NÃO conta venda que ainda não foi paga", () => {
    expect(totalNoCaixa([venda({ pagoEm: null })])).toBe(0);
  });

  it("conta só as pagas", () => {
    const vs = [
      venda({ id: "a", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "b", preco: 30, custo: 12, pagoEm: null }),
      venda({ id: "c", preco: 20, custo: 5, pagoEm: 2 }),
    ];
    expect(totalNoCaixa(vs)).toBe(15 + 15);
  });

  it("prejuízo pago diminui o cofrinho", () => {
    const vs = [
      venda({ id: "a", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "b", preco: 5, custo: 10, pagoEm: 1 }),
    ];
    expect(totalNoCaixa(vs)).toBe(10);
  });
});

describe("o que ainda te devem", () => {
  // De propósito soma PREÇO e não lucro: é o dinheiro que a pessoa vai
  // colocar na mão dela, não o ganho.
  it("soma o preço das que não foram pagas", () => {
    const vs = [
      venda({ id: "a", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "b", preco: 30, custo: 12, pagoEm: null }),
    ];
    expect(totalQueTeDevem(vs)).toBe(30);
  });

  it("tudo pago, ninguém te deve nada", () => {
    expect(totalQueTeDevem([venda({ pagoEm: 1 })])).toBe(0);
  });
});

describe("linhas da migração do contador antigo", () => {
  const CORES: Cor[] = [
    { id: "roxo", nome: "Roxo", hex: "#70f", tipo: "basica", precoRoloKg: 105 },
  ];

  function produto(over: Partial<Produto> = {}): Produto {
    return {
      id: "p1",
      nome: "Dinossauro",
      coresIds: ["roxo"],
      gramas: 40,
      unidade: "g",
      horas: 2,
      minutos: 30,
      margem: 1,
      precoVenda: 25,
      criadoEm: 1700000000000,
      vendidos: 3,
      ...over,
    };
  }

  it("gera uma linha por unidade vendida", () => {
    const linhas = linhasDaMigracao([produto({ vendidos: 3 })], CONFIG_PADRAO, CORES);
    expect(linhas).toHaveLength(3);
  });

  it("ignora produto que nunca foi vendido", () => {
    const linhas = linhasDaMigracao([produto({ vendidos: 0 })], CONFIG_PADRAO, CORES);
    expect(linhas).toHaveLength(0);
  });

  it("marca como paga e sem cliente, pronta pra ela nomear", () => {
    const [l] = linhasDaMigracao([produto({ vendidos: 1 })], CONFIG_PADRAO, CORES);
    expect(l.pagoEm).not.toBeNull();
    expect(l.clienteId).toBeNull();
    expect(l.produtoNome).toBe("Dinossauro");
    expect(l.coresIds).toEqual(["roxo"]);
  });

  // ESTE É O CRITÉRIO DE ACEITE DA MIGRAÇÃO, como teste em vez de conferência
  // a olho: o cofrinho tem que valer exatamente o mesmo antes e depois.
  it("o cofrinho vale o mesmo antes e depois", () => {
    const produtos = [
      produto({ id: "p1", vendidos: 3, precoVenda: 25 }),
      produto({ id: "p2", vendidos: 2, precoVenda: 40, nome: "Vaso" }),
      produto({ id: "p3", vendidos: 0 }),
    ];

    // Como o cofrinho é calculado HOJE, em app/fabrica/page.tsx.
    const antes = produtos.reduce(
      (s, p) => s + calcularProduto(p, CONFIG_PADRAO, CORES).lucro * p.vendidos,
      0
    );

    const depois = totalNoCaixa(
      linhasDaMigracao(produtos, CONFIG_PADRAO, CORES).map((l, i) => ({
        ...l,
        id: `v${i}`,
        criadoEm: 0,
      }))
    );

    expect(depois).toBeCloseTo(antes, 10);
    expect(antes).toBeGreaterThan(0); // não passar por acidente com dois zeros
  });

  it("produto sem preço anotado usa o preço sugerido, não zero", () => {
    const [l] = linhasDaMigracao(
      [produto({ vendidos: 1, precoVenda: 0 })],
      CONFIG_PADRAO,
      CORES
    );
    expect(l.preco).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/vendas.test.ts`
Expected: FAIL — `Failed to resolve import "./vendas"`.

- [ ] **Step 3: Escrever `lib/vendas.ts`**

```ts
import type { Config, Cor, Produto, Venda } from "./types";
import { calcularProduto } from "./calc-produto";

/** Uma venda antes de existir no banco (sem id nem data ainda). */
export type NovaVenda = Omit<Venda, "id" | "criadoEm">;

/**
 * O que sobrou dessa venda. Usa o preço e o custo CONGELADOS na linha, nunca
 * recalcula — foi isso que aconteceu naquele dia.
 */
export function lucroDaVenda(v: Venda): number {
  return v.preco - v.custo;
}

/** Vender não é receber: o dinheiro às vezes chega depois. */
export function recebido(v: Venda): boolean {
  return v.pagoEm !== null;
}

/** O cofrinho: só o que já entrou de verdade. Soma LUCRO. */
export function totalNoCaixa(vendas: Venda[]): number {
  return vendas.filter(recebido).reduce((s, v) => s + lucroDaVenda(v), 0);
}

/**
 * Quanto ainda vão colocar na mão dela. Soma PREÇO, não lucro — e a diferença
 * é proposital: o cofrinho mede ganho, isto aqui mede dinheiro a chegar.
 */
export function totalQueTeDevem(vendas: Venda[]): number {
  return vendas.filter((v) => !recebido(v)).reduce((s, v) => s + v.preco, 0);
}

/**
 * Converte o contador antigo (`produtos.vendidos`) em linhas de venda.
 *
 * Cada unidade vendida vira uma linha marcada como PAGA e SEM CLIENTE — quem
 * comprou nunca foi registrado, e o "** falta o nome **" na tela é justamente
 * o convite pra ela preencher.
 *
 * O preço e o custo saem de `calcularProduto`, a mesma função da tela. É isso
 * que garante que o cofrinho vale o mesmo antes e depois: o cofrinho antigo é
 * `lucro × vendidos`, e `lucro` é `precoVenda - custoTotal`.
 */
export function linhasDaMigracao(
  produtos: Produto[],
  config: Config,
  cores: Cor[]
): NovaVenda[] {
  const linhas: NovaVenda[] = [];

  for (const p of produtos) {
    const quantas = Math.max(0, Math.round(p.vendidos || 0));
    if (quantas === 0) continue;

    const r = calcularProduto(p, config, cores);

    for (let i = 0; i < quantas; i++) {
      linhas.push({
        produtoId: p.id,
        produtoNome: p.nome,
        clienteId: null,
        coresIds: [...p.coresIds],
        preco: r.precoVenda,
        custo: r.custoTotal,
        // A data da venda real nunca foi registrada; a da peça é o mais
        // perto da verdade que dá pra chegar.
        pagoEm: p.criadoEm || Date.now(),
      });
    }
  }

  return linhas;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- lib/vendas.test.ts && npx tsc --noEmit`
Expected: 14 testes passando, sem erro de tipo.

- [ ] **Step 5: Commitar**

```bash
git add lib/vendas.ts lib/vendas.test.ts
git commit -m "O dinheiro das vendas como funções puras e testadas"
```

---

### Task 3: As tabelas no Supabase

**Files:**
- Modify: `supabase/schema.sql` (acrescentar **no fim**)

**Interfaces:**
- Consumes: `public.assinatura_ativa()`, já definida no arquivo.
- Produces: tabelas `public.clientes`, `public.vendas`, `public.migracoes`.

**Este arquivo tem alterações não commitadas da usuária.** Acrescente apenas no fim; não reformate, não reordene, não toque em nada acima.

- [ ] **Step 1: Acrescentar o SQL no fim de `supabase/schema.sql`**

```sql

-- =====================================================================
-- CLIENTES E VENDAS
-- Uma venda é uma linha com dono, cor, preço e custo CONGELADOS. O
-- orçamento não é guardado: ela decide na hora e só o "vendi" grava.
-- =====================================================================

-- ---------- Clientes ----------
-- O nome é editável, então a chave é um id de verdade e não o nome.
create table if not exists public.clientes (
  id        text not null,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now(),
  -- Última venda pra essa pessoa: é o que ordena as pastilhas de atalho.
  usado_em  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Dois "Maria" seriam duas pastilhas idênticas na tela.
-- ATENÇÃO: é lower() e nada além disso. `chaveDoCliente` no TypeScript
-- normaliza igualzinho; se um tirasse acento e o outro não, a busca não
-- acharia a linha e o insert seguinte quebraria aqui.
create unique index if not exists clientes_nome_unico
  on public.clientes (user_id, lower(nome));

create index if not exists clientes_usuario_uso
  on public.clientes (user_id, usado_em desc);

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

-- Nem produto_id nem cliente_id têm foreign key, de propósito:
-- NADA fora desta tabela pode destruir histórico de dinheiro. Um FK com
-- cascata faria apagar uma peça (ou um cliente) apagar vendas junto. O nome
-- da peça já está congelado; sem cliente, a linha vira "** falta o nome **",
-- que é exatamente o estado editável.

-- ---------- Migrações já feitas ----------
-- Tabela própria, e NÃO uma coluna em `perfis`: aquela tabela tem
-- `grant update (nome_empresa)` como trava de segurança deliberada, e
-- alargar o grant pra caber um flag de conveniência enfraqueceria a trava.
create table if not exists public.migracoes (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome     text not null,
  feita_em timestamptz not null default now(),
  primary key (user_id, nome)
);

alter table public.clientes  enable row level security;
alter table public.vendas    enable row level security;
alter table public.migracoes enable row level security;

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

drop policy if exists "dono ve migracoes" on public.migracoes;
drop policy if exists "dono marca migracoes" on public.migracoes;

create policy "dono ve migracoes" on public.migracoes
  for select using (auth.uid() = user_id);
create policy "dono marca migracoes" on public.migracoes
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 2: Conferir que é idempotente**

Não há como rodar o Postgres aqui. Confira lendo, e marque cada item:

1. Todo `create table` tem `if not exists`.
2. Todo `create index` tem `if not exists`.
3. Toda `create policy` é precedida do `drop policy if exists` correspondente.
4. Nenhum `drop table`, `truncate` ou `alter column`.
5. Nada acima da sua adição foi alterado: `git diff supabase/schema.sql` mostra **só** linhas acrescentadas no fim (`+`), nenhuma removida (`-`).

Run: `git diff --stat supabase/schema.sql`
Expected: só inserções.

- [ ] **Step 3: Commitar**

```bash
git add supabase/schema.sql
git commit -m "Tabelas de clientes, vendas e migrações com RLS"
```

---

### Task 4: Clientes no banco (`lib/db.ts`)

**Files:**
- Modify: `lib/db.ts`

**Interfaces:**
- Consumes: `nomeLimpo`, `chaveDoCliente` de `lib/clientes.ts`; `Cliente` de `lib/types.ts`; `novoId` de `lib/format.ts`; `idUsuario()` e `supabase()` já existentes no arquivo.
- Produces:
  - `lerClientes(): Promise<Cliente[]>` — ordenado por `usado_em` desc
  - `acharOuCriarCliente(nome: string): Promise<string>` — devolve o id
  - `renomearCliente(id: string, nome: string): Promise<void>`
  - `marcarClienteUsado(id: string): Promise<void>`

- [ ] **Step 1: Acrescentar os imports no topo de `lib/db.ts`**

Alterar a linha de import de tipos e acrescentar duas linhas:

```ts
import type { Cliente, Config, Cor, Produto, Venda } from "./types";
import { nomeLimpo, chaveDoCliente } from "./clientes";
import { novoId } from "./format";
```

- [ ] **Step 2: Acrescentar as funções no fim de `lib/db.ts`**

```ts
// =====================================================================
// CLIENTES
// =====================================================================

function paraCliente(r: Linha): Cliente {
  return {
    id: String(r.id),
    nome: String(r.nome),
    criadoEm: r.criado_em ? Date.parse(r.criado_em) : 0,
    usadoEm: r.usado_em ? Date.parse(r.usado_em) : 0,
  };
}

/** Mais recentemente usados primeiro — é a ordem das pastilhas de atalho. */
export async function lerClientes(): Promise<Cliente[]> {
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("clientes")
    .select("*")
    .eq("user_id", uid)
    .order("usado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paraCliente);
}

/**
 * Acha o cliente pelo nome (ignorando maiúscula e espaço sobrando) ou cria.
 * Devolve o id.
 */
export async function acharOuCriarCliente(nome: string): Promise<string> {
  const limpo = nomeLimpo(nome);
  if (!chaveDoCliente(nome)) {
    throw new Error("Escreve o nome de quem vai comprar!");
  }

  const uid = await idUsuario();
  const sb = supabase();

  const achado = await sb
    .from("clientes")
    .select("id")
    .eq("user_id", uid)
    // Sem curinga, `ilike` é igualdade sem ligar pra maiúscula — o mesmo
    // critério do índice único `lower(nome)`.
    .ilike("nome", limpo)
    .maybeSingle();
  if (achado.error) throw achado.error;
  if (achado.data?.id) return String(achado.data.id);

  const id = novoId();
  const { error } = await sb
    .from("clientes")
    .insert({ id, user_id: uid, nome: limpo });

  if (error) {
    // 23505 = violação de unicidade. Duas telas gravando o mesmo nome ao
    // mesmo tempo: quem perdeu a corrida busca de novo em vez de estourar.
    if ((error as { code?: string }).code === "23505") {
      const denovo = await sb
        .from("clientes")
        .select("id")
        .eq("user_id", uid)
        .ilike("nome", limpo)
        .maybeSingle();
      if (denovo.data?.id) return String(denovo.data.id);
    }
    throw error;
  }

  return id;
}

export async function renomearCliente(id: string, nome: string): Promise<void> {
  const limpo = nomeLimpo(nome);
  if (!chaveDoCliente(nome)) {
    throw new Error("Escreve o nome de quem vai comprar!");
  }
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("clientes")
    .update({ nome: limpo })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/** Sobe o cliente pro topo das pastilhas. Chamado ao criar uma venda. */
export async function marcarClienteUsado(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("clientes")
    .update({ usado_em: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Conferir os tipos**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro; os testes seguem passando (nada aqui é coberto por teste — é ida e volta ao Supabase, conferido à mão na Task 12).

- [ ] **Step 4: Commitar**

```bash
git add lib/db.ts
git commit -m "Ler, criar e renomear cliente no Supabase"
```

---

### Task 5: Vendas no banco (`lib/db.ts`)

**Files:**
- Modify: `lib/db.ts`

**Interfaces:**
- Consumes: `Venda` de `lib/types.ts`; `NovaVenda` de `lib/vendas.ts`; `marcarClienteUsado` da Task 4; `novoId`, `idUsuario()`, `supabase()`.
- Produces:
  - `lerVendas(): Promise<Venda[]>` — mais nova primeiro
  - `criarVenda(v: NovaVenda): Promise<string>`
  - `marcarPago(id: string): Promise<void>`
  - `definirClienteDaVenda(vendaId: string, clienteId: string): Promise<void>`

- [ ] **Step 1: Acrescentar o import de `NovaVenda` no topo**

```ts
import type { NovaVenda } from "./vendas";
```

- [ ] **Step 2: Acrescentar as funções no fim de `lib/db.ts`**

```ts
// =====================================================================
// VENDAS
// =====================================================================

function paraVenda(r: Linha): Venda {
  return {
    id: String(r.id),
    produtoId: r.produto_id ? String(r.produto_id) : null,
    produtoNome: String(r.produto_nome),
    clienteId: r.cliente_id ? String(r.cliente_id) : null,
    coresIds: Array.isArray(r.cores_ids) ? r.cores_ids.map(String) : [],
    preco: Number(r.preco) || 0,
    custo: Number(r.custo) || 0,
    pagoEm: r.pago_em ? Date.parse(r.pago_em) : null,
    criadoEm: r.criado_em ? Date.parse(r.criado_em) : 0,
  };
}

export async function lerVendas(): Promise<Venda[]> {
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("vendas")
    .select("*")
    .eq("user_id", uid)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paraVenda);
}

export async function criarVenda(v: NovaVenda): Promise<string> {
  const uid = await idUsuario();
  const id = novoId();
  const { error } = await supabase().from("vendas").insert({
    id,
    user_id: uid,
    produto_id: v.produtoId,
    produto_nome: v.produtoNome,
    cliente_id: v.clienteId,
    cores_ids: v.coresIds,
    preco: v.preco,
    custo: v.custo,
    pago_em: v.pagoEm === null ? null : new Date(v.pagoEm).toISOString(),
  });
  if (error) throw error;

  // Sobe o cliente pro topo das pastilhas. Não trava a venda se falhar:
  // a ordem dos atalhos é comodidade, a venda é o que importa.
  if (v.clienteId) {
    marcarClienteUsado(v.clienteId).catch((e) => console.error(e));
  }

  return id;
}

export async function marcarPago(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("vendas")
    .update({ pago_em: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

export async function definirClienteDaVenda(
  vendaId: string,
  clienteId: string
): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("vendas")
    .update({ cliente_id: clienteId })
    .eq("user_id", uid)
    .eq("id", vendaId);
  if (error) throw error;
}
```

- [ ] **Step 3: Conferir os tipos**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro, testes passando.

- [ ] **Step 4: Commitar**

```bash
git add lib/db.ts
git commit -m "Ler, criar, pagar e nomear venda no Supabase"
```

---

### Task 6: A linha "PARA MARIA" na notinha

**Files:**
- Modify: `lib/orcamento.ts`
- Modify: `lib/orcamento.test.ts`
- Modify: `lib/notinha-desenho.ts`

(`components/NotinhaCliente.tsx` **não** muda: ele já repassa `dados` inteiro
pro desenho e já tira o `aria-label` de `textoDaNotinha`.)

**Interfaces:**
- Consumes: `DadosOrcamento`, `montarOrcamento`, `textoDaNotinha` de `lib/orcamento.ts`; `desenharOrcamento` de `lib/notinha-desenho.ts`.
- Produces: `DadosOrcamento` com o campo `cliente: string` (`""` = sem linha).

- [ ] **Step 1: Atualizar os testes de `lib/orcamento.test.ts`**

Duas mudanças no arquivo existente. Primeiro, a lista fechada de campos passa de 5 pra 6 — **continua fechada** (`toEqual`, não "contém"), porque é essa rigidez que faz um campo de custo quebrar o teste:

```ts
    expect(Object.keys(d).sort()).toEqual([
      "cliente",
      "cores",
      "data",
      "empresa",
      "preco",
      "produto",
    ]);
```

Segundo, acrescentar um `describe` novo no fim do arquivo:

```ts
describe("o cliente na notinha", () => {
  it("montarOrcamento não inventa cliente — quem digita é a tela", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE);
    expect(d.cliente).toBe("");
  });

  it("com cliente, o leitor de tela anuncia pra quem é", () => {
    const d = {
      ...montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE),
      cliente: "Tio Fernando",
    };
    expect(textoDaNotinha(d)).toContain("para Tio Fernando");
  });

  it("sem cliente, não sobra 'para' solto na frase", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE);
    expect(textoDaNotinha(d)).not.toContain("para ");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/orcamento.test.ts`
Expected: FAIL — a lista de chaves não bate (`cliente` não existe ainda).

- [ ] **Step 3: Acrescentar o campo em `lib/orcamento.ts`**

Na interface, depois de `empresa`:

```ts
  /** Pra quem é o orçamento. "" = a notinha não mostra linha nenhuma. */
  cliente: string;
```

Em `montarOrcamento`, no objeto devolvido:

```ts
    // Vazio de propósito: o nome não vem do produto, vem do que ela digita
    // na tela de fazer orçamento.
    cliente: "",
```

Em `textoDaNotinha`, antes do `return`:

```ts
  const para = d.cliente ? `, para ${d.cliente}` : "";
```

e no template, logo depois de `${d.produto}`:

```ts
  return `Orçamento da ${d.empresa}: ${d.produto}${para}${cores}, preço ${brl(
    d.preco
  )}, em ${dataBR(d.data)}.`;
```

- [ ] **Step 4: Desenhar a linha em `lib/notinha-desenho.ts`**

Dentro de `percorrer()`, **entre** o bloco de "ORÇAMENTO" e o do tracejado, acrescentar:

```ts
  // Só existe se ela digitou um nome. O `y` avança FORA do if (pintar),
  // igual aos outros blocos, senão a passada de medir e a de pintar
  // discordariam da altura do papel.
  if (dados.cliente) {
    if (pintar) {
      ctx.fillStyle = TINTA;
      ctx.font = `800 12px ${F_CORPO}`;
      ctx.letterSpacing = "2px";
      ctx.fillText(
        `PARA ${dados.cliente.toUpperCase()}`,
        meio,
        y + 12
      );
      ctx.letterSpacing = "0px";
    }
    y += 20;
  }
```

Atenção: `TINTA` e não `SUAVE` — o nome é conteúdo, tem que pesar mais que o rótulo "orçamento" acinzentado logo acima.

Nome comprido: em `desenharOrcamento`, antes de medir o nome da peça, cortar o do cliente numa linha só:

```ts
  // Duas barreiras contra nome comprido: o maxLength do campo na tela, e
  // este corte aqui, que é o que impede o texto de furar o papel.
  ctx.font = `800 12px ${F_CORPO}`;
  const [clienteCabendo] = quebrarEmLinhas(
    dados.cliente,
    LARGURA - MARGEM * 2,
    (t) => ctx.measureText(t).width,
    1
  );
  const paraDesenhar = { ...dados, cliente: dados.cliente ? clienteCabendo : "" };
```

e passar `paraDesenhar` (em vez de `dados`) para as duas chamadas de `percorrer`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test && npx tsc --noEmit`
Expected: todos passando, sem erro de tipo.

- [ ] **Step 6: Commitar**

```bash
git add lib/orcamento.ts lib/orcamento.test.ts lib/notinha-desenho.ts
git commit -m "A linha PARA na notinha do cliente"
```

---

### Task 7: A tela de fazer orçamento (`/orcamento`)

**Files:**
- Create: `app/orcamento/page.tsx`

**Interfaces:**
- Consumes: `lerProduto`, `lerConfig`, `lerCores`, `lerClientes`, `lerVendas` de `lib/db.ts`; `Cliente`, `Cor`, `Produto` de `lib/types.ts`; `nomeLimpo` de `lib/clientes.ts`; `Carretel`, `Logo`, `Dialogo`, ícones.
- Produces: navega pra `/resultado?id=<produtoId>&cliente=<nome>&cores=<id1,id2>`.

- [ ] **Step 1: Criar `app/orcamento/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as db from "@/lib/db";
import { nomeLimpo } from "@/lib/clientes";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Cliente, Cor, Produto } from "@/lib/types";
import Carretel from "@/components/Carretel";
import Dialogo from "@/components/Dialogo";
import { Logo } from "@/components/Marca";
import { IconeCasa } from "@/components/Icones";

/** Quantas pastilhas de atalho cabem sem virar parede de botão. */
const QUANTAS_PASTILHAS = 6;

export default function OrcamentoPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Orcamento />
    </Suspense>
  );
}

function Carregando() {
  return (
    <main className="flex flex-col items-center pt-20 text-center">
      <Logo size={60} className="animate-wiggle" />
      <p className="mt-4 text-xl font-extrabold text-mute">Só um segundinho...</p>
    </main>
  );
}

function Orcamento() {
  const router = useRouter();
  const params = useSearchParams();
  const produtoId = params.get("produto");
  const deVenda = params.get("de");

  const [produto, setProduto] = useState<Produto | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("");
  const [coresIds, setCoresIds] = useState<string[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cs, vendas] = await Promise.all([db.lerCores(), db.lerVendas()]);
        if (!vivo) return;
        setCores(cs);

        // "Vender de novo": herda a peça, o cliente e as cores daquela venda.
        const anterior = deVenda ? vendas.find((v) => v.id === deVenda) : null;
        const idDaPeca = anterior?.produtoId ?? produtoId;

        const p = idDaPeca ? await db.lerProduto(idDaPeca) : null;
        if (!vivo) return;
        setProduto(p);
        setCoresIds(anterior ? anterior.coresIds : p?.coresIds ?? []);

        if (anterior?.clienteId) {
          const lista = await db.lerClientes();
          if (!vivo) return;
          setClientes(lista);
          setNome(lista.find((c) => c.id === anterior.clienteId)?.nome ?? "");
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (vivo) setCarregou(true);
      }
    })();

    // A lista de atalhos não trava a tela: sem ela dá pra digitar do mesmo jeito.
    db.lerClientes()
      .then((l) => vivo && setClientes((atual) => (atual.length ? atual : l)))
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [produtoId, deVenda]);

  const recentes = useMemo(
    () => clientes.slice(0, QUANTAS_PASTILHAS),
    [clientes]
  );

  const podeSeguir = nomeLimpo(nome).length > 0 && coresIds.length > 0;

  function alternarCor(id: string) {
    setCoresIds((atual) =>
      atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]
    );
  }

  function seguir() {
    if (!produto || !podeSeguir) return;
    const busca = new URLSearchParams({
      id: produto.id,
      cliente: nomeLimpo(nome),
      cores: coresIds.join(","),
    });
    router.push(`/resultado?${busca.toString()}`);
  }

  if (!carregou) return <Carregando />;

  if (!produto) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center pt-20 text-center">
        <p className="text-xl font-extrabold text-tinta">
          Não achei essa peça...
        </p>
        <Link
          href="/fabrica"
          className="btn-grande btn-neon mt-6 inline-flex items-center gap-2"
        >
          <IconeCasa size={20} /> Voltar pra fábrica
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md">
      <div className="mb-4">
        <Link
          href="/fabrica"
          aria-label="Voltar pra fábrica"
          className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <IconeCasa size={22} />
        </Link>
      </div>

      <h1 className="display mb-1 text-2xl font-bold text-tinta">
        {produto.nome}
      </h1>
      <p className="mb-6 font-bold text-mute">Vamos fazer a notinha!</p>

      {/* ---------- Pra quem ---------- */}
      <h2 className="display mb-3 text-xl font-bold text-tinta">Pra quem é?</h2>
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={24}
        placeholder="Ex: Maria"
        className="w-full rounded-2xl border-2 border-borda bg-painel2 p-4 text-xl font-bold text-tinta outline-none focus:border-neon"
      />

      {recentes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {recentes.map((c) => (
            <button
              key={c.id}
              onClick={() => setNome(c.nome)}
              className="btn-escuro min-h-[48px] rounded-full px-4 text-base font-bold"
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      {/* ---------- Qual cor ---------- */}
      <h2 className="display mb-3 mt-8 text-xl font-bold text-tinta">
        Qual cor dessa vez?
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {cores.map((c) => {
          const ativo = coresIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => alternarCor(c.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-painel2 p-2.5 transition-all active:translate-y-0.5 ${
                ativo ? "scale-105 border-neon" : "border-borda"
              }`}
            >
              <Carretel cor={c.hex} size={52} />
              <span
                className={`text-xs font-extrabold leading-tight ${
                  ativo ? "text-neon" : "text-tinta"
                }`}
              >
                {ativo ? "✓ " : ""}
                {c.nome}
              </span>
            </button>
          );
        })}
      </div>

      {coresIds.length >= 2 && (
        <p className="mt-4 animate-pop rounded-2xl border border-ciano/30 bg-ciano/10 p-3 text-center font-bold text-ciano">
          Você misturou {coresIds.length} cores! Vou usar o preço médio delas.
        </p>
      )}

      <button
        onClick={seguir}
        disabled={!podeSeguir}
        className="btn-grande btn-neon mt-8 w-full disabled:opacity-50"
      >
        Fazer a notinha
      </button>

      {!podeSeguir && (
        <p className="mt-3 text-center font-bold text-mute">
          {nomeLimpo(nome).length === 0
            ? "Escreve pra quem é essa peça."
            : "Escolhe pelo menos uma cor."}
        </p>
      )}

      {aviso && (
        <Dialogo titulo="Não deu certo" texto={aviso} onFechar={() => setAviso("")} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Conferir os tipos**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro, 100% dos testes passando.

- [ ] **Step 3: Commitar**

```bash
git add app/orcamento/page.tsx
git commit -m "Tela de fazer orçamento: pra quem e qual cor"
```

---

### Task 8: A decisão na tela de resultado

**Files:**
- Modify: `app/resultado/page.tsx`

**Interfaces:**
- Consumes: `acharOuCriarCliente`, `criarVenda` de `lib/db.ts`; `montarOrcamento` de `lib/orcamento.ts`; `calcularProduto` de `lib/calc-produto.ts`.
- Produces: nenhuma interface nova; é a ponta do fluxo.

**Regra que não pode ser quebrada:** sem o parâmetro `cliente`, a página se comporta **exatamente como hoje** — as duas notinhas, sem botão de decisão. É o caminho de quem só quer olhar a notinha de uma peça.

- [ ] **Step 1: Ler os parâmetros novos**

Junto dos `params.get` que já existem:

```tsx
  const clienteParam = params.get("cliente") ?? "";
  const coresParam = params.get("cores");
```

- [ ] **Step 2: Usar as cores da venda no cálculo**

Trocar o `useMemo` do `resultado` por:

```tsx
  // Com ?cores=, calcula com as cores DESTA venda em vez das da peça. É a
  // mesma calcularProduto — nenhuma regra de preço nova.
  const resultado = useMemo(() => {
    if (!produto || !config) return null;
    const escolhidas = coresParam ? coresParam.split(",").filter(Boolean) : null;
    const alvo = escolhidas ? { ...produto, coresIds: escolhidas } : produto;
    return calcularProduto(alvo, config, cores);
  }, [produto, config, cores, coresParam]);
```

E o `dadosOrcamento` passa a levar o cliente e as cores escolhidas:

```tsx
  const dadosOrcamento = useMemo(() => {
    if (!produto || !resultado) return null;
    const escolhidas = coresParam ? coresParam.split(",").filter(Boolean) : null;
    const alvo = escolhidas ? { ...produto, coresIds: escolhidas } : produto;
    return {
      ...montarOrcamento(alvo, resultado, cores, empresa, new Date()),
      cliente: clienteParam,
    };
  }, [produto, resultado, cores, empresa, coresParam, clienteParam]);
```

- [ ] **Step 3: Acrescentar o estado e a ação de vender**

```tsx
  const [salvando, setSalvando] = useState(false);
  const [avisoVenda, setAvisoVenda] = useState("");

  async function vendi() {
    if (!produto || !resultado || salvando) return;
    setSalvando(true);
    try {
      const clienteId = await db.acharOuCriarCliente(clienteParam);
      await db.criarVenda({
        produtoId: produto.id,
        produtoNome: produto.nome,
        clienteId,
        coresIds: coresParam ? coresParam.split(",").filter(Boolean) : produto.coresIds,
        preco: resultado.precoVenda,
        custo: resultado.custoTotal,
        // Vendeu agora, mas ainda não recebeu — quem marca é ela, depois.
        pagoEm: null,
      });
      router.push("/fabrica?aba=vendidos");
    } catch (e) {
      console.error(e);
      setAvisoVenda("Não consegui anotar a venda. Confere a internet!");
      setSalvando(false);
    }
  }
```

Acrescentar `import { useRouter } from "next/navigation";`, `import * as db from "@/lib/db";` e `const router = useRouter();` se ainda não existirem no arquivo.

- [ ] **Step 4: Desenhar os botões**

Depois do `</div>` que fecha a grade das duas notinhas, e **só** quando houver cliente:

```tsx
      {clienteParam && (
        <div className="mt-10">
          <p className="mb-3 text-center text-base font-extrabold text-mute">
            E aí, {clienteParam} vai levar?
          </p>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              onClick={vendi}
              disabled={salvando}
              className="btn-grande btn-neon flex-1 disabled:opacity-60"
            >
              Vendi!
            </button>
            <button
              onClick={() => router.push("/fabrica")}
              disabled={salvando}
              className="btn-grande btn-escuro flex-1 disabled:opacity-60"
            >
              Não vendi
            </button>
          </div>
          <p className="mt-3 text-center font-bold text-mute">
            Se vendeu, dá pra marcar quando o dinheiro chegar.
          </p>
        </div>
      )}

      {avisoVenda && (
        <Dialogo
          titulo="Não deu certo"
          texto={avisoVenda}
          onFechar={() => setAvisoVenda("")}
        />
      )}
```

Acrescentar `import Dialogo from "@/components/Dialogo";` se não existir.

**"Não vendi" só navega de volta.** Não grava nem apaga nada, porque nada foi gravado ainda — o orçamento só existiu na URL.

- [ ] **Step 5: Conferir**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro, testes passando.

- [ ] **Step 6: Commitar**

```bash
git add app/resultado/page.tsx
git commit -m "Vendi ou não vendi na tela da notinha"
```

---

### Task 9: A migração do contador antigo

**Files:**
- Modify: `lib/db.ts`

**Interfaces:**
- Consumes: `linhasDaMigracao` de `lib/vendas.ts` (Task 2); `Produto`, `Config`, `Cor` de `lib/types.ts`.
- Produces: `migrarVendasAntigas(produtos: Produto[], config: Config, cores: Cor[]): Promise<boolean>` — `true` se migrou agora, `false` se já tinha migrado.

**Recebe os dados já carregados em vez de buscá-los**: quem chama (`/fabrica`) já tem produtos, config e cores na mão, e assim a função não faz três idas extras ao banco nem duplica a lógica de carregar.

- [ ] **Step 1: Acrescentar o import**

```ts
import { linhasDaMigracao } from "./vendas";
```

- [ ] **Step 2: Acrescentar a função no fim de `lib/db.ts`**

```ts
/** Nome da linha de controle em `migracoes`. Não mudar: é a trava. */
const MIGRACAO_VENDAS = "vendas-do-contador";

/**
 * Converte `produtos.vendidos` em linhas de venda pagas, uma vez por conta.
 *
 * O contador antigo NÃO é apagado: fica parado, sem ninguém ler. Se esta
 * migração sair errada, dá pra refazer a partir dele — apagar seria queimar
 * a ponte.
 *
 * Devolve true se migrou agora (quem chama recarrega as vendas).
 */
export async function migrarVendasAntigas(
  produtos: Produto[],
  config: Config,
  cores: Cor[]
): Promise<boolean> {
  const uid = await idUsuario();
  const sb = supabase();

  const jaFoi = await sb
    .from("migracoes")
    .select("nome")
    .eq("user_id", uid)
    .eq("nome", MIGRACAO_VENDAS)
    .maybeSingle();
  if (jaFoi.error) throw jaFoi.error;
  if (jaFoi.data) return false;

  const linhas = linhasDaMigracao(produtos, config, cores);

  if (linhas.length > 0) {
    const { error } = await sb.from("vendas").insert(
      linhas.map((l) => ({
        id: novoId(),
        user_id: uid,
        produto_id: l.produtoId,
        produto_nome: l.produtoNome,
        cliente_id: l.clienteId,
        cores_ids: l.coresIds,
        preco: l.preco,
        custo: l.custo,
        pago_em: l.pagoEm === null ? null : new Date(l.pagoEm).toISOString(),
      }))
    );
    if (error) throw error;
  }

  // A marca vai DEPOIS das linhas: se o insert acima falhar, a migração não
  // é dada como feita e roda de novo na próxima visita. Marcar antes deixaria
  // o dado velho pra trás pra sempre.
  const { error: e2 } = await sb
    .from("migracoes")
    .insert({ user_id: uid, nome: MIGRACAO_VENDAS });
  if (e2) throw e2;

  return linhas.length > 0;
}
```

- [ ] **Step 3: Conferir**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro; os 14 testes de `lib/vendas.test.ts` — inclusive o da identidade do cofrinho — seguem passando.

- [ ] **Step 4: Commitar**

```bash
git add lib/db.ts
git commit -m "Migra o contador de vendidos para linhas de venda pagas"
```

---

### Task 10: A lista de vendidos (`components/ListaVendidos.tsx`)

**Files:**
- Create: `components/ListaVendidos.tsx`

**Interfaces:**
- Consumes: `Venda`, `Cliente`, `Cor` de `lib/types.ts`; `totalNoCaixa`, `totalQueTeDevem`, `recebido`, `lucroDaVenda` de `lib/vendas.ts`; `acharCor` de `lib/calc-produto.ts`; `Valor`, `Carretel`, `Dialogo`.
- Produces: `<ListaVendidos vendas={} clientes={} cores={} empresa={} onReceber={} onNomear={} onVenderDeNovo={} />`

**Por que arquivo separado:** `app/fabrica/page.tsx` já tem 458 linhas fazendo lista de produtos, lista de vendidos, cofrinho, diálogos e handlers. Somar a lista nova ali passaria de 600 e o arquivo estaria fazendo cinco coisas.

- [ ] **Step 1: Criar `components/ListaVendidos.tsx`**

```tsx
"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import { lucroDaVenda, recebido, totalNoCaixa, totalQueTeDevem } from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import { IconeMoeda } from "@/components/Icones";

/**
 * A aba "Vendidos": o cofrinho em cima e as vendas embaixo.
 *
 * Duas coisas que a tela precisa deixar óbvias:
 *  - vender não é receber (só o recebido conta no cofrinho);
 *  - venda sem cliente é um convite pra preencher, não um defeito.
 */
export default function ListaVendidos({
  vendas,
  clientes,
  cores,
  empresa,
  onReceber,
  onNomear,
  onVenderDeNovo,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
  empresa: string;
  onReceber: (vendaId: string) => void;
  onNomear: (venda: Venda) => void;
  onVenderDeNovo: (venda: Venda) => void;
}) {
  if (vendas.length === 0) {
    return (
      <div className="card flex flex-col items-center py-8 text-center">
        <IconeMoeda size={56} className="text-mute" />
        <p className="display mt-4 text-xl font-bold text-tinta">
          Ainda não vendeu nada
        </p>
        <p className="mt-1 font-bold text-mute">
          Escolha uma peça em “Meus produtos” e toque em{" "}
          <span className="text-neon">“Fazer orçamento”</span>.
        </p>
      </div>
    );
  }

  const caixa = totalNoCaixa(vendas);
  const devendo = totalQueTeDevem(vendas);
  const quantasPagas = vendas.filter(recebido).length;

  function nomeDoCliente(v: Venda): string | null {
    if (!v.clienteId) return null;
    return clientes.find((c) => c.id === v.clienteId)?.nome ?? null;
  }

  return (
    <>
      {/* O cofrinho: só o dinheiro que já entrou de verdade. */}
      <div className="card caixa-valor mb-4 text-center">
        <p className="display text-xs font-bold uppercase tracking-[0.2em] text-mute">
          cofrinho da {empresa || "empresa"}
        </p>
        <Valor
          valor={Math.abs(caixa)}
          max="3.5rem"
          min="1.5rem"
          className={`mt-1 block font-bold ${
            caixa < 0 ? "text-perigo" : "brilho text-neon"
          }`}
        />
        <p className="mt-1 font-bold text-mute">
          ganho de verdade, com {quantasPagas} venda
          {quantasPagas === 1 ? "" : "s"} paga{quantasPagas === 1 ? "" : "s"} 🎉
        </p>

        {devendo > 0 && (
          <p className="mt-3 border-t border-borda pt-3 font-bold text-mute">
            Ainda te devem{" "}
            <span className="text-ciano">{brl(devendo)}</span>
          </p>
        )}
      </div>

      <div className="space-y-3">
        {vendas.map((v) => {
          const nome = nomeDoCliente(v);
          const pago = recebido(v);
          return (
            <div key={v.id} className="card">
              <div className="flex items-center gap-3">
                <span className="flex shrink-0 -space-x-2.5">
                  {v.coresIds.slice(0, 3).map((id, idx) => (
                    <Carretel key={idx} cor={acharCor(id, cores).hex} size={30} />
                  ))}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Sem nome, o próprio aviso É o botão de preencher. */}
                  {nome ? (
                    <p className="display truncate text-lg font-bold text-tinta">
                      {nome}
                    </p>
                  ) : (
                    <button
                      onClick={() => onNomear(v)}
                      className="display truncate text-lg font-bold text-perigo underline"
                    >
                      ** falta o nome **
                    </button>
                  )}
                  <p className="truncate font-bold text-mute">
                    {v.produtoNome} · {brl(v.preco)}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-bold uppercase ${
                    pago
                      ? "border-neon/30 bg-neon/10 text-neon"
                      : "border-ciano/30 bg-ciano/10 text-ciano"
                  }`}
                >
                  {pago ? `ganhou ${brl(lucroDaVenda(v))}` : "falta pagar"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!pago && (
                  <button
                    onClick={() => onReceber(v.id)}
                    className="btn-grande btn-neon min-h-[48px] flex-1 text-base"
                  >
                    Recebi!
                  </button>
                )}
                {nome && (
                  <button
                    onClick={() => onNomear(v)}
                    className="btn-grande btn-escuro min-h-[48px] flex-1 text-base"
                  >
                    Trocar o nome
                  </button>
                )}
                {v.produtoId && (
                  <button
                    onClick={() => onVenderDeNovo(v)}
                    className="btn-grande btn-escuro min-h-[48px] flex-1 text-base"
                  >
                    Vender de novo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Conferir os tipos**

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 3: Commitar**

```bash
git add components/ListaVendidos.tsx
git commit -m "A aba Vendidos como componente próprio"
```

---

### Task 11: Ligar tudo em `/fabrica`

**Files:**
- Modify: `components/Dialogo.tsx` (aceitar `children`)
- Modify: `app/fabrica/page.tsx`

**Interfaces:**
- Consumes: `ListaVendidos` (Task 10); `lerVendas`, `marcarPago`, `definirClienteDaVenda`, `acharOuCriarCliente`, `lerClientes`, `migrarVendasAntigas` de `lib/db.ts`.
- Produces: nada; é a última tela.

- [ ] **Step 1: Acrescentar estado e carregamento**

Junto dos `useState` existentes:

```tsx
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nomeando, setNomeando] = useState<Venda | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
```

Acrescentar aos imports: `import ListaVendidos from "@/components/ListaVendidos";` e os tipos `Cliente`, `Venda`.

No `useEffect` que já carrega produtos/config/cores, depois de `setCarregou(true)`, acrescentar um efeito novo:

```tsx
  // Migra o contador antigo ANTES de mostrar a aba, senão a primeira
  // renderização apareceria com a lista vazia e o cofrinho zerado.
  useEffect(() => {
    if (!carregou || !config) return;
    let vivo = true;
    (async () => {
      try {
        await db.migrarVendasAntigas(produtos, config, cores);
        const [vs, cls] = await Promise.all([db.lerVendas(), db.lerClientes()]);
        if (!vivo) return;
        setVendas(vs);
        setClientes(cls);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [carregou, config, produtos, cores]);
```

- [ ] **Step 2: Trocar o cofrinho velho pelas ações novas**

Apagar `jaGanhei`, `totalVendidos`, `vendidosLista`, `vender()` e `desfazerVenda()`.

Acrescentar:

```tsx
  function receber(vendaId: string) {
    const anterior = vendas;
    setVendas(vendas.map((v) => (v.id === vendaId ? { ...v, pagoEm: Date.now() } : v)));
    setFesta(true);
    setTimeout(() => setFesta(false), 1600);
    db.marcarPago(vendaId).catch((e) => {
      setVendas(anterior);
      falhou(e);
    });
  }

  async function salvarNome() {
    const alvo = nomeando;
    if (!alvo) return;
    setNomeando(null);
    try {
      const clienteId = await db.acharOuCriarCliente(nomeNovo);
      await db.definirClienteDaVenda(alvo.id, clienteId);
      const [vs, cls] = await Promise.all([db.lerVendas(), db.lerClientes()]);
      setVendas(vs);
      setClientes(cls);
    } catch (e) {
      falhou(e);
    }
  }
```

- [ ] **Step 3: Trocar a aba**

O rótulo do botão de aba passa de "Já vendi" pra "Vendidos". No corpo da aba, trocar todo o bloco de "ABA: JÁ VENDI" por:

```tsx
        <ListaVendidos
          vendas={vendas}
          clientes={clientes}
          cores={cores}
          empresa={empresa}
          onReceber={receber}
          onNomear={(v) => {
            setNomeando(v);
            setNomeNovo(clientes.find((c) => c.id === v.clienteId)?.nome ?? "");
          }}
          onVenderDeNovo={(v) => router.push(`/orcamento?de=${v.id}`)}
        />
```

- [ ] **Step 4: Trocar "Vendi 1!" por "Fazer orçamento"**

No card de cada produto, substituir o botão "Vendi 1!" por:

```tsx
                      <button
                        onClick={() => router.push(`/orcamento?produto=${produto.id}`)}
                        className="btn-grande btn-neon min-h-[48px] flex-1 text-base"
                      >
                        Fazer orçamento
                      </button>
```

Apagar também o selo de `{produto.vendidos > 0 && ...}` no card — o contador não é mais a fonte da verdade sobre vendas.

- [ ] **Step 5a: Dar ao `Dialogo` um lugar pra colocar campo**

`components/Dialogo.tsx` hoje só aceita `titulo`, `texto` e um `icone` — e o
`icone` é renderizado **dentro de um selo redondo de 56px**. Um `<input>` ali
sairia esmagado dentro de uma bolinha. A janelinha precisa de um espaço de
conteúdo de verdade.

Acrescentar `children` às props:

```tsx
  onConfirmar,
  onFechar,
  children,
}: {
  titulo: string;
  texto?: string;
  icone?: React.ReactNode;
  tom?: "neutro" | "perigo";
  confirmar?: string;
  cancelar?: string;
  onConfirmar?: () => void;
  onFechar: () => void;
  /** Conteúdo livre entre o texto e os botões — ex: um campo pra digitar. */
  children?: React.ReactNode;
}) {
```

E renderizar entre o texto e os botões, logo depois da linha do `{texto && ...}`:

```tsx
        {children && <div className="mt-4">{children}</div>}
```

Isso não muda nenhuma das chamadas existentes: sem `children`, nada é
renderizado.

- [ ] **Step 5b: A janelinha de nomear**

Antes do fim do `<main>`:

```tsx
      {nomeando && (
        <Dialogo
          titulo="Quem comprou?"
          confirmar="Salvar"
          cancelar="Deixa quieto"
          onConfirmar={salvarNome}
          onFechar={() => setNomeando(null)}
        >
          <input
            autoFocus
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            maxLength={24}
            placeholder="Ex: Maria"
            className="w-full rounded-xl border-2 border-borda bg-painel2 p-3 text-center text-lg font-bold text-tinta outline-none focus:border-neon"
          />
        </Dialogo>
      )}
```

- [ ] **Step 6: Aceitar `?aba=vendidos`**

A tela de resultado manda pra `/fabrica?aba=vendidos` depois de vender.

Ler com `window.location.search` dentro de um efeito, **não** com
`useSearchParams`: no Next 14 o `useSearchParams` exige que a página esteja
dentro de um `<Suspense>`, e `/fabrica` não está. Trocar por `useSearchParams`
quebraria o build. Não "arrumar" isto.

```tsx
  const [aba, setAba] = useState<Aba>("catalogo");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("aba") === "vendidos") {
      setAba("vendidos");
    }
  }, []);
```

- [ ] **Step 7: Conferir**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro, todos os testes passando. Confira lendo que **nenhuma** referência a `atualizarVendidos`, `jaGanhei`, `vendidosLista` ou `desfazerVenda` sobrou no arquivo.

Run: `grep -n "atualizarVendidos\|jaGanhei\|vendidosLista\|desfazerVenda\|Vendi 1" app/fabrica/page.tsx`
Expected: nenhuma saída.

- [ ] **Step 8: Commitar**

```bash
git add components/Dialogo.tsx app/fabrica/page.tsx
git commit -m "Fábrica: fazer orçamento, aba Vendidos e migração no carregamento"
```

---

### Task 12: Ver com os próprios olhos

**Files:**
- Create (temporário, **apagado no fim**): `app/preview/page.tsx`
- Modify (temporário, **desfeito no fim**): `lib/rotas.ts`
- Create: `<scratchpad>/print.mjs`

- [ ] **Step 1: Criar a rota temporária**

Criar `app/preview/page.tsx` que renderiza a notinha do cliente **com** e **sem** nome, e com um nome de 24 caracteres:

```tsx
"use client";

import NotinhaCliente from "@/components/NotinhaCliente";
import { montarOrcamento } from "@/lib/orcamento";
import type { Cor, Produto, ResultadoCalculo } from "@/lib/types";

const CORES: Cor[] = [
  { id: "roxo", nome: "Roxo", hex: "#7c3aed", tipo: "basica", precoRoloKg: 105 },
  { id: "verde", nome: "Verde", hex: "#0f9d6e", tipo: "basica", precoRoloKg: 105 },
];

const PRODUTO: Produto = {
  id: "p1",
  nome: "Dinossauro Roxo",
  coresIds: ["roxo", "verde"],
  gramas: 40,
  unidade: "g",
  horas: 2,
  minutos: 30,
  margem: 1,
  precoVenda: 25,
  criadoEm: 0,
  vendidos: 0,
};

const RESULTADO: ResultadoCalculo = {
  custoMaterial: 4.2,
  custoEnergia: 0.6,
  custoDesgaste: 1.1,
  custoExtras: 3,
  subtotal: 8.9,
  custoFalhas: 0.89,
  custoTotal: 9.79,
  precoBase: 24.5,
  precoVenda: 25,
  lucro: 15.21,
};

function dados(cliente: string) {
  return {
    ...montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja da Julia", new Date(2026, 6, 19)),
    cliente,
  };
}

export default function Preview() {
  return (
    <main className="mx-auto w-full max-w-md lg:max-w-4xl">
      <div className="grid gap-12 lg:grid-cols-3 lg:gap-6">
        <NotinhaCliente dados={dados("")} />
        <NotinhaCliente dados={dados("Tio Fernando")} />
        <NotinhaCliente dados={dados("Abcdefghij Klmnopqrstu")} />
      </div>
    </main>
  );
}
```

Em `lib/rotas.ts`, acrescentar `"/preview"` a `PUBLICAS`.

- [ ] **Step 2: Subir o dev server e tirar os prints**

Run: `npm run dev` (anote a porta; pode não ser 3000)

No scratchpad: `npm i --no-save playwright`, e `print.mjs`:

```js
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const TELAS = [
  { nome: "desktop", width: 1440, height: 900 },
  { nome: "tablet", width: 820, height: 1180 },
  { nome: "celular", width: 390, height: 844 },
];

const navegador = await chromium.launch();
for (const t of TELAS) {
  // É `viewport`, NÃO `viewportSize`: o segundo é ignorado em silêncio.
  const pagina = await navegador.newPage({
    viewport: { width: t.width, height: t.height },
  });
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(String(e)));
  await pagina.goto(`${BASE}/preview`, { waitUntil: "networkidle" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: `notinhas-${t.nome}.png`, fullPage: true });
  const vazou = await pagina.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  console.log(t.nome, { vazou, erros });
  await pagina.close();
}
await navegador.close();
```

Run: `node print.mjs`
Expected: `vazou: false` e `erros: []` nas três larguras.

- [ ] **Step 3: Olhar os prints**

Abrir cada PNG com Read e conferir:

1. A notinha **sem** cliente não tem linha nenhuma no lugar do nome — nem "PARA" solto, nem espaço vazio sobrando.
2. A notinha **com** "Tio Fernando" mostra `PARA TIO FERNANDO` abaixo de "orçamento" e acima do tracejado.
3. O nome está mais escuro que o "orçamento" acinzentado de cima.
4. O nome de 24 caracteres **não** fura a borda do papel (foi cortado com reticências se preciso).
5. Nas três, o papel fecha embaixo sem faixa vazia sobrando.

Se algo estiver torto, ajustar as constantes no topo de `lib/notinha-desenho.ts`, rodar de novo e olhar outra vez.

- [ ] **Step 4: DESFAZER a rota temporária**

```bash
rm app/preview/page.tsx
git checkout lib/rotas.ts
rmdir app/preview 2>/dev/null
git status --short
```
Expected: nem `app/preview/page.tsx` nem `lib/rotas.ts` aparecem.

- [ ] **Step 5: Verificação final**

Com o dev server **desligado**:

```bash
rm -rf .next && npm test && npx tsc --noEmit && npm run build
```
Expected: todos os testes passando, sem erro de tipo, build concluído, e `/preview` **não** aparece na lista de rotas.

- [ ] **Step 6: Commitar ajustes de desenho, se houve**

```bash
git add lib/notinha-desenho.ts
git commit -m "Ajusta a linha do cliente conforme os prints"
```

Se nada precisou mudar, não há o que commitar.

---

## O que precisa de conferência humana

Estas coisas **não** são cobertas por teste automático e ninguém deve declarar a feature pronta sem elas. Todas exigem uma conta de verdade com o schema já aplicado no Supabase.

1. **O cofrinho antes e depois da migração.** Anotar o valor exibido hoje, aplicar o schema, abrir `/fabrica` e conferir que o número é **idêntico**. O teste `"o cofrinho vale o mesmo antes e depois"` já prova a aritmética; isto prova que a ida ao banco não perdeu nada no caminho.
2. **A migração não roda duas vezes.** Recarregar `/fabrica` várias vezes e conferir que a quantidade de vendas não cresce.
3. **Duas vendas da mesma peça em cores diferentes**, e a primeira não muda de preço nem de cor depois da segunda.
4. **Renomear um cliente** e ver todas as vendas dele acompanharem.
5. **Marcar "Recebi!"** e ver o valor sair do "ainda te devem" e entrar no cofrinho.
6. **"Não vendi" não deixa rastro:** fazer um orçamento, recusar, e conferir que nenhuma venda e nenhum cliente novo apareceram.

## Verificação do plano contra o spec

| Requisito do spec | Onde |
|---|---|
| Orçamento não é salvo; decide na hora | Tasks 7 e 8 (o orçamento só existe na URL) |
| Nasce pela peça, em "Meus produtos" | Task 11 |
| `/novo` não pergunta o cliente | Não há task que o modifique |
| Cliente obrigatório na tela de orçamento | Task 7 (`podeSeguir`) |
| Preço e custo calculados na criação e congelados | Tasks 8 e 2 |
| Cofrinho só com o recebido | Tasks 2 e 10 |
| "Vendi 1!" sai; "Já vendi" vira "Vendidos" | Task 11 |
| Contadores convertidos em vendas pagas | Tasks 2 e 9 |
| Cofrinho vale igual antes e depois | Task 2 (teste) + conferência humana nº 1 |
| `vendidos` não é apagado | Task 9 (só lê) |
| Pastilhas dos 6 mais recentes | Tasks 4 e 7 |
| Seletor de cor igual ao do `/novo` | Task 7 |
| `** falta o nome **` é o botão | Task 10 |
| Editar cliente em todas as vendas | Tasks 10 e 11 |
| Renomear conserta todas as vendas dele | Task 4 (cliente é link) |
| "Vender de novo" pré-preenchido | Tasks 7 e 10 |
| Linha `PARA MARIA` na notinha | Task 6 |
| `DadosOrcamento` com 6 chaves, lista fechada | Task 6 |
| Tabelas com RLS e `assinatura_ativa()` no insert | Task 3 |
| Sem FK em `produto_id`/`cliente_id` | Task 3 |
| Flag de migração fora de `perfis` | Tasks 3 e 9 |
| Print em 1440/820/390 e `/preview` desfeita | Task 12 |
