# Notinha do cliente (orçamento exportável)

Data: 2026-07-19

## Problema

A tela `/resultado` mostra uma notinha só, e ela é de uso interno: quebra de
custos (material, energia, desgaste, embalagem, reserva pra erros) e o carimbo
do lucro. Quando a criança quer mandar o preço pra alguém no WhatsApp, a única
saída hoje é print de tela — e o print entrega o custo e o lucro junto.

Precisa existir uma segunda notinha, feita pro cliente, que saia da tela como
imagem de verdade (WhatsApp, galeria de fotos, download).

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| A notinha do cliente é comprovante de venda ou orçamento? | **Orçamento** — vai antes da compra, é a proposta de preço |
| O que mostra além de loja/peça/preço? | **Cores da peça** e **data do orçamento**. Sem quantidade, sem recado digitado |
| Como as duas convivem na tela? | **Lado a lado** no desktop, empilhadas no celular, com botão de download |
| Como a imagem é gerada? | **Desenhada num `<canvas>`**, e esse canvas é o preview na tela |

Descartado de propósito: quantidade (`3 × R$ 25`), campo de recado livre, e
qualquer variante "comprovante pago". Cada campo a mais é um campo que uma
criança de 10 anos preenche antes de conseguir mandar o preço.

## O que a notinha do cliente mostra

Mesmo papel e mesma família visual da interna. A interna termina no carimbo do
**lucro**; a do cliente termina no carimbo do **preço**.

```
   ★ LOJA DA JULIA ★
       orçamento
 - - - - - - - - - - - -
   DINOSSAURO ROXO
   roxo + verde

      ┌──────────┐
      │  PREÇO   │
      │ R$ 25,00 │
      └──────────┘

  orçamento de 19/07/2026
  ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾  (ziguezague do papel)
```

- Nome da loja: `perfil.nomeEmpresa`, com fallback pra `EMPRESA_PADRAO`.
- Nome da peça: `produto.nome`, caixa alta, quebra em duas linhas se for longo.
- Cores: nomes juntados com ` + ` (ex: `roxo + verde`).
- Preço: `resultado.precoVenda` — o mesmo "vendido por" da notinha interna.
- Data: a data de hoje, formato pt-BR.
- Carimbo verde reaproveitando o visual de `.carimbo` (borda 3px, `rotate(-3deg)`).

**Não aparece, em hipótese nenhuma:** custo de material, energia, desgaste,
embalagem, reserva pra erros, custo total, margem, lucro.

Sem frase de fecho ("é só me chamar!") — a data já fecha a notinha.

## Layout da tela `/resultado`

- **Desktop (`lg`)**: as duas notinhas lado a lado, `max-w-4xl`.
- **Celular**: empilhadas, a interna primeiro.
- Cada uma ganha um rótulo pequeno em cima — **"só sua"** e **"pro cliente"** —
  porque de longe as duas se parecem e mandar a errada é o pior erro possível.
- A notinha interna não muda em nada. Só é recortada pra outro arquivo.

## O botão

Um botão grande embaixo da notinha do cliente, com rótulo que se adapta:

- `navigator.canShare({ files })` disponível (celular): **"Mandar pro cliente"**
  → abre a bandeja do sistema, onde aparecem WhatsApp, Salvar em Fotos,
  Instagram, e-mail. O app não escolhe o destino; o sistema oferece todos.
- Sem suporte (desktop): **"Baixar a notinha"** → salva o PNG.

Nome do arquivo: `orcamento-<nome-da-peça-em-slug>.png`.

Cancelar a bandeja (`AbortError`) **não é erro** — não mostra nada. Erro real
mostra `components/Dialogo.tsx` no modo avisar. Nunca `alert()`.

## Arquitetura

Quatro peças novas, cada uma com um trabalho só.

### `lib/orcamento.ts` — os dados (puro, sem DOM)

```ts
export interface DadosOrcamento {
  empresa: string;
  produto: string;
  cores: string;
  preco: number;
  data: Date;
}

export function montarOrcamento(
  produto: Produto,
  resultado: ResultadoCalculo,
  cores: Cor[],
  nomeEmpresa: string,
): DadosOrcamento;
```

`DadosOrcamento` **não tem campo de custo nem de lucro**. É aqui que a regra "o
cliente não vê número de dentro da fábrica" fica estrutural: não dá pra vazar
por engano lá na frente porque o dado não chega lá.

Testável no Vitest sem DOM.

### `lib/notinha-desenho.ts` — o desenho

```ts
export function desenharOrcamento(
  ctx: CanvasRenderingContext2D,
  dados: DadosOrcamento,
): { largura: number; altura: number };
```

- Passada de medição primeiro (`measureText`) pra quebrar nome comprido em duas
  linhas e somar a altura real do conteúdo; só depois desenha.
- Todas as medidas em constantes no topo do arquivo.
- Desenha sempre em **3×**; a tela exibe com `width: 100%`. Um canvas só serve
  pra tela e pro arquivo — não existem duas resoluções pra manter em sincronia.
- Cores vindas dos mesmos valores de `globals.css`: `--papel` `#fffdf6`,
  `--papel-tinta` `#40372a`, `--papel-suave` `#9c9078`, verde do carimbo
  `#0f9d6e`.
- Desenha o ziguezague do rodapé, equivalente ao `.recibo::after`.

### `lib/compartilhar.ts` — a saída

```ts
export async function compartilharImagem(
  canvas: HTMLCanvasElement,
  nomeArquivo: string,
  titulo: string,
): Promise<"compartilhado" | "baixado" | "cancelado">;
```

`canvas.toBlob()` → `File` → bandeja do sistema se der, download se não der.
Erro real é lançado pro chamador decidir.

### `components/NotinhaCliente.tsx` — a tela

O `<canvas>` mais o botão. Espera `document.fonts.ready` antes de desenhar
(senão a Fredoka ainda não chegou do Google Fonts e a notinha sai em Arial) e
redesenha quando os dados mudam. O canvas leva `role="img"` e `aria-label` com
o texto da notinha, já que imagem não tem texto pra leitor de tela.

### Limpeza junto: `components/NotinhaInterna.tsx`

Hoje `app/resultado/page.tsx` tem 225 linhas fazendo duas coisas: carregar dados
e desenhar a notinha. Somar a notinha do cliente ali deixaria o arquivo em ~400
linhas fazendo três. A notinha interna sai pra `components/NotinhaInterna.tsx`
**sem nenhuma mudança de comportamento** — é recortar e colar — e a página fica
com carregar dados + posicionar as duas.

## Verificação

- Vitest em `lib/orcamento.test.ts`: fallback do nome da empresa, junção das
  cores, preço vindo do resultado, e a garantia de que o objeto não carrega
  custo/lucro.
- Print de verdade com Playwright em 1440 / 820 / 390, via rota `/preview`
  temporária (adicionar em `PUBLICAS` de `lib/rotas.ts` e **desfazer depois**).
  Desenho de canvas é exatamente o tipo de coisa que sai torta se ninguém olhar.
- Conferir `scrollWidth > innerWidth` (vazamento horizontal) nas três larguras.

## Limitação aceita

`--font-mono` é a fonte do sistema, então o dinheiro sai em SF Mono no iPhone e
Consolas no Windows. Como o desenho acontece no aparelho da usuária, o que ela
vê é sempre exatamente o que o cliente recebe — só não é byte-a-byte igual entre
aparelhos diferentes. Resolver isso exigiria embutir um arquivo de fonte no app,
o que não vale o peso agora.
