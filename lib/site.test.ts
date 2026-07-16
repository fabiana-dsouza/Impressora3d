import { describe, it, expect } from "vitest";
import { ehLocal } from "./site";

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
