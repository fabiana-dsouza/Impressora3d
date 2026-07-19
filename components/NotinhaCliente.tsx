"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Dialogo from "./Dialogo";
import { desenharOrcamento } from "@/lib/notinha-desenho";
import { compartilharImagem, podeCompartilhar } from "@/lib/compartilhar";
import {
  nomeDoArquivo,
  textoDaNotinha,
  type DadosOrcamento,
} from "@/lib/orcamento";

/**
 * A notinha que vai pro cliente: um canvas desenhado na hora, mais o botão de
 * mandar. O canvas que aparece na tela é o MESMO que vira arquivo — não existe
 * "na tela estava bonito mas a foto saiu diferente".
 */
export default function NotinhaCliente({ dados }: { dados: DadosOrcamento }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [temBandeja, setTemBandeja] = useState(false);

  // Só depois de montar: no servidor não existe navigator, e decidir o texto
  // do botão durante o render quebraria a hidratação.
  useEffect(() => setTemBandeja(podeCompartilhar()), []);

  useEffect(() => {
    let vivo = true;
    const desenhar = () => {
      if (vivo && canvasRef.current) desenharOrcamento(canvasRef.current, dados);
    };
    desenhar();
    // As fontes vêm do Google Fonts. Se não esperar, a primeira pintura sai em
    // Arial e a notinha fica com cara de documento de banco.
    document.fonts?.ready.then(desenhar).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [dados]);

  const exportar = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || ocupado) return;
    setOcupado(true);
    try {
      await compartilharImagem(
        canvas,
        nomeDoArquivo(dados.produto),
        `Orçamento — ${dados.produto}`
      );
    } catch (e) {
      console.error(e);
      setErro(true);
    } finally {
      setOcupado(false);
    }
  }, [dados, ocupado]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={textoDaNotinha(dados)}
        className="block w-full"
      />

      <button
        onClick={exportar}
        disabled={ocupado}
        className="btn-grande btn-neon mt-6 w-full disabled:opacity-60"
      >
        {temBandeja ? "Mandar pro cliente" : "Baixar a notinha"}
      </button>

      {erro && (
        <Dialogo
          titulo="Não deu certo"
          texto="Não consegui preparar a notinha agora. Tenta de novo?"
          onFechar={() => setErro(false)}
        />
      )}
    </div>
  );
}
