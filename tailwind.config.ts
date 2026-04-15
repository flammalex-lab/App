import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#FDFBF7",
          secondary: "#F3EDE3",
        },
        ink: {
          primary: "#1A1A1A",
          secondary: "#6B6B6B",
        },
        brand: {
          green: "#2D5016",
          sage: "#7C956B",
        },
        accent: {
          gold: "#C4962C",
          rust: "#A0522D",
        },
        feedback: {
          error: "#C13A28",
          success: "#2D7A3A",
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
