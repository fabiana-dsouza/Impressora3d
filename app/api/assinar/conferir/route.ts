import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buscarPreapprovalDoUsuario,
  gravarAssinatura,
} from "@/lib/mercadopago";

/**
 * Pergunta pro Mercado Pago, na hora, se a assinatura do usuário logado já
 * está paga — e grava o resultado. Serve de rede de segurança pro webhook:
 * quem volta do pagamento não fica esperando um aviso que pode atrasar (ou que
 * ainda nem foi cadastrado no painel do MP). Se o webhook chegar depois, só
 * confirma o que já está gravado.
 */
export async function POST() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const mpToken = process.env.MP_ACCESS_TOKEN;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Sem o que é preciso, apenas diz "não confirmei" — a tela segue esperando.
  if (!supaUrl || !supaKey || !mpToken || !serviceKey) {
    return NextResponse.json({ ativa: false });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(supaUrl, supaKey, {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "sem-login" }, { status: 401 });
  }

  const preapproval = await buscarPreapprovalDoUsuario(mpToken, user.id);
  if (!preapproval) return NextResponse.json({ ativa: false });

  const resultado = await gravarAssinatura(supaUrl, serviceKey, preapproval);
  return NextResponse.json({
    ativa: "ativa" in resultado ? resultado.ativa : false,
  });
}
