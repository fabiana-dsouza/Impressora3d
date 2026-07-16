/**
 * A política de rotas do site, separada do middleware pra poder ser testada
 * sem precisar de uma sessão de verdade no Supabase.
 */

/**
 * Rotas abertas a quem não tem conta. A "/" fica de fora desta lista de
 * propósito: ela é prefixo de TUDO, então é comparada por igualdade.
 * As rotas /api validam a sessão sozinhas.
 */
const PUBLICAS = ["/login", "/auth", "/api"];

/** A entrada do site e o login são abertos; o resto é da fábrica. */
export function rotaPublica(pathname: string): boolean {
  return pathname === "/" || PUBLICAS.some((p) => pathname.startsWith(p));
}

/**
 * Pra onde mandar quem pediu `pathname`. `null` = deixa passar.
 *
 * A regra que mais importa aqui: abrir o site (`/`) mostra a entrada pra TODO
 * MUNDO, logado ou não. Já teve uma versão que chutava quem tinha sessão
 * direto pra /fabrica, e o dono do site nunca mais conseguiu ver a própria
 * vitrine sem deslogar.
 */
export function destinoDaRota(
  pathname: string,
  logado: boolean
): string | null {
  if (!logado && !rotaPublica(pathname)) return "/";
  if (logado && pathname.startsWith("/login")) return "/fabrica";
  return null;
}
