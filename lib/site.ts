/**
 * Onde este site está de pé — e se o mundo lá fora alcança ele.
 *
 * Mora aqui, e não dentro da rota, porque arquivo de rota do Next só pode
 * exportar os handlers (GET, POST...). Exportar um ajudante de lá compila no
 * `tsc` e só quebra no `next build`.
 */

/** Endereço que só existe na máquina de quem programa — o MP não alcança. */
export function ehLocal(site: string): boolean {
  try {
    const { hostname, protocol } = new URL(site);
    // Cuidado: `new URL("localhost:3000")` NÃO estoura — o JS lê "localhost:"
    // como protocolo e deixa o hostname vazio. Sem esta checagem, uma variável
    // escrita sem o "http://" passaria batida justo no caso que importa.
    if (protocol !== "http:" && protocol !== "https:") return true;
    if (!hostname) return true;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return true; // URL que nem dá pra ler não vai servir de back_url
  }
}
