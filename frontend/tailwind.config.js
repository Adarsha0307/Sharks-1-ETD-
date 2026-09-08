/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14211d",
        paper: "#f5f3ec",
        panel: "#fffdf7",
        moss: "#1f5b49",
        amber: "#b45f18",
        danger: "#9f2f2f",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(20, 33, 29, 0.10)",
      },
    },
  },
  plugins: [],
};
