import { describe, it, expect } from "vitest";
import { destinoDaRota, rotaPublica } from "./rotas";

const SEGUE = null;

describe("abrir o site cai na entrada", () => {
  it("deslogado vê a entrada", () => {
    expect(destinoDaRota("/", false)).toBe(SEGUE);
  });

  /* O bug que a usuária reportou: logada, ela abria o site e era cuspida na
     fábrica, sem nunca ver a própria landing. */
  it("LOGADO também vê a entrada, não é chutado pra fábrica", () => {
    expect(destinoDaRota("/", true)).toBe(SEGUE);
  });
});

describe("a fábrica é só de quem tem conta", () => {
  it.each(["/fabrica", "/novo", "/resultado", "/config", "/cores", "/planos"])(
    "deslogado em %s cai na entrada",
    (rota) => {
      expect(destinoDaRota(rota, false)).toBe("/");
    }
  );

  it.each(["/fabrica", "/novo", "/planos", "/config"])(
    "logado em %s passa direto",
    (rota) => {
      expect(destinoDaRota(rota, true)).toBe(SEGUE);
    }
  );
});

describe("login", () => {
  it("deslogado entra no login", () => {
    expect(destinoDaRota("/login", false)).toBe(SEGUE);
  });

  it("quem já entrou não fica no formulário de login", () => {
    expect(destinoDaRota("/login", true)).toBe("/fabrica");
    expect(destinoDaRota("/login?modo=criar", true)).toBe("/fabrica");
  });

  it("o retorno do email e as APIs ficam abertos", () => {
    expect(destinoDaRota("/auth/callback", false)).toBe(SEGUE);
    expect(destinoDaRota("/api/mercadopago", false)).toBe(SEGUE);
  });

  it("a tela de senha nova fica aberta (link de recuperação)", () => {
    // Aberta pros dois: deslogado vê o "link expirou"; logado (sessão de
    // recuperação) troca a senha sem ser chutado pra fábrica.
    expect(destinoDaRota("/nova-senha", false)).toBe(SEGUE);
    expect(destinoDaRota("/nova-senha", true)).toBe(SEGUE);
  });
});

describe("rotaPublica: a '/' não pode virar prefixo de tudo", () => {
  it("abre só a raiz exata, não a fábrica inteira", () => {
    expect(rotaPublica("/")).toBe(true);
    expect(rotaPublica("/fabrica")).toBe(false);
    expect(rotaPublica("/novo")).toBe(false);
  });
});
