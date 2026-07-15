"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconeVoltar } from "./Icones";

/** Cabeçalho reutilizável com botão de voltar e título grande. */
export default function TopoTela({
  titulo,
  icone,
  voltarPara,
}: {
  titulo: string;
  icone?: React.ReactNode;
  voltarPara?: string;
}) {
  const router = useRouter();
  const botao = (
    <span className="flex items-center justify-center">
      <IconeVoltar size={22} />
    </span>
  );

  return (
    <div className="mb-5 flex items-center gap-3">
      {voltarPara ? (
        <Link
          href={voltarPara}
          aria-label="Voltar"
          className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
        >
          {botao}
        </Link>
      ) : (
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
          className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
        >
          {botao}
        </button>
      )}
      {icone && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-borda bg-painel2 text-ciano">
          {icone}
        </span>
      )}
      <h1 className="display text-2xl font-bold leading-tight text-tinta">
        {titulo}
      </h1>
    </div>
  );
}
