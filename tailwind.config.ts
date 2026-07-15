import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
      colors: {
        // Tema "gamer escuro": fundo grafite, verde-neon como estrela.
        fundo: "#0b1220", // fundo da página
        painel: "#151d2e", // cards
        painel2: "#1b2740", // inputs / superfícies elevadas
        borda: "#28324c", // bordas sutis
        tinta: "#e8edf7", // texto principal
        mute: "#8a97b0", // texto secundário
        neon: "#4ade80", // verde-neon (lucro / CTA)
        ciano: "#22d3ee", // acento secundário
        perigo: "#f87171", // prejuízo
        // Aliases antigos (para classes remanescentes)
        grana: {
          verde: "#4ade80",
          azul: "#38bdf8",
          roxo: "#22d3ee",
          rosa: "#2dd4bf",
          laranja: "#fb923c",
          amarelo: "#facc15",
          aco: "#8a97b0",
          escuro: "#0b1220",
        },
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        pulseGlow: {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.15)" },
        },
      },
      animation: {
        pop: "pop 0.25s ease-out",
        wiggle: "wiggle 0.6s ease-in-out infinite",
        glow: "pulseGlow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
