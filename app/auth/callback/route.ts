import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Rota que recebe o link de confirmação de email do Supabase
 * e troca o código por uma sessão logada.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && url && key) {
    const cookieStore = cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Destino opcional (usado pelo link de "esqueci a senha", que precisa cair na
  // tela de senha nova em vez da fábrica). Só aceitamos um caminho INTERNO —
  // "/algo", nunca "//site.com" — pra ninguém transformar o link de email num
  // redirecionador pra fora.
  const next = searchParams.get("next");
  const destino =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/fabrica";

  // A fábrica devolve pro /planos quem ainda não pagou, então /fabrica é o
  // destino certo tanto pra conta nova quanto pra quem já assina.
  return NextResponse.redirect(`${origin}${destino}`);
}
