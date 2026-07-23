"use client";

import { useEffect } from "react";
import { IconeAlerta } from "./Icones";

/**
 * A caixa de perguntar/avisar do app. Existe porque o confirm()/alert() do
 * navegador é uma caixa cinza do sistema — some no meio do visual da oficina e
 * ainda usa palavra de adulto ("OK", "Cancelar" em inglês em alguns celulares).
 *
 * Sem onConfirmar, vira só um aviso com um botão de fechar.
 */
export default function Dialogo({
  titulo,
  texto,
  icone,
  tom = "neutro",
  confirmar = "Pode apagar",
  cancelar = "Deixa quieto",
  secundario,
  dispensar,
  onConfirmar,
  onSecundario,
  onFechar,
  children,
}: {
  titulo: string;
  texto?: string;
  icone?: React.ReactNode;
  tom?: "neutro" | "perigo";
  confirmar?: string;
  cancelar?: string;
  /** Botão do meio que TAMBÉM decide algo (não é só fechar). Ex: "Ainda não". */
  secundario?: string;
  /**
   * Rótulo do único botão quando a caixa é só um menu (sem onConfirmar): troca
   * o "Entendi" verde por um botão neutro tipo "Deixa quieto" — pra caixa que
   * é uma lista de escolhas (os children), não um aviso pra confirmar leitura.
   */
  dispensar?: string;
  onConfirmar?: () => void;
  onSecundario?: () => void;
  onFechar: () => void;
  /** Conteúdo livre entre o texto e os botões — ex: um campo pra digitar. */
  children?: React.ReactNode;
}) {
  // Esc fecha, como em qualquer janelinha.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const perigo = tom === "perigo";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-3 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm animate-pop text-center"
      >
        {/* Selo redondo: dá o recado (perigo ou não) antes de a criança ler */}
        <span
          className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 ${
            perigo
              ? "border-perigo/40 bg-perigo/10 text-perigo"
              : "border-ciano/40 bg-ciano/10 text-ciano"
          }`}
        >
          {icone ?? <IconeAlerta size={26} />}
        </span>

        <h2 className="display text-xl font-bold leading-tight text-tinta">
          {titulo}
        </h2>
        {texto && <p className="mt-1.5 font-bold text-mute">{texto}</p>}
        {children && <div className="mt-4">{children}</div>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            // Só foca o botão quando não há conteúdo próprio (ex: um campo de
            // texto): se houver children, é ele quem deve ganhar o foco — numa
            // tela de digitar nome, é o teclado que tem que abrir, não o botão.
            autoFocus={!children}
            onClick={() => {
              onConfirmar?.();
              onFechar();
            }}
            className={`btn-grande flex-1 ${
              onConfirmar
                ? perigo
                  ? "btn-perigo"
                  : "btn-neon"
                : dispensar
                ? "btn-escuro"
                : "btn-neon"
            }`}
          >
            {onConfirmar ? confirmar : dispensar ?? "Entendi"}
          </button>
          {onSecundario ? (
            // Segundo botão que também decide algo (ex: "Ainda não" grava a
            // venda como não paga). Aqui desistir de vez é só pelo fundo ou Esc.
            <button
              onClick={() => {
                onSecundario();
                onFechar();
              }}
              className="btn-grande btn-escuro flex-1"
            >
              {secundario}
            </button>
          ) : (
            onConfirmar && (
              <button onClick={onFechar} className="btn-grande btn-escuro flex-1">
                {cancelar}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
