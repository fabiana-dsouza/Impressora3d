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

const TRACEJADO = "rgba(64, 55, 42, 0.28)";

/** As cores da notinha, lidas do CSS pra baterem com a versão em HTML. */
type Paleta = {
  papel: string;
  tinta: string;
  suave: string;
  verde: string;
  fundo: string;
};

/**
 * Lê a cor do CSS pra notinha desenhada e a notinha de HTML nunca
 * discordarem. O valor de reserva é o mesmo do globals.css, pro desenho
 * não sumir se a variável faltar.
 */
function corDoCss(nome: string, reserva: string): string {
  if (typeof document === "undefined") return reserva;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome);
  return v.trim() || reserva;
}

/** Monta a paleta uma vez por desenho — nunca no topo do módulo (o Vitest
 * roda este arquivo em ambiente node, sem `document`). */
function lerPaleta(): Paleta {
  return {
    papel: corDoCss("--papel", "#fffdf6"),
    tinta: corDoCss("--papel-tinta", "#40372a"),
    suave: corDoCss("--papel-suave", "#9c9078"),
    verde: corDoCss("--neon", "#0f9d6e"),
    fundo: corDoCss("--fundo", "#f7f7f7"),
  };
}

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
function carimbo(
  ctx: CanvasRenderingContext2D,
  paleta: Paleta,
  texto: string,
  cx: number,
  cy: number
) {
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

  ctx.strokeStyle = paleta.verde;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-largura / 2, -altura / 2, largura, altura, 12);
  ctx.stroke();

  ctx.fillStyle = paleta.verde;
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
  paleta: Paleta,
  dados: DadosOrcamento,
  linhasNome: string[],
  pintar: boolean
): number {
  const meio = LARGURA / 2;
  let y = TOPO;

  if (pintar) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = paleta.tinta;
    ctx.font = `700 19px ${F_DISPLAY}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(`★ ${dados.empresa.toUpperCase()} ★`, meio, y + 15);
  }
  y += 22;

  if (pintar) {
    ctx.fillStyle = paleta.suave;
    ctx.font = `700 10px ${F_CORPO}`;
    ctx.letterSpacing = "3px";
    ctx.fillText("ORÇAMENTO", meio, y + 10);
  }
  y += 18;

  // Só existe se ela digitou um nome. O `y` avança FORA do if (pintar),
  // igual aos outros blocos, senão a passada de medir e a de pintar
  // discordariam da altura do papel.
  if (dados.cliente) {
    if (pintar) {
      ctx.fillStyle = paleta.tinta;
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
    ctx.fillStyle = paleta.tinta;
    ctx.font = `800 17px ${F_CORPO}`;
    ctx.letterSpacing = "0px";
  }
  for (const linha of linhasNome) {
    if (pintar) ctx.fillText(linha, meio, y + 17);
    y += 22;
  }

  if (dados.cores) {
    if (pintar) {
      ctx.fillStyle = paleta.suave;
      ctx.font = `600 13px ${F_CORPO}`;
      ctx.letterSpacing = "0px";
      ctx.fillText(dados.cores, meio, y + 13);
    }
    y += 20;
  }

  y += 24; // folga antes do carimbo
  if (pintar)
    carimbo(ctx, paleta, brl(dados.preco), meio, y + CARIMBO_ALTURA / 2);
  y += CARIMBO_ALTURA;

  if (pintar) {
    ctx.fillStyle = paleta.suave;
    ctx.font = `600 11px ${F_CORPO}`;
    ctx.letterSpacing = "1px";
    ctx.fillText(`orçamento de ${dataBR(dados.data)}`, meio, y + 22);
    ctx.letterSpacing = "0px";
  }
  y += 30;

  return y + RODAPE + DENTE;
}

/** O papel: retângulo de cantos arredondados em cima e ziguezague embaixo. */
function papel(ctx: CanvasRenderingContext2D, paleta: Paleta, altura: number) {
  const corpo = altura - DENTE;

  ctx.fillStyle = paleta.papel;
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

  const paleta = lerPaleta();

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

  // Medir com a fonte e o espaçamento certos, senão a quebra de linha erra.
  ctx.letterSpacing = "0px";
  ctx.font = `800 17px ${F_CORPO}`;
  const linhasNome = quebrarEmLinhas(
    dados.produto.toUpperCase(),
    LARGURA - MARGEM * 2,
    (t) => ctx.measureText(t).width
  );

  const altura = Math.ceil(
    percorrer(ctx, paleta, paraDesenhar, linhasNome, false)
  );

  // Mexer em width/height zera o contexto — por isso a medição vem antes.
  canvas.width = LARGURA * ESCALA;
  canvas.height = altura * ESCALA;
  ctx.scale(ESCALA, ESCALA);

  // Fundo opaco: PNG transparente fica preto em alguns visualizadores de zap.
  ctx.fillStyle = paleta.fundo;
  ctx.fillRect(0, 0, LARGURA, altura);

  papel(ctx, paleta, altura);
  percorrer(ctx, paleta, paraDesenhar, linhasNome, true);
}
