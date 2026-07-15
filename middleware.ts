import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que não exigem login (as rotas /api validam a sessão sozinhas). */
const PUBLICAS = ["/login", "/auth", "/api"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const ehPublica = PUBLICAS.some((p) => pathname.startsWith(p));

  // Supabase ainda não configurado: manda tudo pro /login,
  // que mostra o passo a passo de configuração.
  if (!url || !key) {
    if (ehPublica) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Revalida a sessão e mantém os cookies fresquinhos.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !ehPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
