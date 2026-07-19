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
