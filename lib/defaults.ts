import type { Config, Cor } from "./types";

/** Margem mínima ABSOLUTA — trava rígida, nunca pode baixar disso. */
export const MARGEM_MINIMA = 0.15;

/**
 * Nome que aparece enquanto a empresa da pessoa não carregou.
 *
 * NÃO é o nome do produto (esse mora em lib/marca.ts). Os dois já foram a
 * mesma string, e por isso a notinha — que é da fábrica DELA — saía carimbada
 * com a nossa marca.
 */
export const EMPRESA_PADRAO = "Minha Fábrica";

export const CONFIG_PADRAO: Config = {
  potenciaWatts: 100, // A1 consome ~100 W
  tarifaKwh: 0.85, // R$ 0,85 por kWh
  precoImpressora: 5500, // R$ 5.500
  vidaUtilHoras: 5000, // 5.000 horas
  taxaFalhas: 0.1, // 10%
  margemPadrao: 1.0, // 100%
  custoEmbalagem: 3.0, // sempre R$ 3,00 de embalagem
};

export const CORES_PADRAO: Cor[] = [
  { id: "branco", nome: "Branco", hex: "#f1f5f9", tipo: "basica", precoRoloKg: 105 },
  { id: "preto", nome: "Preto", hex: "#0f172a", tipo: "basica", precoRoloKg: 105 },
  { id: "cinza", nome: "Cinza", hex: "#64748b", tipo: "basica", precoRoloKg: 105 },
  { id: "azul", nome: "Azul", hex: "#2563eb", tipo: "basica", precoRoloKg: 105 },
  { id: "vermelho", nome: "Vermelho", hex: "#dc2626", tipo: "basica", precoRoloKg: 105 },
  { id: "verde", nome: "Verde", hex: "#16a34a", tipo: "basica", precoRoloKg: 105 },
  { id: "amarelo", nome: "Amarelo", hex: "#eab308", tipo: "basica", precoRoloKg: 105 },
  { id: "laranja", nome: "Laranja", hex: "#f97316", tipo: "basica", precoRoloKg: 105 },
];
