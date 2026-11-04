/**
 * Brand palette, sampled from the two logos rather than invented:
 *  - CGIAR Multifunctional Landscapes lockup: #033529 (deep green, 52% of the
 *    mark) and #63c392 (mint, 39%), with #276a50 / #337c5d in between.
 *  - The soil-cube logo: the same greens over an earth ramp (#5a3c1f -> #c39a5c),
 *    which is where the `earth` scale comes from.
 *
 * `brand` carries the interface; `earth` is the secondary accent for data and
 * soil-related emphasis. Semantic colours (amber for warnings, red for errors)
 * stay on Tailwind's defaults so they keep reading as warnings and errors.
 */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d7ece0",
          200: "#aedfc6",
          300: "#86d3ab",
          400: "#63c392", // logo mint
          500: "#44a97a",
          600: "#337c5d", // logo mid
          700: "#276a50", // logo mid-dark
          800: "#14503c",
          900: "#033529", // logo deep green
        },
        earth: {
          50: "#faf4ea",
          100: "#f3e7d6",
          200: "#e2c9a1",
          300: "#c39a5c", // cube light soil
          400: "#a97b3f",
          500: "#9c6b34", // cube mid soil
          600: "#8a5c2d",
          700: "#7c5128", // cube dark soil
          800: "#6b4a2a",
          900: "#5a3c1f", // cube deepest soil
        },
      },
    },
  },
  plugins: [],
};
