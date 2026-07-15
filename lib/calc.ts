import type { Config, EntradaCalculo, ResultadoCalculo } from "./types";
import { MARGEM_MINIMA } from "./defaults";

/** Preço por grama a partir do preço do rolo (R$/kg). */
export function precoPorGrama(precoRoloKg: number): number {
  return precoRoloKg / 1000;
}

/** Custo de energia por hora (R$/h) a partir da potência (W) e tarifa (R$/kWh). */
export function custoEnergiaPorHora(potenciaWatts: number, tarifaKwh: number): number {
  return (potenciaWatts / 1000) * tarifaKwh;
}

/** Desgaste por hora (R$/h) = preço da impressora / vida útil em horas. */
export function desgastePorHora(precoImpressora: number, vidaUtilHoras: number): number {
  if (vidaUtilHoras <= 0) return 0;
  return precoImpressora / vidaUtilHoras;
}

/** Converte horas + minutos em horas decimais. */
export function horasDecimais(horas: number, minutos: number): number {
  return horas + minutos / 60;
}

/**
 * Trava rígida de margem: nunca abaixo de MARGEM_MINIMA (15%).
 * Também protege contra NaN/valores negativos.
 */
export function travarMargem(margem: number): number {
  if (!Number.isFinite(margem) || margem < MARGEM_MINIMA) return MARGEM_MINIMA;
  return margem;
}

/** Arredonda PARA CIMA em múltiplos de R$ 0,50. */
export function arredondarMeioReal(valor: number): number {
  return Math.ceil(valor / 0.5 - 1e-9) * 0.5;
}

/**
 * Calcula custos e preço de venda de um produto de impressão 3D.
 * Fórmulas conforme a especificação. Módulo puro, sem efeitos colaterais.
 */
export function calcular(entrada: EntradaCalculo): ResultadoCalculo {
  const margem = travarMargem(entrada.margem);
  const taxaMarketplace = clamp(entrada.taxaMarketplace, 0, 0.95);
  const taxaFalhas = Math.max(0, entrada.taxaFalhas);

  // Soma o material de todas as cores usadas.
  const custoMaterial = entrada.materiais.reduce(
    (soma, m) => soma + Math.max(0, m.gramas) * Math.max(0, m.precoPorGrama),
    0
  );
  const custoEnergia = entrada.horasDecimais * entrada.custoEnergiaPorHora;
  const custoDesgaste = entrada.horasDecimais * entrada.desgastePorHora;
  const custoExtras = Math.max(0, entrada.extras);

  const subtotal = custoMaterial + custoEnergia + custoDesgaste + custoExtras;
  const custoFalhas = subtotal * taxaFalhas;
  const custoTotal = subtotal + custoFalhas;

  const precoBase = custoTotal * (1 + margem);

  // A taxa do marketplace é embutida DEPOIS da margem, pra não comer o lucro.
  const precoComTaxa =
    taxaMarketplace > 0 ? precoBase / (1 - taxaMarketplace) : precoBase;

  let precoVenda = arredondarMeioReal(precoComTaxa);

  // Segurança: nunca deixar o preço de venda abaixo de custoTotal × 1,15.
  const pisoAbsoluto = custoTotal * (1 + MARGEM_MINIMA);
  if (precoVenda < pisoAbsoluto) {
    precoVenda = arredondarMeioReal(pisoAbsoluto);
  }

  const lucro = precoVenda - custoTotal - precoVenda * taxaMarketplace;

  return {
    custoMaterial,
    custoEnergia,
    custoDesgaste,
    custoExtras,
    subtotal,
    custoFalhas,
    custoTotal,
    precoBase,
    precoVenda,
    lucro,
  };
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** Helpers derivados da config, pra montar a EntradaCalculo nas telas. */
export function taxasDaConfig(config: Config) {
  return {
    custoEnergiaPorHora: custoEnergiaPorHora(config.potenciaWatts, config.tarifaKwh),
    desgastePorHora: desgastePorHora(config.precoImpressora, config.vidaUtilHoras),
  };
}
