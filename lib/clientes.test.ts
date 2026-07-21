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
