# Notinha do Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à tela `/resultado` uma segunda notinha — um orçamento pro cliente, sem nenhum custo nem lucro — que sai da tela como imagem PNG pro WhatsApp, pra galeria de fotos ou pra download.

**Architecture:** A notinha do cliente é desenhada num `<canvas>` por uma função pura de desenho, e esse mesmo canvas é o preview na tela — o que a criança vê é literalmente o arquivo que o cliente recebe. Os dados vêm de um objeto (`DadosOrcamento`) que **não tem campo de custo nem de lucro**, então vazar número interno é impossível por construção. A saída usa a bandeja de compartilhar do sistema quando existe, e cai pra download quando não existe.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Vitest. Canvas 2D nativo — **nenhuma dependência nova**.

Spec: [`docs/superpowers/specs/2026-07-19-notinha-do-cliente-design.md`](../specs/2026-07-19-notinha-do-cliente-design.md)

## Global Constraints

- **Nenhuma dependência nova.** Nada de `html2canvas`, `html-to-image`, `satori`. Se um passo parecer pedir uma lib, o passo está errado.
- **A notinha do cliente nunca mostra:** custo de material, energia, desgaste, embalagem, reserva pra erros, custo total, margem ou lucro.
- **Público-alvo é uma criança de 10 anos:** fonte e botão grandes (mínimo 48px de altura), zero jargão, pt-BR com vírgula no decimal.
- **Nada de emoji** em botão, rótulo, erro ou título de bloco. Emoji só em ponto de festa (hoje são 4 no app inteiro).
- **Nada de `alert()` ou `confirm()`** — avisos usam `components/Dialogo.tsx`.
- **Dinheiro** sempre via `brl()` de `lib/format.ts` e sempre em fonte mono (`--font-mono`).
- **Cores do papel** (valores exatos de `app/globals.css`): `--papel` `#fffdf6`, `--papel-tinta` `#40372a`, `--papel-suave` `#9c9078`, verde do carimbo `#0f9d6e`, fundo da tela `#f7f7f7`.
- **Nunca rodar `npm run build` com o dev server ligado** — os dois compartilham `.next/` e corrompem.
- Testes: `npm test` (Vitest). Comentários e nomes em pt-BR, seguindo o código existente.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/orcamento.ts` (criar) | Os **dados** da notinha do cliente. Puro, sem DOM. Monta `DadosOrcamento`, formata data, gera nome de arquivo e o texto pro leitor de tela. |
| `lib/orcamento.test.ts` (criar) | Testa o acima, incluindo a garantia de que nenhum custo/lucro entra no objeto. |
| `lib/notinha-desenho.ts` (criar) | O **desenho** no canvas. Uma passada de medição e uma de pintura, pela mesma função, pra altura nunca sair de sincronia com o conteúdo. |
| `lib/notinha-desenho.test.ts` (criar) | Testa a quebra de linha do nome da peça (a única parte pura). |
| `lib/compartilhar.ts` (criar) | A **saída**: canvas → PNG → bandeja do sistema ou download. |
| `lib/compartilhar.test.ts` (criar) | Testa a decisão bandeja/download e o cancelamento. |
| `components/NotinhaInterna.tsx` (criar) | A notinha de hoje, recortada de `app/resultado/page.tsx` **sem mudança de comportamento**. |
| `components/NotinhaCliente.tsx` (criar) | O `<canvas>` + o botão de exportar. |
| `app/resultado/page.tsx` (modificar) | Fica só com carregar dados e posicionar as duas notinhas lado a lado. |

---

### Task 1: Os dados do orçamento (`lib/orcamento.ts`)

**Files:**
- Create: `lib/orcamento.ts`
- Test: `lib/orcamento.test.ts`

**Interfaces:**
- Consumes: `acharCor(corId, cores)` de `lib/calc-produto.ts`; `EMPRESA_PADRAO` de `lib/defaults.ts`; `brl()` de `lib/format.ts`; tipos `Produto`, `Cor`, `ResultadoCalculo` de `lib/types.ts`.
- Produces:
  - `interface DadosOrcamento { empresa: string; produto: string; cores: string; preco: number; data: Date }`
  - `montarOrcamento(produto: Produto, resultado: ResultadoCalculo, cores: Cor[], nomeEmpresa: string, hoje: Date): DadosOrcamento`
  - `dataBR(d: Date): string`
  - `nomeDoArquivo(nomeProduto: string): string`
  - `textoDaNotinha(d: DadosOrcamento): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `lib/orcamento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  montarOrcamento,
  dataBR,
  nomeDoArquivo,
  textoDaNotinha,
} from "./orcamento";
import { brl } from "./format";
import type { Cor, Produto, ResultadoCalculo } from "./types";

const CORES: Cor[] = [
  { id: "roxo", nome: "Roxo", hex: "#70f", tipo: "basica", precoRoloKg: 105 },
  { id: "verde", nome: "Verde", hex: "#0f9", tipo: "basica", precoRoloKg: 105 },
];

const PRODUTO: Produto = {
  id: "p1",
  nome: "Dinossauro",
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

const HOJE = new Date(2026, 6, 19); // 19/07/2026 no fuso local

describe("montar o orçamento do cliente", () => {
  it("junta os nomes das cores com +", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja da Julia", HOJE);
    expect(d.cores).toBe("Roxo + Verde");
  });

  it("usa o preço de venda do resultado, não o preço base", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja da Julia", HOJE);
    expect(d.preco).toBe(25);
  });

  it("cai no nome padrão quando a empresa está vazia", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "   ", HOJE);
    expect(d.empresa).toBe("Minha Fábrica");
  });

  it("peça sem nome não vira notinha em branco", () => {
    const semNome = { ...PRODUTO, nome: "  " };
    const d = montarOrcamento(semNome, RESULTADO, CORES, "Loja", HOJE);
    expect(d.produto).toBe("Peça sem nome");
  });

  it("peça sem cor não quebra", () => {
    const semCor = { ...PRODUTO, coresIds: [] };
    const d = montarOrcamento(semCor, RESULTADO, CORES, "Loja", HOJE);
    expect(d.cores).toBe("");
  });

  // O teste que mais importa: o cliente não pode ver número de dentro da
  // fábrica. Se alguém um dia acrescentar um campo de custo aqui, isso quebra.
  it("não carrega nenhum número de custo ou lucro", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE);
    expect(Object.keys(d).sort()).toEqual([
      "cores",
      "data",
      "empresa",
      "preco",
      "produto",
    ]);
    const texto = JSON.stringify(d);
    for (const proibido of [9.79, 15.21, 4.2, 0.6, 1.1, 0.89, 24.5]) {
      expect(texto).not.toContain(String(proibido));
    }
  });
});

describe("data em português", () => {
  it("escreve dia/mês/ano com zero à esquerda", () => {
    expect(dataBR(new Date(2026, 6, 19))).toBe("19/07/2026");
    expect(dataBR(new Date(2026, 0, 5))).toBe("05/01/2026");
  });
});

describe("nome do arquivo", () => {
  it("tira acento, espaço e maiúscula", () => {
    expect(nomeDoArquivo("Dinossauro Roxão")).toBe("orcamento-dinossauro-roxao.png");
  });

  it("não deixa traço sobrando nas pontas", () => {
    expect(nomeDoArquivo("  !!Vaso!!  ")).toBe("orcamento-vaso.png");
  });

  it("nome que vira nada ainda dá um arquivo válido", () => {
    expect(nomeDoArquivo("???")).toBe("orcamento-peca.png");
  });
});

describe("texto pro leitor de tela", () => {
  it("descreve a notinha inteira numa frase", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja da Julia", HOJE);
    // brl() vem do Intl, que usa espaço fino em vez de espaço comum em
    // algumas versões do Node — comparar com string crua quebraria à toa.
    expect(textoDaNotinha(d)).toBe(
      `Orçamento da Loja da Julia: Dinossauro, nas cores Roxo + Verde, ` +
        `preço ${brl(25)}, em 19/07/2026.`
    );
  });

  it("sem cor, não sobra vírgula solta", () => {
    const semCor = { ...PRODUTO, coresIds: [] };
    const d = montarOrcamento(semCor, RESULTADO, CORES, "Loja", HOJE);
    expect(textoDaNotinha(d)).toBe(
      `Orçamento da Loja: Dinossauro, preço ${brl(25)}, em 19/07/2026.`
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/orcamento.test.ts`
Expected: FAIL — `Failed to resolve import "./orcamento"`.

- [ ] **Step 3: Escrever `lib/orcamento.ts`**

```ts
import type { Cor, Produto, ResultadoCalculo } from "./types";
import { acharCor } from "./calc-produto";
import { EMPRESA_PADRAO } from "./defaults";
import { brl } from "./format";

/**
 * Tudo que a notinha do CLIENTE mostra — e nada além disso.
 *
 * Repare no que não existe aqui: custo, margem, lucro. Isso é de propósito.
 * A regra "o cliente não vê número de dentro da fábrica" mora nesta interface,
 * não num `if` lá na tela: o dado simplesmente não chega até o desenho.
 */
export interface DadosOrcamento {
  empresa: string;
  produto: string;
  /** nomes das cores já juntados, ex: "Roxo + Verde". "" se não tiver cor. */
  cores: string;
  preco: number;
  data: Date;
}

/**
 * `hoje` entra por parâmetro em vez de `new Date()` aqui dentro pra função
 * continuar pura — senão o teste dependeria do relógio da máquina.
 */
export function montarOrcamento(
  produto: Produto,
  resultado: ResultadoCalculo,
  cores: Cor[],
  nomeEmpresa: string,
  hoje: Date
): DadosOrcamento {
  return {
    empresa: nomeEmpresa.trim() || EMPRESA_PADRAO,
    produto: produto.nome.trim() || "Peça sem nome",
    cores: produto.coresIds.map((id) => acharCor(id, cores).nome).join(" + "),
    preco: resultado.precoVenda,
    data: hoje,
  };
}

/** 19/07/2026 */
export function dataBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** "Dinossauro Roxão" → "orcamento-dinossauro-roxao.png" */
export function nomeDoArquivo(nomeProduto: string): string {
  const slug = nomeProduto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira o acento, mantém a letra
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `orcamento-${slug || "peca"}.png`;
}

/**
 * A notinha é uma imagem, e imagem não tem texto pra leitor de tela. Esta
 * frase é o `aria-label` do canvas.
 */
export function textoDaNotinha(d: DadosOrcamento): string {
  const cores = d.cores ? `, nas cores ${d.cores}` : "";
  return `Orçamento da ${d.empresa}: ${d.produto}${cores}, preço ${brl(
    d.preco
  )}, em ${dataBR(d.data)}.`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- lib/orcamento.test.ts`
Expected: PASS — 12 testes.

- [ ] **Step 5: Commitar**

```bash
git add lib/orcamento.ts lib/orcamento.test.ts
git commit -m "Dados do orçamento do cliente, sem custo nem lucro"
```

---

### Task 2: O desenho no canvas (`lib/notinha-desenho.ts`)

**Files:**
- Create: `lib/notinha-desenho.ts`
- Test: `lib/notinha-desenho.test.ts`

**Interfaces:**
- Consumes: `DadosOrcamento`, `dataBR` de `lib/orcamento.ts`; `brl` de `lib/format.ts`.
- Produces:
  - `quebrarEmLinhas(texto: string, larguraMax: number, medir: (t: string) => number, maxLinhas?: number): string[]`
  - `desenharOrcamento(canvas: HTMLCanvasElement, dados: DadosOrcamento): void` — dimensiona e pinta o canvas recebido.
  - `LARGURA: number` (360), `ESCALA: number` (3)

**Por que uma função `percorrer` que faz duas passadas:** a altura do papel depende de quantas linhas o nome da peça ocupa. Se a conta da altura e o desenho fossem dois trechos de código separados, qualquer ajuste num sem o outro deixaria sobra ou corte no papel. Aqui a **mesma** função roda duas vezes — a primeira só medindo (`pintar = false`), a segunda pintando — então altura e conteúdo não têm como divergir.

- [ ] **Step 1: Escrever o teste que falha**

Só a quebra de linha é pura e testável sem navegador; o resto se verifica com print na Task 7. Criar `lib/notinha-desenho.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { quebrarEmLinhas } from "./notinha-desenho";

// Régua de mentira: cada caractere mede 10. Assim o teste não depende de fonte.
const medir = (t: string) => t.length * 10;

describe("quebrar o nome da peça em linhas", () => {
  it("nome curto cabe numa linha só", () => {
    expect(quebrarEmLinhas("DINOSSAURO", 200, medir)).toEqual(["DINOSSAURO"]);
  });

  it("nome comprido quebra na palavra, sem cortar no meio", () => {
    expect(quebrarEmLinhas("VASO DE FLOR AZUL", 130, medir)).toEqual([
      "VASO DE FLOR",
      "AZUL",
    ]);
  });

  it("passou de duas linhas, o resto vira reticências", () => {
    const linhas = quebrarEmLinhas("UM DOIS TRES QUATRO CINCO SEIS", 100, medir);
    expect(linhas).toHaveLength(2);
    expect(linhas[1].endsWith("…")).toBe(true);
  });

  it("nunca devolve mais linhas que o máximo pedido", () => {
    const linhas = quebrarEmLinhas("A B C D E F G H", 15, medir, 3);
    expect(linhas.length).toBeLessThanOrEqual(3);
  });

  it("texto vazio devolve uma linha vazia, não um array vazio", () => {
    expect(quebrarEmLinhas("   ", 200, medir)).toEqual([""]);
  });

  it("palavra sozinha maior que a linha não entra em loop infinito", () => {
    expect(quebrarEmLinhas("SUPERCALIFRAGILISTICO", 50, medir)).toEqual([
      "SUPERCALIFRAGILISTICO",
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/notinha-desenho.test.ts`
Expected: FAIL — `Failed to resolve import "./notinha-desenho"`.

- [ ] **Step 3: Escrever `lib/notinha-desenho.ts`**

```ts
import { brl } from "./format";
import { dataBR, type DadosOrcamento } from "./orcamento";

/**
 * A notinha do cliente, desenhada à mão no canvas.
 *
 * É canvas e não HTML porque o arquivo que vai pro WhatsApp precisa ser uma
 * imagem de verdade. Desenhando direto, o que aparece na tela é o próprio
 * arquivo — não existe "a foto saiu diferente da tela".
 *
 * Todas as medidas abaixo são em pontos lógicos; o canvas real é ESCALA vezes
 * maior, pra não sair borrado no celular nem no zoom do zap.
 */
export const LARGURA = 360;
export const ESCALA = 3;

const MARGEM = 28;
const TOPO = 30;
const RODAPE = 26;
/** altura do ziguezague do rodapé, igual ao .recibo::after do globals.css */
const DENTE = 8;
const CARIMBO_ALTURA = 64;
const CANTO = 14;

const PAPEL = "#fffdf6";
const TINTA = "#40372a";
const SUAVE = "#9c9078";
const VERDE = "#0f9d6e";
const FUNDO = "#f7f7f7";
const TRACEJADO = "rgba(64, 55, 42, 0.28)";

const F_DISPLAY = '"Fredoka", "Rubik", system-ui, sans-serif';
const F_CORPO = '"Rubik", ui-sans-serif, system-ui, sans-serif';
const F_MONO =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Quebra o texto em no máximo `maxLinhas`, cortando entre palavras. O que não
 * couber vira "…" no fim da última linha.
 *
 * `medir` entra por parâmetro (em vez de a função pegar o canvas sozinha) só
 * pra isto poder ser testado sem navegador.
 */
export function quebrarEmLinhas(
  texto: string,
  larguraMax: number,
  medir: (t: string) => number,
  maxLinhas = 2
): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [""];

  const linhas: string[] = [];
  let atual = palavras[0];

  for (let i = 1; i < palavras.length; i++) {
    const tentativa = `${atual} ${palavras[i]}`;
    if (medir(tentativa) <= larguraMax) {
      atual = tentativa;
    } else if (linhas.length + 1 < maxLinhas) {
      linhas.push(atual);
      atual = palavras[i];
    } else {
      // Acabaram as linhas: o resto do nome vira reticências.
      atual = `${atual}…`;
      break;
    }
  }

  linhas.push(atual);
  return linhas;
}

/** O carimbo verde com o preço — o irmão do carimbo do lucro da notinha interna. */
function carimbo(ctx: CanvasRenderingContext2D, texto: string, cx: number, cy: number) {
  const larguraMax = LARGURA - MARGEM * 2 - 12;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-3 * Math.PI) / 180);

  // Preço grande demais encolhe em vez de furar o papel.
  let tamanho = 24;
  ctx.letterSpacing = "0px";
  ctx.font = `700 ${tamanho}px ${F_MONO}`;
  while (ctx.measureText(texto).width + 34 > larguraMax && tamanho > 14) {
    tamanho -= 1;
    ctx.font = `700 ${tamanho}px ${F_MONO}`;
  }

  const largura = Math.min(
    larguraMax,
    Math.max(150, ctx.measureText(texto).width + 34)
  );
  const altura = 54;

  ctx.strokeStyle = VERDE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-largura / 2, -altura / 2, largura, altura, 11);
  ctx.stroke();

  ctx.fillStyle = VERDE;
  ctx.textAlign = "center";
  ctx.font = `800 9px ${F_CORPO}`;
  ctx.letterSpacing = "3px";
  ctx.fillText("PREÇO", 0, -altura / 2 + 18);

  ctx.font = `700 ${tamanho}px ${F_MONO}`;
  ctx.letterSpacing = "0px";
  ctx.fillText(texto, 0, altura / 2 - 13);

  ctx.restore();
}

/**
 * Passa por todos os blocos da notinha, de cima pra baixo, e devolve a altura
 * total. Com `pintar = false` só mede; com `true` desenha. É a mesma função nas
 * duas vezes de propósito: assim a altura do papel não tem como discordar do
 * que foi desenhado nele.
 */
function percorrer(
  ctx: CanvasRenderingContext2D,
  dados: DadosOrcamento,
  linhasNome: string[],
  pintar: boolean
): number {
  const meio = LARGURA / 2;
  let y = TOPO;

  if (pintar) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = TINTA;
    ctx.font = `700 19px ${F_DISPLAY}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(`★ ${dados.empresa.toUpperCase()} ★`, meio, y + 15);
  }
  y += 22;

  if (pintar) {
    ctx.fillStyle = SUAVE;
    ctx.font = `700 10px ${F_CORPO}`;
    ctx.letterSpacing = "3px";
    ctx.fillText("ORÇAMENTO", meio, y + 10);
  }
  y += 18;

  if (pintar) {
    ctx.strokeStyle = TRACEJADO;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(MARGEM, y + 9);
    ctx.lineTo(LARGURA - MARGEM, y + 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  y += 20;

  if (pintar) {
    ctx.fillStyle = TINTA;
    ctx.font = `800 17px ${F_CORPO}`;
    ctx.letterSpacing = "0px";
  }
  for (const linha of linhasNome) {
    if (pintar) ctx.fillText(linha, meio, y + 17);
    y += 22;
  }

  if (dados.cores) {
    if (pintar) {
      ctx.fillStyle = SUAVE;
      ctx.font = `600 13px ${F_CORPO}`;
      ctx.fillText(dados.cores, meio, y + 13);
    }
    y += 20;
  }

  y += 24; // folga antes do carimbo
  if (pintar) carimbo(ctx, brl(dados.preco), meio, y + CARIMBO_ALTURA / 2);
  y += CARIMBO_ALTURA;

  if (pintar) {
    ctx.fillStyle = SUAVE;
    ctx.font = `600 11px ${F_CORPO}`;
    ctx.letterSpacing = "1px";
    ctx.fillText(`orçamento de ${dataBR(dados.data)}`, meio, y + 22);
    ctx.letterSpacing = "0px";
  }
  y += 30;

  return y + RODAPE + DENTE;
}

/** O papel: retângulo de cantos arredondados em cima e ziguezague embaixo. */
function papel(ctx: CanvasRenderingContext2D, altura: number) {
  const corpo = altura - DENTE;

  ctx.fillStyle = PAPEL;
  ctx.beginPath();
  ctx.roundRect(0, 0, LARGURA, corpo, [CANTO, CANTO, 0, 0]);
  ctx.fill();

  // Dentes de largura exata pra não sobrar meio dente na borda direita.
  const passo = LARGURA / Math.round(LARGURA / 11);
  ctx.beginPath();
  for (let x = 0; x < LARGURA - 0.01; x += passo) {
    ctx.moveTo(x, corpo);
    ctx.lineTo(x + passo / 2, corpo + DENTE);
    ctx.lineTo(x + passo, corpo);
  }
  ctx.fill();
}

/** Dimensiona e pinta o canvas com a notinha do cliente. */
export function desenharOrcamento(
  canvas: HTMLCanvasElement,
  dados: DadosOrcamento
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Medir com a fonte e o espaçamento certos, senão a quebra de linha erra.
  ctx.letterSpacing = "0px";
  ctx.font = `800 17px ${F_CORPO}`;
  const linhasNome = quebrarEmLinhas(
    dados.produto.toUpperCase(),
    LARGURA - MARGEM * 2,
    (t) => ctx.measureText(t).width
  );

  const altura = Math.ceil(percorrer(ctx, dados, linhasNome, false));

  // Mexer em width/height zera o contexto — por isso a medição vem antes.
  canvas.width = LARGURA * ESCALA;
  canvas.height = altura * ESCALA;
  ctx.scale(ESCALA, ESCALA);

  // Fundo opaco: PNG transparente fica preto em alguns visualizadores de zap.
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, LARGURA, altura);

  papel(ctx, altura);
  percorrer(ctx, dados, linhasNome, true);
}
```

Nota sobre `ctx.letterSpacing`: existe no Chrome 99+, Safari 17.4+ e Firefox 121+. Em navegador mais velho a atribuição vira uma propriedade solta e é simplesmente ignorada — a notinha sai sem o espacejamento, que é degradação aceitável, não erro.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- lib/notinha-desenho.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Conferir que o TypeScript aceita**

Run: `npx tsc --noEmit`
Expected: sem erro. (Se `roundRect` ou `letterSpacing` reclamarem, é sinal de `lib` do `tsconfig.json` antiga — resolver com `(ctx as any).letterSpacing` só na linha que reclamar, nunca desligando checagem do arquivo inteiro.)

- [ ] **Step 6: Commitar**

```bash
git add lib/notinha-desenho.ts lib/notinha-desenho.test.ts
git commit -m "Desenho da notinha do cliente no canvas"
```

---

### Task 3: A saída — bandeja do sistema ou download (`lib/compartilhar.ts`)

**Files:**
- Create: `lib/compartilhar.ts`
- Test: `lib/compartilhar.test.ts`

**Interfaces:**
- Consumes: nada do projeto.
- Produces:
  - `podeCompartilhar(): boolean`
  - `compartilharImagem(canvas: HTMLCanvasElement, nomeArquivo: string, titulo: string): Promise<"compartilhado" | "baixado" | "cancelado">`

- [ ] **Step 1: Escrever os testes que falham**

Criar `lib/compartilhar.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compartilharImagem, podeCompartilhar } from "./compartilhar";

/** Canvas de mentira: só precisa saber devolver um Blob. */
function canvasFalso(): HTMLCanvasElement {
  return {
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(new Blob(["png"], { type: "image/png" })),
  } as unknown as HTMLCanvasElement;
}

const navOriginal = globalThis.navigator;

function fingirNavegador(props: Record<string, unknown>) {
  Object.defineProperty(globalThis, "navigator", {
    value: props,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  // O caminho de download mexe no DOM; o jeito mais simples é neutralizar.
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:falso",
    revokeObjectURL: () => {},
  });
  vi.stubGlobal("document", {
    createElement: () => ({ href: "", download: "", click: () => {} }),
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: navOriginal,
    configurable: true,
    writable: true,
  });
  vi.unstubAllGlobals();
});

describe("para onde vai a notinha", () => {
  it("com bandeja do sistema, compartilha", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    fingirNavegador({ canShare: () => true, share });

    const r = await compartilharImagem(canvasFalso(), "orcamento-x.png", "Orçamento");

    expect(r).toBe("compartilhado");
    expect(share).toHaveBeenCalledOnce();
    const arquivo = share.mock.calls[0][0].files[0];
    expect(arquivo.name).toBe("orcamento-x.png");
    expect(arquivo.type).toBe("image/png");
  });

  it("sem bandeja, baixa o arquivo", async () => {
    fingirNavegador({});
    const r = await compartilharImagem(canvasFalso(), "orcamento-x.png", "Orçamento");
    expect(r).toBe("baixado");
  });

  it("bandeja que recusa o arquivo cai pro download", async () => {
    const share = vi.fn();
    fingirNavegador({ canShare: () => false, share });

    const r = await compartilharImagem(canvasFalso(), "orcamento-x.png", "Orçamento");

    expect(r).toBe("baixado");
    expect(share).not.toHaveBeenCalled();
  });

  // Desistir de mandar não é erro — não pode virar tela de aviso.
  it("desistir na bandeja devolve cancelado, sem erro", async () => {
    const abortou = new DOMException("cancelou", "AbortError");
    fingirNavegador({ canShare: () => true, share: vi.fn().mockRejectedValue(abortou) });

    const r = await compartilharImagem(canvasFalso(), "orcamento-x.png", "Orçamento");

    expect(r).toBe("cancelado");
  });

  it("erro de verdade sobe pra quem chamou", async () => {
    fingirNavegador({
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new Error("deu pau")),
    });

    await expect(
      compartilharImagem(canvasFalso(), "orcamento-x.png", "Orçamento")
    ).rejects.toThrow("deu pau");
  });

  it("canvas que não gera imagem vira erro claro", async () => {
    fingirNavegador({});
    const vazio = {
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;

    await expect(
      compartilharImagem(vazio, "orcamento-x.png", "Orçamento")
    ).rejects.toThrow(/imagem/i);
  });
});

describe("podeCompartilhar", () => {
  it("true quando o navegador tem as duas funções", () => {
    fingirNavegador({ canShare: () => true, share: () => {} });
    expect(podeCompartilhar()).toBe(true);
  });

  it("false no computador comum", () => {
    fingirNavegador({});
    expect(podeCompartilhar()).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/compartilhar.test.ts`
Expected: FAIL — `Failed to resolve import "./compartilhar"`.

- [ ] **Step 3: Escrever `lib/compartilhar.ts`**

```ts
/**
 * Tirar a notinha da tela e botar no mundo.
 *
 * No celular, `navigator.share` abre a bandeja do próprio sistema — e é lá que
 * moram o WhatsApp e o "Salvar em Fotos". O app não escolhe o destino: quem
 * oferece as opções é o aparelho, que já sabe o que a pessoa tem instalado.
 * No computador não existe bandeja, então baixa o arquivo.
 */

type Bandeja = Navigator & {
  canShare?: (dados: ShareData) => boolean;
  share?: (dados: ShareData) => Promise<void>;
};

/** Só pra decidir o texto do botão antes de a criança clicar. */
export function podeCompartilhar(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Bandeja;
  return typeof nav.canShare === "function" && typeof nav.share === "function";
}

function baixar(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export async function compartilharImagem(
  canvas: HTMLCanvasElement,
  nomeArquivo: string,
  titulo: string
): Promise<"compartilhado" | "baixado" | "cancelado"> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("não consegui gerar a imagem da notinha");

  const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
  const nav = navigator as Bandeja;

  // canShare com o arquivo na mão: tem celular que compartilha texto mas
  // recusa imagem, e aí só perguntar "existe share?" mentiria.
  if (nav.canShare?.({ files: [arquivo] }) && nav.share) {
    try {
      await nav.share({ files: [arquivo], title: titulo });
      return "compartilhado";
    } catch (e) {
      // Fechar a bandeja sem escolher nada não é erro, é ter mudado de ideia.
      if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
      throw e;
    }
  }

  baixar(blob, nomeArquivo);
  return "baixado";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- lib/compartilhar.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commitar**

```bash
git add lib/compartilhar.ts lib/compartilhar.test.ts
git commit -m "Exportar a notinha pela bandeja do sistema ou download"
```

---

### Task 4: Recortar a notinha interna pra um componente

**Files:**
- Create: `components/NotinhaInterna.tsx`
- Modify: `app/resultado/page.tsx`

**Interfaces:**
- Consumes: `Config`, `Cor`, `Produto`, `ResultadoCalculo` de `lib/types.ts`; `acharCor` de `lib/calc-produto.ts`; `brl`, `num` de `lib/format.ts`; `EMPRESA_PADRAO` de `lib/defaults.ts`; `Valor` de `components/Valor.tsx`.
- Produces: `<NotinhaInterna produto={...} config={...} cores={...} resultado={...} empresa={...} />`

**Esta task não muda nada visualmente.** É recorte e colagem. Se algum pixel mudar, alguma coisa saiu errada.

- [ ] **Step 1: Criar `components/NotinhaInterna.tsx`**

Copiar o conteúdo do `<div className="recibo mono">…</div>` de `app/resultado/page.tsx` (linhas 142–222) junto com a função `peso` (linhas 35–42) e os cálculos locais que só ele usa (`horasDec`, `taxaFalhasPct`, `coresUsadas`, `nomesCores`, `varias`, `prejuizo` — linhas 117–122):

```tsx
import { acharCor } from "@/lib/calc-produto";
import { brl, num } from "@/lib/format";
import { EMPRESA_PADRAO } from "@/lib/defaults";
import type { Config, Cor, Produto, ResultadoCalculo, Unidade } from "@/lib/types";
import Valor from "@/components/Valor";

/** Mostra o peso na unidade preferida do produto. */
function peso(gramas: number, unidade: Unidade): string {
  if (unidade === "kg") {
    const kg = gramas / 1000;
    return `${num(kg, kg % 1 === 0 ? 0 : 2)} kg`;
  }
  return `${num(gramas, 0)} g`;
}

/**
 * A notinha de dentro da fábrica: mostra pra onde foi cada centavo e termina
 * no carimbo do lucro. É a única das duas que pode mostrar custo.
 *
 * Tudo aqui dentro mede em `em`: quem manda no tamanho é o font-size fluido de
 * .recibo, que acompanha a largura da tela.
 */
export default function NotinhaInterna({
  produto,
  config,
  cores,
  resultado: r,
  empresa,
}: {
  produto: Produto;
  config: Config;
  cores: Cor[];
  resultado: ResultadoCalculo;
  empresa: string;
}) {
  const horasDec = produto.horas + produto.minutos / 60;
  const taxaFalhasPct = Math.round(config.taxaFalhas * 100);
  const coresUsadas = produto.coresIds.map((cid) => acharCor(cid, cores));
  const nomesCores = coresUsadas.map((c) => c.nome).join(" + ");
  const varias = coresUsadas.length >= 2;
  const prejuizo = r.lucro < 0;

  return (
    <div className="recibo mono">
      <p className="display text-center text-[1.3em] font-bold uppercase tracking-[0.18em]">
        ★ {empresa || EMPRESA_PADRAO} ★
      </p>
      <p className="text-center text-[0.8em] font-bold uppercase tracking-widest text-[color:var(--papel-suave)]">
        nota da fabriquinha 3D
      </p>

      <div className="tracejado my-[1.15em]" />

      <p className="text-[1em] font-extrabold uppercase">{produto.nome}</p>

      <div className="mt-[0.9em] space-y-[0.6em] text-[1em] font-bold">
        <div className="linha-recibo">
          <span className="rotulo uppercase">
            material {varias ? "(média)" : ""} ·{" "}
            {peso(produto.gramas, produto.unidade)}
          </span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoMaterial)}</span>
        </div>
        <p className="-mt-[0.3em] text-[0.85em] text-[color:var(--papel-suave)]">
          {nomesCores}
        </p>
        <div className="linha-recibo">
          <span className="rotulo uppercase">
            energia · {num(horasDec, 1)} h
          </span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoEnergia)}</span>
        </div>
        <div className="linha-recibo">
          <span className="rotulo uppercase">desgaste da impressora</span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoDesgaste)}</span>
        </div>
        <div className="linha-recibo">
          <span className="rotulo uppercase">embalagem</span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoExtras)}</span>
        </div>
        <div className="linha-recibo">
          <span className="rotulo uppercase">
            reserva p/ erros (+{taxaFalhasPct}%)
          </span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoFalhas)}</span>
        </div>
      </div>

      <div className="tracejado my-[1.15em]" />

      <div className="linha-recibo text-[1.1em] font-extrabold">
        <span className="rotulo uppercase">custo total</span>
        <span className="pontos" />
        <span className="valor">{brl(r.custoTotal)}</span>
      </div>
      <div className="linha-recibo mt-[0.6em] text-[1.25em] font-extrabold">
        <span className="rotulo uppercase">vendido por</span>
        <span className="pontos" />
        <span className="valor">{brl(r.precoVenda)}</span>
      </div>

      {/* Carimbo do resultado: rótulo em cima, número embaixo — em uma linha
          só ele encostava nas bordas do papel quando o valor era grande. */}
      <div className="caixa-valor mt-[1.4em] text-center">
        <span className={`carimbo ${prejuizo ? "carimbo-vermelho" : ""}`}>
          <span className="display block text-[0.75em] uppercase tracking-[0.25em]">
            {prejuizo ? "prejuízo" : "seu lucro"}
          </span>
          {/* folga = padding + borda do carimbo, que a régua não enxerga */}
          <Valor
            valor={Math.abs(r.lucro)}
            max="2.2em"
            min="1.15em"
            folga="44px"
            className="block"
          />
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Usar o componente em `app/resultado/page.tsx`**

Em `app/resultado/page.tsx`: apagar a função `peso` (linhas 35–42), apagar as variáveis locais `horasDec`/`taxaFalhasPct`/`coresUsadas`/`nomesCores`/`varias`/`prejuizo` (linhas 117–122), e trocar o bloco `<div className="recibo mono">…</div>` (linhas 142–222) por:

```tsx
<NotinhaInterna
  produto={produto}
  config={config}
  cores={cores}
  resultado={resultado}
  empresa={empresa}
/>
```

Ajustar os imports do topo: acrescentar `import NotinhaInterna from "@/components/NotinhaInterna";` e remover os que ficaram sem uso (`acharCor`, `num`, `EMPRESA_PADRAO`, `Valor`, e o tipo `Unidade`). `brl` também sai: ele só era usado dentro da notinha. Apagar a linha `const r = resultado;`.

- [ ] **Step 3: Conferir que nada quebrou**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro de tipo (nenhum import órfão) e todos os testes passando.

- [ ] **Step 4: Commitar**

```bash
git add components/NotinhaInterna.tsx app/resultado/page.tsx
git commit -m "Recorta a notinha interna pra um componente próprio"
```

---

### Task 5: O componente da notinha do cliente

**Files:**
- Create: `components/NotinhaCliente.tsx`

**Interfaces:**
- Consumes: `desenharOrcamento` de `lib/notinha-desenho.ts`; `compartilharImagem`, `podeCompartilhar` de `lib/compartilhar.ts`; `nomeDoArquivo`, `textoDaNotinha`, `DadosOrcamento` de `lib/orcamento.ts`; `Dialogo` de `components/Dialogo.tsx`.
- Produces: `<NotinhaCliente dados={dadosOrcamento} />` — espera um `DadosOrcamento` **estável** (memoizado pelo pai; ver Task 6).

- [ ] **Step 1: Criar `components/NotinhaCliente.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Dialogo from "./Dialogo";
import { desenharOrcamento } from "@/lib/notinha-desenho";
import { compartilharImagem, podeCompartilhar } from "@/lib/compartilhar";
import {
  nomeDoArquivo,
  textoDaNotinha,
  type DadosOrcamento,
} from "@/lib/orcamento";

/**
 * A notinha que vai pro cliente: um canvas desenhado na hora, mais o botão de
 * mandar. O canvas que aparece na tela é o MESMO que vira arquivo — não existe
 * "na tela estava bonito mas a foto saiu diferente".
 */
export default function NotinhaCliente({ dados }: { dados: DadosOrcamento }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [temBandeja, setTemBandeja] = useState(false);

  // Só depois de montar: no servidor não existe navigator, e decidir o texto
  // do botão durante o render quebraria a hidratação.
  useEffect(() => setTemBandeja(podeCompartilhar()), []);

  useEffect(() => {
    let vivo = true;
    const desenhar = () => {
      if (vivo && canvasRef.current) desenharOrcamento(canvasRef.current, dados);
    };
    desenhar();
    // As fontes vêm do Google Fonts. Se não esperar, a primeira pintura sai em
    // Arial e a notinha fica com cara de documento de banco.
    document.fonts?.ready.then(desenhar).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [dados]);

  const exportar = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || ocupado) return;
    setOcupado(true);
    try {
      await compartilharImagem(
        canvas,
        nomeDoArquivo(dados.produto),
        `Orçamento — ${dados.produto}`
      );
    } catch (e) {
      console.error(e);
      setErro(true);
    } finally {
      setOcupado(false);
    }
  }, [dados, ocupado]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={textoDaNotinha(dados)}
        className="block w-full"
      />

      <button
        onClick={exportar}
        disabled={ocupado}
        className="btn-grande btn-neon mt-6 w-full disabled:opacity-60"
      >
        {temBandeja ? "Mandar pro cliente" : "Baixar a notinha"}
      </button>

      {erro && (
        <Dialogo
          titulo="Não deu certo"
          texto="Não consegui preparar a notinha agora. Tenta de novo?"
          onFechar={() => setErro(false)}
        />
      )}
    </div>
  );
}
```

Repare no que **não** tem aqui: nenhum aviso quando a pessoa fecha a bandeja sem escolher. `compartilharImagem` devolve `"cancelado"` nesse caso, e desistir de mandar não merece uma janelinha.

- [ ] **Step 2: Conferir os tipos**

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 3: Commitar**

```bash
git add components/NotinhaCliente.tsx
git commit -m "Componente da notinha do cliente com botão de mandar"
```

---

### Task 6: As duas notinhas lado a lado

**Files:**
- Modify: `app/resultado/page.tsx`

**Interfaces:**
- Consumes: `NotinhaInterna` (Task 4), `NotinhaCliente` (Task 5), `montarOrcamento` (Task 1).
- Produces: a tela final. Nada é consumido por tasks posteriores.

- [ ] **Step 1: Montar os dados do orçamento na página**

Acrescentar os imports:

```tsx
import NotinhaCliente from "@/components/NotinhaCliente";
import { montarOrcamento } from "@/lib/orcamento";
```

Logo depois do `useMemo` que calcula `resultado` (hoje nas linhas 90–93), acrescentar:

```tsx
// Memoizado porque NotinhaCliente redesenha o canvas toda vez que `dados`
// muda de identidade — sem isto, um objeto novo a cada render viraria um
// loop de repintura.
const dadosOrcamento = useMemo(() => {
  if (!produto || !resultado) return null;
  return montarOrcamento(produto, resultado, cores, empresa, new Date());
}, [produto, resultado, cores, empresa]);
```

- [ ] **Step 2: Trocar o `<main>` pelo layout de duas colunas**

Substituir o `<main className="mx-auto w-full max-w-md">` e seu conteúdo por:

```tsx
<main className="mx-auto w-full max-w-md lg:max-w-4xl">
  <Confete ativo={confete} />

  <div className="mb-4">
    <Link
      href="/fabrica"
      aria-label="Voltar pra fábrica"
      className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
    >
      <IconeCasa size={22} />
    </Link>
  </div>

  {/* As duas notinhas se parecem de longe, e mandar a errada pro cliente
      seria o pior erro possível — por isso cada uma tem nome em cima. */}
  <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-8">
    <section>
      <p className="mb-3 text-center text-base font-extrabold uppercase tracking-wide text-mute">
        só sua
      </p>
      <NotinhaInterna
        produto={produto}
        config={config}
        cores={cores}
        resultado={resultado}
        empresa={empresa}
      />
    </section>

    <section>
      <p className="mb-3 text-center text-base font-extrabold uppercase tracking-wide text-mute">
        pro cliente
      </p>
      {dadosOrcamento && <NotinhaCliente dados={dadosOrcamento} />}
    </section>
  </div>
</main>
```

- [ ] **Step 3: Conferir tipos e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro, todos os testes passando.

- [ ] **Step 4: Commitar**

```bash
git add app/resultado/page.tsx
git commit -m "As duas notinhas lado a lado na tela de resultado"
```

---

### Task 7: Ver com os próprios olhos (Playwright)

**Files:**
- Create (temporário, **apagado no fim desta task**): `app/preview/page.tsx`
- Modify (temporário, **desfeito no fim desta task**): `lib/rotas.ts`
- Create: `<scratchpad>/print.mjs`

Desenho de canvas é exatamente o tipo de coisa que sai torta se ninguém olhar: linha encostando na borda, carimbo cortado, papel com sobra embaixo. Seis rodadas de design já foram rejeitadas neste projeto por chute sem print.

A tela `/resultado` exige conta assinada e o middleware chuta quem não tem sessão. A saída conhecida é uma rota `/preview` temporária com dados de mentira.

- [ ] **Step 1: Criar a rota temporária**

Criar `app/preview/page.tsx`:

```tsx
"use client";

import NotinhaInterna from "@/components/NotinhaInterna";
import NotinhaCliente from "@/components/NotinhaCliente";
import { montarOrcamento } from "@/lib/orcamento";
import { CONFIG_PADRAO } from "@/lib/defaults";
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

const DADOS = montarOrcamento(
  PRODUTO,
  RESULTADO,
  CORES,
  "Loja da Julia",
  new Date(2026, 6, 19)
);

export default function Preview() {
  return (
    <main className="mx-auto w-full max-w-md lg:max-w-4xl">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-8">
        <section>
          <p className="mb-3 text-center text-base font-extrabold uppercase tracking-wide text-mute">
            só sua
          </p>
          <NotinhaInterna
            produto={PRODUTO}
            config={CONFIG_PADRAO}
            cores={CORES}
            resultado={RESULTADO}
            empresa="Loja da Julia"
          />
        </section>
        <section>
          <p className="mb-3 text-center text-base font-extrabold uppercase tracking-wide text-mute">
            pro cliente
          </p>
          <NotinhaCliente dados={DADOS} />
        </section>
      </div>
    </main>
  );
}
```

Em `lib/rotas.ts`, acrescentar `"/preview"` à constante `PUBLICAS`:

```ts
const PUBLICAS = ["/login", "/auth", "/api", "/nova-senha", "/preview"];
```

- [ ] **Step 2: Subir o dev server**

Run: `npm run dev`
Expected: `ready on http://localhost:3000`. **Não rodar `npm run build` enquanto isso estiver ligado** — os dois compartilham `.next/` e corrompem.

- [ ] **Step 3: Escrever o script de print**

No diretório de scratchpad: `npm i --no-save playwright`, e criar `print.mjs`:

```js
import { chromium } from "playwright";

const TELAS = [
  { nome: "desktop", width: 1440, height: 900 },
  { nome: "tablet", width: 820, height: 1180 },
  { nome: "celular", width: 390, height: 844 },
];

const navegador = await chromium.launch();
for (const t of TELAS) {
  // É `viewport`, NÃO `viewportSize`: o segundo é ignorado em silêncio e você
  // mede 1280 achando que mediu 1440.
  const pagina = await navegador.newPage({
    viewport: { width: t.width, height: t.height },
  });
  await pagina.goto("http://localhost:3000/preview", { waitUntil: "networkidle" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: `notinhas-${t.nome}.png`, fullPage: true });

  const vazou = await pagina.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  console.log(`${t.nome}: vazamento horizontal = ${vazou}`);
  await pagina.close();
}
await navegador.close();
```

Run: `node print.mjs`
Expected: três PNGs e `vazamento horizontal = false` nas três larguras.

- [ ] **Step 4: Olhar os três prints de verdade**

Abrir cada PNG com a ferramenta Read e conferir, item por item:

1. No desktop as duas notinhas estão **lado a lado**; no celular, empilhadas com a interna em cima.
2. A notinha do cliente **não mostra** material, energia, desgaste, embalagem, reserva, custo total nem lucro.
3. O nome da loja não encosta nas bordas do papel.
4. O carimbo verde está inteiro, inclinado, com "PREÇO" em cima e `R$ 25,00` embaixo, sem texto estourando a borda.
5. O ziguezague do rodapé fecha a largura toda, sem meio dente sobrando na direita.
6. Não sobra faixa de papel vazia embaixo da data (sinal de altura calculada a mais).
7. As duas notinhas parecem da mesma família — mesmo papel, mesmo tracejado.
8. O botão tem pelo menos 48px de altura e diz "Baixar a notinha" (no desktop não existe bandeja).

Se algo estiver torto, ajustar as constantes no topo de `lib/notinha-desenho.ts`, rodar `node print.mjs` de novo e olhar outra vez. Repetir até os oito itens passarem.

- [ ] **Step 5: Testar o download de verdade**

Com o dev server ligado, abrir `http://localhost:3000/preview` no navegador, clicar em "Baixar a notinha" e abrir o PNG baixado.
Expected: o arquivo é idêntico ao que estava na tela, em alta resolução (1080px de largura), com fundo opaco (nada transparente), e o nome do arquivo é `orcamento-dinossauro-roxo.png`.

- [ ] **Step 6: DESFAZER a rota temporária**

Isto não é opcional — `/preview` pública em produção mostra a tela da fábrica pra qualquer um:

```bash
rm app/preview/page.tsx
git checkout lib/rotas.ts
git status --short
```
Expected: `git status --short` não lista nem `app/preview/page.tsx` nem `lib/rotas.ts`.

- [ ] **Step 7: Verificação final**

Com o dev server **desligado**:

```bash
npm test && npx tsc --noEmit && npm run build
```
Expected: todos os testes passando, sem erro de tipo, build concluído.

- [ ] **Step 8: Commitar os ajustes de desenho (se houve algum)**

```bash
git add lib/notinha-desenho.ts
git commit -m "Ajusta as medidas da notinha do cliente conforme os prints"
```

Se a Task 7 não precisou mexer em nada, não há o que commitar — seguir em frente.

---

## Verificação de que o plano cobre o spec

| Requisito do spec | Onde |
|---|---|
| Orçamento, não comprovante ("ORÇAMENTO" no cabeçalho, "orçamento de DD/MM/AAAA" no pé) | Task 2 |
| Mostra loja, peça, cores, preço, data | Tasks 1 e 2 |
| Nome da loja com fallback pro `EMPRESA_PADRAO` | Task 1 |
| Nome da peça em caixa alta, quebrando em duas linhas | Task 2 |
| Cores juntadas com ` + ` | Task 1 |
| Preço = `resultado.precoVenda` | Task 1 |
| Carimbo verde reaproveitando o visual do `.carimbo` | Task 2 |
| Sem frase de fecho | Task 2 (não existe no desenho) |
| Nunca mostra custo/margem/lucro | Task 1 (a interface não tem os campos; teste garante) |
| Lado a lado no desktop, empilhado no celular, `max-w-4xl` | Task 6 |
| Rótulos "só sua" e "pro cliente" | Task 6 |
| Notinha interna sem mudança de comportamento | Task 4 |
| Botão adapta o rótulo (bandeja vs download) | Tasks 3 e 5 |
| Nome do arquivo `orcamento-<slug>.png` | Task 1 |
| Cancelar não é erro; erro real usa `Dialogo` | Tasks 3 e 5 |
| Canvas com `role="img"` e `aria-label` | Tasks 1 e 5 |
| Desenho em 3×, exibido com `width: 100%` | Task 2 |
| Espera `document.fonts.ready` antes de desenhar | Task 5 |
| Cores exatas do `globals.css` | Task 2 |
| Ziguezague do rodapé equivalente ao `.recibo::after` | Task 2 |
| Print em 1440/820/390 e checagem de vazamento horizontal | Task 7 |
| Rota `/preview` desfeita depois | Task 7, Step 6 |
