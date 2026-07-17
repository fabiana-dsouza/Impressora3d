"use client";

import { useEffect, useState } from "react";

const CORES = [
  "#AB9FF2", // lavanda da marca
  "#5B8DEF", // azul
  "#2FC98A", // menta
  "#FFC94D", // sol
  "#F49CC4", // rosa
  "#F2565C", // coral
];

interface Peca {
  id: number;
  left: number;
  cor: string;
  atraso: number;
  duracao: number;
  tamanho: number;
}

/** Chuva de confete. Passe `ativo` pra disparar. */
export default function Confete({ ativo }: { ativo: boolean }) {
  const [pecas, setPecas] = useState<Peca[]>([]);

  useEffect(() => {
    if (!ativo) {
      setPecas([]);
      return;
    }
    const novas: Peca[] = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      cor: CORES[i % CORES.length],
      atraso: Math.random() * 0.6,
      duracao: 1.8 + Math.random() * 1.4,
      tamanho: 8 + Math.random() * 8,
    }));
    setPecas(novas);
    const t = setTimeout(() => setPecas([]), 3600);
    return () => clearTimeout(t);
  }, [ativo]);

  if (pecas.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
      {pecas.map((p) => (
        <span
          key={p.id}
          className="confete"
          style={{
            left: `${p.left}%`,
            background: p.cor,
            width: p.tamanho,
            height: p.tamanho,
            animationDelay: `${p.atraso}s`,
            animationDuration: `${p.duracao}s`,
          }}
        />
      ))}
    </div>
  );
}
