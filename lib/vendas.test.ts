import { describe, it, expect } from "vitest";
import {
  lucroDaVenda,
  recebido,
  totalNoCaixa,
  totalQueTeDevem,
  linhasDaMigracao,
  precoBaseDaVenda,
  vendasDaPeca,
  rotuloVendidos,
  vendasPagas,
  vendasPendentes,
  naoFoiVenda,
  totalGastoPraMim,
  totalDeGraca,
} from "./vendas";
import { calcularProduto } from "./calc-produto";
import { CONFIG_PADRAO } from "./defaults";
import type { Cor, Produto, Venda } from "./types";

function venda(over: Partial<Venda> = {}): Venda {
  return {
    id: "v1",
    produtoId: "p1",
    produtoNome: "Dinossauro",
    clienteId: "c1",
    coresIds: ["roxo"],
    preco: 25,
    custo: 10,
    pagoEm: null,
    destino: "venda",
    criadoEm: 0,
    ...over,
  };
}

describe("lucro de uma venda", () => {
  it("é o preço menos o custo, os dois congelados", () => {
    expect(lucroDaVenda(venda({ preco: 25, custo: 10 }))).toBe(15);
  });

  it("venda no prejuízo dá lucro negativo", () => {
    expect(lucroDaVenda(venda({ preco: 8, custo: 10 }))).toBe(-2);
  });
});

describe("recebido", () => {
  it("sem pagoEm, ainda não recebeu", () => {
    expect(recebido(venda({ pagoEm: null }))).toBe(false);
  });

  it("com pagoEm, recebeu", () => {
    expect(recebido(venda({ pagoEm: 1700000000000 }))).toBe(true);
  });
});

describe("abas de vendas", () => {
  const vs = [
    venda({ id: "paga-1", pagoEm: 100 }),
    venda({ id: "pendente-1", pagoEm: null }),
    venda({ id: "paga-2", pagoEm: 200 }),
    venda({ id: "pendente-2", pagoEm: null }),
  ];

  it('"Vendidos" contém somente as vendas pagas', () => {
    expect(vendasPagas(vs).map((v) => v.id)).toEqual(["paga-1", "paga-2"]);
  });

  it('"Falta receber" contém somente as vendas pendentes', () => {
    expect(vendasPendentes(vs).map((v) => v.id)).toEqual([
      "pendente-1",
      "pendente-2",
    ]);
  });
});

describe("o cofrinho", () => {
  it("lista vazia é zero", () => {
    expect(totalNoCaixa([])).toBe(0);
  });

  // A regra que a usuária pediu: vender não é receber.
  it("NÃO conta venda que ainda não foi paga", () => {
    expect(totalNoCaixa([venda({ pagoEm: null })])).toBe(0);
  });

  it("conta só as pagas", () => {
    const vs = [
      venda({ id: "a", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "b", preco: 30, custo: 12, pagoEm: null }),
      venda({ id: "c", preco: 20, custo: 5, pagoEm: 2 }),
    ];
    expect(totalNoCaixa(vs)).toBe(15 + 15);
  });

  it("prejuízo pago diminui o cofrinho", () => {
    const vs = [
      venda({ id: "a", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "b", preco: 5, custo: 10, pagoEm: 1 }),
    ];
    expect(totalNoCaixa(vs)).toBe(10);
  });
});

describe("o que ainda te devem", () => {
  // De propósito soma PREÇO e não lucro: é o dinheiro que a pessoa vai
  // colocar na mão dela, não o ganho.
  it("soma o preço das que não foram pagas", () => {
    const vs = [
      venda({ id: "a", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "b", preco: 30, custo: 12, pagoEm: null }),
    ];
    expect(totalQueTeDevem(vs)).toBe(30);
  });

  it("tudo pago, ninguém te deve nada", () => {
    expect(totalQueTeDevem([venda({ pagoEm: 1 })])).toBe(0);
  });
});

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
    expect(rotuloVendidos(1)).toBe("vendido 1 vez");
  });

  it("duas ou mais é plural", () => {
    expect(rotuloVendidos(2)).toBe("vendido 2 vezes");
  });
});

describe("preço base do orçamento", () => {
  // A base que vem preenchida na nota: o último preço vendido daquela peça,
  // ou o sugerido se ela nunca foi vendida.
  it("sem venda dessa peça, usa o preço sugerido", () => {
    expect(precoBaseDaVenda([], "p1", 18)).toBe(18);
  });

  it("com uma venda dessa peça, usa o preço dela", () => {
    const vs = [venda({ produtoId: "p1", preco: 20 })];
    expect(precoBaseDaVenda(vs, "p1", 18)).toBe(20);
  });

  it("com várias vendas, usa a MAIS RECENTE", () => {
    const vs = [
      venda({ id: "a", produtoId: "p1", preco: 20, criadoEm: 100 }),
      venda({ id: "b", produtoId: "p1", preco: 25, criadoEm: 300 }),
      venda({ id: "c", produtoId: "p1", preco: 22, criadoEm: 200 }),
    ];
    expect(precoBaseDaVenda(vs, "p1", 18)).toBe(25);
  });

  it("ignora vendas de outra peça", () => {
    const vs = [
      venda({ id: "a", produtoId: "p2", preco: 99, criadoEm: 500 }),
      venda({ id: "b", produtoId: "p1", preco: 20, criadoEm: 100 }),
    ];
    expect(precoBaseDaVenda(vs, "p1", 18)).toBe(20);
  });
});

describe("linhas da migração do contador antigo", () => {
  const CORES: Cor[] = [
    { id: "roxo", nome: "Roxo", hex: "#70f", tipo: "basica", precoRoloKg: 105 },
  ];

  function produto(over: Partial<Produto> = {}): Produto {
    return {
      id: "p1",
      nome: "Dinossauro",
      coresIds: ["roxo"],
      gramas: 40,
      unidade: "g",
      horas: 2,
      minutos: 30,
      margem: 1,
      precoVenda: 25,
      criadoEm: 1700000000000,
      vendidos: 3,
      ...over,
    };
  }

  it("gera uma linha por unidade vendida", () => {
    const linhas = linhasDaMigracao([produto({ vendidos: 3 })], CONFIG_PADRAO, CORES);
    expect(linhas).toHaveLength(3);
  });

  it("ignora produto que nunca foi vendido", () => {
    const linhas = linhasDaMigracao([produto({ vendidos: 0 })], CONFIG_PADRAO, CORES);
    expect(linhas).toHaveLength(0);
  });

  it("marca como paga e sem cliente, pronta pra ela nomear", () => {
    const [l] = linhasDaMigracao([produto({ vendidos: 1 })], CONFIG_PADRAO, CORES);
    expect(l.pagoEm).not.toBeNull();
    expect(l.clienteId).toBeNull();
    expect(l.produtoNome).toBe("Dinossauro");
    expect(l.coresIds).toEqual(["roxo"]);
  });

  // ESTE É O CRITÉRIO DE ACEITE DA MIGRAÇÃO, como teste em vez de conferência
  // a olho: o cofrinho tem que valer exatamente o mesmo antes e depois.
  it("o cofrinho vale o mesmo antes e depois", () => {
    const produtos = [
      produto({ id: "p1", vendidos: 3, precoVenda: 25 }),
      produto({ id: "p2", vendidos: 2, precoVenda: 40, nome: "Vaso" }),
      // Produto com precoVenda: 0 exercita o ramo do preço sugerido em calcularProduto
      produto({ id: "p4", vendidos: 1, precoVenda: 0, nome: "Teste Preço Sugerido" }),
      produto({ id: "p3", vendidos: 0 }),
    ];

    // Como o cofrinho é calculado HOJE, em app/fabrica/page.tsx.
    const antes = produtos.reduce(
      (s, p) => s + calcularProduto(p, CONFIG_PADRAO, CORES).lucro * p.vendidos,
      0
    );

    const depois = totalNoCaixa(
      linhasDaMigracao(produtos, CONFIG_PADRAO, CORES).map((l, i) => ({
        ...l,
        id: `v${i}`,
        criadoEm: 0,
      }))
    );

    expect(depois).toBeCloseTo(antes, 10);
    expect(antes).toBeGreaterThan(0); // não passar por acidente com dois zeros
  });

  it("produto sem preço anotado usa o preço sugerido, não zero", () => {
    const [l] = linhasDaMigracao(
      [produto({ vendidos: 1, precoVenda: 0 })],
      CONFIG_PADRAO,
      CORES
    );
    expect(l.preco).toBeGreaterThan(0);
  });

  it("criadoEm zero não é tratado como missing — pagoEm fica 0", () => {
    const [l] = linhasDaMigracao(
      [produto({ vendidos: 1, criadoEm: 0 })],
      CONFIG_PADRAO,
      CORES
    );
    expect(l.pagoEm).toBe(0);
  });
});

describe("fiz pra mim / dei de graça não são dinheiro", () => {
  it("não entram no cofrinho, mesmo com pagoEm preenchido", () => {
    const vs = [
      venda({ id: "v", preco: 25, custo: 10, pagoEm: 1 }),
      venda({ id: "m", preco: 25, custo: 10, pagoEm: 1, destino: "mim" }),
      venda({ id: "g", preco: 25, custo: 10, pagoEm: 1, destino: "graca" }),
    ];
    expect(totalNoCaixa(vs)).toBe(15); // só a venda de verdade
  });

  it("não aparecem em vendas pagas nem pendentes", () => {
    const vs = [
      venda({ id: "v", pagoEm: 1 }),
      venda({ id: "m", pagoEm: null, destino: "mim" }),
      venda({ id: "g", pagoEm: null, destino: "graca" }),
    ];
    expect(vendasPagas(vs).map((v) => v.id)).toEqual(["v"]);
    expect(vendasPendentes(vs).map((v) => v.id)).toEqual([]);
  });

  it("não contam em 'falta receber'", () => {
    const vs = [venda({ preco: 30, pagoEm: null, destino: "mim" })];
    expect(totalQueTeDevem(vs)).toBe(0);
  });

  it("a aba 'Fiz para mim' lista as duas categorias", () => {
    const vs = [
      venda({ id: "v" }),
      venda({ id: "m", destino: "mim" }),
      venda({ id: "g", destino: "graca" }),
    ];
    expect(naoFoiVenda(vs).map((v) => v.id)).toEqual(["m", "g"]);
  });

  it("as caixas somam o CUSTO, não o preço", () => {
    const vs = [
      venda({ preco: 25, custo: 10, destino: "mim" }),
      venda({ preco: 40, custo: 7, destino: "mim" }),
      venda({ preco: 15, custo: 4, destino: "graca" }),
    ];
    expect(totalGastoPraMim(vs)).toBe(17);
    expect(totalDeGraca(vs)).toBe(4);
  });

  it("não viram base de preço da peça (só venda de verdade lembra)", () => {
    const vs = [
      venda({ produtoId: "p1", preco: 20, criadoEm: 100 }),
      venda({ produtoId: "p1", preco: 99, criadoEm: 300, destino: "mim" }),
    ];
    expect(precoBaseDaVenda(vs, "p1", 50)).toBe(20);
  });

  it("não contam no 'vendido N vezes' da peça", () => {
    const vs = [
      venda({ id: "v", produtoId: "p1" }),
      venda({ id: "m", produtoId: "p1", destino: "mim" }),
    ];
    expect(vendasDaPeca(vs, "p1").map((v) => v.id)).toEqual(["v"]);
  });
});
