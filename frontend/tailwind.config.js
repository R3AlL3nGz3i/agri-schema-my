/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1a6b3c", light: "#2d9e5f", dark: "#0f4a28" },
        accent:  { DEFAULT: "#e8b84b", light: "#f5d07a" },
      },
    },
  },
  plugins: [],
}

