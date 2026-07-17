"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/Marca";
import { IconeCadeado, IconeChave } from "@/components/Icones";

/**
 * Tela de senha nova. A pessoa chega aqui pelo link de "esqueci minha senha":
 * o /auth/callback já trocou o código do email por uma sessão, então aqui ela
 * só está logada o suficiente pra escolher a senha nova.
 */
export default function NovaSenhaPage() {
  const router = useRouter();
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Sem sessão de recuperação, não dá pra trocar nada. Isso acontece se o link
  // do email expirou ou já foi usado.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase().auth.getUser();
        if (vivo) setTemSessao(Boolean(data.user));
      } catch {
        if (vivo) setTemSessao(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar() {
    setErro("");
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 letrinhas.");
      return;
    }
    if (senha !== repete) {
      setErro("As duas senhas precisam ser iguais.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase().auth.updateUser({ password: senha });
      if (error) throw error;
      setPronto(true);
      // Dá um tempinho pra pessoa ler o "deu certo" e vai pra fábrica (que
      // devolve pro /planos quem ainda não assinou).
      setTimeout(() => {
        router.push("/fabrica");
        router.refresh();
      }, 1200);
    } catch (e: any) {
      setErro(
        String(e?.message ?? e).toLowerCase().includes("should be different")
          ? "Essa senha é igual à antiga. Escolhe uma diferente."
          : "Não consegui salvar. Tenta pedir o link de novo."
      );
      setSalvando(false);
    }
  }

  if (temSessao === null) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center">
        <Logo size={64} className="animate-wiggle" />
        <p className="mt-4 font-extrabold text-mute">Um segundinho...</p>
      </main>
    );
  }

  // Link velho / já usado: manda pedir outro.
  if (!temSessao) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center text-center">
        <div className="card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-borda bg-painel2 text-ciano">
            <IconeChave size={28} />
          </span>
          <h1 className="display mt-4 text-2xl font-bold text-tinta">
            Esse link não vale mais
          </h1>
          <p className="mt-1 font-bold text-mute">
            Links de senha valem por pouco tempo. Pede um novo na tela de
            entrar.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="btn-grande btn-neon mt-5 w-full text-xl"
          >
            Pedir outro link
          </button>
        </div>
      </main>
    );
  }

  if (pronto) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center text-center">
        <div className="card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-neon/40 bg-neon/10 text-neon">
            <IconeCadeado size={28} />
          </span>
          <h1 className="display mt-4 text-2xl font-bold text-tinta">
            Senha trocada! 🎉
          </h1>
          <p className="mt-1 font-bold text-mute">Já vou te levar pra dentro...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={64} />
        <h1 className="display mt-3 text-2xl font-bold text-tinta">
          Crie uma senha nova
        </h1>
        <p className="mt-1 font-bold text-mute">
          Escolha uma senha só sua, de pelo menos 6 letrinhas.
        </p>
      </div>

      <div className="card">
        <div className="mb-4">
          <label className="mb-1 block font-extrabold text-mute">
            Senha nova
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mínimo 6 letrinhas"
            className="w-full rounded-2xl border-2 border-borda bg-painel2 p-4 text-lg font-bold text-tinta outline-none focus:border-neon"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1 block font-extrabold text-mute">
            Repete a senha
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={repete}
            onChange={(e) => setRepete(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="a mesma coisa de novo"
            className="w-full rounded-2xl border-2 border-borda bg-painel2 p-4 text-lg font-bold text-tinta outline-none focus:border-neon"
          />
        </div>

        {erro && (
          <p className="mb-4 animate-pop rounded-2xl border border-perigo/40 bg-perigo/15 p-3 text-center font-extrabold text-perigo">
            {erro}
          </p>
        )}

        <button
          onClick={salvar}
          disabled={salvando}
          className="btn-grande btn-neon w-full text-xl disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar senha nova"}
        </button>
      </div>
    </main>
  );
}
