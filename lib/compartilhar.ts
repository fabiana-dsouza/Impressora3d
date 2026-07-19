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
  // Adiar a revogação para o Safari não abortar o download enquanto começa de forma assíncrona
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
