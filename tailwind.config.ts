import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101010",
        panel: "#181717",
        line: "#2a2927",
        paper: "#f5f1e8",
        mint: "#49d7a0",
        coral: "#ff6b5f",
        gold: "#f4c95d"
      },
      boxShadow: {
        glow: "0 0 35px rgba(73, 215, 160, 0.18)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseLine: {
          "0%, 100%": { strokeOpacity: "0.45" },
          "50%": { strokeOpacity: "0.9" }
        }
      },
      animation: {
        floatIn: "floatIn 420ms ease-out both",
        pulseLine: "pulseLine 2.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
