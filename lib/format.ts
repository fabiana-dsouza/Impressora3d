/** Formata um número como Real brasileiro: R$ 1.234,56 */
export function brl(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(valor) ? valor : 0);
}

/** Formata número simples com vírgula (ex: 0,105). */
export function num(valor: number, casas = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number.isFinite(valor) ? valor : 0);
}

/**
 * Gera um id único de verdade (UUID v4 do navegador).
 * Math.random() sozinho podia repetir; UUID não repete na prática.
 */
export function novoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Reserva pra navegador antigo / sem contexto seguro.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const b = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}
