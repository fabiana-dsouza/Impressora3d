import { describe, it, expect } from "vitest";
import {
  calcular,
  precoPorGrama,
  custoEnergiaPorHora,
  desgastePorHora,
  horasDecimais,
  travarMargem,
  arredondarMeioReal,
} from "./calc";
import { MARGEM_MINIMA } from "./defaults";
import type { EntradaCalculo } from "./types";

// Entrada base equivalente ao exemplo da tela de Resultado.
function entradaBase(over: Partial<EntradaCalculo> = {}): EntradaCalculo {
  return {
    materiais: [{ gramas: 50, precoPorGrama: 0.105 }], // rolo R$ 105/kg
    horasDecimais: 3,
    custoEnergiaPorHora: 0.09, // 100 W × R$ 0,85/kWh
    desgastePorHora: 1.1, // R$ 5500 ÷ 5000 h
    extras: 1.0,
    taxaFalhas: 0.1,
    margem: 1.0, // 100%
    taxaMarketplace: 0,
    ...over,
  };
}

describe("conversões auxiliares", () => {
  it("preço por grama a partir do rolo em kg", () => {
    expect(precoPorGrama(105)).toBeCloseTo(0.105, 6);
    expect(precoPorGrama(170)).toBeCloseTo(0.17, 6);
  });

  it("custo de energia por hora (100 W, R$ 0,85/kWh ≈ R$ 0,085/h)", () => {
    expect(custoEnergiaPorHora(100, 0.85)).toBeCloseTo(0.085, 6);
  });

  it("desgaste por hora (R$ 5500 ÷ 5000 h = R$ 1,10/h)", () => {
    expect(desgastePorHora(5500, 5000)).toBeCloseTo(1.1, 6);
  });

  it("desgaste com vida útil zero não quebra", () => {
    expect(desgastePorHora(5500, 0)).toBe(0);
  });

  it("horas + minutos em decimais", () => {
    expect(horasDecimais(3, 0)).toBe(3);
    expect(horasDecimais(1, 30)).toBe(1.5);
    expect(horasDecimais(0, 15)).toBeCloseTo(0.25, 6);
  });
});

describe("arredondamento para cima em múltiplos de R$ 0,50", () => {
  it("arredonda para cima", () => {
    expect(arredondarMeioReal(21.6)).toBe(22.0);
    expect(arredondarMeioReal(21.1)).toBe(21.5);
    expect(arredondarMeioReal(10.01)).toBe(10.5);
  });

  it("mantém múltiplos exatos", () => {
    expect(arredondarMeioReal(22.0)).toBe(22.0);
    expect(arredondarMeioReal(21.5)).toBe(21.5);
  });
});

describe("trava rígida de margem (mínimo 15%)", () => {
  it("bloqueia margem abaixo de 15%", () => {
    expect(travarMargem(0.1)).toBe(MARGEM_MINIMA);
    expect(travarMargem(0)).toBe(MARGEM_MINIMA);
    expect(travarMargem(-0.5)).toBe(MARGEM_MINIMA);
  });

  it("bloqueia NaN", () => {
    expect(travarMargem(NaN)).toBe(MARGEM_MINIMA);
  });

  it("mantém margens válidas", () => {
    expect(travarMargem(0.15)).toBe(0.15);
    expect(travarMargem(1.0)).toBe(1.0);
    expect(travarMargem(3.0)).toBe(3.0);
  });

  it("no cálculo, margem 5% é tratada como 15%", () => {
    const comBaixa = calcular(entradaBase({ margem: 0.05, extras: 0 }));
    const com15 = calcular(entradaBase({ margem: 0.15, extras: 0 }));
    expect(comBaixa.precoVenda).toBe(com15.precoVenda);
  });
});

describe("várias cores no mesmo produto", () => {
  it("soma o material de todas as cores", () => {
    // 30 g de básica (0,105) + 20 g de especial (0,17)
    const r = calcular(
      entradaBase({
        materiais: [
          { gramas: 30, precoPorGrama: 0.105 }, // 3,15
          { gramas: 20, precoPorGrama: 0.17 }, // 3,40
        ],
      })
    );
    expect(r.custoMaterial).toBeCloseTo(6.55, 6);
  });

  it("uma cor só continua funcionando", () => {
    const r = calcular(
      entradaBase({ materiais: [{ gramas: 50, precoPorGrama: 0.105 }] })
    );
    expect(r.custoMaterial).toBeCloseTo(5.25, 6);
  });

  it("sem cores, material é zero (não quebra)", () => {
    const r = calcular(entradaBase({ materiais: [] }));
    expect(r.custoMaterial).toBe(0);
    expect(Number.isFinite(r.precoVenda)).toBe(true);
  });
});

describe("cálculo completo (exemplo da spec)", () => {
  const r = calcular(entradaBase());

  it("custo de material = 50 × 0,105 = 5,25", () => {
    expect(r.custoMaterial).toBeCloseTo(5.25, 6);
  });

  it("custo de energia = 3 × 0,09 = 0,27", () => {
    expect(r.custoEnergia).toBeCloseTo(0.27, 6);
  });

  it("custo de desgaste = 3 × 1,10 = 3,30", () => {
    expect(r.custoDesgaste).toBeCloseTo(3.3, 6);
  });

  it("subtotal = 5,25 + 0,27 + 3,30 + 1,00 = 9,82", () => {
    expect(r.subtotal).toBeCloseTo(9.82, 6);
  });

  it("custo de falhas = 9,82 × 10% = 0,982", () => {
    expect(r.custoFalhas).toBeCloseTo(0.982, 6);
  });

  it("custo total = 9,82 + 0,982 = 10,802", () => {
    expect(r.custoTotal).toBeCloseTo(10.802, 6);
  });

  it("preço base = 10,802 × 2 = 21,604", () => {
    expect(r.precoBase).toBeCloseTo(21.604, 6);
  });

  it("preço de venda arredondado para cima = 22,00", () => {
    expect(r.precoVenda).toBe(22.0);
  });

  it("lucro = 22,00 - 10,802 = 11,198", () => {
    expect(r.lucro).toBeCloseTo(11.198, 3);
  });
});

describe("taxa de marketplace embutida DEPOIS da margem", () => {
  it("Shopee 20%: preço = precoBase / (1 - 0,20)", () => {
    const r = calcular(entradaBase({ taxaMarketplace: 0.2 }));
    // precoBase = 21,604 → /0,8 = 27,005 → arredonda pra 27,50
    expect(r.precoVenda).toBe(27.5);
  });

  it("Shopee 20%: o lucro continua saudável (a taxa não come a margem)", () => {
    const semTaxa = calcular(entradaBase({ taxaMarketplace: 0 }));
    const comTaxa = calcular(entradaBase({ taxaMarketplace: 0.2 }));
    // O lucro com taxa deve ser >= lucro sem taxa (embutir sobe o preço).
    expect(comTaxa.lucro).toBeGreaterThanOrEqual(semTaxa.lucro - 0.5);
    // E a taxa efetivamente cobrada é descontada:
    const taxaCobrada = comTaxa.precoVenda * 0.2;
    expect(comTaxa.lucro).toBeCloseTo(
      comTaxa.precoVenda - comTaxa.custoTotal - taxaCobrada,
      6
    );
  });

  it("Elo7 12%: preço = precoBase / (1 - 0,12)", () => {
    const r = calcular(entradaBase({ taxaMarketplace: 0.12 }));
    // 21,604 / 0,88 = 24,55 → arredonda pra 24,50? não, ceil → 24,55 → 25,00... vamos checar múltiplo
    expect(r.precoVenda % 0.5).toBeCloseTo(0, 6);
    expect(r.precoVenda).toBeGreaterThanOrEqual(21.604 / 0.88);
  });
});

describe("piso de segurança: preço nunca abaixo de custoTotal × 1,15", () => {
  it("mantém piso mesmo com números pequenos", () => {
    const r = calcular(
      entradaBase({
        materiais: [{ gramas: 1, precoPorGrama: 0.105 }],
        extras: 0,
        horasDecimais: 0.1,
        margem: 0.15,
      })
    );
    expect(r.precoVenda).toBeGreaterThanOrEqual(r.custoTotal * 1.15 - 1e-9);
  });
});

describe("robustez contra entradas ruins", () => {
  it("extras negativos viram zero", () => {
    const r = calcular(entradaBase({ extras: -5 }));
    expect(r.custoExtras).toBe(0);
  });

  it("taxa de marketplace inválida não quebra", () => {
    const r = calcular(entradaBase({ taxaMarketplace: 2 }));
    expect(Number.isFinite(r.precoVenda)).toBe(true);
  });
});
