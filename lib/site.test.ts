import { describe, it, expect } from "vitest";
import { ehLocal, enderecoDoSite } from "./site";

/* Esta trava existe pra ninguém pagar de verdade num fluxo que nunca vai
   ativar a conta: de localhost o Mercado Pago não devolve a pessoa (back_url)
   nem avisa o webhook. Um falso negativo aqui custa dinheiro de alguém. */
describe("ehLocal: o Mercado Pago alcança este site?", () => {
  it.each([
    "http://localhost:3000",
    "http://localhost",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:8080",
    "http://meu-mac.local:3000",
    "http://app.localhost:3000",
  ])("%s = não alcança", (url) => {
    expect(ehLocal(url)).toBe(true);
  });

  it.each([
    "https://preco-de-fabrica.vercel.app",
    "https://precodefabrica.com.br",
    "http://precodefabrica.com.br",
    "https://impressora3d-git-main-fabiana.vercel.app",
  ])("%s = alcança", (url) => {
    expect(ehLocal(url)).toBe(false);
  });

  it("URL quebrada é tratada como inalcançável, não como pública", () => {
    // Na dúvida, barrar: liberar por engano é que custa caro.
    for (const lixo of ["", "localhost:3000", "sei-la", "://"]) {
      expect(ehLocal(lixo)).toBe(true);
    }
  });

  it("não confunde domínio que só CONTÉM 'localhost'", () => {
    expect(ehLocal("https://localhost.com.br")).toBe(false);
    expect(ehLocal("https://naoelocal.host")).toBe(false);
  });
});

/* O valor da variável na Vercel não pode ser um ponto único de falha: se
   estiver errado (localhost), o pagamento em produção tem que sobreviver
   caindo no endereço real por onde a requisição chegou. */
describe("enderecoDoSite: qual endereço o MP vai usar", () => {
  const PROD = "https://impressora3d.vercel.app";

  it("usa o valor configurado quando ele é um endereço real", () => {
    expect(enderecoDoSite("https://precodefabrica.com.br", PROD)).toBe(
      "https://precodefabrica.com.br"
    );
  });

  it("variável errada (localhost) em produção NÃO derruba: usa a origem real", () => {
    expect(enderecoDoSite("http://localhost:3000", PROD)).toBe(PROD);
  });

  it("variável vazia/ausente: usa a origem da requisição", () => {
    expect(enderecoDoSite(undefined, PROD)).toBe(PROD);
    expect(enderecoDoSite("", PROD)).toBe(PROD);
  });

  it("em dev os dois são locais: resultado segue local (a trava do ehLocal barra)", () => {
    const dev = "http://localhost:3000";
    const resultado = enderecoDoSite(dev, dev);
    expect(resultado).toBe(dev);
    expect(ehLocal(resultado)).toBe(true);
  });
});
