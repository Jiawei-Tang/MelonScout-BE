import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        detective: {
          green: "#10B981",
          black: "#0F172A",
          red: "#EF4444"
        }
      },
      boxShadow: {
        melon: "0 10px 35px -15px rgba(16, 185, 129, 0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
