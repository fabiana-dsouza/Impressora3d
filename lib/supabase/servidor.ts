import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente do Supabase pro lado do servidor. Devolve null quando o .env.local
 * ainda não foi preenchido — aí a página trata como "ninguém logado".
 */
export function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component não pode escrever cookie. Tudo bem: o middleware
          // roda antes e já renovou a sessão nesta mesma requisição.
        }
      },
    },
  });
}

/** True quando tem alguém logado nesta requisição. */
export async function temSessao(): Promise<boolean> {
  const sb = supabaseServidor();
  if (!sb) return false;
  const { data } = await sb.auth.getUser();
  return Boolean(data.user);
}
