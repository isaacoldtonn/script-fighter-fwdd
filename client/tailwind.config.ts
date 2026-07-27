import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "screen-shake": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-4px, -2px)" },
          "20%": { transform: "translate(4px, 2px)" },
          "30%": { transform: "translate(-4px, 2px)" },
          "40%": { transform: "translate(4px, -2px)" },
          "50%": { transform: "translate(-2px, 4px)" },
          "60%": { transform: "translate(2px, -4px)" },
          "70%": { transform: "translate(-4px, 0px)" },
          "80%": { transform: "translate(4px, 2px)" },
          "90%": { transform: "translate(-2px, -2px)" },
        },
        "hit-flash": {
          "0%, 100%": { opacity: "0" },
          "25%": { opacity: "1" },
          "50%": { opacity: "0" },
          "75%": { opacity: "1" },
        },
        "ko-appear": {
          "0%": { transform: "scale(0.2)", opacity: "0" },
          "60%": { transform: "scale(1.2)", opacity: "1" },
          "80%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "hp-pulse": {
          "0%, 100%": { boxShadow: "0 0 4px #FF2020" },
          "50%": { boxShadow: "0 0 16px #FF2020, 0 0 32px #FF0000" },
        },
      },
      animation: {
        "screen-shake": "screen-shake 0.5s ease-in-out",
        "hit-flash": "hit-flash 0.6s ease-in-out",
        "ko-appear": "ko-appear 0.6s ease-out forwards",
        "hp-pulse": "hp-pulse 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
