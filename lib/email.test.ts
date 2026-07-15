import { describe, it, expect } from "vitest";
import { normalizarGmail, emailGmailValido, nomeEmpresaValido } from "./email";

describe("normalizar gmail (evita conta duplicada)", () => {
  it("tira os pontos do nome", () => {
    expect(normalizarGmail("fabi.souza@gmail.com")).toBe("fabisouza@gmail.com");
    expect(normalizarGmail("f.a.b.i@gmail.com")).toBe("fabi@gmail.com");
  });

  it("tira o +apelido", () => {
    expect(normalizarGmail("fabisouza+teste@gmail.com")).toBe(
      "fabisouza@gmail.com"
    );
    expect(normalizarGmail("fabi.souza+loja@gmail.com")).toBe(
      "fabisouza@gmail.com"
    );
  });

  it("deixa tudo minúsculo e sem espaço", () => {
    expect(normalizarGmail("  FabiSouza@Gmail.COM ")).toBe(
      "fabisouza@gmail.com"
    );
  });

  it("googlemail.com vira gmail.com", () => {
    expect(normalizarGmail("fabi.souza@googlemail.com")).toBe(
      "fabisouza@gmail.com"
    );
  });

  it("as variações da MESMA pessoa viram o mesmo email", () => {
    const canonico = "fabisouza@gmail.com";
    for (const variacao of [
      "fabisouza@gmail.com",
      "fabi.souza@gmail.com",
      "f.a.b.i.s.o.u.z.a@gmail.com",
      "fabisouza+3d@gmail.com",
      "FABI.SOUZA+loja@GMAIL.com",
    ]) {
      expect(normalizarGmail(variacao)).toBe(canonico);
    }
  });

  it("não mexe em outros domínios", () => {
    expect(normalizarGmail("fabi.souza@outlook.com")).toBe(
      "fabi.souza@outlook.com"
    );
  });
});

describe("validar email @gmail.com", () => {
  it("aceita gmail de verdade", () => {
    expect(emailGmailValido("fabisouza@gmail.com")).toBe(true);
    expect(emailGmailValido("fabi.souza@gmail.com")).toBe(true);
    expect(emailGmailValido("fabi+loja@gmail.com")).toBe(true);
  });

  it("recusa quem não é gmail", () => {
    expect(emailGmailValido("fabi@outlook.com")).toBe(false);
    expect(emailGmailValido("fabi@hotmail.com")).toBe(false);
    expect(emailGmailValido("fabi@gmail.com.br")).toBe(false);
  });

  it("recusa coisa que não é email", () => {
    expect(emailGmailValido("fabi")).toBe(false);
    expect(emailGmailValido("")).toBe(false);
    expect(emailGmailValido("@gmail.com")).toBe(false);
    expect(emailGmailValido("ab@gmail.com")).toBe(false); // curto demais
    expect(emailGmailValido("fabi souza@gmail.com")).toBe(false); // espaço
  });
});

describe("validar nome da empresa", () => {
  it("aceita nomes normais", () => {
    expect(nomeEmpresaValido("Dino Prints")).toBe(true);
    expect(nomeEmpresaValido("3D")).toBe(true);
  });

  it("recusa vazio, curto ou gigante", () => {
    expect(nomeEmpresaValido("")).toBe(false);
    expect(nomeEmpresaValido("a")).toBe(false);
    expect(nomeEmpresaValido("x".repeat(31))).toBe(false);
  });

  it("recusa @ (senão confunde com email no login)", () => {
    expect(nomeEmpresaValido("loja@casa")).toBe(false);
  });
});
