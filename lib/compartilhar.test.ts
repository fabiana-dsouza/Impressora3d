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
