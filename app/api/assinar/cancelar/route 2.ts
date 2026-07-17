import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cancelarPreapproval } from "@/lib/mercadopago";

/**
 * Cancela a assinatura do usuário logado: para as cobranças futuras no Mercado
 * Pago, mas mantém o acesso até o fim do período que já foi pago (o `pago_ate`
 * é preservado; a função assinatura_ativa() honra "cancelada dentro do prazo").
 */
export async function POST() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const mpToken = process.env.MP_ACCESS_TOKEN;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supaUrl || !supaKey || !serviceKey) {
    return NextResponse.json({ erro: "supabase-nao-configurado" }, { status: 500 });
  }
  if (!mpToken) {
    return NextResponse.json({ erro: "pagamentos-nao-configurados" }, { status: 501 });
  }

  // Quem está pedindo precisa estar logado.
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

  // Acha a assinatura da pessoa (a RLS já garante que é a dela).
  const { data: linha } = await supabase
    .from("assinaturas")
    .select("provedor_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const provedorId = linha?.provedor_id;
  // Sem provedor_id = cortesia da família ou nada pra cancelar.
  if (!provedorId) {
    return NextResponse.json({ erro: "sem-assinatura" }, { status: 400 });
  }
  if (linha?.status === "cancelada") {
    return NextResponse.json({ ok: true, ja: true });
  }

  // Manda o Mercado Pago parar as cobranças.
  const ok = await cancelarPreapproval(mpToken, String(provedorId));
  if (!ok) {
    return NextResponse.json({ erro: "mp-falhou" }, { status: 502 });
  }

  // Grava o cancelamento na hora (o webhook confirma depois). Preserva o
  // `pago_ate`: o acesso continua até o fim do período já pago.
  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin
    .from("assinaturas")
    .update({ status: "cancelada", atualizado_em: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) {
    console.error("Cancelar: MP aceitou mas o banco falhou", error);
    return NextResponse.json({ erro: "banco" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
