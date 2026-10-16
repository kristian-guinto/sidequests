import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arcade: ["var(--font-arcade)", "monospace"],
        pixel: ["var(--font-pixel)", "monospace"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        trench: {
          surface: "#0f172a",
          twilight: "#0b132b",
          midnight: "#080c1f",
          abyss: "#040714",
          hadal: "#020308",
        },
        krillion: {
          gold: "#ffd166",
          cyan: "#4de3ff",
          purple: "#9d7bff",
          coral: "#ff5252",
          orange: "#ff9f43",
          plankton: "#8fa3c4",
        },
      },
      keyframes: {
        "bubble-rise": {
          "0%": { transform: "translateY(100%) scale(0.7)", opacity: "0" },
          "20%": { opacity: "0.8" },
          "80%": { opacity: "0.8" },
          "100%": { transform: "translateY(-120%) scale(1.1)", opacity: "0" },
        },
        "plunge-rush": {
          "0%": { transform: "translateY(50%)", opacity: "0.2" },
          "50%": { opacity: "0.9" },
          "100%": { transform: "translateY(-200%)", opacity: "0" },
        },
        "sonar-ping": {
          "0%": { transform: "scale(0.2)", opacity: "0.9" },
          "70%": { opacity: "0.35" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        "pixel-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "clown-wobble": {
          "0%, 100%": { transform: "rotate(0deg) translateY(0)" },
          "25%": { transform: "rotate(-8deg) translateY(-3px)" },
          "75%": { transform: "rotate(8deg) translateY(2px)" },
        },
        "krillion-shockwave": {
          "0%": { transform: "scale(1)", filter: "drop-shadow(0 0 0px #ffd166)" },
          "25%": { transform: "scale(1.15) rotate(-2deg)", filter: "drop-shadow(0 0 25px #ffd166)" },
          "50%": { transform: "scale(1.1) rotate(2deg)", filter: "drop-shadow(0 0 35px #ffd166)" },
          "75%": { transform: "scale(1.05) rotate(-1deg)", filter: "drop-shadow(0 0 20px #ffd166)" },
          "100%": { transform: "scale(1)", filter: "drop-shadow(0 0 10px #ffd166)" },
        },
      },
      animation: {
        "bubble-rise": "bubble-rise 6s ease-in infinite",
        "plunge-rush": "plunge-rush 0.5s linear infinite",
        "sonar-ping": "sonar-ping 3s cubic-bezier(0, 0.2, 0.8, 1) infinite",
        "pixel-bob": "pixel-bob 3s ease-in-out infinite",
        "clown-wobble": "clown-wobble 2s ease-in-out infinite",
        "krillion-shockwave": "krillion-shockwave 1.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
