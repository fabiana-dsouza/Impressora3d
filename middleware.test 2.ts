import { describe, it, expect, vi, beforeEach } from "vitest";

/* O Supabase é trocado por um de mentirinha pra dar pra testar "com sessão"
   sem precisar criar conta de verdade no banco de produção. */
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function pedir(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

function logado(sim: boolean) {
  getUser.mockResolvedValue({ data: { user: sim ? { id: "u1" } : null } });
}

/** Pra onde o middleware mandou? null = deixou passar. */
function paraOnde(r: Response): string | null {
  const destino = r.headers.get("location");
  return destino ? new URL(destino).pathname : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sem isto o middleware entra no caminho "supabase não configurado" e o
  // teste passaria pelo motivo errado.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://teste.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-de-teste";
});

describe("middleware: abrir o site cai na entrada", () => {
  it("deslogado vê a entrada", async () => {
    logado(false);
    expect(paraOnde(await middleware(pedir("/")))).toBeNull();
  });

  /* O que a usuária reportou duas vezes: logada, abria o site e era cuspida
     na fábrica sem nunca ver a própria vitrine. */
  it("LOGADO também vê a entrada", async () => {
    logado(true);
    expect(paraOnde(await middleware(pedir("/")))).toBeNull();
  });
});

describe("middleware: o resto das rotas", () => {
  it("deslogado na fábrica volta pra entrada", async () => {
    logado(false);
    expect(paraOnde(await middleware(pedir("/fabrica")))).toBe("/");
    expect(paraOnde(await middleware(pedir("/novo")))).toBe("/");
  });

  it("logado na fábrica passa", async () => {
    logado(true);
    expect(paraOnde(await middleware(pedir("/fabrica")))).toBeNull();
  });

  it("logado no login vai pra fábrica", async () => {
    logado(true);
    expect(paraOnde(await middleware(pedir("/login")))).toBe("/fabrica");
  });

  it("deslogado no login fica no login", async () => {
    logado(false);
    expect(paraOnde(await middleware(pedir("/login")))).toBeNull();
  });
});

describe("middleware: sem o .env.local preenchido", () => {
  it("a entrada continua abrindo, o resto vai pro passo a passo", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(paraOnde(await middleware(pedir("/")))).toBeNull();
    expect(paraOnde(await middleware(pedir("/fabrica")))).toBe("/login");
  });
});
