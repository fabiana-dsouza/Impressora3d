import { describe, it, expect } from "vitest";
import { precoMedioPorGrama, calcularProduto } from "./calc-produto";
import { CONFIG_PADRAO } from "./defaults";
import type { Cor, Produto } from "./types";

const CORES: Cor[] = [
  { id: "basica", nome: "Básica", hex: "#000", tipo: "basica", precoRoloKg: 105 },
  { id: "especial", nome: "Especial", hex: "#000", tipo: "especial", precoRoloKg: 170 },
];

describe("preço médio das cores (sem % de uso de cada)", () => {
  it("uma cor só = o preço dela", () => {
    expect(precoMedioPorGrama(["basica"], CORES)).toBeCloseTo(0.105, 6);
    expect(precoMedioPorGrama(["especial"], CORES)).toBeCloseTo(0.17, 6);
  });

  it("duas cores = média simples dos preços", () => {
    // (0,105 + 0,17) / 2 = 0,1375
    expect(precoMedioPorGrama(["basica", "especial"], CORES)).toBeCloseTo(
      0.1375,
      6
    );
  });

  it("sem cores = 0 (não quebra)", () => {
    expect(precoMedioPorGrama([], CORES)).toBe(0);
  });
});

describe("calcularProduto usa peso total × preço médio", () => {
  function produto(over: Partial<Produto> = {}): Produto {
    return {
      id: "p1",
      nome: "Teste",
      coresIds: ["basica"],
      gramas: 50,
      unidade: "g",
      horas: 3,
      minutos: 0,
      margem: 1,
      precoVenda: 0,
      criadoEm: 0,
      vendidos: 0,
      ...over,
    };
  }

  it("uma cor: 50 g × 0,105 = 5,25 de material", () => {
    const r = calcularProduto(produto(), CONFIG_PADRAO, CORES);
    expect(r.custoMaterial).toBeCloseTo(5.25, 6);
  });

  it("duas cores: 50 g × 0,1375 (média) = 6,875 de material", () => {
    const r = calcularProduto(
      produto({ coresIds: ["basica", "especial"] }),
      CONFIG_PADRAO,
      CORES
    );
    expect(r.custoMaterial).toBeCloseTo(6.875, 6);
  });

  it("embalagem de R$ 3,00 entra sempre", () => {
    const r = calcularProduto(produto(), CONFIG_PADRAO, CORES);
    expect(r.custoExtras).toBeCloseTo(3, 6);
  });
});

describe("preço que realmente vendeu manda na notinha", () => {
  function produto(over: Partial<Produto> = {}): Produto {
    return {
      id: "p1",
      nome: "Teste",
      coresIds: ["basica"],
      gramas: 50,
      unidade: "g",
      horas: 3,
      minutos: 0,
      margem: 1,
      precoVenda: 0,
      criadoEm: 0,
      vendidos: 0,
      ...over,
    };
  }

  it("sem preço anotado, usa o sugerido", () => {
    const r = calcularProduto(produto(), CONFIG_PADRAO, CORES);
    // custo 5,25 + 0,255 + 3,30 + 3,00 = 11,805 → +10% = 12,9855 → ×2 = 25,971 → 26,00
    expect(r.precoVenda).toBe(26);
    expect(r.lucro).toBeCloseTo(26 - r.custoTotal, 6);
  });

  it("com preço anotado, é ele que vale", () => {
    const r = calcularProduto(produto({ precoVenda: 20 }), CONFIG_PADRAO, CORES);
    expect(r.precoVenda).toBe(20);
    expect(r.lucro).toBeCloseTo(20 - r.custoTotal, 6);
  });

  it("vendeu barato demais: o lucro fica negativo (mostra a verdade)", () => {
    const r = calcularProduto(produto({ precoVenda: 5 }), CONFIG_PADRAO, CORES);
    expect(r.precoVenda).toBe(5);
    expect(r.lucro).toBeLessThan(0);
  });

  it("o custo não muda por causa do preço de venda", () => {
    const a = calcularProduto(produto(), CONFIG_PADRAO, CORES);
    const b = calcularProduto(produto({ precoVenda: 99 }), CONFIG_PADRAO, CORES);
    expect(b.custoTotal).toBeCloseTo(a.custoTotal, 6);
  });
});
