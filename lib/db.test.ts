import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Produto } from "./types";

/* O client do Supabase é trocado por um de mentirinha: aqui o que interessa é
   COMO a gente traduz a recusa do banco, não a viagem até ele. */
const { getUser, from } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase/client", () => ({
  supabase: () => ({ auth: { getUser }, from }),
  supabaseConfigurado: () => true,
}));

import { criarProduto, SemAssinaturaError } from "./db";

const PRODUTO: Produto = {
  id: "p1",
  nome: "Chaveiro de dinossauro",
  coresIds: ["azul"],
  gramas: 20,
  unidade: "g",
  horas: 1,
  minutos: 0,
  margem: 0.6,
  precoVenda: 10,
  criadoEm: 0,
  vendidos: 0,
};

/** O que o Postgres devolve quando a policy de INSERT recusa a linha. */
const ERRO_RLS = {
  code: "42501",
  message: 'new row violates row-level security policy for table "produtos"',
};

function montarBanco({
  erroInsert = null as unknown,
  assinatura = null as unknown,
  erroAssinatura = null as unknown,
}) {
  from.mockImplementation((tabela: string) => {
    if (tabela === "produtos") {
      return { insert: () => Promise.resolve({ error: erroInsert }) };
    }
    if (tabela === "assinaturas") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: assinatura, error: erroAssinatura }),
          }),
        }),
      };
    }
    throw new Error(`tabela inesperada no teste: ${tabela}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});

describe("criarProduto: traduzir a recusa do banco", () => {
  it("salva quando o banco aceita", async () => {
    montarBanco({});
    await expect(criarProduto(PRODUTO)).resolves.toBeUndefined();
  });

  it("RLS + sem assinatura = SemAssinaturaError (o recado certo)", async () => {
    montarBanco({ erroInsert: ERRO_RLS, assinatura: null });
    await expect(criarProduto(PRODUTO)).rejects.toBeInstanceOf(
      SemAssinaturaError
    );
  });

  it("reconhece a RLS pela mensagem, mesmo sem o código", async () => {
    montarBanco({
      erroInsert: { message: "new row violates row-level security policy" },
      assinatura: null,
    });
    await expect(criarProduto(PRODUTO)).rejects.toBeInstanceOf(
      SemAssinaturaError
    );
  });

  it("assinatura vencida também conta como trancada", async () => {
    montarBanco({
      erroInsert: ERRO_RLS,
      assinatura: { status: "ativa", plano: "mensal", pago_ate: "2020-01-01" },
    });
    await expect(criarProduto(PRODUTO)).rejects.toBeInstanceOf(
      SemAssinaturaError
    );
  });

  /* As três abaixo são o ponto: não podemos acusar falta de pagamento de quem
     já pagou — seria mandar a criança assinar de novo por um bug nosso. */
  it("RLS mas a assinatura ESTÁ ativa: devolve o erro cru", async () => {
    montarBanco({
      erroInsert: ERRO_RLS,
      assinatura: { status: "ativa", plano: "anual", pago_ate: null },
    });
    await expect(criarProduto(PRODUTO)).rejects.toBe(ERRO_RLS);
  });

  it("RLS mas não deu pra conferir a assinatura: devolve o erro cru", async () => {
    montarBanco({
      erroInsert: ERRO_RLS,
      erroAssinatura: { message: "sem internet" },
    });
    await expect(criarProduto(PRODUTO)).rejects.toBe(ERRO_RLS);
  });

  it("erro que não é de RLS passa direto, sem nem olhar a assinatura", async () => {
    const outro = { code: "23505", message: "duplicate key value" };
    montarBanco({ erroInsert: outro });
    await expect(criarProduto(PRODUTO)).rejects.toBe(outro);
    expect(from).not.toHaveBeenCalledWith("assinaturas");
  });
});
