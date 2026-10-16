import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
    },
  },
  plugins: [],
};
export default config;
