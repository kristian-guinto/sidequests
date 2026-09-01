import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        fuel: {
          solar: "#F59E0B",
          wind: "#10B981",
          hydro: "#3B82F6",
          geothermal: "#EC4899",
          biomass: "#8B5CF6",
          gas: "#F97316",
          coal: "#374151",
          oil: "#6B7280",
          battery: "#A855F7",
        }
      },
    },
  },
  plugins: [],
};
export default config;

