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
      "cliente",
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

describe("o cliente na notinha", () => {
  it("montarOrcamento não inventa cliente — quem digita é a tela", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE);
    expect(d.cliente).toBe("");
  });

  it("com cliente, o leitor de tela anuncia pra quem é", () => {
    const d = {
      ...montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE),
      cliente: "Tio Fernando",
    };
    expect(textoDaNotinha(d)).toContain("para Tio Fernando");
  });

  it("sem cliente, não sobra 'para' solto na frase", () => {
    const d = montarOrcamento(PRODUTO, RESULTADO, CORES, "Loja", HOJE);
    expect(textoDaNotinha(d)).not.toContain("para ");
  });
});
