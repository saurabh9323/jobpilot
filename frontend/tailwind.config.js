/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        brand: {
          50:  "#EEEDFE",
          100: "#D9D7FD",
          200: "#B3AEFB",
          300: "#8D86F8",
          400: "#7F77DD",
          500: "#6B62D4",
          600: "#534AB7",
          700: "#3C3489",
          800: "#28225C",
          900: "#14112E",
        },
      },
    },
  },
  plugins: [],
};
