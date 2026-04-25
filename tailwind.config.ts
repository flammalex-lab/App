import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#FFFFFF",   // pure white surface (Baldor-style)
          secondary: "#F4F4F1", // neutral wash for hovers / thumb placeholders
          tinted: "#EAF1F6",    // very faint blue tint, for highlights
        },
        ink: {
          primary: "#161616",
          secondary: "#5E5E5E",
          tertiary: "#9A9A9A",
        },
        // FLF brand — pulled from the logo (bright blue + bright green)
        brand: {
          blue: "#1763B5",       // primary action color
          "blue-dark": "#0F4A8A",// hover / pressed
          "blue-tint": "#E5EFF8",// 8% wash for selected states
          green: "#2A9B46",      // success / freshness
          "green-dark": "#1F7A35",
          "green-tint": "#E6F4EA",
          // legacy aliases for backwards compat (was forest green / sage)
          sage: "#7C956B",
        },
        accent: {
          gold: "#C49431",
          rust: "#A0522D",
        },
        feedback: {
          error: "#C13A28",
          success: "#2A9B46",
          warning: "#C49431",
        },
      },
      fontFamily: {
        // Bricolage Grotesque — geometric, has chunk, modern but not precious;
        // matches the bold/confident feel of the FLF logo
        display: ['"Bricolage Grotesque"', "Georgia", "serif"],
        serif: ['"Bricolage Grotesque"', "Georgia", "serif"], // alias for legacy
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.015em",
        tighter: "-0.025em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,22,22,0.04), 0 4px 12px rgba(22,22,22,0.06)",
        sticky: "0 -8px 24px rgba(22,22,22,0.06)",
        // Used on the sticky cart bar + dropdowns. Slightly stronger so
        // the floating element reads above the white surface.
        floating:
          "0 1px 2px rgba(22,22,22,0.06), 0 8px 24px rgba(22,22,22,0.10), 0 16px 40px rgba(22,22,22,0.06)",
      },
      transitionTimingFunction: {
        // Project-wide standards. Hover/press = quick ease-out;
        // state changes (modal open, slide-up) = the gentler curve below.
        fluent: "cubic-bezier(.2,.8,.2,1)",
      },
      transitionDuration: {
        150: "150ms",
        250: "250ms",
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 250ms cubic-bezier(.2,.8,.2,1)",
        "scale-in": "scale-in 200ms cubic-bezier(.2,.8,.2,1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.97)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
