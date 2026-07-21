/**
 * O nome do cliente tem duas formas: a que aparece na tela (do jeito que ela
 * escreveu) e a que serve pra comparar (pra "Maria" e "maria" não virarem
 * dois clientes).
 */

/** Tira espaço das pontas e colapsa o do meio. */
function semEspacoSobrando(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

/** "  Maria   Silva " → "Maria Silva". É o que vai pra tela e pra notinha. */
export function nomeLimpo(nome: string): string {
  return semEspacoSobrando(nome);
}

/**
 * "  MARIA   SILVA " → "maria silva". Só pra comparar e deduplicar.
 *
 * Minúscula e nada além disso, DE PROPÓSITO: o índice único do banco é
 * `lower(nome)`. Se aqui tirasse acento e lá não, procurar "José" não
 * acharia a linha existente e o insert seguinte quebraria na unicidade.
 */
export function chaveDoCliente(nome: string): string {
  return semEspacoSobrando(nome).toLowerCase();
}
