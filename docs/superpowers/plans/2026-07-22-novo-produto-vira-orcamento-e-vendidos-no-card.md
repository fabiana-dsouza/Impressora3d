# Criar produto vira orçamento + "vendidos" no card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de criar uma peça, a criança já cai no orçamento completo (pra quem é? + teste de negociação + vender); e o card de cada produto mostra "N vendidos — ver quem comprou", abrindo a lista das unidades vendidas.

**Architecture:** Duas mudanças pequenas e independentes. A Parte A é fiação de rota: `/novo` passa a mandar pra `/resultado` com `?cores`, ligando o modo orçamento que já existe; `/resultado` ganha uma frase de festa quando vem de peça nova. A Parte B extrai dois helpers puros pra `lib/vendas.ts` (testados) e usa um componente novo, só de apresentação, dentro de um `Dialogo` no card da fábrica.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Tailwind. Vitest pra lógica pura (sem harness de componente — componentes não têm teste de render neste projeto).

## Global Constraints

Valores exatos copiados da spec e das regras do projeto. Valem pra toda task.

- **Público:** criança de 10 anos. Fonte/botão grandes, zero jargão, linguagem "quanto gastei / quanto vou ganhar", pt-BR com vírgula.
- **Dinheiro** sempre via `brl()` de `lib/format.ts`.
- **Emoji só em ponto de festa** (confete, "Bom negócio!"). Nunca em botão, rótulo, erro ou título de bloco.
- **Nada de `confirm()`/`alert()` do navegador** — usar `components/Dialogo.tsx`.
- **Não tocar nas regras de preço** (`lib/calc.ts`), margem mínima 15%, arredondamento em múltiplos de R$ 0,50.
- **NUNCA rodar `npm run build` com o `npm run dev` ligado** — os dois dividem `.next/` e corrompe. Parar o dev antes.
- **Testes:** `npm test` (Vitest, roda tudo). Lógica testável mora em `lib/*.ts`; componentes ficam finos e sem teste de render.

---

## File Structure

- `lib/vendas.ts` — **modificar**: adicionar `vendasDaPeca()` e `rotuloVendidos()` (puros).
- `lib/vendas.test.ts` — **modificar**: testes dos dois helpers.
- `components/EspecificacoesProduto.tsx` — **criar**: lista das unidades vendidas de uma peça (apresentação pura, read-only).
- `app/fabrica/page.tsx` — **modificar**: linha "N vendidos — ver quem comprou" no card + estado e `Dialogo` da janelinha.
- `app/novo/page.tsx` — **modificar**: redirect com `&cores=` no `salvar()`.
- `app/resultado/page.tsx` — **modificar**: frase de festa quando `ehNovo && ehOrcamento`.

---

## Task 1: Helpers puros de "vendidos" (lib/vendas.ts)

**Files:**
- Modify: `lib/vendas.ts`
- Test: `lib/vendas.test.ts`

**Interfaces:**
- Consumes: `Venda` de `./types` (já importado no arquivo).
- Produces:
  - `vendasDaPeca(vendas: Venda[], produtoId: string): Venda[]` — as vendas daquela peça (ignora `produtoId` nulo e de outras peças).
  - `rotuloVendidos(n: number): string` — `"1 vendido"` / `"N vendidos"`.

- [ ] **Step 1: Write the failing tests**

Em `lib/vendas.test.ts`, adicionar `vendasDaPeca` e `rotuloVendidos` ao import existente de `"./vendas"`:

```ts
import {
  lucroDaVenda,
  recebido,
  totalNoCaixa,
  totalQueTeDevem,
  linhasDaMigracao,
  precoBaseDaVenda,
  vendasDaPeca,
  rotuloVendidos,
} from "./vendas";
```

E adicionar estes dois blocos `describe` no fim do arquivo (o factory `venda()` já existe no topo, com `produtoId: "p1"` por padrão):

```ts
describe("vendas de uma peça", () => {
  it("pega só as vendas daquela peça", () => {
    const vs = [
      venda({ id: "a", produtoId: "p1" }),
      venda({ id: "b", produtoId: "p2" }),
      venda({ id: "c", produtoId: "p1" }),
    ];
    expect(vendasDaPeca(vs, "p1").map((v) => v.id)).toEqual(["a", "c"]);
  });

  it("ignora venda de peça apagada (produtoId nulo)", () => {
    const vs = [
      venda({ id: "a", produtoId: null }),
      venda({ id: "b", produtoId: "p1" }),
    ];
    expect(vendasDaPeca(vs, "p1").map((v) => v.id)).toEqual(["b"]);
  });

  it("peça sem nenhuma venda dá lista vazia", () => {
    expect(vendasDaPeca([venda({ produtoId: "p2" })], "p1")).toEqual([]);
  });
});

describe("rótulo de vendidos", () => {
  it("uma venda é singular", () => {
    expect(rotuloVendidos(1)).toBe("1 vendido");
  });

  it("duas ou mais é plural", () => {
    expect(rotuloVendidos(2)).toBe("2 vendidos");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- vendas`
Expected: FAIL — `vendasDaPeca is not a function` / `rotuloVendidos is not a function`.

- [ ] **Step 3: Implement the helpers**

No fim de `lib/vendas.ts`, adicionar:

```ts
/** Só as vendas daquela peça (ignora as de peça apagada, com produtoId nulo). */
export function vendasDaPeca(vendas: Venda[], produtoId: string): Venda[] {
  return vendas.filter((v) => v.produtoId === produtoId);
}

/** "1 vendido", "2 vendidos" — o rótulo do contador no card. */
export function rotuloVendidos(n: number): string {
  return `${n} vendido${n === 1 ? "" : "s"}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- vendas`
Expected: PASS (os novos + os antigos de `vendas.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/vendas.ts lib/vendas.test.ts
git commit -m "$(cat <<'EOF'
Helpers vendasDaPeca e rotuloVendidos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Contador "vendidos" + janelinha no card (Parte B)

**Files:**
- Create: `components/EspecificacoesProduto.tsx`
- Modify: `app/fabrica/page.tsx`

**Interfaces:**
- Consumes: `vendasDaPeca`, `rotuloVendidos` (Task 1); `lucroDaVenda`, `recebido` (`lib/vendas.ts`); `acharCor` (`lib/calc-produto.ts`); `brl` (`lib/format.ts`); `Dialogo`, `Carretel` (componentes); `IconeMoeda` (`components/Icones.tsx`).
- Produces: componente `EspecificacoesProduto` com props `{ vendas: Venda[]; clientes: Cliente[]; cores: Cor[] }`.

- [ ] **Step 1: Create the presentational component**

Criar `components/EspecificacoesProduto.tsx`:

```tsx
"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import { lucroDaVenda, recebido } from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";

/**
 * A lista das unidades vendidas de UMA peça, pra abrir dentro do Dialogo do
 * card. Só pra ver: quem comprou, o valor e se já pagou. Receber e trocar o
 * nome continuam na aba Vendidos — aqui não duplica ação nenhuma.
 */
export default function EspecificacoesProduto({
  vendas,
  clientes,
  cores,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
}) {
  function nomeDoCliente(v: Venda): string | null {
    if (!v.clienteId) return null;
    return clientes.find((c) => c.id === v.clienteId)?.nome ?? null;
  }

  return (
    <div className="space-y-2 text-left">
      {vendas.map((v) => {
        const nome = nomeDoCliente(v);
        const pago = recebido(v);
        return (
          <div
            key={v.id}
            className="flex items-center gap-3 rounded-xl border border-borda bg-painel2 p-3"
          >
            <span className="flex shrink-0 -space-x-2">
              {v.coresIds.slice(0, 3).map((id, idx) => (
                <Carretel key={idx} cor={acharCor(id, cores).hex} size={26} />
              ))}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-tinta">
                {nome ?? "** falta o nome **"}
              </p>
              <p className="text-sm font-bold text-mute">{brl(v.preco)}</p>
            </div>

            <span
              className={`shrink-0 rounded-lg border px-2 py-1 text-center ${
                pago
                  ? "border-neon/30 bg-neon/10"
                  : "border-ciano/30 bg-ciano/10"
              }`}
            >
              {pago ? (
                <>
                  <span className="block text-[10px] font-bold uppercase leading-none text-neon/70">
                    ganhou
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap text-xs font-bold text-neon">
                    {brl(lucroDaVenda(v))}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-[10px] font-bold uppercase leading-none text-ciano/70">
                    falta
                  </span>
                  <span className="mt-0.5 block text-xs font-bold uppercase text-ciano">
                    pagar
                  </span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire the imports in the fábrica**

Em `app/fabrica/page.tsx`, adicionar ao bloco de imports (perto dos outros de `@/lib` e `@/components`):

```tsx
import { vendasDaPeca, rotuloVendidos } from "@/lib/vendas";
import EspecificacoesProduto from "@/components/EspecificacoesProduto";
```

`Dialogo`, `IconeMoeda`, o tipo `Produto`, e os estados `vendas`/`clientes`/`cores` já existem no arquivo — não reimportar.

- [ ] **Step 3: Add the dialog state**

Ainda em `app/fabrica/page.tsx`, junto dos outros `useState` do componente `Home` (perto de `const [apagando, setApagando] = useState<Produto | null>(null);`):

```tsx
const [vendoUnidadesDe, setVendoUnidadesDe] = useState<Produto | null>(null);
```

- [ ] **Step 4: Show the "N vendidos" line on the card**

No `calculos.map(...)` do catálogo, trocar o callback de retorno implícito por corpo com bloco, pra calcular as vendas da peça uma vez.

Trocar a abertura do map:

```tsx
{calculos.map(({ produto, resultado }) => (
  <div
    key={produto.id}
    className="card animate-pop overflow-hidden p-0"
  >
```

por:

```tsx
{calculos.map(({ produto, resultado }) => {
  const vendasDesta = vendasDaPeca(vendas, produto.id);
  return (
    <div
      key={produto.id}
      className="card animate-pop overflow-hidden p-0"
    >
```

e fechar o map trocando o fim atual:

```tsx
                  </div>
                </div>
              </div>
            ))}
```

por (mesmo JSX, só o `))}` do arrow implícito vira `);` `})}` do bloco):

```tsx
                  </div>
                </div>
              </div>
            );
          })}
```

Depois, dentro do corpo do card (o `<div className="min-w-0 flex-1 p-4">`), inserir a linha do contador **logo antes** do bloco dos botões `<div className="mt-3 flex gap-2">` (o de "A conta" / "Fazer orçamento"):

```tsx
{vendasDesta.length > 0 && (
  <button
    onClick={() => setVendoUnidadesDe(produto)}
    className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-borda bg-painel2 px-3 py-2 active:translate-y-0.5"
  >
    <span className="text-sm font-extrabold text-tinta">
      {rotuloVendidos(vendasDesta.length)}
    </span>
    <span className="text-sm font-bold text-ciano">ver quem comprou ›</span>
  </button>
)}
```

- [ ] **Step 5: Add the drill-down dialog**

Ainda em `app/fabrica/page.tsx`, junto dos outros `Dialogo` do fim do `return` (perto do `{apagando && (` ), adicionar:

```tsx
{vendoUnidadesDe && (
  <Dialogo
    icone={<IconeMoeda size={26} />}
    titulo={`${vendoUnidadesDe.nome} — ${rotuloVendidos(
      vendasDaPeca(vendas, vendoUnidadesDe.id).length
    )}`}
    onFechar={() => setVendoUnidadesDe(null)}
  >
    <EspecificacoesProduto
      vendas={vendasDaPeca(vendas, vendoUnidadesDe.id)}
      clientes={clientes}
      cores={cores}
    />
  </Dialogo>
)}
```

(Sem `onConfirmar`, o `Dialogo` mostra só o botão "Entendi" — é uma janelinha de ver, não de decidir.)

- [ ] **Step 6: Typecheck / build**

Parar o `npm run dev` se estiver rodando (dividem `.next/`). Então:

Run: `npm run build`
Expected: build passa sem erro de TypeScript.

- [ ] **Step 7: Manual check no app**

Run: `npm run dev`, logar numa conta assinada, abrir a fábrica.
Conferir:
- Um produto **sem** vendas: o card NÃO mostra a linha de vendidos (igual a hoje).
- Um produto **com** vendas (faça uma venda pela "Fazer orçamento" → "Vendido" se precisar): aparece "1 vendido" / "2 vendidos — ver quem comprou ›".
- Tocar abre a janelinha com cada unidade: nome (ou "** falta o nome **"), valor, e o chip ganhou/falta. Esc ou "Entendi" fecha.

- [ ] **Step 8: Commit**

```bash
git add components/EspecificacoesProduto.tsx app/fabrica/page.tsx
git commit -m "$(cat <<'EOF'
Card do produto mostra "N vendidos" e abre as unidades

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Criar produto cai no orçamento (Parte A)

**Files:**
- Modify: `app/novo/page.tsx`
- Modify: `app/resultado/page.tsx`

**Interfaces:**
- Consumes: o modo orçamento já existente em `/resultado` (`ehOrcamento = coresParam !== null`) e a flag `ehNovo = params.get("novo") === "1"`.
- Produces: nenhum símbolo novo — só fiação de rota e um bloco de UI.

- [ ] **Step 1: Redirect do /novo com as cores**

Em `app/novo/page.tsx`, na função `salvar()`, trocar:

```tsx
      await criarProduto(produto);
      router.push(`/resultado?id=${produto.id}&novo=1`);
```

por:

```tsx
      await criarProduto(produto);
      // ?cores liga o modo orçamento da nota (pra quem é? + negociação +
      // vender). A peça acabou de nascer, então vai com as cores dela.
      const cores = produto.coresIds.join(",");
      router.push(`/resultado?id=${produto.id}&novo=1&cores=${cores}`);
```

- [ ] **Step 2: Frase de festa na nota da peça nova**

Em `app/resultado/page.tsx`, dentro do bloco `{ehOrcamento && (`, inserir a frase como **primeiro filho** do `<div className="mx-auto mb-8 max-w-md space-y-6">`, antes do `<div>` do "Pra quem é?".

Trocar:

```tsx
      {ehOrcamento && (
        <div className="mx-auto mb-8 max-w-md space-y-6">
          <div>
            <h2 className="display mb-3 text-xl font-bold text-tinta">
              Pra quem é?
            </h2>
```

por:

```tsx
      {ehOrcamento && (
        <div className="mx-auto mb-8 max-w-md space-y-6">
          {ehNovo && (
            <div className="animate-pop rounded-2xl border-2 border-neon/40 bg-neon/10 p-4 text-center">
              <p className="display text-lg font-bold text-tinta">
                {produto.nome} entrou na fábrica!
              </p>
              <p className="mt-0.5 font-bold text-mute">
                Já quer fazer o primeiro orçamento?
              </p>
            </div>
          )}
          <div>
            <h2 className="display mb-3 text-xl font-bold text-tinta">
              Pra quem é?
            </h2>
```

(`produto` já está garantido não-nulo aqui: o guard `if (!resultado || !resultadoNota || !produto || !config || !alvo) return <Carregando />;` roda antes deste `return`.)

- [ ] **Step 3: Typecheck / build**

Parar o `npm run dev` se estiver rodando. Então:

Run: `npm run build`
Expected: build passa sem erro.

- [ ] **Step 4: Manual check no app**

Run: `npm run dev`, logar, criar um produto novo (`/novo`) até o fim.
Conferir depois de "Salvar produto":
- Cai numa tela de orçamento (não na notinha só-pra-ver): tem "Pra quem é?", o teste de negociação e os botões Vendido / Apenas orçamento.
- A frase "{nome} entrou na fábrica! Já quer fazer o primeiro orçamento?" aparece no topo.
- O valor do teste de negociação já vem no preço indicado (peça nova, sem venda anterior).
- Confete de peça nova continua disparando.

- [ ] **Step 5: Commit**

```bash
git add app/novo/page.tsx app/resultado/page.tsx
git commit -m "$(cat <<'EOF'
Criar produto já cai no orçamento, com frase de festa

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final integration check

- [ ] Rodar a suíte inteira: `npm test` → tudo verde (nada de preço quebrou).
- [ ] `npm run build` limpo (com o dev server parado).
- [ ] Passada manual do fluxo ponta a ponta: criar peça → cai no orçamento com a frase → marca "Vendido" → volta pra fábrica → o card daquela peça agora mostra "1 vendido — ver quem comprou" → abre a janelinha e vê a unidade (nome, valor, ganhou/falta).

---

## Self-Review (do autor do plano)

**Cobertura da spec:**
- Parte A (novo → orçamento) → Task 3, Step 1. ✓
- Frase de festa (`ehNovo && ehOrcamento`) → Task 3, Step 2. ✓
- Contador "N vendidos" no card só com ≥1 venda → Task 2, Step 4. ✓
- Janelinha read-only com nome/valor/pago → Task 2, Steps 1 e 5. ✓
- Componente novo `EspecificacoesProduto` → Task 2, Step 1. ✓
- Base do valor = último preço vendido (sem mudança) → não requer task; `precoBaseDaVenda` intocado. ✓
- Linguagem "ver quem comprou" no lugar de "especificações" → Task 2, Step 4. ✓
- O que NÃO muda (calc, /orcamento, aba Vendidos, modo só-ver) → nenhuma task toca esses arquivos. ✓

**Consistência de tipos:** `vendasDaPeca(vendas, produtoId): Venda[]` e `rotuloVendidos(n): string` usados com a mesma assinatura em Task 2 (card e dialog) e definidos em Task 1. `EspecificacoesProduto` recebe `{ vendas, clientes, cores }` — os três existem no estado da fábrica. ✓

**Placeholders:** nenhum "TBD/TODO"; todo passo de código traz o código completo. ✓
