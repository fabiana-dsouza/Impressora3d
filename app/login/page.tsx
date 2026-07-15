"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase/client";
import { emailDaEmpresa, empresaExiste } from "@/lib/db";
import { Logo } from "@/components/Marca";
import { IconeCadeado, IconeChave } from "@/components/Icones";
import {
  emailGmailValido,
  normalizarGmail,
  nomeEmpresaValido,
} from "@/lib/email";

type Modo = "entrar" | "criar";

/** Traduz os erros do Supabase pra linguagem de criança. */
function erroAmigavel(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Email/empresa ou senha errados. Tenta de novo!";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Esse email já tem conta! É só entrar.";
  if (m.includes("perfis_email_unico"))
    return "Esse Gmail já tem uma conta! É só entrar.";
  if (m.includes("perfis_nome_empresa_unico"))
    return "Já existe uma empresa com esse nome! Escolhe outro.";
  if (m.includes("@gmail.com") || m.includes("so aceitamos email"))
    return "Precisa ser um email @gmail.com de verdade.";
  // Erro do gatilho: quase sempre nome de empresa ou email repetido.
  if (m.includes("database error saving new user"))
    return "Esse nome de empresa ou esse Gmail já está em uso.";
  if (m.includes("duplicate") || m.includes("unique"))
    return "Já existe uma empresa com esse nome! Escolhe outro.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 letrinhas.";
  if (m.includes("email not confirmed"))
    return "Falta confirmar seu email! Olha sua caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Calma! Muitas tentativas. Espera um pouquinho.";
  // Banco ainda não preparado: schema.sql não foi rodado.
  if (
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("pgrst2") ||
    m.includes("relation") ||
    m.includes("function")
  )
    return "O banco ainda não está pronto! Rode o supabase/schema.sql no Supabase.";
  if (m.includes("failed to fetch") || m.includes("networkerror"))
    return "Sem internet? Não consegui falar com o servidor.";
  return `Algo deu errado (${msg})`;
}

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");

  const [empresa, setEmpresa] = useState(""); // usado no cadastro
  const [email, setEmail] = useState(""); // usado no cadastro
  const [login, setLogin] = useState(""); // usado no entrar (email OU empresa)
  const [senha, setSenha] = useState("");

  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  if (!supabaseConfigurado()) return <SetupSupabase />;

  function trocarModo(m: Modo) {
    setModo(m);
    setErro("");
    setAviso("");
  }

  async function entrar() {
    if (!login.trim() || !senha) {
      setErro("Preenche tudo pra entrar!");
      return;
    }
    setCarregando(true);
    try {
      const digitado = login.trim();
      let emailLogin: string;

      if (digitado.includes("@")) {
        // Digitou o email: normaliza (o Gmail ignora pontos e +apelido).
        emailLogin = normalizarGmail(digitado);
      } else {
        // Digitou o nome da empresa: o banco só devolve o email se a senha
        // estiver certa, então erro aqui = nome OU senha errados.
        const achado = await emailDaEmpresa(digitado, senha);
        if (!achado) {
          setErro("Empresa ou senha errada. Tenta de novo!");
          setCarregando(false);
          return;
        }
        emailLogin = achado;
      }

      const { error } = await supabase().auth.signInWithPassword({
        email: emailLogin,
        password: senha,
      });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setErro(erroAmigavel(String(e?.message ?? e)));
    } finally {
      setCarregando(false);
    }
  }

  async function criar() {
    setErro("");
    setAviso("");
    if (!empresa.trim()) {
      setErro("Dá um nome pra sua empresa!");
      return;
    }
    if (empresa.includes("@")) {
      setErro("O nome da empresa não pode ter @");
      return;
    }
    if (!nomeEmpresaValido(empresa)) {
      setErro("O nome da empresa tem que ter de 2 a 30 letrinhas");
      return;
    }
    if (!emailGmailValido(email)) {
      setErro("Precisa ser um email @gmail.com de verdade");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 letrinhas");
      return;
    }
    setCarregando(true);
    try {
      if (await empresaExiste(empresa.trim())) {
        setErro("Já existe uma empresa com esse nome! Escolhe outro.");
        setCarregando(false);
        return;
      }
      // Guarda o email na forma canônica: assim fabi.souza@ e fabisouza@
      // não viram duas contas diferentes.
      const { data, error } = await supabase().auth.signUp({
        email: normalizarGmail(email),
        password: senha,
        options: {
          data: { nome_empresa: empresa.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setAviso("Quase lá! Abra seu email e clique no link de confirmação.");
      }
    } catch (e: any) {
      setErro(erroAmigavel(String(e?.message ?? e)));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={72} />
        <h1 className="display mt-3 text-3xl font-bold uppercase tracking-wide text-tinta">
          Minha Startup
        </h1>
        <p className="mt-1 font-bold text-mute">
          sua fabriquinha de impressão 3D
        </p>
      </div>

      <div className="card">
        {/* Abas entrar / criar conta */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-borda bg-painel2 p-1">
          <button
            onClick={() => trocarModo("entrar")}
            className={`rounded-xl py-3 font-extrabold transition-colors ${
              modo === "entrar" ? "bg-neon text-fundo" : "text-mute"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => trocarModo("criar")}
            className={`rounded-xl py-3 font-extrabold transition-colors ${
              modo === "criar" ? "bg-neon text-fundo" : "text-mute"
            }`}
          >
            Criar conta
          </button>
        </div>

        {modo === "criar" ? (
          <>
            <Campo
              rotulo="Nome da sua empresa"
              value={empresa}
              onChange={setEmpresa}
              placeholder="Ex: Dino Prints"
            />
            <Campo
              rotulo="Email (tem que ser @gmail.com)"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="voce@gmail.com"
            />
            <Campo
              rotulo="Senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={setSenha}
              placeholder="mínimo 6 letrinhas"
              onEnter={criar}
            />
          </>
        ) : (
          <>
            <Campo
              rotulo="Email ou nome da empresa"
              value={login}
              onChange={setLogin}
              placeholder="voce@gmail.com ou Dino Prints"
            />
            <Campo
              rotulo="Senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={setSenha}
              placeholder="sua senha"
              onEnter={entrar}
            />
          </>
        )}

        {erro && (
          <p className="mb-4 animate-pop rounded-2xl border border-perigo/40 bg-perigo/15 p-3 text-center font-extrabold text-perigo">
            {erro}
          </p>
        )}
        {aviso && (
          <p className="mb-4 animate-pop rounded-2xl border border-ciano/40 bg-ciano/10 p-3 text-center font-extrabold text-ciano">
            {aviso}
          </p>
        )}

        <button
          onClick={modo === "entrar" ? entrar : criar}
          disabled={carregando}
          className="btn-grande btn-neon w-full text-xl disabled:opacity-60"
        >
          {carregando
            ? "Um segundinho..."
            : modo === "entrar"
            ? "Entrar"
            : "Criar minha conta"}
        </button>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm font-bold text-mute">
        <IconeCadeado size={15} />
        Seus produtos ficam guardados na nuvem, só você vê.
      </p>
    </main>
  );
}

function Campo({
  rotulo,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  onEnter,
}: {
  rotulo: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  onEnter?: () => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block font-extrabold text-mute">{rotulo}</label>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        className="w-full rounded-2xl border-2 border-borda bg-painel2 p-4 text-lg font-bold text-tinta outline-none focus:border-neon"
      />
    </div>
  );
}

/** Passo a passo mostrado enquanto o .env.local não está preenchido. */
function SetupSupabase() {
  return (
    <main className="mx-auto w-full max-w-xl py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-borda bg-painel2 text-ciano">
          <IconeChave size={30} />
        </span>
        <h1 className="display mt-3 text-2xl font-bold text-tinta">
          Falta ligar o banco de dados!
        </h1>
        <p className="mt-1 font-bold text-mute">
          3 passinhos e o app fica pronto (peça ajuda a um adulto):
        </p>
      </div>

      <div className="space-y-3">
        <div className="card">
          <p className="display font-bold text-neon">1. Criar o projeto</p>
          <p className="mt-1 font-bold text-mute">
            Entre em <span className="text-tinta">supabase.com</span>, crie uma
            conta grátis e um projeto novo.
          </p>
        </div>

        <div className="card">
          <p className="display font-bold text-neon">2. Criar as tabelas</p>
          <p className="mt-1 font-bold text-mute">
            No projeto, abra o <span className="text-tinta">SQL Editor</span>,
            cole o conteúdo do arquivo{" "}
            <code className="rounded bg-painel2 px-2 py-0.5 text-ciano">
              supabase/schema.sql
            </code>{" "}
            e clique em <span className="text-tinta">RUN</span>.
          </p>
        </div>

        <div className="card">
          <p className="display font-bold text-neon">3. Colar as chaves</p>
          <p className="mt-1 font-bold text-mute">
            Em <span className="text-tinta">Settings → API</span>, copie a URL e
            a chave <span className="text-tinta">anon public</span>. Crie um
            arquivo{" "}
            <code className="rounded bg-painel2 px-2 py-0.5 text-ciano">
              .env.local
            </code>{" "}
            na pasta do projeto:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-borda bg-painel2 p-3 text-sm font-bold text-tinta">
{`NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon`}
          </pre>
          <p className="mt-2 font-bold text-mute">
            Depois pare e rode de novo o{" "}
            <code className="rounded bg-painel2 px-2 py-0.5 text-ciano">
              npm run dev
            </code>
            . Prontinho! 🎉
          </p>
        </div>
      </div>
    </main>
  );
}
