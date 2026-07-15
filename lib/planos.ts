/**
 * Os planos da Calculadora. Os preços vivem SÓ aqui — a cobrança no
 * Mercado Pago é criada com estes valores, então mudar aqui muda pra
 * quem assinar depois (quem já assinou continua no preço antigo).
 */
export const PLANOS = {
  mensal: {
    nome: "Mensal",
    preco: 120,
    frequenciaMeses: 1,
    porMes: 120,
    legenda: "cobrado todo mês no cartão",
  },
  anual: {
    nome: "Anual",
    preco: 1200,
    frequenciaMeses: 12,
    porMes: 100,
    legenda: "12 meses pelo preço de 10 — 2 meses grátis",
  },
} as const;

export type PlanoId = keyof typeof PLANOS;

export function ehPlanoId(x: unknown): x is PlanoId {
  return x === "mensal" || x === "anual";
}
