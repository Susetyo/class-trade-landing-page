import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 80px rgba(141, 140, 89, 0.24)",
      },
    },
  },
  plugins: [],
};

export default config;
