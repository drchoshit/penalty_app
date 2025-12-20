/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#1f4d3a",
          green2: "#2a6b52",
          gold: "#c9a24d",
          gold2: "#e6cf9b",
          ivory: "#f7f4ef",
          ink: "#0f172a"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(0,0,0,0.10)"
      }
    }
  },
  plugins: []
};
