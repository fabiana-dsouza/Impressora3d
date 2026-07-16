import { describe, it, expect } from "vitest";
import { PLANOS, economiaDoAnual, ehPlanoId } from "./planos";

/* A vitrine faz promessas de dinheiro ("2 meses grátis", "sai por R$ 100/mês").
   Estes testes amarram cada promessa ao preço que o cartão vai cobrar de
   verdade — mexer num preço sem mexer no texto passa a quebrar aqui, e não na
   fatura de alguém. */
describe("as promessas dos pacotes batem com os preços", () => {
  it("o '2 meses grátis' vale exatamente 2 mensalidades", () => {
    expect(economiaDoAnual()).toBe(PLANOS.mensal.preco * 2);
  });

  it("o 'sai por X/mês' do anual é o anual dividido por 12", () => {
    expect(PLANOS.anual.porMes).toBe(
      PLANOS.anual.preco / PLANOS.anual.frequenciaMeses
    );
  });

  it("o anual é mesmo mais barato que 12 mensais", () => {
    expect(economiaDoAnual()).toBeGreaterThan(0);
    expect(PLANOS.anual.porMes).toBeLessThan(PLANOS.mensal.preco);
  });

  it("o mensal cobra todo mês", () => {
    expect(PLANOS.mensal.frequenciaMeses).toBe(1);
    expect(PLANOS.mensal.porMes).toBe(PLANOS.mensal.preco);
  });
});

describe("ehPlanoId", () => {
  it("aceita só os dois planos que existem", () => {
    expect(ehPlanoId("mensal")).toBe(true);
    expect(ehPlanoId("anual")).toBe(true);
  });

  it("recusa lixo vindo da URL", () => {
    for (const x of ["pirata", "", null, undefined, 0, {}]) {
      expect(ehPlanoId(x)).toBe(false);
    }
  });
});
