"use client";

import { useEffect, useState } from "react";
import TopoTela from "@/components/TopoTela";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import Dialogo from "@/components/Dialogo";
import { IconeLixeira, IconeMais } from "@/components/Icones";
import {
  lerCores,
  salvarCor as salvarCorDb,
  apagarCor as apagarCorDb,
} from "@/lib/db";
import { precoPorGrama } from "@/lib/calc";
import { brl, novoId } from "@/lib/format";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Cor, TipoCor } from "@/lib/types";

export default function MinhasCores() {
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [editando, setEditando] = useState<Cor | null>(null);
  const [apagando, setApagando] = useState<Cor | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const cs = await lerCores();
        if (vivo) setCores(cs);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  function falhou(e: unknown, anterior: Cor[]) {
    console.error(e);
    setCores(anterior);
    setAviso("Tenta de novo daqui a pouquinho!");
  }

  function salvarCor(cor: Cor) {
    const anterior = cores;
    const existe = cores.some((c) => c.id === cor.id);
    setCores(
      existe ? cores.map((c) => (c.id === cor.id ? cor : c)) : [...cores, cor]
    );
    setEditando(null);
    salvarCorDb(cor).catch((e) => falhou(e, anterior));
  }

  function apagar(id: string) {
    const anterior = cores;
    setCores(cores.filter((c) => c.id !== id));
    apagarCorDb(id).catch((e) => falhou(e, anterior));
  }

  function nova() {
    setEditando({
      id: novoId(),
      nome: "",
      hex: "#2563eb",
      tipo: "basica",
      precoRoloKg: 105,
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl">
      <TopoTela
        titulo="Minhas Cores"
        icone={<Carretel cor="#22d3ee" size={24} />}
        voltarPara="/"
      />

      <p className="mb-4 font-bold text-mute">
        Aqui ficam os seus filamentos! Cada cor tem o preço do rolo.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {cores.map((c) => (
          <div key={c.id} className="card caixa-valor flex flex-col items-center gap-2">
            <Carretel cor={c.hex} size={64} />
            <p className="display w-full break-words text-center text-lg font-bold leading-tight text-tinta">
              {c.nome}
            </p>
            <p className="text-center text-sm font-bold text-mute">
              {c.tipo === "especial" ? "✨ especial" : "básica"}
            </p>
            <div className="w-full space-y-0.5 text-center">
              <Valor
                valor={c.precoRoloKg}
                sufixo="/kg"
                max="0.875rem"
                className="block font-bold text-mute"
              />
              <Valor
                valor={precoPorGrama(c.precoRoloKg)}
                sufixo="/g"
                max="0.875rem"
                className="block font-bold text-neon"
              />
            </div>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setEditando(c)}
                aria-label={`Editar ${c.nome}`}
                className="btn-escuro rounded-lg px-3 py-1.5 text-sm font-extrabold"
              >
                Editar
              </button>
              <button
                onClick={() => setApagando(c)}
                aria-label={`Apagar ${c.nome}`}
                className="rounded-lg border border-perigo/30 bg-perigo/10 px-2.5 py-1.5 text-perigo active:scale-90"
              >
                <IconeLixeira size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={nova}
        className="btn-grande btn-neon mt-5 flex w-full items-center justify-center gap-2 text-xl"
      >
        <IconeMais size={20} /> Nova cor
      </button>

      {editando && (
        <EditorCor
          cor={editando}
          onSalvar={salvarCor}
          onCancelar={() => setEditando(null)}
        />
      )}

      {apagando && (
        <Dialogo
          tom="perigo"
          icone={<Carretel cor={apagando.hex} size={26} />}
          titulo={`Apagar a cor “${apagando.nome}”?`}
          texto="Os produtos que já usaram ela continuam do jeito que estão."
          confirmar="Sim, apagar"
          cancelar="Não, deixa"
          onConfirmar={() => apagar(apagando.id)}
          onFechar={() => setApagando(null)}
        />
      )}

      {aviso && (
        <Dialogo
          tom="perigo"
          titulo="Não consegui salvar"
          texto={aviso}
          onFechar={() => setAviso("")}
        />
      )}
    </main>
  );
}

function EditorCor({
  cor,
  onSalvar,
  onCancelar,
}: {
  cor: Cor;
  onSalvar: (c: Cor) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(cor.nome);
  const [hex, setHex] = useState(cor.hex);
  const [tipo, setTipo] = useState<TipoCor>(cor.tipo);
  const [preco, setPreco] = useState(String(cor.precoRoloKg));
  const [erro, setErro] = useState("");

  function confirmar() {
    if (!nome.trim()) {
      setErro("Dá um nome pra cor!");
      return;
    }
    onSalvar({
      ...cor,
      nome: nome.trim(),
      hex,
      tipo,
      precoRoloKg: Number(preco) || 0,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-3 sm:items-center">
      <div className="card my-auto w-full max-w-md animate-pop">
        <h2 className="display mb-4 text-center text-2xl font-bold text-tinta">
          Cor do filamento
        </h2>

        <div className="mb-4 flex items-center justify-center gap-4">
          <Carretel cor={hex} size={80} />
          <label className="btn-escuro cursor-pointer rounded-2xl px-4 py-3 font-extrabold">
            Escolher cor
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="ml-2 h-8 w-10 cursor-pointer bg-transparent align-middle"
            />
          </label>
        </div>

        <label className="mb-1 block font-extrabold text-mute">Nome</label>
        <input
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErro("");
          }}
          placeholder="Ex: Azul galaxy"
          className={`w-full rounded-2xl border-2 bg-painel2 p-3 text-lg font-bold text-tinta outline-none focus:border-neon ${
            erro ? "border-perigo" : "border-borda"
          }`}
        />
        {erro ? (
          <p className="mb-4 mt-1.5 animate-pop font-extrabold text-perigo">
            {erro}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        <label className="mb-1 block font-extrabold text-mute">Tipo</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTipo("basica")}
            className={`rounded-2xl border-2 p-3 font-extrabold ${
              tipo === "basica"
                ? "border-neon bg-neon/10 text-tinta"
                : "border-borda bg-painel2 text-mute"
            }`}
          >
            Básica
          </button>
          <button
            onClick={() => setTipo("especial")}
            className={`rounded-2xl border-2 p-3 font-extrabold ${
              tipo === "especial"
                ? "border-neon bg-neon/10 text-tinta"
                : "border-borda bg-painel2 text-mute"
            }`}
          >
            Especial
          </button>
        </div>

        <label className="mb-1 block font-extrabold text-mute">
          Preço do rolo (1 kg)
        </label>
        <div className="mb-2 flex items-center gap-2 rounded-2xl border-2 border-borda bg-painel2 px-3 focus-within:border-neon">
          <span className="shrink-0 text-lg font-extrabold text-mute">R$</span>
          <input
            type="number"
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className="valor w-full min-w-0 bg-transparent py-3 text-lg font-bold text-tinta outline-none"
          />
        </div>
        <p className="mb-5 text-sm font-bold text-mute">
          Isso dá {brl(precoPorGrama(Number(preco) || 0))} por grama.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            className="btn-grande btn-escuro flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            className="btn-grande btn-neon flex-1"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
