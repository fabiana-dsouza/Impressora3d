/**
 * Regras de email da fabriquinha: só @gmail.com, e sem conta duplicada.
 *
 * IMPORTANTE: o Gmail IGNORA os pontos e tudo que vem depois do "+".
 * Ou seja, estas três são a MESMA caixa de entrada:
 *   fabi.souza@gmail.com
 *   fabisouza@gmail.com
 *   fabisouza+teste@gmail.com
 * Sem normalizar, a mesma pessoa criaria várias contas. Por isso a gente
 * guarda sempre a forma canônica (sem pontos, sem +tag).
 */

const DOMINIO = "gmail.com";

/** Deixa o email do Gmail na forma canônica (é assim que o Google enxerga). */
export function normalizarGmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return e;

  const local = e.slice(0, at);
  const dominio = e.slice(at + 1);

  // googlemail.com é apelido do gmail.com
  if (dominio !== DOMINIO && dominio !== "googlemail.com") return e;

  const semTag = local.split("+")[0];
  const semPontos = semTag.replace(/\./g, "");
  return `${semPontos}@${DOMINIO}`;
}

/** Só passa se for um @gmail.com com cara de email de verdade. */
export function emailGmailValido(email: string): boolean {
  const e = normalizarGmail(email);
  if (!e.endsWith(`@${DOMINIO}`)) return false;

  const local = e.slice(0, -(DOMINIO.length + 1));
  // depois de normalizar não sobra ponto nem +tag: só letras, números, _ e -
  return /^[a-z0-9_-]{3,30}$/.test(local);
}

/** Nome da empresa aceitável (o "@" atrapalharia o login por email). */
export function nomeEmpresaValido(nome: string): boolean {
  const n = nome.trim();
  return n.length >= 2 && n.length <= 30 && !n.includes("@");
}
