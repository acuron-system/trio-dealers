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
        background: "rgb(var(--bg-canvas) / <alpha-value>)",
        foreground: "rgb(var(--text-primary) / <alpha-value>)",
        canvas: "rgb(var(--bg-canvas) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
          subtle: "rgb(var(--bg-subtle) / <alpha-value>)",
          input: "rgb(var(--bg-input) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        edge: {
          DEFAULT: "rgb(var(--border-subtle) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        obsidian: {
          DEFAULT: "rgb(var(--bg-canvas) / <alpha-value>)",
          50: "rgb(var(--bg-subtle) / <alpha-value>)",
          100: "rgb(var(--bg-elevated) / <alpha-value>)",
          200: "rgb(var(--bg-surface) / <alpha-value>)",
          300: "rgb(var(--bg-surface) / <alpha-value>)",
          card: "rgb(var(--bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
          border: "rgb(var(--border-subtle) / <alpha-value>)",
        },
        gold: {
          50: "#FCF9EE",
          100: "#FBF3D5",
          200: "#F6E4A8",
          300: "#EED275",
          400: "rgb(var(--gold-readable) / <alpha-value>)",
          500: "#D4AF37",
          600: "#B89228",
          700: "#8F6A0E",
          800: "#6D5318",
          900: "#493712",
          accent: "#FFC72C",
          foil: "#F5D061",
          light: "#FFF4C2",
          antique: "#9E7E1D",
        },
        dark: {
          DEFAULT: "rgb(var(--bg-canvas) / <alpha-value>)",
          50: "rgb(var(--bg-subtle) / <alpha-value>)",
          100: "rgb(var(--bg-elevated) / <alpha-value>)",
          200: "rgb(var(--bg-surface) / <alpha-value>)",
          300: "rgb(var(--bg-surface) / <alpha-value>)",
          card: "rgb(var(--bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
          border: "rgb(var(--border-subtle) / <alpha-value>)",
          muted: "rgb(var(--bg-subtle) / <alpha-value>)",
        },
      },
      fontFamily: {
        royal: ["Cinzel", "Cinzel Decorative", "serif"],
        cinzel: ["Cinzel", "Cinzel Decorative", "serif"],
        heading: ["Montserrat", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #FFF1B0 0%, #D4AF37 40%, #997316 80%, #E5C158 100%)",
        "gold-metallic": "linear-gradient(135deg, #FFE890 0%, #D4AF37 35%, #8B6508 70%, #F5D061 100%)",
        "gold-radial": "var(--hero-radial)",
        "obsidian-gradient": "linear-gradient(180deg, rgb(var(--bg-surface)) 0%, rgb(var(--bg-canvas)) 100%)",
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(212, 175, 55, 0.04) 100%)",
      },
      boxShadow: {
        gold: "0 8px 25px -6px rgba(181, 137, 28, 0.25)",
        "gold-lg": "0 16px 40px -10px rgba(181, 137, 28, 0.35)",
        "gold-glow": "0 20px 60px -15px rgba(212, 175, 55, 0.28)",
        luxury: "var(--luxury-shadow)",
        "card-hover": "var(--card-hover-shadow)",
      },
      keyframes: {
        shimmer: {
          "100%": {
            transform: "translateX(100%)",
          },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s infinite",
        pulseSlow: "pulseSlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
