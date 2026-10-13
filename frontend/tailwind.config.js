/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#0f172a", soft: "#475569", muted: "#64748b" },
        brand: {
          50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 500: "#6366f1",
          600: "#4f46e5", 700: "#4338ca", 800: "#3730a3",
        },
      },
      boxShadow: { card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)" },
    },
  },
  plugins: [],
};
